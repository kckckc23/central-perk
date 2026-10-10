import {
  Compass,
  MapPin,
  SlidersHorizontal,
  Users,
  Vote,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

export type StepId =
  | "people"
  | "location"
  | "preferences"
  | "discover"
  | "vote";

const STEPS: { id: StepId; label: string; icon: LucideIcon }[] = [
  { id: "people", label: "People", icon: Users },
  { id: "location", label: "Your location", icon: MapPin },
  { id: "preferences", label: "Preferences", icon: SlidersHorizontal },
  { id: "discover", label: "Discover", icon: Compass },
  { id: "vote", label: "Shortlist & vote", icon: Vote },
];

interface StepsNavProps {
  active: StepId;
  onSelect: (step: StepId) => void;
  readyCount: number;
  total: number;
  withLocation: number;
}

export function StepsNav({
  active,
  onSelect,
  readyCount,
  total,
  withLocation,
}: StepsNavProps) {
  return (
    <nav aria-label="Room steps">
      <div className="flex gap-1 overflow-x-auto rounded-xl border border-stone-200 bg-white p-1">
        {STEPS.map((step) => {
          const isActive = active === step.id;
          return (
            <button
              key={step.id}
              type="button"
              onClick={() => onSelect(step.id)}
              aria-current={isActive ? "step" : undefined}
              className={cn(
                "flex min-w-0 flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600",
                isActive
                  ? "bg-brand-600 text-white"
                  : "text-stone-600 hover:bg-stone-100",
              )}
            >
              <step.icon className="h-4 w-4 shrink-0" />
              <span className="truncate">{step.label}</span>
            </button>
          );
        })}
      </div>
      <p className="mt-2 text-xs text-stone-500">
        {readyCount} of {total} submitted preferences ·{" "}
        {withLocation} of {total} shared a location
      </p>
    </nav>
  );
}
