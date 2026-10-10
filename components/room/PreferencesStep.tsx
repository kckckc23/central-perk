"use client";

import { useState } from "react";
import { CheckCircle2, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox, Switch } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/components/ui/toaster";
import {
  ANYTHING_CATEGORY_ID,
  CATEGORIES,
  CUISINES,
  OPTIONAL_PREFS,
} from "@/lib/venues/categories";
import type {
  ParticipantPreferences,
  RoomState,
  TravelMode,
} from "@/types";

const BUDGET_OPTIONS = [
  {
    id: "flexible",
    label: "Flexible",
    min: null,
    max: null,
  },
  { id: "under200", label: "Under ₹200", min: null, max: 200 },
  { id: "200to500", label: "₹200 – ₹500", min: 200, max: 500 },
  {
    id: "500to1000",
    label: "₹500 – ₹1,000",
    min: 500,
    max: 1000,
  },
] as const;

function budgetOptionFor(
  prefs: ParticipantPreferences | null,
): string {
  if (!prefs || (prefs.budgetMin == null && prefs.budgetMax == null)) {
    return "flexible";
  }
  return (
    BUDGET_OPTIONS.find(
      (o) => o.min === prefs.budgetMin && o.max === prefs.budgetMax,
    )?.id ?? "flexible"
  );
}

const defaultPreferences = (): ParticipantPreferences => ({
  participantId: "",
  categories: [],
  cuisines: [],
  budgetMin: null,
  budgetMax: null,
  budgetMandatory: false,
  allowUnknownPrice: true,
  categoriesMandatory: false,
  maxDistanceKm: null,
  travelMode: "foot",
  optional: [],
  updated: "",
});

export function PreferencesStep({
  state,
  onChanged,
}: {
  state: RoomState;
  onChanged: () => void;
}) {
  const toast = useToast();
  const existing = state.myPreferences;
  const [prefs, setPrefs] = useState<ParticipantPreferences>(
    existing
      ? { ...existing }
      : { ...defaultPreferences() },
  );
  const [budgetOption, setBudgetOption] = useState<string>(
    budgetOptionFor(existing),
  );
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const update = (patch: Partial<ParticipantPreferences>) => {
    setPrefs((current) => ({ ...current, ...patch }));
    setSaved(false);
  };

  function toggleCategory(id: string) {
    const current = prefs.categories;
    if (id === ANYTHING_CATEGORY_ID) {
      update({ categories: current.includes(id) ? [] : [id] });
      return;
    }
    const withoutAnything = current.filter(
      (c) => c !== ANYTHING_CATEGORY_ID,
    );
    update({
      categories: current.includes(id)
        ? current.filter((c) => c !== id)
        : [...withoutAnything, id],
    });
  }

  function toggleArrayItem(
    key: "cuisines" | "optional",
    id: string,
  ) {
    update({
      [key]: prefs[key].includes(id)
        ? prefs[key].filter((x) => x !== id)
        : [...prefs[key], id],
    } as Partial<ParticipantPreferences>);
  }

  function applyBudget(optionId: string) {
    setBudgetOption(optionId);
    const option = BUDGET_OPTIONS.find((o) => o.id === optionId);
    update({
      budgetMin: option?.min ?? null,
      budgetMax: option?.max ?? null,
    });
  }

  async function save() {
    setSaving(true);
    try {
      const res = await fetch(
        `/api/rooms/${state.room.token}/preferences`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            categories: prefs.categories,
            cuisines: prefs.cuisines,
            budgetMin: prefs.budgetMin,
            budgetMax: prefs.budgetMax,
            budgetMandatory: prefs.budgetMandatory,
            allowUnknownPrice: prefs.allowUnknownPrice,
            categoriesMandatory: prefs.categoriesMandatory,
            maxDistanceKm: prefs.maxDistanceKm,
            travelMode: prefs.travelMode,
            optional: prefs.optional,
          }),
        },
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not save");
      toast("Preferences saved", "success");
      setSaved(true);
      onChanged();
    } catch (err) {
      toast(
        err instanceof Error ? err.message : "Could not save",
        "error",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card className="flex flex-col gap-6">
      <div>
        <h2 className="mb-1 text-base font-semibold text-stone-900">
          Your preferences
        </h2>
        <p className="text-sm text-stone-600">
          Skip anything you don&apos;t care about. Mark a
          filter as required to make it a hard constraint.
        </p>
      </div>

      <section className="flex flex-col gap-2">
        <h3 className="text-sm font-semibold text-stone-800">
          Place types
        </h3>
        <div className="grid gap-2 sm:grid-cols-2">
          <Checkbox
            id="cat-anything"
            label="Anything is fine"
            description="No preference on place type"
            checked={prefs.categories.includes(
              ANYTHING_CATEGORY_ID,
            )}
            onChange={() => toggleCategory(ANYTHING_CATEGORY_ID)}
          />
          {CATEGORIES.map((category) => (
            <Checkbox
              key={category.id}
              id={`cat-${category.id}`}
              label={category.label}
              description={category.description}
              checked={prefs.categories.includes(category.id)}
              onChange={() => toggleCategory(category.id)}
            />
          ))}
        </div>
        <Switch
          id="categories-mandatory"
          label="Place types are required"
          description="Venues matching none of your selected types are excluded."
          checked={prefs.categoriesMandatory}
          onChange={(checked) =>
            update({ categoriesMandatory: checked })
          }
        />
      </section>

      <Separator />

      <section className="flex flex-col gap-2">
        <h3 className="text-sm font-semibold text-stone-800">
          Cuisines <span className="font-normal text-stone-500">(optional)</span>
        </h3>
        <div className="grid gap-2 sm:grid-cols-2">
          {CUISINES.map((cuisine) => (
            <Checkbox
              key={cuisine.id}
              id={`cuisine-${cuisine.id}`}
              label={cuisine.label}
              checked={prefs.cuisines.includes(cuisine.id)}
              onChange={() => toggleArrayItem("cuisines", cuisine.id)}
            />
          ))}
        </div>
      </section>

      <Separator />

      <section className="flex flex-col gap-3">
        <h3 className="text-sm font-semibold text-stone-800">
          Budget per person (INR)
        </h3>
        <div className="grid gap-2 sm:grid-cols-2">
          {BUDGET_OPTIONS.map((option) => (
            <label
              key={option.id}
              className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm ${
                budgetOption === option.id
                  ? "border-brand-500 bg-brand-50 font-medium text-brand-900"
                  : "border-stone-200 text-stone-700"
              }`}
            >
              <input
                type="radio"
                name="budget"
                className="accent-brand-600"
                checked={budgetOption === option.id}
                onChange={() => applyBudget(option.id)}
              />
              {option.label}
            </label>
          ))}
        </div>
        <Switch
          id="budget-mandatory"
          label="Budget is required"
          description="Venues over your maximum are excluded. Venues with unknown prices stay unless you disallow them."
          checked={prefs.budgetMandatory}
          onChange={(checked) => update({ budgetMandatory: checked })}
        />
        <Switch
          id="allow-unknown-price"
          label="Allow venues with unknown price"
          description="OpenStreetMap rarely includes prices. Turn off to exclude venues without a price tag."
          checked={prefs.allowUnknownPrice}
          onChange={(checked) =>
            update({ allowUnknownPrice: checked })
          }
        />
      </section>

      <Separator />

      <section className="flex flex-col gap-3">
        <h3 className="text-sm font-semibold text-stone-800">
          Travel
        </h3>
        <div className="grid gap-3 sm:grid-cols-2">
          <Select
            id="travel-mode"
            label="Travel mode"
            value={prefs.travelMode}
            onChange={(value) =>
              update({ travelMode: value as TravelMode })
            }
            options={[
              { value: "foot", label: "Walking" },
              { value: "bike", label: "Cycling" },
              { value: "car", label: "Driving" },
            ]}
          />
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="max-distance">
              Max straight-line distance (km)
            </Label>
            <Input
              id="max-distance"
              type="number"
              min={0.1}
              max={100}
              step={0.5}
              value={prefs.maxDistanceKm ?? ""}
              placeholder="No limit"
              onChange={(e) =>
                update({
                  maxDistanceKm:
                    e.target.value === ""
                      ? null
                      : Number(e.target.value),
                })
              }
            />
            <p className="text-xs text-stone-500">
              Straight-line estimate — actual travel may be
              longer.
            </p>
          </div>
        </div>
      </section>

      <Separator />

      <section className="flex flex-col gap-2">
        <h3 className="text-sm font-semibold text-stone-800">
          Nice to have <span className="font-normal text-stone-500">(optional)</span>
        </h3>
        <div className="grid gap-2 sm:grid-cols-2">
          {OPTIONAL_PREFS.map((pref) => (
            <Checkbox
              key={pref.id}
              id={`optional-${pref.id}`}
              label={pref.label}
              checked={prefs.optional.includes(pref.id)}
              onChange={() => toggleArrayItem("optional", pref.id)}
            />
          ))}
        </div>
      </section>

      <div className="flex items-center gap-3">
        <Button onClick={save} disabled={saving}>
          {saving ? (
            "Saving…"
          ) : (
            <>
              <Save className="h-4 w-4" /> Save preferences
            </>
          )}
        </Button>
        {saved && (
          <span className="flex items-center gap-1 text-sm text-emerald-700">
            <CheckCircle2 className="h-4 w-4" /> Saved
          </span>
        )}
      </div>
    </Card>
  );
}
