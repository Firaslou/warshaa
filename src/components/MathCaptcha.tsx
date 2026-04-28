import { useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

/**
 * Captcha mathématique simple — empêche les bots basiques sans clé tierce.
 * Utilise `onValidChange` pour notifier le parent.
 */
export function MathCaptcha({ onValidChange }: { onValidChange: (valid: boolean) => void }) {
  const [a, setA] = useState(0);
  const [b, setB] = useState(0);
  const [answer, setAnswer] = useState("");

  const regenerate = () => {
    setA(Math.floor(Math.random() * 9) + 1);
    setB(Math.floor(Math.random() * 9) + 1);
    setAnswer("");
  };

  useEffect(() => { regenerate(); }, []);

  useEffect(() => {
    const expected = a + b;
    onValidChange(answer.trim() !== "" && parseInt(answer, 10) === expected);
  }, [answer, a, b, onValidChange]);

  return (
    <div>
      <Label htmlFor="captcha">Vérification anti-robot</Label>
      <div className="mt-1 flex items-center gap-2">
        <div className="flex h-10 select-none items-center justify-center rounded-md border border-input bg-muted px-4 font-mono text-sm font-semibold">
          {a} + {b} = ?
        </div>
        <Input
          id="captcha"
          type="number"
          required
          inputMode="numeric"
          value={answer}
          onChange={(e) => setAnswer(e.target.value)}
          placeholder="Réponse"
          className="flex-1"
        />
        <Button type="button" variant="outline" size="icon" onClick={regenerate} aria-label="Nouveau captcha">
          <RefreshCw className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}