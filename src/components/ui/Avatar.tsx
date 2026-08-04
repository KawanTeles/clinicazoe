import Image from "next/image";
import { cn } from "@/lib/utils/cn";

interface AvatarProps {
  src?: string | null;
  name: string;
  size?: number;
  rounded?: "full" | "2xl" | "3xl";
  className?: string;
}

const ROUNDED_CLASS: Record<NonNullable<AvatarProps["rounded"]>, string> = {
  full: "rounded-full",
  "2xl": "rounded-2xl",
  "3xl": "rounded-3xl",
};

function initials(name: string) {
  const parts = name.trim().split(/\s+/);
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? parts[parts.length - 1]?.[0] : "";
  return (first + last).toUpperCase();
}

export function Avatar({ src, name, size = 40, rounded = "full", className }: AvatarProps) {
  const style = { width: size, height: size };
  const shapeClass = ROUNDED_CLASS[rounded];

  if (src) {
    return (
      <Image
        src={src}
        alt={name}
        width={size}
        height={size}
        style={style}
        className={cn(shapeClass, "object-cover ring-2 ring-[#255044]", className)}
      />
    );
  }

  return (
    <div
      style={style}
      className={cn(
        "flex shrink-0 items-center justify-center bg-[#2E8B57]/20 text-[#5ED39D] border border-[#2E8B57]/30 font-bold shadow-inner",
        shapeClass,
        className,
      )}
    >
      <span style={{ fontSize: size * 0.4 }}>{initials(name)}</span>
    </div>
  );
}

