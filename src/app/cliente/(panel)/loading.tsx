import { Skeleton } from "@/components/ui/Skeleton";

export default function ClientPanelLoading() {
  return (
    <div className="flex flex-col gap-8 animate-pulse">
      <div className="space-y-2">
        <Skeleton className="h-7 w-56" />
        <Skeleton className="h-4 w-80" />
      </div>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <Skeleton className="h-28 w-full" />
        <Skeleton className="h-28 w-full" />
      </div>

      <Skeleton className="h-96 w-full" />
    </div>
  );
}
