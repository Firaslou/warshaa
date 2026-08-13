import { ReactNode } from "react";
import { Link } from "react-router-dom";
import { LucideIcon, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export interface EmptyStateProps {
  icon?: LucideIcon | ReactNode;
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick?: () => void;
    to?: string;
    variant?: "default" | "outline" | "secondary" | "ghost";
  };
  secondaryAction?: {
    label: string;
    onClick?: () => void;
    to?: string;
  };
  suggestions?: string[];
  onSelectSuggestion?: (suggestion: string) => void;
  className?: string;
  children?: ReactNode;
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  secondaryAction,
  suggestions,
  onSelectSuggestion,
  className,
  children,
}: EmptyStateProps) {
  const isLucideIcon = typeof Icon === "function" || (typeof Icon === "object" && Icon !== null && "render" in (Icon as any));

  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-3xl border border-dashed border-border/80 bg-card/40 p-8 text-center backdrop-blur-sm sm:p-12",
        className
      )}
    >
      {Icon && (
        <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary shadow-inner">
          {isLucideIcon ? <Icon className="h-7 w-7" /> : Icon}
        </div>
      )}

      <h3 className="font-serif text-xl font-bold tracking-tight text-foreground sm:text-2xl">
        {title}
      </h3>

      {description && (
        <p className="mt-2 max-w-md text-sm text-muted-foreground sm:text-base">
          {description}
        </p>
      )}

      {suggestions && suggestions.length > 0 && (
        <div className="mt-6 flex flex-col items-center gap-2">
          <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <Sparkles className="h-3.5 w-3.5 text-primary" />
            <span>Suggestions populaires :</span>
          </div>
          <div className="flex flex-wrap justify-center gap-1.5">
            {suggestions.map((item) => (
              <Badge
                key={item}
                variant="secondary"
                className="cursor-pointer transition hover:bg-primary/20 hover:text-primary active:scale-95"
                onClick={() => onSelectSuggestion?.(item)}
              >
                {item}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {(action || secondaryAction) && (
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          {action &&
            (action.to ? (
              <Button asChild className="gradient-warm text-primary-foreground shadow-sm">
                <Link to={action.to}>{action.label}</Link>
              </Button>
            ) : (
              <Button
                onClick={action.onClick}
                variant={action.variant || "default"}
                className={!action.variant || action.variant === "default" ? "gradient-warm text-primary-foreground shadow-sm" : ""}
              >
                {action.label}
              </Button>
            ))}

          {secondaryAction &&
            (secondaryAction.to ? (
              <Button asChild variant="outline">
                <Link to={secondaryAction.to}>{secondaryAction.label}</Link>
              </Button>
            ) : (
              <Button onClick={secondaryAction.onClick} variant="outline">
                {secondaryAction.label}
              </Button>
            ))}
        </div>
      )}

      {children}
    </div>
  );
}
