import { SelectHTMLAttributes, forwardRef } from "react";
import { cn } from "@/lib/utils/cn";

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, label, error, id, children, ...props }, ref) => {
    const selectId = id ?? props.name;
    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label htmlFor={selectId} className="text-sm font-medium text-text-secondary">
            {label}
          </label>
        )}
        <select
          ref={ref}
          id={selectId}
          className={cn(
            "h-11 w-full rounded-xl border border-border bg-card-elevated px-4 text-sm text-text-primary transition-all duration-200 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30 [&>option]:bg-card-elevated [&>option]:text-text-primary",
            error && "border-danger focus:border-danger focus:ring-danger/30",
            className,
          )}
          {...props}
        >
          {children}
        </select>
        {error && <span className="text-xs text-danger font-medium">{error}</span>}
      </div>
    );
  },
);

Select.displayName = "Select";

