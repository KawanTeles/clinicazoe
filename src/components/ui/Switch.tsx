import { InputHTMLAttributes, forwardRef } from "react";
import { cn } from "@/lib/utils/cn";

interface SwitchProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "onChange"> {
  label?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}

export const Switch = forwardRef<HTMLInputElement, SwitchProps>(
  ({ className, label, checked, onChange, disabled, id, name, ...props }, ref) => {
    const inputId = id ?? name;
    return (
      <label
        htmlFor={inputId}
        className={cn(
          "inline-flex items-center gap-2.5 select-none",
          disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer",
        )}
      >
        <input
          ref={ref}
          id={inputId}
          name={name}
          type="checkbox"
          role="switch"
          aria-checked={checked}
          checked={checked}
          disabled={disabled}
          onChange={(event) => onChange(event.target.checked)}
          className="peer sr-only"
          {...props}
        />
        <span
          className={cn(
            "relative h-6 w-11 shrink-0 rounded-full border border-border bg-card-elevated transition-colors duration-200 ease-out",
            "peer-checked:border-primary peer-checked:bg-primary",
            "peer-focus-visible:ring-2 peer-focus-visible:ring-primary/40 peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-background",
            className,
          )}
        >
          <span
            className={cn(
              "absolute top-0.5 left-0.5 h-4.5 w-4.5 rounded-full bg-white shadow-sm transition-transform duration-200 ease-out",
              checked && "translate-x-5",
            )}
          />
        </span>
        {label && <span className="text-xs font-semibold text-text-primary">{label}</span>}
      </label>
    );
  },
);

Switch.displayName = "Switch";
