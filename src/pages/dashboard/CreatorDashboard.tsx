import { useEffect, useMemo, useState, useRef } from "react";
import { Navigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  Heart, Users, MessageCircle, Eye, Plus, Pencil, Trash2, Radio,
  Image as ImageIcon, Save, Leaf, Loader2,
} from "lucide-react";
import { PageLayout } from "@/components/layout/PageLayout";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { TUNISIA_GOVERNORATES, TUNISIA_DELEGATIONS, CATEGORIES_KEYS } from "@/lib/tunisia";
import { toast } from "@/hooks/use-toast";
import { ProductFormDialog } from "@/components/creator/ProductFormDialog";
import { LiveScheduleManager } from "@/components/creator/LiveScheduleManager";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, BarChart, Bar, CartesianGrid } from "recharts";

export default function CreatorDashboard() {
  const { t } = useTranslation();
  const { user, loading } = useAuth();
  const [startup, setStartup] = useState<any>(null);
  const [application, setApplication] = useState<any>(null);
  const [products, setProducts] = useState<any[]>([]);
  const [clicks, setClicks] = useState(0);
  const [views30d, setViews30d] = useState<{ date: string; count: number }[]>([]);
  const [topProducts, setTopProducts] = useState<{ name: string; views: number }[]>([]);
  const [productEdit, setProductEdit] = useState<any | null>(null);
  const [productOpen, setProductOpen] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [facingMode, setFacingMode] = useState<"user" | "environment">("user");
  const [comments, setComments] = useState([]);
  const [viewerCount, setViewerCount] = useState(0);
  useEffect(() => {
    let interval: NodeJS.Timeout;
    
    if (startup?.is_live) {
      // On commence avec un nombre de spectateurs aléatoire au démarrage du live
      setViewerCount(Math.floor(Math.random() * 20) + 15);

      // Toutes les 5 secondes, le nombre varie légèrement
      interval = setInterval(() => {
        setViewerCount(prev => {
          const change = Math.floor(Math.random() * 5) - 2; // -2, -1, 0, 1 ou 2
          const next = prev + change;
          return next < 0 ? 0 : next;
        });
      }, 5000);
    } else {
      // Si le live est éteint, on remet le compteur à 0
      setViewerCount(0);
    }

    return () => clearInterval(interval);
  }, [startup?.is_live]);

  // Profile form state
  const [pf, setPf] = useState({
    name: "", tagline: "", description: "", creator_story: "",
    city: "", delegation: "", categories: [] as string[],
    instagram_url: "", facebook_url: "", tiktok_url: "", whatsapp_number: "",
    logo_url: "", cover_url: "",
  });

  const refreshAll = async (uid: string) => {
    const { data: s } = await supabase.from("startups").select("*").eq("owner_id", uid).maybeSingle();
    setStartup(s);
    if (!s) {
      const { data: a } = await supabase.from("startup_applications").select("*").eq("applicant_id", uid).order("created_at", { ascending: false }).maybeSingle();
      setApplication(a);
      return;
    }
    setPf({
      name: s.name ?? "",
      tagline: s.tagline ?? "",
      description: s.description ?? "",
      creator_story: s.creator_story ?? "",
      city: s.city ?? "",
      delegation: s.delegation ?? "",
      categories: s.categories ?? [],
      instagram_url: s.instagram_url ?? "",
      facebook_url: s.facebook_url ?? "",
      tiktok_url: s.tiktok_url ?? "",
      whatsapp_number: s.whatsapp_number ?? "",
      logo_url: s.logo_url ?? "",
      cover_url: s.cover_url ?? "",
    });
    const [{ count: clicksCount }, { data: prods }, { data: views }] = await Promise.all([
      supabase.from("purchase_clicks").select("id", { count: "exact", head: true }).eq("startup_id", s.id),
      supabase.from("products").select("*").eq("startup_id", s.id).order("created_at", { ascending: false }),
      supabase.from("product_views")
        .select("created_at, product_id, products!inner(name, startup_id)")
        .eq("products.startup_id", s.id)
        .gte("created_at", new Date(Date.now() - 30 * 86400000).toISOString()),
    ]);
    setClicks(clicksCount ?? 0);
    setProducts(prods ?? []);
    // 30-day views series
    const buckets: Record<string, number> = {};
    for (let i = 29; i >= 0; i--) {
      const d = new Date(Date.now() - i * 86400000);
      buckets[d.toISOString().slice(5, 10)] = 0;
    }
    const topMap: Record<string, { name: string; views: number }> = {};
    (views ?? []).forEach((v: any) => {
      const k = new Date(v.created_at).toISOString().slice(5, 10);
      if (k in buckets) buckets[k]++;
      const pid = v.product_id;
      const pname = v.products?.name ?? "—";
      topMap[pid] = { name: pname, views: (topMap[pid]?.views ?? 0) + 1 };
    });
    setViews30d(Object.entries(buckets).map(([date, count]) => ({ date, count })));
    setTopProducts(Object.values(topMap).sort((a, b) => b.views - a.views).slice(0, 5));
  };

  useEffect(() => { if (user) refreshAll(user.id); }, [user]);

  const delegations = pf.city ? TUNISIA_DELEGATIONS[pf.city as keyof typeof TUNISIA_DELEGATIONS] ?? [] : [];

  const uploadAsset = async (file: File, kind: "logo_url" | "cover_url") => {
    if (!user || !startup) return;
    const ext = file.name.split(".").pop();
    const path = `${user.id}/${startup.id}/${kind}-${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("startup-assets").upload(path, file);
    if (error) return toast({ title: error.message, variant: "destructive" });
    const { data } = supabase.storage.from("startup-assets").getPublicUrl(path);
    setPf((p) => ({ ...p, [kind]: data.publicUrl }));
  };

  const saveProfile = async () => {
    if (!startup) return;
    if (!pf.name.trim()) return toast({ title: t("dashboard.creator.toastBrandRequired"), variant: "destructive" });
    if (pf.categories.length === 0) return toast({ title: t("dashboard.creator.toastCategoryRequired"), variant: "destructive" });
    setSavingProfile(true);
    const { error } = await supabase.from("startups").update({
      name: pf.name.trim(),
      tagline: pf.tagline || null,
      description: pf.description || null,
      creator_story: pf.creator_story || null,
      city: pf.city || null,
      delegation: pf.delegation || null,
      categories: pf.categories,
      category: pf.categories[0] ?? null,
      instagram_url: pf.instagram_url || null,
      facebook_url: pf.facebook_url || null,
      tiktok_url: pf.tiktok_url || null,
      whatsapp_number: pf.whatsapp_number || null,
      logo_url: pf.logo_url || null,
      cover_url: pf.cover_url || null,
    }).eq("id", startup.id);
    setSavingProfile(false);
    if (error) return toast({ title: error.message, variant: "destructive" });
    toast({ title: t("dashboard.creator.toastProfileUpdated") });
    refreshAll(user!.id);
  };

  const deleteProduct = async (id: string) => {
    const { error } = await supabase.from("products").delete().eq("id", id);
    if (error) return toast({ title: error.message, variant: "destructive" });
    toast({ title: t("dashboard.creator.toastProductDeleted") });
    refreshAll(user!.id);
  };

  const toggleLive = async () => {
    if (!startup) return;
    const newLive = !startup.is_live;

    if (newLive) {
      try {
        const mediaStream = await navigator.mediaDevices.getUserMedia({ 
          video: { facingMode: facingMode }, 
          audio: true 
        });
        setStream(mediaStream);
      } catch (err) {
        console.error("Accès caméra refusé:", err);
        return toast({ title: "Erreur", description: "Veuillez autoriser l'accès à la caméra et au micro.", variant: "destructive" });
      }
    } else {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
        setStream(null);
      }
    }

    const { error } = await supabase.from("startups").update({
      is_live: newLive,
      live_started_at: newLive ? new Date().toISOString() : null,
    }).eq("id", startup.id);
    
    if (error) return toast({ title: error.message, variant: "destructive" });
    toast({ title: newLive ? t("dashboard.creator.toastLiveStarted") : t("dashboard.creator.toastLiveEnded") });
    refreshAll(user!.id);
  };

  const switchCamera = async () => {
    if (!stream) return;
    const newMode = facingMode === "user" ? "environment" : "user";
    setFacingMode(newMode);
    stream.getVideoTracks().forEach(track => track.stop());
    try {
      const newStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: newMode },
        audio: true
      });
      setStream(newStream);
    } catch (err) {
      console.error("Erreur switch caméra:", err);
      toast({ title: "Erreur", description: "Impossible d'accéder à l'autre caméra.", variant: "destructive" });
    }
  };

  // Attache la vidéo
  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream, startup?.is_live]);

  // Nettoyage de la caméra
  useEffect(() => {
    return () => {
      if (stream) stream.getTracks().forEach(track => track.stop());
    };
  }, [stream]);

  // 🚀 MOTEUR DE SIMULATION : Vues et Commentaires
  useEffect(() => {
    let viewsInterval;
    let commentsInterval;

    if (startup?.is_live) {
      // 1. Simulation des vues (ça monte et ça descend)
      setViewerCount(Math.floor(Math.random() * 20) + 15); // Démarre entre 15 et 35
      viewsInterval = setInterval(() => {
        setViewerCount(prev => Math.max(5, prev + (Math.floor(Math.random() * 11) - 5))); // +/- 5 vues
      }, 3000);

      // 2. Simulation des commentaires
      const fakeUsers = ["Sarah", "Ahmed", "Julien_99", "Marie.C", "Karim"];
      const fakeMsgs = ["Trop bien le concept !", "Salut !! 👋", "On vous regarde depuis Paris", "C'est dispo quand ?", "J'adore 😍", "Continuez comme ça !"];
      
      commentsInterval = setInterval(() => {
        const user = fakeUsers[Math.floor(Math.random() * fakeUsers.length)];
        const msg = fakeMsgs[Math.floor(Math.random() * fakeMsgs.length)];
        
        setComments(prev => {
          const newComments = [...prev, { id: Date.now(), user, msg }];
          return newComments.slice(-6); // On garde seulement les 6 derniers messages pour ne pas remplir l'écran
        });
      }, 4500); // Un commentaire toutes les 4,5 secondes

    } else {
      setViewerCount(0);
      setComments([]); // Vide les commentaires si le live s'arrête
    }

    return () => {
      clearInterval(viewsInterval);
      clearInterval(commentsInterval);
    };
  }, [startup?.is_live]);
  const markNewPost = async () => {
    if (!startup) return;
    await supabase.from("startups").update({ last_post_at: new Date().toISOString() }).eq("id", startup.id);
    toast({ title: t("dashboard.creator.toastNewPost") });
    refreshAll(user!.id);
  };

  if (loading) return <PageLayout><div className="container py-20 text-center">{t("common.loading")}</div></PageLayout>;
  if (!user) return <Navigate to="/login" replace />;

  if (!startup) {
    return (
      <PageLayout>
        <div className="container py-12">
          <h1 className="font-serif text-4xl font-bold">{t("dashboard.creator.title")}</h1>
          <div className="mt-8 rounded-2xl bg-card p-8 text-center shadow-card">
            {application ? (
              <>
                <Badge className="mb-3">{application.status}</Badge>
                <p className="text-muted-foreground">{t("dashboard.creator.applicationPending")}</p>
              </>
            ) : (
              <p className="text-muted-foreground">{t("dashboard.creator.noStartup")}</p>
            )}
          </div>
        </div>
      </PageLayout>
    );
  }

  const totalViews = views30d.reduce((s, d) => s + d.count, 0);

  return (
    <PageLayout>
      <div className="container py-10">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="font-serif text-4xl font-bold">{startup.name}</h1>
            <p className="text-muted-foreground">{startup.tagline}</p>
          </div>
          <Badge variant={startup.is_live ? "destructive" : "secondary"} className="gap-1">
            <Radio className="h-3 w-3" /> {startup.is_live ? t("dashboard.creator.live") : t("dashboard.creator.offline")}
          </Badge>
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard icon={Heart} label={t("dashboard.creator.totalLikes")} value={startup.likes_count} />
          <StatCard icon={Users} label={t("dashboard.creator.totalSupporters")} value={startup.supporters_count} />
          <StatCard icon={MessageCircle} label={t("dashboard.creator.purchaseClicks")} value={clicks} />
          <StatCard icon={Eye} label={t("dashboard.creator.views30d")} value={totalViews} />
        </div>

        <Tabs defaultValue="stats" className="mt-8">
          <TabsList className="flex-wrap">
            <TabsTrigger value="stats">{t("dashboard.creator.tabStats")}</TabsTrigger>
            <TabsTrigger value="profile">{t("dashboard.creator.tabProfile")}</TabsTrigger>
            <TabsTrigger value="products">{t("dashboard.creator.tabProducts")} ({products.length})</TabsTrigger>
            <TabsTrigger value="live">{t("dashboard.creator.tabLive")}</TabsTrigger>
            <TabsTrigger value="calendar">{t("liveCalendar.creator.tab")}</TabsTrigger>
          </TabsList>

          {/* STATS */}
          <TabsContent value="stats" className="space-y-6">
            <Card>
              <CardHeader><CardTitle>{t("dashboard.creator.chartViews")}</CardTitle></CardHeader>
              <CardContent className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={views30d}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis dataKey="date" className="text-xs" />
                    <YAxis allowDecimals={false} className="text-xs" />
                    <Tooltip contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))" }} />
                    <Line type="monotone" dataKey="count" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle>{t("dashboard.creator.chartTop5")}</CardTitle></CardHeader>
              <CardContent className="h-72">
                {topProducts.length === 0 ? (
                  <p className="text-sm text-muted-foreground">{t("dashboard.creator.noViewsYet")}</p>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={topProducts}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                      <XAxis dataKey="name" className="text-xs" />
                      <YAxis allowDecimals={false} className="text-xs" />
                      <Tooltip contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))" }} />
                      <Bar dataKey="views" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* PROFILE */}
          <TabsContent value="profile">
            <Card>
              <CardContent className="space-y-4 pt-6">
                <div className="grid gap-4 sm:grid-cols-2">
                  <AssetUploader label={t("dashboard.creator.logo")} url={pf.logo_url} onPick={(f) => uploadAsset(f, "logo_url")} onClear={() => setPf((p) => ({ ...p, logo_url: "" }))} />
                  <AssetUploader label={t("dashboard.creator.cover")} url={pf.cover_url} onPick={(f) => uploadAsset(f, "cover_url")} onClear={() => setPf((p) => ({ ...p, cover_url: "" }))} wide />
                </div>
                <div>
                  <Label>{t("dashboard.creator.brandName")} *</Label>
                  <Input value={pf.name} onChange={(e) => setPf({ ...pf, name: e.target.value })} />
                </div>
                <div>
                  <Label>{t("dashboard.creator.tagline")}</Label>
                  <Input value={pf.tagline} onChange={(e) => setPf({ ...pf, tagline: e.target.value })} maxLength={120} />
                </div>
                <div>
                  <Label>{t("dashboard.creator.description")}</Label>
                  <Textarea rows={3} value={pf.description} onChange={(e) => setPf({ ...pf, description: e.target.value })} />
                </div>
                <div>
                  <Label>{t("dashboard.creator.creatorStory")}</Label>
                  <Textarea rows={4} value={pf.creator_story} onChange={(e) => setPf({ ...pf, creator_story: e.target.value })} />
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <Label>{t("dashboard.creator.city")}</Label>
                    <Select value={pf.city} onValueChange={(v) => setPf({ ...pf, city: v, delegation: "" })}>
                      <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                      <SelectContent className="bg-popover">
                        {TUNISIA_GOVERNORATES.map((g) => <SelectItem key={g} value={g}>{g}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>{t("dashboard.creator.delegation")}</Label>
                    <Select value={pf.delegation} onValueChange={(v) => setPf({ ...pf, delegation: v })} disabled={!pf.city}>
                      <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                      <SelectContent className="bg-popover">
                        {delegations.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div>
                  <Label>{t("dashboard.creator.categories")} *</Label>
                  <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
                    {CATEGORIES_KEYS.map((c) => {
                      const checked = pf.categories.includes(c);
                      return (
                        <label key={c} className="flex cursor-pointer items-center gap-2 rounded-md border border-border p-2 text-xs hover:bg-accent">
                          <Checkbox checked={checked} onCheckedChange={() =>
                            setPf((f) => ({ ...f, categories: checked ? f.categories.filter((k) => k !== c) : [...f.categories, c] }))
                          } />
                          {t(`categoriesExt.${c}`)}
                        </label>
                      );
                    })}
                  </div>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div><Label>{t("dashboard.creator.whatsapp")}</Label><Input value={pf.whatsapp_number} onChange={(e) => setPf({ ...pf, whatsapp_number: e.target.value })} /></div>
                  <div><Label>{t("dashboard.creator.instagram")}</Label><Input value={pf.instagram_url} onChange={(e) => setPf({ ...pf, instagram_url: e.target.value })} /></div>
                  <div><Label>{t("dashboard.creator.facebook")}</Label><Input value={pf.facebook_url} onChange={(e) => setPf({ ...pf, facebook_url: e.target.value })} /></div>
                  <div><Label>{t("dashboard.creator.tiktok")}</Label><Input value={pf.tiktok_url} onChange={(e) => setPf({ ...pf, tiktok_url: e.target.value })} /></div>
                </div>
                <Button onClick={saveProfile} disabled={savingProfile} className="gradient-warm text-primary-foreground">
                  {savingProfile ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                  {t("dashboard.creator.save")}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* PRODUCTS */}
          <TabsContent value="products">
            <div className="mb-4 flex justify-end">
              <Button onClick={() => { setProductEdit(null); setProductOpen(true); }} className="gradient-warm text-primary-foreground">
                <Plus className="mr-2 h-4 w-4" /> {t("dashboard.creator.newProduct")}
              </Button>
            </div>
            {products.length === 0 ? (
              <Card><CardContent className="py-12 text-center text-muted-foreground">{t("dashboard.creator.noProducts")}</CardContent></Card>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {products.map((p) => (
                  <Card key={p.id} className="overflow-hidden">
                    <div className="aspect-square bg-muted">
                      {p.images?.[0] ? (
                        <img src={p.images[0]} alt={p.name} className="h-full w-full object-cover" />
                      ) : (
                        <div className="flex h-full items-center justify-center text-muted-foreground"><ImageIcon /></div>
                      )}
                    </div>
                    <CardContent className="space-y-2 p-4">
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="font-semibold leading-tight">{p.name}</h3>
                        {p.is_eco && <Leaf className="h-4 w-4 shrink-0 text-green-600" />}
                      </div>
                      <p className="text-sm text-primary">{p.price} {p.currency}</p>
                      <p className="line-clamp-2 text-xs text-muted-foreground">{p.description}</p>
                      <div className="flex gap-2 pt-2">
                        <Button size="sm" variant="outline" className="flex-1" onClick={() => { setProductEdit(p); setProductOpen(true); }}>
                          <Pencil className="mr-1 h-3 w-3" /> {t("dashboard.creator.edit")}
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button size="sm" variant="destructive"><Trash2 className="h-3 w-3" /></Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent className="bg-background">
                            <AlertDialogHeader>
                              <AlertDialogTitle>{t("dashboard.creator.deleteProductTitle")}</AlertDialogTitle>
                              <AlertDialogDescription>{t("dashboard.creator.deleteProductDesc")}</AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
                              <AlertDialogAction onClick={() => deleteProduct(p.id)}>{t("common.delete")}</AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}

            <ProductFormDialog
              open={productOpen}
              onOpenChange={setProductOpen}
              startupId={startup.id}
              ownerId={user.id}
              product={productEdit}
              onSaved={() => refreshAll(user.id)}
            />
          </TabsContent>

          {/* LIVE */}
          <TabsContent value="live">
            <Card>
              <CardHeader><CardTitle className="flex items-center gap-2"><Radio className="h-5 w-5 text-primary" /> {t("dashboard.creator.liveTitle")}</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                
                {/* L'ÉCRAN VIDÉO DU CRÉATEUR */}
                <div className="relative aspect-video w-full max-w-3xl overflow-hidden rounded-xl bg-black flex items-center justify-center">
                  {startup?.is_live ? (
                    <video 
                      ref={videoRef} 
                      autoPlay 
                      muted
                      playsInline
                      className={`h-full w-full object-cover ${facingMode === "user" ? "transform scale-x-[-1]" : ""}`} 
                    />
                    {/* 👇 LE BADGE DES SPECTATEURS EN DIRECT */}
                    {startup?.is_live && (
                      <div className="absolute top-4 left-4 bg-red-600 text-white px-2.5 py-1 rounded-md text-xs font-semibold flex items-center gap-1.5 shadow-lg animate-pulse">
                        <span className="h-2 w-2 rounded-full bg-white animate-ping" />
                        <span>• LIVE</span>
                        <span className="ml-1 flex items-center gap-1">
                          👁️ {viewerCount}
                        </span>
                      </div>
                    )}
                  ) : (
                    <div className="flex flex-col items-center justify-center text-muted-foreground/40">
                      <Radio className="h-12 w-12 mb-2" />
                      <p>La caméra est éteinte</p>
                    </div>
                  )}
                </div>

                <div className="flex flex-wrap items-center justify-between gap-4 pt-2">
                  <div className="flex items-center gap-4">
                    <p className="text-sm text-muted-foreground">
                      {startup?.is_live
                        ? t("dashboard.creator.liveActiveSince", { time: startup.live_started_at ? new Date(startup.live_started_at).toLocaleTimeString() : "—" })
                        : t("dashboard.creator.liveInvite")}
                    </p>

                    <div className="flex items-center gap-1 text-sm text-muted-foreground border-l pl-4 border-border">
                      👁️ <span className="font-medium text-foreground">{viewerCount || 0} vues</span>
                    </div>
                  </div>
                  
                  <div className="flex gap-2">
                    {startup?.is_live && (
                      <Button onClick={switchCamera} variant="outline">
                        🔄 Tourner la caméra
                      </Button>
                    )}

                    <Button 
                      onClick={toggleLive} 
                      variant={startup?.is_live ? "destructive" : "default"} 
                      className={startup?.is_live ? "" : "gradient-warm text-primary-foreground"}
                    >
                      {startup?.is_live ? t("dashboard.creator.stopLive") : t("dashboard.creator.startLive")}
                    </Button>
                  </div>
                  </div>
                </div>

              </CardContent>
            </Card>
            
            <Card className="mt-6">
              <CardHeader><CardTitle>{t("dashboard.creator.newPostTitle")}</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  {t("dashboard.creator.newPostDesc", { time: startup?.last_post_at ? new Date(startup.last_post_at).toLocaleString() : t("dashboard.creator.never") })}
                </p>
                <Button onClick={markNewPost} variant="outline">{t("dashboard.creator.signalNew")}</Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* CALENDAR */}
          <TabsContent value="calendar">
            <LiveScheduleManager startupId={startup.id} />
          </TabsContent>
        </Tabs>
      </div>
    </PageLayout>
  );
}

function StatCard({ icon: Icon, label, value }: any) {
  return (
    <div className="rounded-2xl bg-card p-6 shadow-card">
      <Icon className="h-6 w-6 text-primary" />
      <div className="mt-3 text-3xl font-bold">{value}</div>
      <div className="text-sm text-muted-foreground">{label}</div>
    </div>
  );
}

function AssetUploader({ label, url, onPick, onClear, wide }: { label: string; url: string; onPick: (f: File) => void; onClear: () => void; wide?: boolean }) {
  return (
    <div>
      <Label>{label}</Label>
      <div className={`mt-2 flex ${wide ? "h-32" : "h-32 w-32"} items-center justify-center overflow-hidden rounded-lg border-2 border-dashed bg-muted`}>
        {url ? (
          <div className="relative h-full w-full">
            <img src={url} alt="" className="h-full w-full object-cover" />
            <Button size="sm" variant="destructive" className="absolute right-1 top-1 h-6 px-2" onClick={onClear}>×</Button>
          </div>
        ) : (
          <label className="flex h-full w-full cursor-pointer items-center justify-center text-xs text-muted-foreground">
            + ajouter
            <input type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && onPick(e.target.files[0])} />
          </label>
        )}
      </div>
    </div>
  );
}
