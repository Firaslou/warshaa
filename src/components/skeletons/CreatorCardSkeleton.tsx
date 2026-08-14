import { Skeleton } from "@/components/ui/skeleton";

export function CreatorCardSkeleton() {
  return (
    <div className="rounded-2xl bg-card overflow-hidden shadow-card">
      <Skeleton className="h-28 w-full" />
      <div className="flex flex-col items-center -mt-8 pb-4 px-4 space-y-2">
        <Skeleton className="h-16 w-16 rounded-full border-4 border-background" />
        <Skeleton className="h-4 w-32 rounded" />
        <Skeleton className="h-3 w-24 rounded" />
      </div>
    </div>
  );
}
