import Image from "next/image";
import { cn } from "@/lib/utils/cn";

interface AvatarProps {
  src?: string | null;
  name: string;
  size?: number;
  className?: string;
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/);
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? parts[parts.length - 1]?.[0] : "";
  return (first + last).toUpperCase();
}

export function Avatar({ src, name, size = 40, className }: AvatarProps) {
  const style = { width: size, height: size };

  if (src) {
    return (
      <Image
        src={src}
        alt={name}
        width={size}
        height={size}
        style={style}
        className={cn("rounded-full object-cover", className)}
      />
    );
  }

  return (
    <div
      style={style}
      className={cn(
        "flex items-center justify-center rounded-full bg-primary/10 text-primary-dark font-semibold",
        className,
      )}
    >
      <span style={{ fontSize: size * 0.4 }}>{initials(name)}</span>
    </div>
  );
}
