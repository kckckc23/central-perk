import {
  createRecord,
  listRecords,
  pbRequest,
  PocketBaseError,
} from "@/lib/db/pocketbase";

/**
 * Collection definitions for PocketBase (v0.23+ schema format).
 *
 * Security model: all API rules are empty (default deny) because
 * every request goes through Next.js API routes with the
 * server-side superuser token. Authorisation is enforced in
 * the route handlers.
 *
 * Relations use cascadeDelete so deleting a room/participant
 * cleans up dependent records. Relation fields reference target
 * collections by id, so they are resolved at setup time
 * (after the target collections exist).
 */

type FieldSpec =
  | { kind: "text"; name: string; required: boolean; max: number | null }
  | { kind: "number"; name: string; required: boolean }
  | { kind: "bool"; name: string; required: boolean; default: boolean }
  | { kind: "json"; name: string; required: boolean }
  | { kind: "datetime"; name: string; required: boolean }
  | { kind: "relation"; name: string; target: "rooms" | "participants" };

interface CollectionDef {
  name: string;
  fields: FieldSpec[];
  indexes: string[];
}

const COLLECTIONS: CollectionDef[] = [
  {
    name: "rooms",
    fields: [
      { kind: "text", name: "name", required: true, max: 120 },
      { kind: "text", name: "token", required: true, max: 64 },
      { kind: "text", name: "slug", required: true, max: 160 },
      { kind: "text", name: "creator_participant_id", required: false, max: 64 },
      { kind: "datetime", name: "expires", required: true },
      { kind: "text", name: "status", required: true, max: 16 },
      { kind: "json", name: "selected_venue", required: false },
    ],
    indexes: [
      "CREATE UNIQUE INDEX `rooms_token_unique` ON `rooms` (`token`)",
      "CREATE UNIQUE INDEX `rooms_slug_unique` ON `rooms` (`slug`)",
    ],
  },
  {
    name: "participants",
    fields: [
      { kind: "relation", name: "room", target: "rooms" },
      { kind: "text", name: "display_name", required: true, max: 80 },
      { kind: "text", name: "token_hash", required: true, max: 128 },
      { kind: "bool", name: "is_host", required: false, default: false },
      { kind: "bool", name: "ready", required: false, default: false },
    ],
    indexes: [
      "CREATE UNIQUE INDEX `participants_token_hash_unique` ON `participants` (`token_hash`)",
    ],
  },
  {
    name: "private_locations",
    fields: [
      { kind: "relation", name: "participant", target: "participants" },
      { kind: "relation", name: "room", target: "rooms" },
      { kind: "text", name: "label", required: true, max: 200 },
      { kind: "number", name: "lat", required: true },
      { kind: "number", name: "lng", required: true },
      { kind: "text", name: "precision", required: true, max: 16 },
      { kind: "datetime", name: "updated", required: true },
    ],
    indexes: [
      "CREATE UNIQUE INDEX `private_locations_participant_unique` ON `private_locations` (`participant`)",
    ],
  },
  {
    name: "preferences",
    fields: [
      { kind: "relation", name: "participant", target: "participants" },
      { kind: "relation", name: "room", target: "rooms" },
      { kind: "json", name: "categories", required: true },
      { kind: "json", name: "cuisines", required: true },
      { kind: "number", name: "budget_min", required: false },
      { kind: "number", name: "budget_max", required: false },
      { kind: "bool", name: "budget_mandatory", required: false, default: false },
      { kind: "bool", name: "allow_unknown_price", required: false, default: true },
      { kind: "bool", name: "categories_mandatory", required: false, default: false },
      { kind: "number", name: "max_distance_km", required: false },
      { kind: "text", name: "travel_mode", required: true, max: 16 },
      { kind: "json", name: "optional", required: true },
      { kind: "datetime", name: "updated", required: true },
    ],
    indexes: [
      "CREATE UNIQUE INDEX `preferences_participant_unique` ON `preferences` (`participant`)",
    ],
  },
  {
    name: "room_votes",
    fields: [
      { kind: "relation", name: "room", target: "rooms" },
      { kind: "relation", name: "participant", target: "participants" },
      { kind: "text", name: "venue_id", required: true, max: 128 },
      { kind: "text", name: "value", required: true, max: 8 },
      { kind: "datetime", name: "updated", required: true },
    ],
    indexes: [
      "CREATE UNIQUE INDEX `room_votes_room_participant_unique` ON `room_votes` (`room`, `participant`)",
    ],
  },
  {
    name: "room_shortlist",
    fields: [
      { kind: "relation", name: "room", target: "rooms" },
      { kind: "text", name: "venue_id", required: true, max: 128 },
      { kind: "json", name: "venue", required: true },
      { kind: "relation", name: "added_by", target: "participants" },
      { kind: "datetime", name: "added", required: true },
    ],
    indexes: [
      "CREATE UNIQUE INDEX `room_shortlist_room_venue_unique` ON `room_shortlist` (`room`, `venue_id`)",
    ],
  },
];

let roomsId = "";
let participantsId = "";

function resolveField(
  spec: FieldSpec,
): Record<string, unknown> {
  switch (spec.kind) {
    case "text":
      return {
        name: spec.name,
        type: "text",
        required: spec.required,
        options: {
          min: spec.required ? 1 : null,
          max: spec.max,
          pattern: "",
        },
      };
    case "number":
      return {
        name: spec.name,
        type: "number",
        required: spec.required,
        options: { noDecimal: false, min: null, max: null },
      };
    case "bool":
      return {
        name: spec.name,
        type: "bool",
        required: spec.required,
        options: { default: spec.default },
      };
    case "json":
      return {
        name: spec.name,
        type: "json",
        required: spec.required,
        options: {},
      };
    case "datetime":
      return {
        name: spec.name,
        type: "datetime",
        required: spec.required,
        options: {},
      };
    case "relation": {
      const collectionId =
        spec.target === "rooms" ? roomsId : participantsId;
      if (!collectionId) {
        throw new Error(
          `Relation target "${spec.target}" is not set up yet`,
        );
      }
      return {
        name: spec.name,
        type: "relation",
        required: true,
        options: {
          collectionId,
          cascadeDelete: true,
          minSelect: null,
          maxSelect: null,
          displayFields: null,
        },
      };
    }
  }
}

let ensured = false;

/**
 * Creates or updates the required collections. Safe to call
 * on every request — the result is memoised until a failure
 * resets it.
 */
export async function ensureCollections(): Promise<void> {
  if (ensured) return;
  try {
    const existing = await pbRequest<{
      items: { id: string; name: string }[];
    }>("GET", "/api/collections", undefined, {
      page: "1",
      perPage: "200",
    });
    const byName = new Map(existing.items.map((c) => [c.name, c.id]));

    // First pass: create missing collections so relation
    // targets exist and their ids are known.
    for (const def of COLLECTIONS) {
      if (!byName.has(def.name)) {
        const created = await createCollection(def.name);
        byName.set(def.name, created.id);
      }
    }

    roomsId = byName.get("rooms") ?? "";
    participantsId = byName.get("participants") ?? "";
    if (!roomsId || !participantsId) {
      throw new Error("Could not resolve core collection ids");
    }

    // Second pass: (re)apply schemas so relation ids are correct.
    for (const def of COLLECTIONS) {
      const id = byName.get(def.name);
      if (!id) throw new Error(`Collection ${def.name} missing after create`);
      await pbRequest("PATCH", `/api/collections/${id}`, {
        fields: def.fields.map(resolveField),
        indexes: def.indexes,
      });
    }

    ensured = true;
  } catch (err) {
    // Retry on the next request (e.g. PocketBase not up yet).
    ensured = false;
    if (err instanceof PocketBaseError) throw err;
    throw new PocketBaseError(
      `Failed to initialise collections: ${err instanceof Error ? err.message : String(err)}`,
      500,
    );
  }
}

async function createCollection(
  name: string,
): Promise<{ id: string }> {
  return (await pbRequest<{ id: string }>("POST", "/api/collections", {
    name,
    type: "base",
    fields: [],
    indexes: [],
    listRule: "",
    viewRule: "",
    createRule: "",
    updateRule: "",
    deleteRule: "",
  })) as { id: string };
}

/** Test helper: resets the memoised "already ensured" flag. */
export function resetEnsureCollections(): void {
  ensured = false;
}

/** Test helper: clears cached collection ids. */
export function resetCollectionIds(): void {
  roomsId = "";
  participantsId = "";
}
