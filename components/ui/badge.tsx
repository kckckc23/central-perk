import * as React from "react";
import { cn } from "@/lib/utils";

const badgeVariants = {
  default: "bg-brand-100 text-brand-800",
  secondary: "bg-stone-100 text-stone-700",
  success: "bg-emerald-100 text-emerald-800",
  outline: "border border-stone-300 text-stone-600",
} as const;

export function Badge({
  className,
  variant = "default",
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & {
  variant?: keyof typeof badgeVariants;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium",
        badgeVariants[variant],
        className,
      )}
      {...props}
    />
  );
}
