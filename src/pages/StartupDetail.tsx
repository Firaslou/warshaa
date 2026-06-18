import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  Heart,
  Users,
  MessageCircle,
  Eye,
  Star,
  ShoppingCart,
  Tag,
  ChevronLeft,
  Send,
  AlertTriangle,
  Loader2,
  Leaf,
} from "lucide-react";
import { PageLayout } from "@/components/layout/PageLayout";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { PrivateChatDialog } from "@/components/chat/PrivateChatDialog";
import { ComplaintDialog } from "@/components/complaint/ComplaintDialog";
import { useTranslation } from "react-i18next";

interface Startup {
  id: string;
  name: string;
  description: string;
  sector: string;
  stage: string;
  model: string;
  status: string;
  logo_url: string | null;
  cover_url: string | null;
  website: string | null;
  social_links: Record<string, string> | null;
  team_size: number | null;
  created_at: string;
  profiles?: {
    full_name: string | null;
    avatar_url: string | null;
  } | null;
}

interface Product {
  id: string;
  name: string;
  description: string | null;
  price: number;
  discount_percentage: number | null;
  images: string[] | null;
  category: string | null;
  startup_id: string;
  created_at: string;
}

interface Review {
  id: string;
  rating: number;
  comment: string | null;
  created_at: string;
  profiles?: {
    full_name: string | null;
    avatar_url: string | null;
  } | null;
}

export default function StartupDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const { t } = useTranslation();

  const [startup, setStartup] = useState<<Startup | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [reviews, setReviews] = useState<<Review[]>([]);
  const [followersCount, setFollowersCount] = useState(0);
  const [isFollowing, setIsFollowing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [chatOpen, setChatOpen] = useState(false);
  const [complaintOpen, setComplaintOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<<"products" | "reviews" | "about">("products");

  const startupId = id || "";

  useEffect(() => {
    if (!startupId) return;
    fetchStartup();
  }, [startupId]);

  async function fetchStartup() {
    setLoading(true);
    try {
      // 1. Startup
      const { data: s, error: startupErr } = await supabase
        .from("startups")
        .select(
          `*,
          profiles:owner_id ( full_name, avatar_url )`
        )
        .eq("id", startupId)
        .single();

      if (startupErr || !s) {
        toast({ title: "Erreur", description: "Startup introuvable.", variant: "destructive" });
        navigate("/explore");
        return;
      }
      setStartup(s as Startup);

      // 2. Products — REQUÊTE CORRIGÉE : select explicite + pas de .or() bizarre
      const { data: prods, error: prodErr } = await supabase
        .from("products")
        .select("id, name, description, price, discount_percentage, images, category, startup_id, created_at")
        .eq("startup_id", startupId)
        .order("created_at", { ascending: false });

      if (prodErr) {
        console.error("Erreur produits:", prodErr);
      } else {
        setProducts(prods || []);
        // DEBUG : regarde dans ta console si discount_percentage est bien là
        console.log(
          "🔍 Produits chargés:",
          (prods || []).map((p: Product) => ({
            name: p.name,
            price: p.price,
            discount: p.discount_percentage,
          }))
        );
      }

      // 3. Reviews
      const { data: revs } = await supabase
        .from("reviews")
        .select(
          `id, rating, comment, created_at,
          profiles:user_id ( full_name, avatar_url )`
        )
        .eq("startup_id", startupId)
        .order("created_at", { ascending: false });

      setReviews((revs as Review[]) || []);

      // 4. Followers
      const { count } = await supabase
        .from("follows")
        .select("id", { count: "exact", head: true })
        .eq("startup_id", startupId);
      setFollowersCount(count || 0);

      // 5. Is following ?
      if (user) {
        const { data: fol } = await supabase
          .from("follows")
          .select("id")
          .eq("startup_id", startupId)
          .eq("user_id", user.id)
          .single();
        setIsFollowing(!!fol);
      }
    } finally {
      setLoading(false);
    }
  }

  async function toggleFollow() {
    if (!user) {
      toast({ title: "Connexion requise", description: "Connectez-vous pour suivre cette startup." });
      return;
    }
    if (!startup) return;

    if (isFollowing) {
      await supabase.from("follows").delete().eq("startup_id", startupId).eq("user_id", user.id);
      setIsFollowing(false);
      setFollowersCount((c) => Math.max(0, c - 1));
    } else {
      await supabase.from("follows").insert({ startup_id: startupId, user_id: user.id });
      setIsFollowing(true);
      setFollowersCount((c) => c + 1);
    }
  }

  const averageRating = useMemo(() => {
    if (!reviews.length) return 0;
    return reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length;
  }, [reviews]);

  if (loading) {
    return (
      <PageLayout>
        <div className="flex h-[60vh] items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </PageLayout>
    );
  }

  if (!startup) return null;

  return (
    <PageLayout>
      {/* Cover */}
      <div className="relative h-48 w-full overflow-hidden rounded-xl sm:h-64">
        <img
          src={startup.cover_url || "/placeholder-cover.jpg"}
          alt={`${startup.name} cover`}
          className="h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
        <Button
          variant="ghost"
          size="sm"
          className="absolute left-4 top-4 bg-black/40 text-white hover:bg-black/60"
          onClick={() => navigate(-1)}
        >
          <ChevronLeft className="mr-1 h-4 w-4" />
          Retour
        </Button>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Main content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Header */}
          <div className="flex items-start gap-4">
            <Avatar className="h-20 w-20 border-4 border-background shadow-lg">
              <AvatarImage src={startup.logo_url || ""} alt={startup.name} />
              <AvatarFallback className="text-2xl">{startup.name?.[0] || "S"}</AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <h1 className="text-2xl font-bold">{startup.name}</h1>
              <p className="text-muted-foreground mt-1">{startup.description}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Badge variant="secondary">{startup.sector}</Badge>
                <Badge variant="secondary">{startup.stage}</Badge>
                <Badge variant="secondary">{startup.model}</Badge>
                {startup.status === "en_vedette" && (
                  <Badge className="bg-amber-500 text-white">
                    <Star className="mr-1 h-3 w-3" />
                    En vedette
                  </Badge>
                )}
                {startup.status === "certifie" && (
                  <Badge className="bg-emerald-500 text-white">
                    <Leaf className="mr-1 h-3 w-3" />
                    Certifié
                  </Badge>
                )}
              </div>
            </div>
          </div>

          {/* Tabs */}
          <div className="border-b">
            <div className="flex gap-6">
              {(["products", "reviews", "about"] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`pb-3 text-sm font-medium capitalize transition-colors ${
                    activeTab === tab
                      ? "border-b-2 border-primary text-primary"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {tab === "products" && (
                    <span className="flex items-center gap-1.5">
                      <ShoppingCart className="h-4 w-4" />
                      Produits ({products.length})
                    </span>
                  )}
                  {tab === "reviews" && (
                    <span className="flex items-center gap-1.5">
                      <MessageCircle className="h-4 w-4" />
                      Avis ({reviews.length})
                    </span>
                  )}
                  {tab === "about" && (
                    <span className="flex items-center gap-1.5">
                      <Eye className="h-4 w-4" />
                      À propos
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Tab: Products — LOGIQUE SOLDES CORRIGÉE */}
          {activeTab === "products" && (
            <div className="space-y-4">
              {products.length === 0 ? (
                <p className="text-muted-foreground py-8 text-center">Aucun produit disponible pour le moment.</p>
              ) : (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  {products.map((product) => {
                    const discount = product.discount_percentage || 0;
                    const finalPrice = product.price * (1 - discount / 100);
                    const hasDiscount = discount > 0;

                    return (
                      <div
                        key={product.id}
                        className="group relative overflow-hidden rounded-xl border bg-card p-4 transition-shadow hover:shadow-md"
                      >
                        {hasDiscount && (
                          <Badge className="absolute left-3 top-3 z-10 bg-red-500 text-white hover:bg-red-600">
                            <Tag className="mr-1 h-3 w-3" />
                            -{discount}%
                          </Badge>
                        )}
                        <div className="aspect-square overflow-hidden rounded-lg bg-muted">
                          <img
                            src={product.images?.[0] || "/placeholder-product.jpg"}
                            alt={product.name}
                            className="h-full w-full object-cover transition-transform group-hover:scale-105"
                          />
                        </div>
                        <div className="mt-3">
                          <h3 className="font-semibold">{product.name}</h3>
                          {product.category && <p className="text-muted-foreground text-xs">{product.category}</p>}
                          <div className="mt-2 flex items-center gap-2">
                            {hasDiscount ? (
                              <>
                                <span className="text-lg font-bold text-red-500">{finalPrice.toFixed(0)} €</span>
                                <span className="text-sm text-muted-foreground line-through">
                                  {product.price.toFixed(0)} €
                                </span>
                              </>
                            ) : (
                              <span className="text-lg font-bold">{product.price.toFixed(0)} €</span>
                            )}
                          </div>
                          {product.description && (
                            <p className="text-muted-foreground mt-1 text-sm line-clamp-2">{product.description}</p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Tab: Reviews */}
          {activeTab === "reviews" && (
            <div className="space-y-4">
              {reviews.length === 0 ? (
                <p className="text-muted-foreground py-8 text-center">Aucun avis pour le moment.</p>
              ) : (
                reviews.map((review) => (
                  <div key={review.id} className="rounded-xl border bg-card p-4">
                    <div className="flex items-center gap-3">
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={review.profiles?.avatar_url || ""} />
                        <AvatarFallback>{review.profiles?.full_name?.[0] || "U"}</AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="text-sm font-medium">{review.profiles?.full_name || "Utilisateur"}</p>
                        <div className="flex text-amber-500">
                          {Array.from({ length: 5 }).map((_, i) => (
                            <Star
                              key={i}
                              className={`h-3 w-3 ${i < review.rating ? "fill-current" : "text-muted-foreground"}`}
                            />
                          ))}
                        </div>
                      </div>
                      <span className="text-muted-foreground ml-auto text-xs">
                        {new Date(review.created_at).toLocaleDateString()}
                      </span>
                    </div>
                    {review.comment && <p className="mt-2 text-sm">{review.comment}</p>}
                  </div>
                ))
              )}
            </div>
          )}

          {/* Tab: About */}
          {activeTab === "about" && (
            <div className="space-y-4 rounded-xl border bg-card p-6">
              <h3 className="font-semibold">À propos de {startup.name}</h3>
              <p className="text-muted-foreground">{startup.description}</p>
              {startup.website && (
                <p className="text-sm">
                  <span className="font-medium">Site web : </span>
                  <a
                    href={startup.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline"
                  >
                    {startup.website}
                  </a>
                </p>
              )}
              {startup.team_size && (
                <div className="flex items-center gap-2 text-sm">
                  <Users className="h-4 w-4 text-muted-foreground" />
                  <span>Équipe de {startup.team_size} personnes</span>
                </div>
              )}
              {startup.social_links && (
                <div className="flex flex-wrap gap-3 pt-2">
                  {Object.entries(startup.social_links).map(([key, url]) => (
                    <a
                      key={key}
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary text-sm hover:underline"
                    >
                      {key}
                    </a>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Sidebar */}
        <aside className="space-y-4">
          <div className="rounded-xl border bg-card p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users className="h-5 w-5 text-muted-foreground" />
                <span className="font-medium">{followersCount}</span>
                <span className="text-muted-foreground text-sm">abonnés</span>
              </div>
              <div className="flex items-center gap-2">
                <Eye className="h-5 w-5 text-muted-foreground" />
                <span className="text-muted-foreground text-sm">{startup.stage}</span>
              </div>
            </div>

            {averageRating > 0 && (
              <div className="flex items-center gap-2">
                <div className="flex text-amber-500">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star
                      key={i}
                      className={`h-4 w-4 ${i < Math.round(averageRating) ? "fill-current" : "text-muted-foreground"}`}
                    />
                  ))}
                </div>
                <span className="text-sm font-medium">{averageRating.toFixed(1)}/5</span>
                <span className="text-muted-foreground text-sm">({reviews.length} avis)</span>
              </div>
            )}

            <Button variant={isFollowing ? "outline" : "default"} className="w-full" onClick={toggleFollow}>
              <Heart className={`mr-2 h-4 w-4 ${isFollowing ? "fill-current text-red-500" : ""}`} />
              {isFollowing ? "Abonné" : "Suivre"}
            </Button>

            <Button variant="outline" className="w-full" onClick={() => setChatOpen(true)}>
              <Send className="mr-2 h-4 w-4" />
              Démarrer une conversation
            </Button>

            <Button
              variant="ghost"
              size="sm"
              className="w-full text-muted-foreground hover:text-red-500"
              onClick={() => setComplaintOpen(true)}
            >
              <AlertTriangle className="mr-2 h-4 w-4" />
              Signaler
            </Button>
          </div>

          {startup.profiles && (
            <div className="rounded-xl border bg-card p-6">
              <h3 className="mb-3 text-sm font-medium text-muted-foreground">Créateur</h3>
              <div className="flex items-center gap-3">
                <Avatar className="h-10 w-10">
                  <AvatarImage src={startup.profiles.avatar_url || ""} />
                  <AvatarFallback>{startup.profiles.full_name?.[0] || "C"}</AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-medium">{startup.profiles.full_name || "Créateur"}</p>
                  <p className="text-muted-foreground text-xs">Fondateur</p>
                </div>
              </div>
            </div>
          )}
        </aside>
      </div>

      <PrivateChatDialog
        open={chatOpen}
        onOpenChange={setChatOpen}
        startupId={startup.id}
        startupName={startup.name}
      />

      <ComplaintDialog
        open={complaintOpen}
        onOpenChange={setComplaintOpen}
        startupId={startup.id}
        startupName={startup.name}
      />
    </PageLayout>
  );
}
