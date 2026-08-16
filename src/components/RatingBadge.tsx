import { Star } from "lucide-react";
import { cn } from "@/lib/utils";
import type { RatingSummary } from "@/lib/ratings";

export function RatingBadge({
  rating,
  className,
}: {
  rating?: RatingSummary;
  className?: string;
}) {
  return (
    <span className={cn("inline-flex items-center gap-1 text-xs font-medium text-amber-700", className)}>
      <Star className={cn("h-3.5 w-3.5", rating?.count ? "fill-amber-400 text-amber-500" : "text-muted-foreground/50")} />
      {rating?.count ? `${rating.average.toFixed(1)} (${rating.count})` : "Nouveau"}
    </span>
  );
}
