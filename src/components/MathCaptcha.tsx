import { useCallback, useEffect, useMemo, useState } from "react";
import { RefreshCw } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

const CHARACTERS = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
const CODE_LENGTH = 5;

function createCode() {
  let result = "";
  for (let i = 0; i < CODE_LENGTH; i += 1) {
    result += CHARACTERS[Math.floor(Math.random() * CHARACTERS.length)];
  }
  return result;
}

function randomBetween(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Visual CAPTCHA: distorted letters/numbers that the visitor must copy.
 * Keeps the existing MathCaptcha API so login/register forms do not need changes.
 * Note: this is a client-side CAPTCHA and is intended as a lightweight bot barrier.
 * For high-volume/public production protection, use a server-verified CAPTCHA such as Turnstile.
 */
export function MathCaptcha({ onValidChange }: { onValidChange: (valid: boolean) => void }) {
  const [code, setCode] = useState("");
  const [answer, setAnswer] = useState("");

  const regenerate = useCallback(() => {
    setCode(createCode());
    setAnswer("");
    onValidChange(false);
  }, [onValidChange]);

  useEffect(() => {
    regenerate();
  }, [regenerate]);

  const normalizedAnswer = answer.trim().toLowerCase();
  const isAnswered = normalizedAnswer !== "";
  const isCorrect = isAnswered && normalizedAnswer === code.toLowerCase();

  useEffect(() => {
    onValidChange(isCorrect);
  }, [isCorrect, onValidChange]);

  const { characters, noiseLines } = useMemo(
    () => ({
      characters: code.split("").map((character, index) => ({
        character,
        x: 22 + index * 25,
        y: randomBetween(34, 45),
        rotate: randomBetween(-22, 22),
        size: randomBetween(25, 31),
      })),
      noiseLines: Array.from({ length: 5 }, (_, index) => ({
        x1: randomBetween(0, 20),
        y1: randomBetween(10, 50),
        x2: randomBetween(105, 125),
        y2: randomBetween(10, 50),
        rotate: index * 7 - 14,
      })),
    }),
    [code],
  );

  return (
    <div>
      <Label htmlFor="captcha">Vérification anti-robot</Label>
      <div className="mt-1 flex items-center gap-2">
        <div
          className="relative h-12 w-[145px] shrink-0 overflow-hidden rounded-md border border-input bg-muted select-none"
          aria-label="Code CAPTCHA visuel"
        >
          <svg
            viewBox="0 0 125 55"
            className="h-full w-full"
            role="img"
            aria-hidden="true"
          >
            <rect width="125" height="55" fill="transparent" />
            {noiseLines.map((line, index) => (
              <line
                key={`line-${index}`}
                x1={line.x1}
                y1={line.y1}
                x2={line.x2}
                y2={line.y2}
                stroke="currentColor"
                strokeWidth="1.2"
                opacity="0.25"
                transform={`rotate(${line.rotate} 62.5 27.5)`}
              />
            ))}
            {characters.map((item, index) => (
              <text
                key={`${item.character}-${index}`}
                x={item.x}
                y={item.y}
                fontSize={item.size}
                fontWeight="700"
                fontFamily="Arial, sans-serif"
                fill="currentColor"
                transform={`rotate(${item.rotate} ${item.x} ${item.y})`}
              >
                {item.character}
              </text>
            ))}
          </svg>
        </div>

        <Input
          id="captcha"
          type="text"
          required
          autoComplete="off"
          inputMode="text"
          value={answer}
          onChange={(e) => setAnswer(e.target.value)}
          placeholder="Recopier le code"
          className={`flex-1 ${isAnswered ? (isCorrect ? "border-green-500" : "border-destructive") : ""}`}
          aria-invalid={isAnswered && !isCorrect}
        />

        <Button
          type="button"
          variant="outline"
          size="icon"
          onClick={regenerate}
          aria-label="Nouveau code CAPTCHA"
          title="Nouveau code"
        >
          <RefreshCw className="h-4 w-4" />
        </Button>
      </div>

      <p className={`mt-1 text-xs ${isCorrect ? "text-green-600" : "text-muted-foreground"}`}>
        {isCorrect
          ? "Vérification réussie."
          : "Recopie les lettres et chiffres affichés."}
      </p>
    </div>
  );
}
