import { HTMLAttributes } from "react";
import { cn } from "@/lib/utils/cn";

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-[#255044] bg-[#102A22] shadow-[0_10px_40px_rgba(0,0,0,0.25)] transition-all duration-300 ease-out hover:border-[#2E8B57]/40 hover:shadow-[0_15px_40px_rgba(11,61,46,0.3)]",
        className,
      )}
      {...props}
    />
  );
}

export function CardHeader({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "flex flex-col gap-1 border-b border-[#255044]/60 bg-[#17382D]/40 px-6 py-4 rounded-t-2xl",
        className,
      )}
      {...props}
    />
  );
}

export function CardTitle({ className, ...props }: HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3
      className={cn("text-base font-semibold text-[#F5F7F6] tracking-tight", className)}
      {...props}
    />
  );
}

export function CardContent({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("px-6 py-5 text-[#C8D4CF]", className)} {...props} />;
}

