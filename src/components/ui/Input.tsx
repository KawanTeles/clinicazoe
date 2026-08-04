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
      <div className="flex flex-col gap-1.5">
        {label && (
          <label htmlFor={inputId} className="text-sm font-medium text-[#C8D4CF]">
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={inputId}
          className={cn(
            "h-11 w-full rounded-xl border border-[#255044] bg-[#17382D] px-4 text-sm text-[#F5F7F6] placeholder:text-[#7A9187] transition-all duration-200 focus:border-[#2E8B57] focus:outline-none focus:ring-2 focus:ring-[#2E8B57]/30",
            error && "border-[#DC4F4F] focus:border-[#DC4F4F] focus:ring-[#DC4F4F]/30",
            className,
          )}
          {...props}
        />
        {error && <span className="text-xs text-[#FF8A8A] font-medium">{error}</span>}
      </div>
    );
  },
);

Input.displayName = "Input";

