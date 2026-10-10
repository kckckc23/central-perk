import { cn } from "@/lib/utils";

const AVATAR_COLORS = [
  "bg-amber-200 text-amber-900",
  "bg-sky-200 text-sky-900",
  "bg-emerald-200 text-emerald-900",
  "bg-rose-200 text-rose-900",
  "bg-violet-200 text-violet-900",
  "bg-teal-200 text-teal-900",
];

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

function colorFor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  }
  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
}

export function Avatar({
  name,
  className,
}: {
  name: string;
  className?: string;
}) {
  return (
    <span
      aria-hidden
      className={cn(
        "inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
        colorFor(name),
        className,
      )}
    >
      {initials(name) || "?"}
    </span>
  );
}
