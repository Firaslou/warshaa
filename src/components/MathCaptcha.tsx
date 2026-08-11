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
  const [operator, setOperator] = useState<"+" | "−" | "×">("+");
  const [expected, setExpected] = useState(0);
  const [answer, setAnswer] = useState("");

  const regenerate = () => {
    const operation = (["+", "−", "×"] as const)[Math.floor(Math.random() * 3)];
    let first = Math.floor(Math.random() * 12) + 2;
    let second = Math.floor(Math.random() * 9) + 1;
    if (operation === "−" && second > first) [first, second] = [second, first];
    if (operation === "×") {
      first = Math.floor(Math.random() * 8) + 2;
      second = Math.floor(Math.random() * 8) + 2;
    }
    setA(first);
    setB(second);
    setOperator(operation);
    setExpected(operation === "+" ? first + second : operation === "−" ? first - second : first * second);
    setAnswer("");
    onValidChange(false);
  };

  useEffect(() => { regenerate(); }, []);

  useEffect(() => {
    onValidChange(answer.trim() !== "" && parseInt(answer, 10) === expected);
  }, [answer, expected, onValidChange]);

  const isAnswered = answer.trim() !== "";
  const isCorrect = isAnswered && parseInt(answer, 10) === expected;

  return (
    <div>
      <Label htmlFor="captcha">Vérification anti-robot</Label>
      <div className="mt-1 flex items-center gap-2">
        <div className="flex h-10 select-none items-center justify-center rounded-md border border-input bg-muted px-4 font-mono text-sm font-semibold">
          {a} {operator} {b} = ?
        </div>
        <Input
          id="captcha"
          type="number"
          required
          inputMode="numeric"
          value={answer}
          onChange={(e) => setAnswer(e.target.value)}
          placeholder="Réponse"
          className={`flex-1 ${isAnswered ? (isCorrect ? "border-green-500" : "border-destructive") : ""}`}
          aria-invalid={isAnswered && !isCorrect}
        />
        <Button type="button" variant="outline" size="icon" onClick={regenerate} aria-label="Nouveau captcha">
          <RefreshCw className="h-4 w-4" />
        </Button>
      </div>
      <p className={`mt-1 text-xs ${isCorrect ? "text-green-600" : "text-muted-foreground"}`}>
        {isCorrect ? "Vérification réussie." : "Résous le calcul pour confirmer que tu n'es pas un robot."}
      </p>
    </div>
  );
}
