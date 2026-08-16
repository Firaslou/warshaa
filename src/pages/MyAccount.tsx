import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Heart, MessageCircle, HandHeart, KeyRound, User as UserIcon, RefreshCw, Save, ExternalLink, Loader2 } from "lucide-react";
import { PageLayout } from "@/components/layout/PageLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

export default function MyAccount() {
  const { t } = useTranslation();
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<any>(null);
  const [likedProducts, setLikedProducts] = useState<any[]>([]);
  const [supported, setSupported] = useState<any[]>([]);
  const [comments, setComments] = useState<any[]>([]);
  const [newPwd, setNewPwd] = useState("");
  const [newPwd2, setNewPwd2] = useState("");
  const [activityLoading, setActivityLoading] = useState(true);
  const [activityError, setActivityError] = useState<string | null>(null);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [profileForm, setProfileForm] = useState({ full_name: "", city: "", bio: "" });

  useEffect(() => {
    if (!loading && !user) navigate("/login");
  }, [loading, user, navigate]);

  const loadAccount = useCallback(async () => {
    if (!user) return;
    setActivityLoading(true);
    setActivityError(null);

    const [profileResult, likesResult, favoritesResult, supportsResult, commentsResult] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", user.id).maybeSingle(),
      supabase.from("product_likes").select("product_id").eq("user_id", user.id).limit(100),
      supabase.from("favorites").select("product_id").eq("user_id", user.id).not("product_id", "is", null).limit(100),
      supabase.from("startup_supporters").select("startup_id").eq("user_id", user.id).limit(100),
      supabase.from("product_comments").select("id,content,created_at,product_id").eq("user_id", user.id).order("created_at", { ascending: false }).limit(50),
    ]);

    const firstError = profileResult.error || likesResult.error || favoritesResult.error || supportsResult.error || commentsResult.error;
    if (firstError) {
      setActivityError(firstError.message);
      setActivityLoading(false);
      return;
    }

    const p = profileResult.data;
    setProfile(p);
    setProfileForm({ full_name: p?.full_name ?? "", city: p?.city ?? "", bio: p?.bio ?? "" });

    const productIds = [...new Set([
      ...(likesResult.data ?? []).map((row) => row.product_id),
      ...(favoritesResult.data ?? []).map((row) => row.product_id).filter(Boolean),
    ])] as string[];
    const commentProductIds = [...new Set((commentsResult.data ?? []).map((row) => row.product_id))];
    const allProductIds = [...new Set([...productIds, ...commentProductIds])];
    const startupIds = [...new Set((supportsResult.data ?? []).map((row) => row.startup_id))];

    const [productsResult, startupsResult] = await Promise.all([
      allProductIds.length ? supabase.from("products").select("id,name,images,startup_id").in("id", allProductIds) : Promise.resolve({ data: [], error: null }),
      startupIds.length ? supabase.from("startups").select("id,slug,name,city,logo_url").in("id", startupIds) : Promise.resolve({ data: [], error: null }),
    ]);
    if (productsResult.error || startupsResult.error) {
      setActivityError(productsResult.error?.message ?? startupsResult.error?.message ?? "Erreur de chargement");
      setActivityLoading(false);
      return;
    }

    const productMap = new Map((productsResult.data ?? []).map((product) => [product.id, product]));
    setLikedProducts(productIds.map((productId) => ({ product_id: productId, products: productMap.get(productId) })).filter((item) => item.products));
    setSupported((startupsResult.data ?? []).map((startup) => ({ startup_id: startup.id, startups: startup })));
    setComments((commentsResult.data ?? []).map((comment) => ({ ...comment, products: productMap.get(comment.product_id) ?? null })));
    setActivityLoading(false);
  }, [user]);

  useEffect(() => { void loadAccount(); }, [loadAccount]);

  useEffect(() => {
    if (!user) return;
    const channel = supabase.channel(`my-account:${user.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "product_likes", filter: `user_id=eq.${user.id}` }, () => void loadAccount())
      .on("postgres_changes", { event: "*", schema: "public", table: "favorites", filter: `user_id=eq.${user.id}` }, () => void loadAccount())
      .on("postgres_changes", { event: "*", schema: "public", table: "startup_supporters", filter: `user_id=eq.${user.id}` }, () => void loadAccount())
      .on("postgres_changes", { event: "*", schema: "public", table: "product_comments", filter: `user_id=eq.${user.id}` }, () => void loadAccount())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user, loadAccount]);

  const saveProfile = async () => {
    if (!user || !profileForm.full_name.trim()) { toast({ title: "Le nom est obligatoire", variant: "destructive" }); return; }
    setSavingProfile(true);
    const updates = { full_name: profileForm.full_name.trim(), city: profileForm.city.trim() || null, bio: profileForm.bio.trim() || null, updated_at: new Date().toISOString() };
    const { error } = await supabase.from("profiles").update(updates).eq("id", user.id);
    setSavingProfile(false);
    if (error) { toast({ title: error.message, variant: "destructive" }); return; }
    setProfile((current: any) => ({ ...current, ...updates }));
    toast({ title: "Informations enregistrées" });
  };

  const changePassword = async () => {
    if (newPwd.length < 8) {
      toast({ title: "Mot de passe trop court (min 8)", variant: "destructive" });
      return;
    }
    if (newPwd !== newPwd2) {
      toast({ title: "Les mots de passe ne correspondent pas", variant: "destructive" });
      return;
    }
    setSavingPassword(true);
    const { error } = await supabase.auth.updateUser({ password: newPwd });
    setSavingPassword(false);
    if (error) toast({ title: error.message, variant: "destructive" });
    else {
      toast({ title: t("myAccount.passwordChanged") });
      setNewPwd(""); setNewPwd2("");
    }
  };

  if (!user) return null;

  return (
    <PageLayout>
      <section className="container py-6 sm:py-12">
        <div className="mb-6 flex min-w-0 items-center gap-3 sm:mb-8 sm:gap-4">
          <Avatar className="h-16 w-16 shrink-0 sm:h-20 sm:w-20">
            <AvatarImage src={profile?.avatar_url ?? undefined} />
            <AvatarFallback><UserIcon /></AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <h1 className="truncate font-serif text-2xl font-bold sm:text-3xl">{profile?.full_name ?? user.email}</h1>
            <p className="truncate text-sm text-muted-foreground sm:text-base">{user.email}</p>
            {profile?.city && <p className="text-sm text-muted-foreground">{profile.city}</p>}
          </div>
        </div>

        <Tabs defaultValue="activity" className="w-full">
          <TabsList className="flex w-full">
            <TabsTrigger value="activity">{t("myAccount.myActivity")}</TabsTrigger>
            <TabsTrigger value="info">{t("myAccount.personalInfo")}</TabsTrigger>
            <TabsTrigger value="password">{t("myAccount.changePassword")}</TabsTrigger>
          </TabsList>

          <TabsContent value="activity" className="grid gap-6 md:grid-cols-3">
            {activityLoading && <div className="col-span-full py-10 text-center text-muted-foreground"><Loader2 className="mx-auto mb-2 h-5 w-5 animate-spin" />Chargement de votre activité…</div>}
            {!activityLoading && activityError && <div className="col-span-full rounded-xl border border-destructive/30 bg-destructive/5 p-6 text-center"><p className="text-sm text-destructive">Impossible de charger votre activité.</p><Button variant="outline" size="sm" className="mt-3" onClick={loadAccount}><RefreshCw className="mr-2 h-4 w-4" />Réessayer</Button></div>}
            {!activityLoading && !activityError && <>
            <Card>
              <CardHeader><CardTitle className="flex items-center gap-2"><Heart className="h-4 w-4 text-primary"/>{t("myAccount.likedPosts")}</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                {likedProducts.length === 0 && <p className="text-sm text-muted-foreground">—</p>}
                {likedProducts.map((l: any) => (
                  <button key={l.product_id} className="flex w-full items-center gap-2 rounded-md p-1.5 text-left text-sm hover:bg-muted" onClick={() => navigate(`/product/${l.product_id}`)}>
                    {l.products?.images?.[0] && <img src={l.products.images[0]} alt="" className="h-9 w-9 rounded object-cover" />}
                    <span className="min-w-0 flex-1 truncate">{l.products?.name}</span><ExternalLink className="h-3 w-3 text-muted-foreground" />
                  </button>
                ))}
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="flex items-center gap-2"><HandHeart className="h-4 w-4 text-primary"/>{t("myAccount.supportedCreators")}</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                {supported.length === 0 && <p className="text-sm text-muted-foreground">—</p>}
                {supported.map((s: any) => (
                  <button key={s.startup_id} className="flex w-full items-center gap-2 rounded-md p-1.5 text-left text-sm hover:bg-muted hover:text-primary"
                    onClick={() => navigate(`/startup/${s.startups?.slug}`)}>
                    {s.startups?.logo_url && <img src={s.startups.logo_url} alt="" className="h-9 w-9 rounded-full object-cover" />}
                    <span className="min-w-0 flex-1"><span className="block truncate font-medium">{s.startups?.name}</span><span className="block truncate text-xs text-muted-foreground">{s.startups?.city}</span></span><ExternalLink className="h-3 w-3" />
                  </button>
                ))}
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="flex items-center gap-2"><MessageCircle className="h-4 w-4 text-primary"/>{t("myAccount.myComments")}</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                {comments.length === 0 && <p className="text-sm text-muted-foreground">—</p>}
                {comments.map((c: any) => (
                  <button key={c.id} className="block w-full rounded-md p-1.5 text-left text-sm hover:bg-muted" onClick={() => navigate(`/product/${c.product_id}#comment-${c.id}`)}>
                    <p className="font-medium">{c.products?.name}</p>
                    <p className="line-clamp-2 text-muted-foreground">{c.content}</p>
                  </button>
                ))}
              </CardContent>
            </Card>
            </>}
          </TabsContent>

          <TabsContent value="info">
            <Card>
              <CardContent className="space-y-3 pt-6">
                <div><Label>Email</Label><Input value={user.email ?? ""} disabled /></div>
                <div><Label>{t("auth.fullName")}</Label><Input value={profileForm.full_name} onChange={(event) => setProfileForm((current) => ({ ...current, full_name: event.target.value }))} /></div>
                <div><Label>{t("common.city")}</Label><Input value={profileForm.city} onChange={(event) => setProfileForm((current) => ({ ...current, city: event.target.value }))} /></div>
                <div><Label>Biographie</Label><Textarea value={profileForm.bio} onChange={(event) => setProfileForm((current) => ({ ...current, bio: event.target.value }))} rows={4} placeholder="Parlez-nous un peu de vous…" /></div>
                <Button onClick={saveProfile} disabled={savingProfile} className="gradient-warm text-primary-foreground">{savingProfile ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}Enregistrer</Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="password">
            <Card>
              <CardHeader><CardTitle className="flex items-center gap-2"><KeyRound className="h-4 w-4"/>{t("myAccount.changePassword")}</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <div><Label>{t("myAccount.newPassword")}</Label><Input type="password" value={newPwd} onChange={(e)=>setNewPwd(e.target.value)} /></div>
                <div><Label>{t("myAccount.confirmNewPassword")}</Label><Input type="password" value={newPwd2} onChange={(e)=>setNewPwd2(e.target.value)} /></div>
                <Button onClick={changePassword} disabled={savingPassword || !newPwd || !newPwd2} className="gradient-warm text-primary-foreground">{savingPassword && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{t("common.save")}</Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <Separator className="my-12" />
        <p className="text-center text-sm italic text-muted-foreground">{t("stats.supportLine")}</p>
      </section>
    </PageLayout>
  );
}
