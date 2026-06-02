import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Bot, Send, Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

interface Rec {
  id: string;
  name: string;
  slug: string;
  tagline: string | null;
  logo_url: string | null;
  category: string | null;
  city: string | null;
}

interface Msg {
  role: "user" | "assistant";
  content: string;
  recommendations?: Rec[];
}

const SUGGESTIONS = [
  "Un cadeau artisanal pour ma mère",
  "Bijoux faits main à Tunis",
  "Cosmétiques naturels",
  "Décoration berbère",
];

export function AIAssistant() {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>([
    {
      role: "assistant",
      content:
        "Salut ! Je suis ton assistant Warsha 🌿 Dis-moi ce que tu cherches et je te recommande les meilleurs créateurs tunisiens.",
    },
  ]);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [msgs, loading]);

  const send = async (text: string) => {
    if (!text.trim() || loading) return;
    const next: Msg[] = [...msgs, { role: "user", content: text }];
    setMsgs(next);
    setInput("");
    setLoading(true);
    try {
      const payload = next
        .filter((m) => m.role === "user" || m.role === "assistant")
        .map((m) => ({ role: m.role, content: m.content }));
      const { data, error } = await supabase.functions.invoke("ai-assistant", {
        body: { messages: payload },
      });
      if (error) throw error;
      setMsgs((m) => [
        ...m,
        {
          role: "assistant",
          content: data?.reply || "Désolé, je n'ai pas trouvé de réponse.",
          recommendations: data?.recommendations ?? [],
        },
      ]);
    } catch (e: any) {
      setMsgs((m) => [
        ...m,
        { role: "assistant", content: "Oups, une erreur est survenue. Réessaie dans un instant." },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <button
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full shadow-lg transition-all",
          "gradient-warm text-primary-foreground hover:scale-105",
          open && "rotate-90",
        )}
        aria-label="Assistant shopping"
      >
        {open ? <X className="h-6 w-6" /> : <Sparkles className="h-6 w-6" />}
      </button>

      {open && (
        <div className="fixed bottom-24 right-6 z-50 flex h-[560px] max-h-[80vh] w-[calc(100vw-3rem)] max-w-sm flex-col overflow-hidden rounded-2xl border bg-card shadow-2xl">
          <div className="flex items-center gap-2 border-b bg-muted/40 px-4 py-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-full gradient-warm text-primary-foreground">
              <Bot className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold leading-tight">Assistant Warsha</p>
              <p className="text-xs text-muted-foreground">Trouve le bon créateur</p>
            </div>
          </div>

          <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto px-3 py-4">
            {msgs.map((m, i) => (
              <div key={i} className={cn("flex flex-col gap-2", m.role === "user" ? "items-end" : "items-start")}>
                <div
                  className={cn(
                    "max-w-[85%] rounded-2xl px-3 py-2 text-sm",
                    m.role === "user"
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-foreground",
                  )}
                >
                  {m.content}
                </div>
                {m.recommendations && m.recommendations.length > 0 && (
                  <div className="flex w-full flex-col gap-2">
                    {m.recommendations.map((r) => (
                      <Link
                        key={r.id}
                        to={`/startup/${r.slug}`}
                        onClick={() => setOpen(false)}
                        className="flex items-center gap-3 rounded-xl border bg-background p-2 transition hover:border-primary hover:shadow-sm"
                      >
                        <div className="h-10 w-10 shrink-0 overflow-hidden rounded-full bg-muted">
                          {r.logo_url ? (
                            <img src={r.logo_url} alt={r.name} className="h-full w-full object-cover" />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center text-sm font-semibold">
                              {r.name.charAt(0)}
                            </div>
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold">{r.name}</p>
                          <p className="truncate text-xs text-muted-foreground">
                            {r.tagline || [r.category, r.city].filter(Boolean).join(" · ")}
                          </p>
                        </div>
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            ))}
            {loading && (
              <div className="flex items-start">
                <div className="rounded-2xl bg-muted px-3 py-2 text-sm text-muted-foreground">
                  <span className="inline-flex gap-1">
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-foreground/40" />
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-foreground/40 [animation-delay:120ms]" />
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-foreground/40 [animation-delay:240ms]" />
                  </span>
                </div>
              </div>
            )}
          </div>

          {msgs.length <= 1 && (
            <div className="flex flex-wrap gap-1.5 border-t px-3 py-2">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => send(s)}
                  className="rounded-full border border-border bg-background px-2.5 py-1 text-xs text-muted-foreground transition hover:border-primary hover:text-primary"
                >
                  {s}
                </button>
              ))}
            </div>
          )}

          <form
            onSubmit={(e) => {
              e.preventDefault();
              send(input);
            }}
            className="flex items-center gap-2 border-t bg-background px-3 py-2"
          >
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Que cherches-tu ?"
              disabled={loading}
              className="h-9"
            />
            <Button type="submit" size="icon" disabled={loading || !input.trim()} className="h-9 w-9 shrink-0">
              <Send className="h-4 w-4" />
            </Button>
          </form>
        </div>
      )}
    </>
  );
}