import { useState } from "react";
import { Phone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

type Props = {
  phone?: string | null;
  compact?: boolean;
  className?: string;
};

function callablePhoneNumber(phone: string) {
  const trimmed = phone.trim();
  const digits = trimmed.replace(/\D/g, "");
  if (digits.length < 6 || digits.length > 15) return null;
  return trimmed.startsWith("+") ? `+${digits}` : digits;
}

export function ServicePhoneButton({ phone, compact = false, className }: Props) {
  const { user } = useAuth();
  const [revealed, setRevealed] = useState(false);
  const callable = phone ? callablePhoneNumber(phone) : null;

  if (!phone || !callable) return null;

  if (!revealed) {
    return (
      <Button
        type="button"
        variant="outline"
        size={compact ? "icon" : "default"}
        className={cn(compact && "h-9 w-9 shrink-0", className)}
        aria-label="Afficher le numéro de téléphone"
        title="Afficher le numéro de téléphone"
        onClick={() => {
          if (!user) {
            toast.info("Connectez-vous pour voir le numéro de téléphone.");
            return;
          }
          setRevealed(true);
        }}
      >
        <Phone className={cn("h-4 w-4", !compact && "mr-2")} />
        {!compact && "Téléphone"}
      </Button>
    );
  }

  return (
    <Button variant="outline" size="sm" className={cn("max-w-full", className)} asChild>
      <a href={`tel:${callable}`} aria-label={`Appeler le ${phone.trim()}`}>
        <Phone className="mr-2 h-4 w-4" />
        <span className="truncate">{phone.trim()}</span>
      </a>
    </Button>
  );
}
