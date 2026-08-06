import { TextareaHTMLAttributes, forwardRef } from "react";
import { cn } from "@/lib/utils/cn";

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, label, error, id, rows = 4, ...props }, ref) => {
    const textareaId = id ?? props.name;
    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label htmlFor={textareaId} className="text-[11px] font-bold uppercase tracking-wider text-text-secondary">
            {label}
          </label>
        )}
        <textarea
          ref={ref}
          id={textareaId}
          rows={rows}
          className={cn(
            "w-full resize-y rounded-xl border border-border bg-card-elevated px-3.5 py-2.5 text-xs font-medium leading-relaxed text-text-primary placeholder:text-text-muted transition-all duration-200 ease-out focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30 focus:shadow-[0_0_15px_rgba(15,118,110,0.15)]",
            error && "border-danger focus:border-danger focus:ring-danger/30 focus:shadow-[0_0_15px_rgba(220,38,38,0.15)]",
            className,
          )}
          {...props}
        />
        {error && <span className="text-[11px] text-danger font-semibold animate-fade-up">{error}</span>}
      </div>
    );
  },
);

Textarea.displayName = "Textarea";
