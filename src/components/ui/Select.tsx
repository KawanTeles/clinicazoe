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
          <label htmlFor={selectId} className="text-sm font-medium text-[#C8D4CF]">
            {label}
          </label>
        )}
        <select
          ref={ref}
          id={selectId}
          className={cn(
            "h-11 w-full rounded-xl border border-[#255044] bg-[#17382D] px-4 text-sm text-[#F5F7F6] transition-all duration-200 focus:border-[#2E8B57] focus:outline-none focus:ring-2 focus:ring-[#2E8B57]/30 [&>option]:bg-[#17382D] [&>option]:text-[#F5F7F6]",
            error && "border-[#DC4F4F] focus:border-[#DC4F4F] focus:ring-[#DC4F4F]/30",
            className,
          )}
          {...props}
        >
          {children}
        </select>
        {error && <span className="text-xs text-[#FF8A8A] font-medium">{error}</span>}
      </div>
    );
  },
);

Select.displayName = "Select";

