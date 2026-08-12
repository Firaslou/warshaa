import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Bot, Send, Sparkles, X, ArrowRight, ShoppingBag, ListChecks } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";

interface CreatorRec {
  id: string;
  name: string;
  slug: string;
  tagline: string | null;
  logo_url: string | null;
  category: string | null;
  city: string | null;
}

interface ProductRec {
  id: string;
  name: string;
  description: string | null;
  price: number | null;
  currency: string;
  images: string[];
  category: string | null;
  in_stock: boolean;
  is_eco: boolean;
  discount_percentage: number | null;
  creator: CreatorRec;
}

interface PlanItem {
  label: string;
  products: ProductRec[];
}

interface AssistantContext {
  language?: string;
  intent?: string;
  event?: string | null;
  role?: string | null;
  budget?: number | null;
  style?: string | null;
  category?: string | null;
  city?: string | null;
}

interface Msg {
  role: "user" | "assistant";
  content: string;
  creators?: CreatorRec[];
  products?: ProductRec[];
  plan?: PlanItem[];
}

const SUGGESTIONS = [
  "Un cadeau artisanal pour ma mère",
  "Une tenue simple pour un mariage à moins de 300 DT",
  "عندي anniversaire متاع أختي، شنوة يلزمني؟",
  "J'ai oublié le nom d'un petit sac beige avec une chaîne dorée",
];

export function AIAssistant() {
  const { user, loading: authLoading } = useAuth();
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [context, setContext] = useState<AssistantContext>({});
  const [msgs, setMsgs] = useState<Msg[]>([
    {
      role: "assistant",
      content:
        "Salut ! Je peux chercher des produits et des créateurs, retrouver un article ou t'aider à préparer un événement. Parle-moi en français, tunisien, arabe ou anglais 🌿",
    },
  ]);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [msgs, loading]);

  const send = async (text: string) => {
    if (!text.trim() || loading) return;
    if (!user) {
      setMsgs((current) => [
        ...current,
        { role: "assistant", content: "Connecte-toi pour utiliser l'assistant IA Warsha." },
      ]);
      return;
    }
    const next: Msg[] = [...msgs, { role: "user", content: text }];
    setMsgs(next);
    setInput("");
    setLoading(true);
    try {
      const payload = next
        .filter((m) => m.role === "user" || m.role === "assistant")
        .map((m) => ({ role: m.role, content: m.content }));
      const { data, error } = await supabase.functions.invoke("ai-assistant", {
        body: { messages: payload, context },
      });
      if (error) throw error;
      if (data?.context) setContext(data.context as AssistantContext);
      setMsgs((m) => [
        ...m,
        {
          role: "assistant",
          content: data?.reply || "Désolé, je n'ai pas trouvé de réponse.",
          creators: data?.creators ?? [],
          products: data?.products ?? [],
          plan: data?.plan ?? [],
        },
      ]);
    } catch {
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
              <p className="text-xs text-muted-foreground">Produits, créateurs et événements</p>
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
                {m.plan && m.plan.length > 0 && (
                  <div className="w-full rounded-xl border bg-background p-3">
                    <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold">
                      <ListChecks className="h-3.5 w-3.5 text-primary" /> Checklist proposée
                    </p>
                    <div className="space-y-2">
                      {m.plan.map((item) => (
                        <div key={item.label}>
                          <p className="text-xs font-medium capitalize">{item.label}</p>
                          <div className="mt-1 flex flex-wrap gap-1">
                            {item.products.slice(0, 3).map((product) => (
                              <Link
                                key={product.id}
                                to={`/product/${product.id}`}
                                onClick={() => setOpen(false)}
                                className="rounded-full bg-muted px-2 py-1 text-[11px] hover:bg-primary/10 hover:text-primary"
                              >
                                {product.name}
                              </Link>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {m.products && m.products.length > 0 && (
                  <div className="flex w-full flex-col gap-2">
                    {m.products.slice(0, 6).map((product) => {
                      const discount = Math.max(0, Math.min(100, product.discount_percentage ?? 0));
                      const finalPrice = product.price == null ? null : product.price * (1 - discount / 100);
                      return (
                        <Link
                          key={product.id}
                          to={`/product/${product.id}`}
                          onClick={() => setOpen(false)}
                          className="flex items-center gap-3 rounded-xl border bg-background p-2 transition hover:border-primary hover:shadow-sm"
                        >
                          <div className="h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-muted">
                            {product.images?.[0] ? (
                              <img src={product.images[0]} alt={product.name} className="h-full w-full object-cover" />
                            ) : (
                              <div className="flex h-full w-full items-center justify-center">
                                <ShoppingBag className="h-5 w-5 text-muted-foreground" />
                              </div>
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-semibold">{product.name}</p>
                            <p className="truncate text-xs text-muted-foreground">{product.creator?.name}</p>
                            <div className="mt-1 flex items-center gap-2 text-xs">
                              {finalPrice != null && (
                                <span className="font-bold text-primary">{finalPrice.toFixed(3)} {product.currency}</span>
                              )}
                              {!product.in_stock && <span className="text-destructive">Rupture</span>}
                              {product.is_eco && <span title="Produit écologique">🌿</span>}
                            </div>
                          </div>
                          <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                        </Link>
                      );
                    })}
                  </div>
                )}
                {m.creators && m.creators.length > 0 && (
                  <div className="flex w-full flex-col gap-2">
                    {m.creators.map((r) => (
                      <div
                        key={r.id}
                        className="flex items-center gap-3 rounded-xl border bg-background p-2 transition hover:border-primary hover:shadow-sm"
                      >
                        <Link
                          to={`/startup/${r.slug}`}
                          onClick={() => setOpen(false)}
                          className="h-10 w-10 shrink-0 overflow-hidden rounded-full bg-muted"
                        >
                          {r.logo_url ? (
                            <img src={r.logo_url} alt={r.name} className="h-full w-full object-cover" />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center text-sm font-semibold">
                              {r.name.charAt(0)}
                            </div>
                          )}
                        </Link>
                        <Link
                          to={`/startup/${r.slug}`}
                          onClick={() => setOpen(false)}
                          className="min-w-0 flex-1"
                        >
                          <p className="truncate text-sm font-semibold">{r.name}</p>
                          <p className="truncate text-xs text-muted-foreground">
                            {r.tagline || [r.category, r.city].filter(Boolean).join(" · ")}
                          </p>
                        </Link>
                        <Button
                          asChild
                          size="sm"
                          className="h-8 shrink-0 gradient-warm text-primary-foreground"
                        >
                          <Link to={`/startup/${r.slug}`} onClick={() => setOpen(false)}>
                            Voir <ArrowRight className="ml-1 h-3 w-3" />
                          </Link>
                        </Button>
                      </div>
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

          {!authLoading && !user ? (
            <div className="border-t bg-background px-4 py-3 text-center">
              <p className="mb-2 text-sm text-muted-foreground">
                Connecte-toi pour utiliser l'assistant IA Warsha.
              </p>
              <Button asChild className="w-full gradient-warm text-primary-foreground">
                <Link to="/login" onClick={() => setOpen(false)}>Se connecter</Link>
              </Button>
            </div>
          ) : (
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
                disabled={loading || authLoading}
                className="h-9"
              />
              <Button type="submit" size="icon" disabled={loading || authLoading || !input.trim()} className="h-9 w-9 shrink-0">
                <Send className="h-4 w-4" />
              </Button>
            </form>
          )}
        </div>
      )}
    </>
  );
}
