import { cn } from "@/lib/utils";

export function Checkbox({
  checked,
  onChange,
  label,
  description,
  id,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  description?: string;
  id: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <input
        id={id}
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 h-4 w-4 rounded border-stone-300 accent-brand-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
      />
      <div className="flex flex-col">
        <label htmlFor={id} className="text-sm font-medium text-stone-800">
          {label}
        </label>
        {description && (
          <p className="text-xs text-stone-500">{description}</p>
        )}
      </div>
    </div>
  );
}

export function Switch({
  checked,
  onChange,
  label,
  description,
  id,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  description?: string;
  id: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={cn(
          "mt-0.5 inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600",
          checked ? "bg-brand-600" : "bg-stone-300",
        )}
      >
        <span
          className={cn(
            "h-4 w-4 rounded-full bg-white shadow transition-transform",
            checked ? "translate-x-4" : "translate-x-0.5",
          )}
        />
      </button>
      <div className="flex flex-col">
        <label
          htmlFor={id}
          className="text-sm font-medium text-stone-800"
        >
          {label}
        </label>
        {description && (
          <p className="text-xs text-stone-500">{description}</p>
        )}
      </div>
    </div>
  );
}
