import { useEffect, useState, useRef } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  Heart, MessageCircle, Send, MapPin, Truck, ArrowLeft, Lock,
  ChevronLeft, ChevronRight, Play, ShoppingBag, LogIn, Image as ImageIcon, Tag,
  Star, CheckCircle2, Camera,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { PageLayout } from "@/components/layout/PageLayout";
import { PrivateChatDialog } from "@/components/PrivateChatDialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useFavorites } from "@/contexts/FavoritesContext";
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
  discount_percentage?: number | null;
}

interface Comment {
  id: string;
  user_id: string;
  content: string;
  created_at: string;
  is_anonymous: boolean;
  author_name?: string;
}

interface Review {
  id: string;
  user_id: string;
  rating: number;
  comment?: string | null;
  photo_url?: string | null;
  created_at: string;
  author_name?: string;
}

interface StartupLite {
  id: string;
  slug: string;
  name: string;
  city?: string | null;
  whatsapp_number?: string | null;
  logo_url?: string | null;
}

export default function ProductDetail() {
  const { id } = useParams();
  const { t } = useTranslation();
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  const [product, setProduct] = useState<Product | null>(null);
  const [similarProducts, setSimilarProducts] = useState<Product[]>([]);
  const [startup, setStartup] = useState<StartupLite | null>(null);
  const [loading, setLoading] = useState(true);
  const [isDemo, setIsDemo] = useState(false);

  const [imageIdx, setImageIdx] = useState(0);
  const [showVideo, setShowVideo] = useState(false);

  const [likes, setLikes] = useState(0);
  const [viewCount, setViewCount] = useState(0);
  const [liked, setLiked] = useState(false);

  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState("");
  const [posting, setPosting] = useState(false);

  const [chatOpen, setChatOpen] = useState(false);

  const [purchased, setPurchased] = useState(false);
  const [purchaseCount, setPurchaseCount] = useState(0);
  const [confirming, setConfirming] = useState(false);

  const [reviews, setReviews] = useState<Review[]>([]);
  const [reviewRating, setReviewRating] = useState(0);
  const [reviewText, setReviewText] = useState("");
  const [reviewPhoto, setReviewPhoto] = useState<File | null>(null);
  const [submittingReview, setSubmittingReview] = useState(false);

  useEffect(() => {
    if (!id || authLoading) return;
    (async () => {
      setLoading(true);
      setSimilarProducts([]);
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
          discount_percentage: (demo as any).discount_percentage ?? null,
        });
        if (demoStartup) {
          setStartup({
            id: demoStartup.id,
            slug: demoStartup.slug,
            name: demoStartup.name,
            city: demoStartup.city,
            whatsapp_number: "+21620000000",
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
          .select("id, slug, name, city, whatsapp_number, logo_url")
          .eq("id", (prod as any).startup_id)
          .maybeSingle();
        if (s) setStartup(s as StartupLite);

        if ((prod as Product).category) {
          let similarResult = await supabase
            .from("products")
            .select("id,startup_id,name,description,price,currency,images,category,discount_percentage")
            .eq("category", (prod as Product).category!)
            .neq("id", id)
            .eq("is_published", true)
            .limit(4);
          if (similarResult.error && /is_published/i.test(similarResult.error.message)) {
            similarResult = await supabase
              .from("products")
              .select("id,startup_id,name,description,price,currency,images,category,discount_percentage")
              .eq("category", (prod as Product).category!)
              .neq("id", id)
              .limit(4);
          }
          setSimilarProducts((similarResult.data as Product[]) ?? []);
        }

        // View ownership comes from the authenticated session. Anonymous
        // browser identifiers are intentionally not accepted because callers
        // can forge or rotate them.
        if (user) {
          await supabase.from("product_views").upsert(
            { product_id: id, user_id: user.id },
            { onConflict: "user_id,product_id", ignoreDuplicates: true },
          );
        }

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

        // Reviews
        const { data: revs } = await supabase
          .from("reviews")
          .select("*")
          .eq("product_id", id)
          .order("created_at", { ascending: false });
        const rList = (revs as Review[]) ?? [];
        const rIds = Array.from(new Set(rList.map((r) => r.user_id)));
        if (rIds.length) {
          const { data: profs } = await supabase
            .from("profiles").select("id, full_name").in("id", rIds);
          const map = new Map((profs ?? []).map((p: any) => [p.id, p.full_name]));
          rList.forEach((r) => { r.author_name = map.get(r.user_id) ?? "Utilisateur"; });
        }
        setReviews(rList);

        // Achats confirmés + vues : chiffres agrégés via fonction serveur
        const { data: pstats } = await supabase.rpc("get_product_stats", { _product_id: id });
        const ps = (pstats ?? {}) as Record<string, number>;
        setPurchaseCount(Number(ps.purchases ?? 0));
        setViewCount(Number(ps.views ?? 0));
        if (Number(ps.likes ?? 0) > 0) setLikes(Number(ps.likes));
        if (user) {
          const { data: mine } = await supabase
            .from("purchase_confirmations").select("id")
            .eq("product_id", id).eq("user_id", user.id).maybeSingle();
          setPurchased(!!mine);
        }
      }
      setLoading(false);
    })();
  }, [id, user, authLoading]);

  const { isProductFavorite, toggleProductFavorite } = useFavorites();
  const isFav = product ? isProductFavorite(product.id) : false;

  const toggleLike = async () => {
    if (isDemo) {
      setLiked((v) => !v);
      setLikes((n) => (liked ? n - 1 : n + 1));
      return;
    }
    if (!product) return;
    const wasFav = isProductFavorite(product.id);
    const nextFav = await toggleProductFavorite(product.id);
    if (nextFav !== wasFav) {
      setLikes((n) => (nextFav ? n + 1 : Math.max(0, n - 1)));
      setLiked(nextFav);
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

  const confirmPurchase = async () => {
    if (!user) { toast.info("Connectez-vous pour confirmer votre achat."); return; }
    if (!product || isDemo || purchased) return;
    setConfirming(true);
    const { error } = await supabase.from("purchase_confirmations")
      .insert({ user_id: user.id, product_id: product.id, startup_id: product.startup_id });
    setConfirming(false);
    if (error) { toast.error(error.message); return; }
    setPurchased(true);
    setPurchaseCount((n) => n + 1);
    toast.success("Merci ! Votre achat est confirmé. Vous pouvez maintenant laisser un avis.");
  };

  const submitReview = async () => {
    if (!user || !product) return;
    if (reviewRating < 1) { toast.error("Choisissez une note."); return; }
    setSubmittingReview(true);
    try {
      let photo_url: string | null = null;
      if (reviewPhoto) {
        const ext = reviewPhoto.name.split(".").pop() ?? "jpg";
        const path = `${user.id}/${product.id}-${Date.now()}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from("review-photos").upload(path, reviewPhoto, { upsert: false });
        if (upErr) throw upErr;
        const { data: pub } = supabase.storage.from("review-photos").getPublicUrl(path);
        photo_url = pub.publicUrl;
      }
      const { data, error } = await supabase.from("reviews").insert({
        user_id: user.id,
        startup_id: product.startup_id,
        product_id: product.id,
        rating: reviewRating,
        comment: reviewText.trim() || null,
        photo_url,
      }).select("*").single();
      if (error) throw error;
      setReviews((rs) => [{ ...(data as Review), author_name: "Vous" }, ...rs]);
      setReviewRating(0); setReviewText(""); setReviewPhoto(null);
      toast.success("Merci pour votre avis !");
    } catch (e: any) {
      toast.error(e.message ?? "Impossible de publier l'avis.");
    } finally {
      setSubmittingReview(false);
    }
  };

  const myReview = reviews.find((r) => r.user_id === user?.id);
  const avgRating = reviews.length ? reviews.reduce((s, r) => s + r.rating, 0) / reviews.length : 0;

  useEffect(() => {
    const targetId = window.location.hash.slice(1);
    if (!targetId) return;
    const target = document.getElementById(targetId);
    if (target) requestAnimationFrame(() => target.scrollIntoView({ behavior: "smooth", block: "center" }));
  }, [comments, reviews]);

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
                  {startup.logo_url ? (
                    <img src={startup.logo_url} alt={startup.name} className="h-full w-full object-contain" />
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
              <div className="my-4">
                {product.discount_percentage && product.discount_percentage > 0 ? (
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-3">
                      <span className="font-serif text-3xl font-bold text-primary">
                        {(product.price * (1 - product.discount_percentage / 100)).toFixed(3)} {product.currency}
                      </span>
                      <Badge className="bg-red-500 hover:bg-red-600 text-white font-bold border-none px-2 py-1">
                        -{product.discount_percentage}%
                      </Badge>
                    </div>
                    <span className="text-base text-muted-foreground line-through">
                      {Number(product.price).toFixed(3)} {product.currency}
                    </span>
                  </div>
                ) : (
                  <div className="font-serif text-3xl font-bold text-primary">
                    {Number(product.price).toFixed(3)} {product.currency}
                  </div>
                )}
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
              <Button
                variant={(isFav || liked) ? "secondary" : "outline"}
                onClick={toggleLike}
                title={(isFav || liked) ? "Retirer des favoris" : "Ajouter aux favoris"}
              >
                <Heart className={cn("mr-2 h-4 w-4", (isFav || liked) && "fill-rose-500 text-rose-500")} />
                {likes}
              </Button>
              {!isDemo && (
                <Button
                  variant={purchased ? "secondary" : "outline"}
                  onClick={confirmPurchase}
                  disabled={purchased || confirming}
                  className={purchased ? "text-success" : ""}
                  title={purchased ? "Vous avez confirmé cet achat" : "Confirmer que vous avez acheté ce produit"}
                >
                  <CheckCircle2 className={cn("mr-2 h-4 w-4", purchased && "text-success")} />
                  {purchased ? "Achat confirmé" : "Confirmer mon achat"}
                </Button>
              )}
            </div>
            {!isDemo && (
              <p className="flex flex-wrap gap-x-4 text-xs text-muted-foreground">
                <span>✅ {purchaseCount} achat{purchaseCount > 1 ? "s" : ""} confirmé{purchaseCount > 1 ? "s" : ""}</span>
                <span>👁 {viewCount} vue{viewCount > 1 ? "s" : ""}</span>
                <span>❤️ {likes} j'aime</span>
                <span>💬 {comments.length} commentaire{comments.length > 1 ? "s" : ""}</span>
                <span>⭐ {reviews.length} avis</span>
              </p>
            )}
          </div>
        </div>

        {/* REVIEWS */}
        <section id="reviews" className="mx-auto mt-12 max-w-3xl scroll-mt-24">
          <h2 className="mb-4 flex items-center gap-2 font-serif text-2xl font-bold">
            <Star className="h-5 w-5" />
            Avis ({reviews.length})
            {reviews.length > 0 && (
              <span className="ml-2 text-sm font-normal text-muted-foreground">
                ★ {avgRating.toFixed(1)} / 5
              </span>
            )}
          </h2>

          {!isDemo && user && purchased && !myReview && (
            <div className="mb-6 space-y-3 rounded-xl border border-primary/30 bg-primary/5 p-4">
              <p className="text-sm font-medium">Partagez votre expérience</p>
              <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setReviewRating(n)}
                    aria-label={`${n} étoile${n > 1 ? "s" : ""}`}
                  >
                    <Star className={cn("h-7 w-7 transition", n <= reviewRating ? "fill-warning text-warning" : "text-muted-foreground/40 hover:text-warning")} />
                  </button>
                ))}
              </div>
              <Textarea
                value={reviewText}
                onChange={(e) => setReviewText(e.target.value)}
                placeholder="Qu'avez-vous pensé du produit ?"
                rows={3}
              />
              <div className="flex flex-wrap items-center justify-between gap-2">
                <label className="inline-flex cursor-pointer items-center gap-2 text-sm text-muted-foreground hover:text-primary">
                  <Camera className="h-4 w-4" />
                  {reviewPhoto ? reviewPhoto.name : "Ajouter une photo (optionnel)"}
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => setReviewPhoto(e.target.files?.[0] ?? null)}
                  />
                </label>
                <Button onClick={submitReview} disabled={submittingReview || reviewRating < 1} className="gradient-warm text-primary-foreground">
                  <Send className="mr-2 h-4 w-4" /> Publier l'avis
                </Button>
              </div>
            </div>
          )}

          {!isDemo && user && !purchased && (
            <div className="mb-6 rounded-xl border border-dashed border-border bg-muted/30 p-4 text-center text-sm text-muted-foreground">
              Confirmez d'abord votre achat ci-dessus pour pouvoir laisser un avis.
            </div>
          )}

          <div className="space-y-3">
            {reviews.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">Aucun avis pour le moment.</p>
            ) : (
              reviews.map((r) => (
                <div id={`review-${r.id}`} key={r.id} className="scroll-mt-24 rounded-xl border border-border bg-card p-4 target:ring-2 target:ring-primary/50">
                  <div className="mb-2 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold">{r.author_name ?? "Utilisateur"}</span>
                      <span className="flex">
                        {Array.from({ length: 5 }).map((_, i) => (
                          <Star key={i} className={cn("h-3.5 w-3.5", i < r.rating ? "fill-warning text-warning" : "text-muted-foreground/30")} />
                        ))}
                      </span>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {new Date(r.created_at).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}
                    </span>
                  </div>
                  {r.comment && <p className="text-sm text-foreground/80">{r.comment}</p>}
                  {r.photo_url && <img src={r.photo_url} alt="avis" className="mt-3 max-h-64 rounded-lg" />}
                </div>
              ))
            )}
          </div>
        </section>

        {/* SIMILAR PRODUCTS */}
        {similarProducts.length > 0 && (
          <section className="mx-auto mt-16 max-w-5xl">
            <h2 className="mb-6 font-serif text-2xl font-bold">Vous pourriez aussi aimer</h2>
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
              {similarProducts.map((p) => {
                const hasDiscount = p.discount_percentage && p.discount_percentage > 0;
                const finalPrice = hasDiscount && p.price
                  ? p.price - (p.price * (p.discount_percentage / 100))
                  : p.price;

                return (
                  <Link key={p.id} to={`/product/${p.id}`} className="group block overflow-hidden rounded-xl bg-card shadow-sm hover:shadow-md transition">
                    <div className="relative aspect-square overflow-hidden bg-muted">
                      {hasDiscount && (
                        <div className="absolute left-0 top-0 z-10 rounded-br-lg bg-red-600 px-2 py-1 text-[10px] font-bold text-white">
                          -{p.discount_percentage}%
                        </div>
                      )}
                      {p.images?.[0] ? (
                        <img src={p.images[0]} alt={p.name} className="h-full w-full object-cover transition-transform group-hover:scale-105" />
                      ) : (
                        <div className="flex h-full items-center justify-center">
                          <ImageIcon className="h-8 w-8 text-muted-foreground/40" />
                        </div>
                      )}
                    </div>
                    <div className="p-3">
                      <h3 className="truncate font-semibold group-hover:text-primary">{p.name}</h3>
                      {p.price && (
                        <div className="mt-1 flex items-baseline gap-1">
                          <span className="font-bold text-primary">
                            {finalPrice?.toFixed(3)} {p.currency}
                          </span>
                          {hasDiscount && (
                            <span className="text-[10px] text-muted-foreground line-through">
                              {p.price.toFixed(3)}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </Link>
                );
              })}
            </div>
          </section>
        )}

        {/* COMMENTS */}
        <section id="comments" className="mx-auto mt-12 max-w-3xl scroll-mt-24">
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
                <div id={`comment-${c.id}`} key={c.id} className="scroll-mt-24 rounded-xl border border-border bg-card p-4 target:ring-2 target:ring-primary/50">
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
