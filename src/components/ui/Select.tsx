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
      <div className="flex flex-col gap-1">
        {label && (
          <label htmlFor={selectId} className="text-[11px] font-bold uppercase tracking-wider text-text-secondary">
            {label}
          </label>
        )}
        <select
          ref={ref}
          id={selectId}
          className={cn(
            "h-9.5 w-full rounded-lg border border-border bg-card-elevated px-3 text-xs font-medium text-text-primary transition-all duration-200 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/25 [&>option]:bg-card-elevated [&>option]:text-text-primary",
            error && "border-danger focus:border-danger focus:ring-danger/25",
            className,
          )}
          {...props}
        >
          {children}
        </select>
        {error && <span className="text-[11px] text-danger font-semibold">{error}</span>}
      </div>
    );
  },
);

Select.displayName = "Select";


