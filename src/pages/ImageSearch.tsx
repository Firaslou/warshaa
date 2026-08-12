import { useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Camera, Loader2, Upload, X } from "lucide-react";
import { PageLayout } from "@/components/layout/PageLayout";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";

interface ResultRow {
  id: string;
  name: string;
  description: string | null;
  price: number | null;
  currency: string;
  images: string[];
  category: string | null;
  startups: { name: string; slug: string };
}

export default function ImageSearch() {
  const { user, loading: authLoading } = useAuth();
  const fileRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [description, setDescription] = useState("");
  const [results, setResults] = useState<ResultRow[]>([]);
  const [searched, setSearched] = useState(false);

  const handleFile = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      toast.error("Choisis une image (JPG, PNG, WEBP).");
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      toast.error("Image trop lourde (max 8 Mo).");
      return;
    }
    const reader = new FileReader();
    reader.onload = async () => {
      const dataUrl = reader.result as string;
      setPreview(dataUrl);
      const base64 = dataUrl.split(",")[1];
      await runSearch(base64, file.type);
    };
    reader.readAsDataURL(file);
  };

  const runSearch = async (imageBase64: string, mimeType: string) => {
    setLoading(true);
    setSearched(true);
    setResults([]);
    setDescription("");
    try {
      const { data, error } = await supabase.functions.invoke("image-search", {
        body: { imageBase64, mimeType },
      });
      if (error) throw error;
      setDescription(data?.description ?? "");
      setResults((data?.results ?? []) as ResultRow[]);
    } catch {
      toast.error("Recherche échouée. Réessaie.");
    } finally {
      setLoading(false);
    }
  };

  const reset = () => {
    setPreview(null);
    setResults([]);
    setDescription("");
    setSearched(false);
    if (fileRef.current) fileRef.current.value = "";
  };

  return (
    <PageLayout>
      <div className="container max-w-5xl py-10">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full gradient-warm text-primary-foreground">
            <Camera className="h-6 w-6" />
          </div>
          <h1 className="font-serif text-3xl font-bold md:text-4xl">Recherche par image</h1>
          <p className="mt-2 text-muted-foreground">
            Téléverse une photo d'inspiration, on te trouve les produits qui s'en rapprochent.
          </p>
        </div>

        {!authLoading && !user ? (
          <div className="rounded-2xl border bg-card p-8 text-center shadow-sm">
            <p className="mb-4 text-muted-foreground">
              Connecte-toi pour utiliser la recherche par image.
            </p>
            <Button asChild className="gradient-warm text-primary-foreground">
              <Link to="/login">Se connecter</Link>
            </Button>
          </div>
        ) : !preview ? (
          <button
            onClick={() => fileRef.current?.click()}
            className="flex w-full flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-border bg-card/50 p-12 text-center transition hover:border-primary hover:bg-card"
          >
            <Upload className="h-10 w-10 text-muted-foreground" />
            <div>
              <p className="font-semibold">Clique pour choisir une image</p>
              <p className="text-sm text-muted-foreground">JPG, PNG, WEBP — max 8 Mo</p>
            </div>
          </button>
        ) : (
          <div className="grid gap-6 md:grid-cols-[260px_1fr]">
            <div className="relative">
              <img
                src={preview}
                alt="Inspiration"
                className="aspect-square w-full rounded-2xl border object-cover"
              />
              <button
                onClick={reset}
                className="absolute right-2 top-2 rounded-full bg-background/90 p-1.5 shadow hover:bg-background"
                aria-label="Retirer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div>
              {loading ? (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Loader2 className="h-5 w-5 animate-spin" /> Analyse de ton image…
                </div>
              ) : (
                <>
                  {description && (
                    <div className="mb-4 rounded-xl bg-muted/50 p-4 text-sm">
                      <p className="mb-1 font-semibold">Ce qu'on a détecté</p>
                      <p className="text-muted-foreground">{description}</p>
                    </div>
                  )}
                  <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
                    <Upload className="h-4 w-4" /> Essayer une autre image
                  </Button>
                </>
              )}
            </div>
          </div>
        )}

        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleFile(f);
          }}
        />

        {searched && !loading && (
          <div className="mt-10">
            <h2 className="mb-4 font-serif text-2xl font-bold">
              {results.length > 0 ? "Produits similaires" : "Aucun résultat"}
            </h2>
            {results.length === 0 ? (
              <p className="text-muted-foreground">
                On n'a rien trouvé pour cette image. Essaie une photo plus claire ou plus proche du produit.
              </p>
            ) : (
              <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
                {results.map((p) => (
                  <Link
                    key={p.id}
                    to={`/product/${p.id}`}
                    className="group overflow-hidden rounded-xl border bg-card transition hover:shadow-lg"
                  >
                    <div className="aspect-square overflow-hidden bg-muted">
                      {p.images?.[0] ? (
                        <img
                          src={p.images[0]}
                          alt={p.name}
                          className="h-full w-full object-cover transition group-hover:scale-105"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                          —
                        </div>
                      )}
                    </div>
                    <div className="p-3">
                      <p className="truncate text-sm font-semibold">{p.name}</p>
                      <p className="truncate text-xs text-muted-foreground">{p.startups?.name}</p>
                      {p.price != null && (
                        <p className="mt-1 text-sm font-bold text-primary">
                          {p.price} {p.currency}
                        </p>
                      )}
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </PageLayout>
  );
}
