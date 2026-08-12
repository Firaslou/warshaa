import { cn } from "@/lib/utils";

interface BrandLogoProps {
  className?: string;
  markClassName?: string;
  nameClassName?: string;
  showName?: boolean;
}

export function BrandLogo({
  className,
  markClassName,
  nameClassName,
  showName = true,
}: BrandLogoProps) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <img
        src="/brand/warsha-mark.png"
        alt=""
        aria-hidden="true"
        className={cn("h-10 w-auto shrink-0 object-contain", markClassName)}
      />
      {showName && (
        <span className={cn("font-serif text-xl font-bold tracking-tight text-foreground", nameClassName)}>
          Warsha
        </span>
      )}
    </span>
  );
}
