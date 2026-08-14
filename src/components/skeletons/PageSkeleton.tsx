import { Skeleton } from "@/components/ui/skeleton";

export function PageSkeleton() {
  return (
    <div className="min-h-screen bg-background">
      {/* Header skeleton */}
      <div className="border-b border-border/40 bg-card/50 backdrop-blur">
        <div className="container flex h-16 items-center justify-between">
          <Skeleton className="h-8 w-32 rounded-lg" />
          <div className="flex items-center gap-3">
            <Skeleton className="h-9 w-24 rounded-lg" />
            <Skeleton className="h-9 w-9 rounded-full" />
          </div>
        </div>
      </div>
      {/* Content skeleton */}
      <div className="container py-10 space-y-6">
        <Skeleton className="h-10 w-64 rounded-lg" />
        <Skeleton className="h-5 w-96 rounded" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 mt-8">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="rounded-2xl bg-card p-4 shadow-card space-y-3">
              <Skeleton className="aspect-square w-full rounded-xl" />
              <Skeleton className="h-4 w-3/4 rounded" />
              <Skeleton className="h-4 w-1/2 rounded" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
