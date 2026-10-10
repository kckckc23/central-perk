export interface LatLng {
  lat: number;
  lng: number;
}

export type LocationPrecision = "gps" | "search" | "pin";

export type TravelMode = "foot" | "bike" | "car";

export type RoomStatus = "open" | "closed";

export type VoteValue = "yes" | "no";

export interface Room {
  id: string;
  /** Unguessable token used in the shareable URL. */
  token: string;
  slug: string;
  name: string;
  creatorParticipantId: string | null;
  created: string;
  expires: string;
  status: RoomStatus;
  selectedVenue: Venue | null;
}

export interface Participant {
  id: string;
  roomId: string;
  displayName: string;
  isHost: boolean;
  ready: boolean;
  joined: string;
}

export interface ParticipantPrivateLocation {
  participantId: string;
  label: string;
  lat: number;
  lng: number;
  precision: LocationPrecision;
  updated: string;
}

export interface ParticipantPreferences {
  participantId: string;
  categories: string[];
  cuisines: string[];
  budgetMin: number | null;
  budgetMax: number | null;
  budgetMandatory: boolean;
  allowUnknownPrice: boolean;
  categoriesMandatory: boolean;
  maxDistanceKm: number | null;
  travelMode: TravelMode;
  optional: string[];
  updated: string;
}

/** Normalised venue model, independent of the source provider. */
export interface Venue {
  /** Stable id, e.g. "node/12345" for OSM objects or "demo/3" for demo data. */
  id: string;
  osmType?: "node" | "way" | "relation";
  osmId?: number;
  name: string;
  /** Primary category id from the category mapping (e.g. "cafe"). */
  category: string;
  /** All matched category ids. */
  categories: string[];
  lat: number;
  lng: number;
  address?: string;
  cuisine?: string[];
  openingHours?: string;
  website?: string;
  phone?: string;
  /** Per-person price estimate in local currency when a trustworthy tag exists. */
  price: number | null;
  accessibility?: string | null;
  outdoorSeating: boolean | null;
  /** Raw source tags, kept for debugging/extensibility. Never log to console. */
  tags: Record<string, string>;
  /** True when the record comes from the built-in demo data set. */
  demo?: boolean;
}

export interface TravelEstimate {
  participantId: string;
  displayName: string;
  distanceKm: number;
  /** Only present when a real routing engine supplied it. */
  durationMin: number | null;
  mode: TravelMode;
  /** True for straight-line (haversine) results — must be shown as such. */
  isStraightLine: boolean;
}

export interface VenueScore {
  total: number;
  travel: number;
  preference: number;
  completeness: number;
  explanations: string[];
}

export interface RankedVenue extends Venue {
  score: VenueScore;
  travel: TravelEstimate[];
}

export interface ShortlistEntry {
  roomId: string;
  venueId: string;
  venue: Venue;
  addedBy: string;
  addedByDisplayName: string;
  added: string;
  votes: { participantId: string; displayName: string; value: VoteValue; updated: string }[];
  /** Straight-line distance from the viewer's own location, when known. */
  myDistanceKm?: number;
}

export interface RoomState {
  room: Room;
  myParticipantId: string | null;
  /** The requesting participant's own location (never anyone else's). */
  myLocation: { label: string; lat: number; lng: number } | null;
  /** The requesting participant's own preferences, if saved. */
  myPreferences: ParticipantPreferences | null;
  participants: (Participant & { hasLocation: boolean; hasPreferences: boolean })[];
  shortlist: ShortlistEntry[];
  totalParticipants: number;
}

export interface GeocodingResult {
  label: string;
  lat: number;
  lng: number;
  /** e.g. "Berlin, Germany" — area context from the geocoder. */
  context?: string;
}

export interface ProviderStatus {
  geocodingConfigured: boolean;
  venuesConfigured: boolean;
  routingProvider: "haversine" | "valhalla" | "osrm";
}
