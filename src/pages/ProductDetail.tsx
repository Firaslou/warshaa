import { useEffect, useState, useRef } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  Heart, MessageCircle, Send, MapPin, Truck, ArrowLeft, Lock,
  ChevronLeft, ChevronRight, Play, ShoppingBag, LogIn, Image as ImageIcon, Tag,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { PageLayout } from "@/components/layout/PageLayout";
import { PrivateChatDialog } from "@/components/PrivateChatDialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { openWhatsApp } from "@/lib/whatsapp";
import { getDemoProductById } from "@/lib/demo";
import { DEMO_STARTUPS } from "@/lib/demo";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface Product {
  id: string;
  startup_id: string;
  name: string;
  description?: string | null;
  price?: number | null;
  currency: string;
  images: string[];
  video_url?: string | null;
  category?: string | null;
  delegation?: string | null;
  delivery_available?: boolean;
  delivery_fee?: number | null;
}

interface Comment {
  id: string;
  user_id: string;
  content: string;
  created_at: string;
  is_anonymous: boolean;
  author_name?: string;
}

interface StartupLite {
  id: string;
  slug: string;
  name: string;
  city?: string | null;
  whatsapp_number?: string | null;
  logo_url?: string | null;
  cover_url?: string | null;
}

export default function ProductDetail() {
  const { id } = useParams();
  const { t } = useTranslation();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [product, setProduct] = useState<Product | null>(null);
  const [startup, setStartup] = useState<StartupLite | null>(null);
  const [loading, setLoading] = useState(true);
  const [isDemo, setIsDemo] = useState(false);

  const [imageIdx, setImageIdx] = useState(0);
  const [showVideo, setShowVideo] = useState(false);

  const [likes, setLikes] = useState(0);
  const [liked, setLiked] = useState(false);

  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState("");
  const [posting, setPosting] = useState(false);

  const [chatOpen, setChatOpen] = useState(false);

  useEffect(() => {
    if (!id) return;
    (async () => {
      setLoading(true);
      // Try demo first
      const demo = getDemoProductById(id);
      if (demo) {
        setIsDemo(true);
        const demoStartup = DEMO_STARTUPS.find((s) => s.slug === demo.startup_slug);
        setProduct({
          id: demo.id,
          startup_id: demoStartup?.id ?? "demo",
          name: demo.name,
          description: demo.description,
          price: demo.price,
          currency: demo.currency,
          images: demo.images,
          video_url: demo.video_url ?? null,
          category: demo.category,
          delegation: demo.delegation,
          delivery_available: demo.delivery_available,
          delivery_fee: demo.delivery_fee,
        });
        if (demoStartup) {
          setStartup({
            id: demoStartup.id,
            slug: demoStartup.slug,
            name: demoStartup.name,
            city: demoStartup.city,
            whatsapp_number: "+21620000000",
            cover_url: demoStartup.cover_url ?? null,
            logo_url: null,
          });
        }
        setLikes(Math.floor(Math.random() * 80) + 12);
        setComments([
          {
            id: "demo-c1",
            user_id: "u1",
            content: "Magnifique pièce, je l'adore !",
            created_at: new Date(Date.now() - 86400000).toISOString(),
            is_anonymous: false,
            author_name: "Sarra",
          },
          {
            id: "demo-c2",
            user_id: "u2",
            content: "Est-ce que c'est encore disponible en stock ?",
            created_at: new Date(Date.now() - 3600000).toISOString(),
            is_anonymous: false,
            author_name: "Mehdi",
          },
        ]);
        setLoading(false);
        return;
      }

      // Real product
      const { data: prod } = await supabase
        .from("products").select("*").eq("id", id).maybeSingle();
      if (prod) {
        setProduct(prod as Product);
        const { data: s } = await supabase
          .from("startups")
          .select("id, slug, name, city, whatsapp_number, logo_url, cover_url")
          .eq("id", (prod as any).startup_id)
          .maybeSingle();
        if (s) setStartup(s as StartupLite);

        // Likes
        const { count } = await supabase
          .from("product_likes")
          .select("id", { count: "exact", head: true })
          .eq("product_id", id);
        setLikes(count ?? 0);
        if (user) {
          const { data: myLike } = await supabase
            .from("product_likes").select("id")
            .eq("product_id", id).eq("user_id", user.id).maybeSingle();
          setLiked(!!myLike);

          // Log a view
          supabase.from("product_views")
            .insert({ product_id: id, user_id: user.id }).then(() => {});
        }

        // Comments + author names
        const { data: cmts } = await supabase
          .from("product_comments")
          .select("*")
          .eq("product_id", id)
          .order("created_at", { ascending: false });
        const list = (cmts as Comment[]) ?? [];
        const ids = Array.from(new Set(list.filter(c => !c.is_anonymous).map(c => c.user_id)));
        if (ids.length > 0) {
          const { data: profs } = await supabase
            .from("profiles").select("id, full_name").in("id", ids);
          const map = new Map((profs ?? []).map((p: any) => [p.id, p.full_name]));
          list.forEach((c) => {
            c.author_name = c.is_anonymous ? "Anonyme" : (map.get(c.user_id) ?? "Utilisateur");
          });
        } else {
          list.forEach((c) => { c.author_name = c.is_anonymous ? "Anonyme" : "Utilisateur"; });
        }
        setComments(list);
      }
      setLoading(false);
    })();
  }, [id, user]);

  const toggleLike = async () => {
    if (isDemo) {
      setLiked((v) => !v);
      setLikes((n) => liked ? n - 1 : n + 1);
      return;
    }
    if (!user) { toast.info("Connectez-vous pour aimer ce produit."); return; }
    if (!product) return;
    if (liked) {
      await supabase.from("product_likes")
        .delete().eq("product_id", product.id).eq("user_id", user.id);
      setLiked(false);
      setLikes((n) => Math.max(0, n - 1));
    } else {
      await supabase.from("product_likes")
        .insert({ product_id: product.id, user_id: user.id });
      setLiked(true);
      setLikes((n) => n + 1);
    }
  };

  const submitComment = async () => {
    const content = newComment.trim();
    if (!content) return;
    if (isDemo) {
      toast.info("Aperçu de démonstration — votre commentaire ne sera pas enregistré.");
      setComments((c) => [
        { id: `tmp-${Date.now()}`, user_id: user?.id ?? "me", content, created_at: new Date().toISOString(), is_anonymous: false, author_name: "Vous" },
        ...c,
      ]);
      setNewComment("");
      return;
    }
    if (!user) { toast.info("Connectez-vous pour commenter."); return; }
    if (!product) return;
    setPosting(true);
    const { data, error } = await supabase.from("product_comments")
      .insert({ product_id: product.id, user_id: user.id, content, is_anonymous: false })
      .select("*").single();
    setPosting(false);
    if (error) { toast.error(error.message); return; }
    setNewComment("");
    setComments((c) => [{ ...(data as Comment), author_name: "Vous" }, ...c]);
  };

  const buy = () => {
    if (!product || !startup) return;
    if (isDemo) { toast.info("Aperçu de démonstration — aucun message ne sera envoyé."); return; }
    if (!startup.whatsapp_number) { toast.error("Numéro WhatsApp indisponible."); return; }
    openWhatsApp({
      phone: startup.whatsapp_number,
      productName: product.name,
      startupId: startup.id,
      productId: product.id,
      message: t("startup.whatsappMessage", { product: product.name }),
    });
  };

  const openChat = () => {
    if (isDemo) {
      toast.info("Aperçu de démonstration — le chat privé sera disponible avec les vrais créateurs.");
      return;
    }
    if (!user) { toast.info("Connectez-vous pour discuter avec ce créateur."); return; }
    setChatOpen(true);
  };

  if (loading) return <PageLayout><div className="container py-20 text-center">{t("common.loading")}</div></PageLayout>;
  if (!product) return <PageLayout><div className="container py-20 text-center">{t("notFound.title")}</div></PageLayout>;

  const allMedia = product.images ?? [];
  const hasVideo = !!product.video_url;
  const totalSlides = allMedia.length + (hasVideo ? 1 : 0);
  const isVideoSlide = hasVideo && imageIdx === allMedia.length;

  return (
    <PageLayout>
      <div className="container py-6">
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="mb-4">
          <ArrowLeft className="mr-1 h-4 w-4" /> Retour
        </Button>

        <div className="grid gap-8 lg:grid-cols-2">
          {/* MEDIA */}
          <div className="space-y-3">
            <div className="relative aspect-square overflow-hidden rounded-2xl bg-muted shadow-elegant">
              {isVideoSlide && product.video_url ? (
                <video src={product.video_url} controls className="h-full w-full object-cover" />
              ) : allMedia[imageIdx] ? (
                <img src={allMedia[imageIdx]} alt={product.name} className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full items-center justify-center">
                  <ImageIcon className="h-12 w-12 text-muted-foreground/40" />
                </div>
              )}
              {totalSlides > 1 && (
                <>
                  <button
                    onClick={() => setImageIdx((i) => (i - 1 + totalSlides) % totalSlides)}
                    className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-background/80 p-2 shadow hover:bg-background"
                    aria-label="Précédent"
                  >
                    <ChevronLeft className="h-5 w-5" />
                  </button>
                  <button
                    onClick={() => setImageIdx((i) => (i + 1) % totalSlides)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-background/80 p-2 shadow hover:bg-background"
                    aria-label="Suivant"
                  >
                    <ChevronRight className="h-5 w-5" />
                  </button>
                  <div className="absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-background/80 px-3 py-1 text-xs">
                    {imageIdx + 1} / {totalSlides}
                  </div>
                </>
              )}
            </div>
            {totalSlides > 1 && (
              <div className="flex gap-2 overflow-x-auto pb-1">
                {allMedia.map((img, i) => (
                  <button
                    key={i}
                    onClick={() => setImageIdx(i)}
                    className={cn(
                      "h-16 w-16 shrink-0 overflow-hidden rounded-lg border-2 transition",
                      imageIdx === i ? "border-primary" : "border-transparent opacity-70 hover:opacity-100",
                    )}
                  >
                    <img src={img} alt="" className="h-full w-full object-cover" />
                  </button>
                ))}
                {hasVideo && (
                  <button
                    onClick={() => setImageIdx(allMedia.length)}
                    className={cn(
                      "flex h-16 w-16 shrink-0 items-center justify-center rounded-lg border-2 bg-muted transition",
                      isVideoSlide ? "border-primary" : "border-transparent opacity-70 hover:opacity-100",
                    )}
                    aria-label="Vidéo"
                  >
                    <Play className="h-5 w-5" />
                  </button>
                )}
              </div>
            )}
          </div>

          {/* INFO */}
          <div className="space-y-5">
            {startup && (
              <Link to={`/startup/${startup.slug}`} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-primary">
                <div className="h-8 w-8 overflow-hidden rounded-full bg-muted">
                  {startup.logo_url || startup.cover_url ? (
                    <img src={(startup.logo_url || startup.cover_url)!} alt={startup.name} className="h-full w-full object-cover" />
                  ) : null}
                </div>
                <span className="font-medium">{startup.name}</span>
                {startup.city && <span>· {startup.city}</span>}
              </Link>
            )}

            <h1 className="font-serif text-3xl font-bold md:text-4xl">{product.name}</h1>

            <div className="flex flex-wrap items-center gap-2">
              {product.category && (
                <Badge variant="outline" className="border-primary/30 bg-primary/10 text-primary">
                  <Tag className="mr-1 h-3 w-3" /> {product.category}
                </Badge>
              )}
              {(product.delegation || startup?.city) && (
                <Badge variant="outline">
                  <MapPin className="mr-1 h-3 w-3" />
                  {product.delegation ? `${product.delegation}` : startup?.city}
                </Badge>
              )}
              {product.delivery_available ? (
                <Badge variant="outline" className="border-success/30 bg-success/10 text-success">
                  <Truck className="mr-1 h-3 w-3" />
                  {product.delivery_fee && product.delivery_fee > 0
                    ? `Livraison ${product.delivery_fee} ${product.currency}`
                    : "Livraison gratuite"}
                </Badge>
              ) : (
                <Badge variant="outline" className="text-muted-foreground">Retrait uniquement</Badge>
              )}
            </div>

            {product.price != null && (
              <div className="font-serif text-3xl font-bold text-primary">
                {product.price} {product.currency}
              </div>
            )}

            {product.description && (
              <p className="whitespace-pre-line leading-relaxed text-foreground/80">{product.description}</p>
            )}

            <div className="flex flex-wrap gap-2 pt-2">
              <Button onClick={buy} className="gradient-warm text-primary-foreground">
                <ShoppingBag className="mr-2 h-4 w-4" /> Acheter sur WhatsApp
              </Button>
              <Button variant="outline" onClick={openChat}>
                <Lock className="mr-2 h-4 w-4" /> Chat privé
              </Button>
              <Button variant="outline" onClick={toggleLike}>
                <Heart className={cn("mr-2 h-4 w-4", liked && "fill-primary text-primary")} />
                {likes}
              </Button>
            </div>
          </div>
        </div>

        {/* COMMENTS */}
        <section className="mx-auto mt-12 max-w-3xl">
          <h2 className="mb-4 flex items-center gap-2 font-serif text-2xl font-bold">
            <MessageCircle className="h-5 w-5" />
            Commentaires ({comments.length})
          </h2>

          {user || isDemo ? (
            <div className="mb-6 space-y-2 rounded-xl border border-border bg-card p-4">
              <Textarea
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                placeholder="Posez une question, partagez votre avis…"
                rows={3}
              />
              <div className="flex justify-end">
                <Button onClick={submitComment} disabled={posting || !newComment.trim()} className="gradient-warm text-primary-foreground">
                  <Send className="mr-2 h-4 w-4" /> Publier
                </Button>
              </div>
            </div>
          ) : (
            <div className="mb-6 rounded-xl border border-primary/30 bg-primary/5 p-4 text-center">
              <p className="mb-3 text-sm text-muted-foreground">
                Connectez-vous pour commenter ce produit.
              </p>
              <div className="flex justify-center gap-2">
                <Link to="/login"><Button size="sm" className="gradient-warm text-primary-foreground"><LogIn className="mr-1 h-4 w-4" /> Se connecter</Button></Link>
                <Link to="/signup"><Button size="sm" variant="outline">Créer un compte</Button></Link>
              </div>
            </div>
          )}

          <div className="space-y-3">
            {comments.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">Aucun commentaire pour le moment. Soyez le premier !</p>
            ) : (
              comments.map((c) => (
                <div key={c.id} className="rounded-xl border border-border bg-card p-4">
                  <div className="mb-1 flex items-center justify-between">
                    <span className="text-sm font-semibold">{c.author_name ?? "Utilisateur"}</span>
                    <span className="text-xs text-muted-foreground">
                      {new Date(c.created_at).toLocaleDateString("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>
                  <p className="text-sm text-foreground/80">{c.content}</p>
                </div>
              ))
            )}
          </div>
        </section>
      </div>

      {startup && (
        <PrivateChatDialog
          open={chatOpen}
          onOpenChange={setChatOpen}
          startupId={startup.id}
          startupName={startup.name}
        />
      )}
    </PageLayout>
  );
}