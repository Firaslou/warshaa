import { useState } from "react";
import { Link } from "react-router-dom";
import { Search, Sparkles, Loader2 } from "lucide-react";
import { PageLayout } from "@/components/layout/PageLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";

interface ProductHit {
  id: string;
  name: string;
  description: string | null;
  price: number | null;
  currency: string;
  images: string[];
  category: string | null;
  delegation: string | null;
  startups: { slug: string; name: string; city: string | null } | null;
}

const EXAMPLES = [
  "robe traditionnelle bleue moins de 100dt",
  "bijoux artisanaux en argent à Tunis",
  "déco maison écolo livraison incluse",
  "sac en cuir marron sous 250 TND",
];

export default function SmartSearch() {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<ProductHit[]>([]);
  const [filters, setFilters] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [searched, setSearched] = useState(false);

  const run = async (q: string) => {
    if (!q.trim()) return;
    setLoading(true); setError(null); setSearched(true);
    try {
      const { data, error } = await supabase.functions.invoke("smart-search", { body: { query: q } });
      if (error) throw error;
      setResults(data?.products ?? []);
      setFilters(data?.filters ?? null);
    } catch (e: any) {
      setError(e?.message ?? "Erreur");
      setResults([]);
    } finally { setLoading(false); }
  };

  return (
    <PageLayout>
      <section className="container py-12">
        <div className="mx-auto max-w-3xl text-center">
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border bg-card px-3 py-1 text-xs text-muted-foreground">
            <Sparkles className="h-3 w-3 text-primary" /> Recherche intelligente
          </div>
          <h1 className="font-serif text-4xl font-bold">Décrivez ce que vous cherchez</h1>
          <p className="mt-2 text-muted-foreground">
            Tapez en langage naturel : couleur, prix, ville, style… l'IA comprend.
          </p>

          <form
            onSubmit={(e) => { e.preventDefault(); run(query); }}
            className="mt-6 flex gap-2"
          >
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="robe traditionnelle bleue moins de 100dt"
                className="pl-9 h-12 text-base"
              />
            </div>
            <Button type="submit" disabled={loading} size="lg" className="gradient-warm text-primary-foreground">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Chercher"}
            </Button>
          </form>

          <div className="mt-4 flex flex-wrap justify-center gap-2">
            {EXAMPLES.map((ex) => (
              <button
                key={ex}
                onClick={() => { setQuery(ex); run(ex); }}
                className="rounded-full border bg-card px-3 py-1 text-xs text-muted-foreground hover:border-primary hover:text-primary"
              >
                {ex}
              </button>
            ))}
          </div>
        </div>

        {filters && (
          <div className="mx-auto mt-8 flex max-w-3xl flex-wrap justify-center gap-2 text-xs">
            {Array.isArray(filters.keywords) && filters.keywords.map((k: string) => (
              <Badge key={k} variant="secondary">{k}</Badge>
            ))}
            {filters.color && <Badge variant="outline">Couleur : {filters.color}</Badge>}
            {filters.max_price && <Badge variant="outline">≤ {filters.max_price} TND</Badge>}
            {filters.min_price && <Badge variant="outline">≥ {filters.min_price} TND</Badge>}
            {filters.city && <Badge variant="outline">{filters.city}</Badge>}
            {filters.delivery_required && <Badge variant="outline">Livraison</Badge>}
          </div>
        )}

        {error && <p className="mt-8 text-center text-sm text-destructive">{error}</p>}

        {searched && !loading && results.length === 0 && !error && (
          <p className="mt-12 text-center text-muted-foreground">Aucun produit ne correspond à votre recherche.</p>
        )}

        <div className="mt-10 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {results.map((p) => (
            <Card key={p.id} className="overflow-hidden">
              {p.images?.[0] && (
                <Link to={`/product/${p.id}`} className="block aspect-square w-full overflow-hidden bg-muted">
                  <img src={p.images[0]} alt={p.name} className="h-full w-full object-cover transition-transform hover:scale-105" loading="lazy" />
                </Link>
              )}
              <CardContent className="space-y-2 p-4">
                <div className="flex items-start justify-between gap-2">
                  <Link to={`/product/${p.id}`} className="font-serif text-lg font-semibold hover:text-primary">
                    {p.name}
                  </Link>
                  {p.price != null && (
                    <span className="whitespace-nowrap font-bold text-primary">{p.price} {p.currency}</span>
                  )}
                </div>
                {p.description && <p className="line-clamp-2 text-sm text-muted-foreground">{p.description}</p>}
                <div className="flex flex-wrap gap-2 text-xs">
                  {p.category && <Badge variant="secondary">{p.category}</Badge>}
                  {p.startups?.city && <Badge variant="outline">{p.startups.city}</Badge>}
                </div>
                {p.startups && (
                  <Link to={`/startup/${p.startups.slug}`} className="text-xs text-primary hover:underline">
                    {p.startups.name}
                  </Link>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      </section>
    </PageLayout>
  );
}