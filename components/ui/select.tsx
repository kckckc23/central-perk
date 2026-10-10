import { cn } from "@/lib/utils";

export function Select({
  value,
  onChange,
  options,
  id,
  label,
}: {
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
  id: string;
  label?: string;
}) {
  return (
    <div className="flex flex-col gap-1">
      {label && (
        <label htmlFor={id} className="text-sm font-medium text-stone-700">
          {label}
        </label>
      )}
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={cn(
          "h-10 w-full rounded-lg border border-stone-300 bg-white px-3 text-sm text-stone-900 focus:border-brand-500 focus:outline-2 focus:outline-offset-1 focus:outline-brand-600",
        )}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}
