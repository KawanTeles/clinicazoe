import { InputHTMLAttributes, forwardRef } from "react";
import { cn } from "@/lib/utils/cn";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, id, ...props }, ref) => {
    const inputId = id ?? props.name;
    return (
      <div className="flex flex-col gap-1">
        {label && (
          <label htmlFor={inputId} className="text-[11px] font-bold uppercase tracking-wider text-text-secondary">
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={inputId}
          className={cn(
            "h-9.5 w-full rounded-lg border border-border bg-card-elevated px-3 text-xs font-medium text-text-primary placeholder:text-text-muted transition-all duration-200 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/25",
            error && "border-danger focus:border-danger focus:ring-danger/25",
            className,
          )}
          {...props}
        />
        {error && <span className="text-[11px] text-danger font-semibold">{error}</span>}
      </div>
    );
  },
);

Input.displayName = "Input";


