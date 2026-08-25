import { HTMLAttributes } from "react";
import { cn } from "@/lib/utils/cn";

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-border/80 bg-card/95 bg-gradient-to-br from-card to-card-elevated/30 backdrop-blur-sm shadow-[var(--shadow-card)] transition-all duration-300 ease-[var(--ease-premium)] transform-gpu hover:border-primary/40 hover:shadow-[var(--shadow-card-hover)] hover:-translate-y-1 relative overflow-hidden",
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
        "flex flex-col gap-1 border-b border-border/60 bg-card-elevated/40 px-6 py-4 rounded-t-2xl",
        className,
      )}
      {...props}
    />
  );
}

export function CardTitle({ className, ...props }: HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3
      className={cn("text-base font-semibold text-text-primary tracking-tight font-heading", className)}
      {...props}
    />
  );
}

export function CardContent({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("px-6 py-5 text-text-secondary", className)} {...props} />;
}
