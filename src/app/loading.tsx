import Image from "next/image";
import { Skeleton } from "@/components/ui/Skeleton";

export default function Loading() {
  return (
    <div className="min-h-screen bg-background flex flex-col justify-center items-center p-6 space-y-8">
      <div className="flex flex-col items-center justify-center space-y-3 animate-pulse">
        <Image
          src="/brand-logo.png"
          alt="Clínica Zoe"
          width={64}
          height={64}
          priority
          className="h-16 w-16 rounded-full object-cover shadow-md border-2 border-primary/30"
        />
      </div>
      <div className="w-full max-w-4xl space-y-6 animate-fade-up">
        <div className="flex items-center justify-between">
          <Skeleton className="h-10 w-48" />
          <Skeleton className="h-10 w-32" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Skeleton className="h-36 w-full" />
          <Skeleton className="h-36 w-full" />
          <Skeleton className="h-36 w-full" />
        </div>
        <Skeleton className="h-64 w-full" />
      </div>
    </div>
  );
}
