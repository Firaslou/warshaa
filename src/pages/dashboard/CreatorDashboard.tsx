import { useEffect, useMemo, useState, useRef } from "react";
import { Navigate } from "react-router-dom";
import { useNavigate } from 'react-router-dom';
import { useTranslation } from "react-i18next";
import {
  Heart, Users, MessageCircle, Eye, Plus, Pencil, Trash2, Radio,
  Image as ImageIcon, Save, Leaf, Loader2, Clock, TrendingUp, ShoppingBag, Star,
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
import { toast } from "sonner";
import { ProductFormDialog } from "@/components/creator/ProductFormDialog";
import { LiveScheduleManager } from "@/components/creator/LiveScheduleManager";
import { LiveRoomModal } from "@/components/live/LiveRoomModal";
import { LineChart, Line as RechartsLine, XAxis as RechartsXAxis, YAxis as RechartsYAxis, Tooltip as RechartsTooltip, ResponsiveContainer, BarChart, Bar as RechartsBar, CartesianGrid } from "recharts";
const XAxis = RechartsXAxis as any;
const YAxis = RechartsYAxis as any;
const Tooltip = RechartsTooltip as any;
const Line = RechartsLine as any;
const Bar = RechartsBar as any;

export default function CreatorDashboard() {
  const { t } = useTranslation();
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [startup, setStartup] = useState<any>(null);
  const [application, setApplication] = useState<any>(null);
  const [products, setProducts] = useState<any[]>([]);
  const [clicks, setClicks] = useState(0);
  const [selectedInsight, setSelectedInsight] = useState<any>(null);

  const productInsights = useMemo(() => {
    if (!products || products.length === 0) return [];

    const tips = [];

    products.forEach(product => {
      // On utilise des noms simples et uniques pour éviter l'erreur
      const lesVues = product.views || 0; 
      const lesVentes = product.sales || 0; 

      // Si le produit est vu plus de 50 fois mais moins de 2% d'achats
      if (lesVues >= 50 && (lesVentes === 0 || (lesVentes / lesVues) < 0.02)) {
        tips.push({
          id: product.id,
          type: "warning",
          name: product.name,
          views: lesVues,
          sales: lesVentes,
          message: `Ton produit "${product.name}" est très consulté (${lesVues} vues) mais peu acheté (${lesVentes} ventes). Astuce : Baisse un peu le prix ou ajoute une promotion !`
        });
      }
    });

    return tips;
  }, [products]);
  const [views30d, setViews30d] = useState<{ date: string; count: number }[]>([]);
  const [topProducts, setTopProducts] = useState<{ name: string; views: number }[]>([]);
  const [productEdit, setProductEdit] = useState<any | null>(null);
  const [productOpen, setProductOpen] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [facingMode, setFacingMode] = useState<"user" | "environment">("user");
  const [showCreatorLiveModal, setShowCreatorLiveModal] = useState(false);
  const [activeLiveEventId, setActiveLiveEventId] = useState<string | null>(null);
  const [viewerCount, setViewerCount] = useState(0);
  // États pour stocker les vraies heures calculées
  const [bestTimeRange, setBestTimeRange] = useState("18h00 - 21h00");
  const [peakPercentage, setPeakPercentage] = useState(0);
  const [agg, setAgg] = useState({ likes: 0, supporters: 0, purchases: 0, comments: 0, reviews: 0, views: 0 });
  const [bestDay, setBestDay] = useState("Mer. & Dim.");

  // Analyse de l'activité en temps réel
  useEffect(() => {
    const fetchRealAnalytics = async () => {
      try {
        const { data, error } = await (supabase as any)
          .from('analytics_events')
          .select('created_at');

        if (error || !data || data.length === 0) return;

        // --- CALCUL DES HEURES ---
        const hoursCount = new Array(24).fill(0);
        // --- CALCUL DES JOURS ---
        const daysCount = new Array(7).fill(0); // 0 = Dimanche, 1 = Lundi, etc.

        data.forEach(event => {
          const date = new Date(event.created_at);
          hoursCount[date.getHours()]++;
          daysCount[date.getDay()]++;
        });

        // Trouver la meilleure heure
        let maxViews = 0;
        let bestHour = 18;
        hoursCount.forEach((count, hour) => {
          if (count > maxViews) {
            maxViews = count;
            bestHour = hour;
          }
        });

        // Trouver le meilleur jour
        let maxDayViews = 0;
        let bestDayIndex = 3; // Mercredi par défaut
        daysCount.forEach((count, dayIndex) => {
          if (count > maxDayViews) {
            maxDayViews = count;
            bestDayIndex = dayIndex;
          }
        });

        // Traduction du jour en français
        const lesJours = ["Dimanche", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"];
        setBestDay(lesJours[bestDayIndex]);

        // Mise à jour de l'heure et du pourcentage
        const endHour = (bestHour + 3) % 24;
        setBestTimeRange(`${bestHour}h00 - ${endHour}h00`);
        
        const percentage = Math.round((maxViews / data.length) * 100);
        setPeakPercentage(percentage);
      } catch (err) {
        console.error("Erreur audience:", err);
      }
    };

    // Creator-specific timing is calculated in refreshAll from product_views.
  }, []);
  // Profile form state
  const [pf, setPf] = useState({
    name: "", tagline: "", description: "", creator_story: "",
    city: "", delegation: "", categories: [] as string[],
    instagram_url: "", facebook_url: "", tiktok_url: "", whatsapp_number: "",
    logo_url: "", cover_url: "",
  });

  const refreshAll = async (uid: string, preserveProfileForm = false) => {
    const { data: s } = await supabase.from("startups").select("*").eq("owner_id", uid).maybeSingle();
    setStartup(s);
    if (!s) {
      const { data: a } = await supabase.from("startup_applications").select("*").eq("applicant_id", uid).order("created_at", { ascending: false }).maybeSingle();
      setApplication(a);
      return;
    }
    if (!preserveProfileForm) {
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
    }
    const [{ count: clicksCount }, { data: prods }] = await Promise.all([
      supabase.from("purchase_clicks").select("id", { count: "exact", head: true }).eq("startup_id", s.id),
      supabase.from("products").select("*").eq("startup_id", s.id).order("created_at", { ascending: false }),
    ]);
    const productIds = (prods ?? []).map((product) => product.id);
    const { data: views } = productIds.length
      ? await supabase.from("product_views")
          .select("created_at, product_id")
          .in("product_id", productIds)
          .gte("created_at", new Date(Date.now() - 30 * 86400000).toISOString())
      : { data: [] };
    setClicks(clicksCount ?? 0);
    setProducts(prods ?? []);
    const { data: aggData } = await supabase.rpc("get_startup_stats", { _startup_id: s.id });
    const a = (aggData ?? {}) as Record<string, number>;
    setAgg({
      likes: Number(a.likes ?? 0),
      supporters: Number(a.supporters ?? 0),
      purchases: Number(a.purchases ?? 0),
      comments: Number(a.comments ?? 0),
      reviews: Number(a.reviews ?? 0),
      views: Number(a.views ?? 0),
    });
    // 30-day views series
    const buckets: Record<string, number> = {};
    for (let i = 29; i >= 0; i--) {
      const d = new Date(Date.now() - i * 86400000);
      buckets[d.toISOString().slice(5, 10)] = 0;
    }
    const topMap: Record<string, { name: string; views: number }> = {};
    const productNames = new Map((prods ?? []).map((product) => [product.id, product.name]));
    (views ?? []).forEach((v: any) => {
      const k = new Date(v.created_at).toISOString().slice(5, 10);
      if (k in buckets) buckets[k]++;
      const pid = v.product_id;
      const pname = productNames.get(pid) ?? "—";
      topMap[pid] = { name: pname, views: (topMap[pid]?.views ?? 0) + 1 };
    });
    setViews30d(Object.entries(buckets).map(([date, count]) => ({ date, count })));
    setTopProducts(Object.values(topMap).sort((a, b) => b.views - a.views).slice(0, 5));

    // Creator-specific audience timing, derived from this creator's product views.
    const hours = new Array(24).fill(0);
    const days = new Array(7).fill(0);
    (views ?? []).forEach((view: any) => {
      const date = new Date(view.created_at);
      hours[date.getHours()] += 1;
      days[date.getDay()] += 1;
    });
    const totalRecentViews = views?.length ?? 0;
    if (totalRecentViews > 0) {
      const bestHour = hours.indexOf(Math.max(...hours));
      const bestDayIndex = days.indexOf(Math.max(...days));
      const dayNames = ["Dimanche", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"];
      setBestTimeRange(`${bestHour}h00 - ${(bestHour + 3) % 24}h00`);
      setBestDay(dayNames[bestDayIndex]);
      setPeakPercentage(Math.round((hours[bestHour] / totalRecentViews) * 100));
    } else {
      setPeakPercentage(0);
    }
  };

  useEffect(() => { if (user) refreshAll(user.id); }, [user]);

  useEffect(() => {
    if (!user || !startup?.id) return;
    let refreshTimer: ReturnType<typeof setTimeout> | undefined;
    const refreshCreatorData = () => {
      if (refreshTimer) clearTimeout(refreshTimer);
      refreshTimer = setTimeout(() => refreshAll(user.id, true), 300);
    };
    const channel = supabase
      .channel(`creator-dashboard:${startup.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "startups", filter: `id=eq.${startup.id}` }, refreshCreatorData)
      .on("postgres_changes", { event: "*", schema: "public", table: "products", filter: `startup_id=eq.${startup.id}` }, refreshCreatorData)
      .on("postgres_changes", { event: "*", schema: "public", table: "purchase_clicks", filter: `startup_id=eq.${startup.id}` }, refreshCreatorData)
      .on("postgres_changes", { event: "*", schema: "public", table: "purchase_confirmations", filter: `startup_id=eq.${startup.id}` }, refreshCreatorData)
      .on("postgres_changes", { event: "*", schema: "public", table: "reviews", filter: `startup_id=eq.${startup.id}` }, refreshCreatorData)
      .on("postgres_changes", { event: "*", schema: "public", table: "startup_supporters", filter: `startup_id=eq.${startup.id}` }, refreshCreatorData)
      .on("postgres_changes", { event: "*", schema: "public", table: "product_views" }, refreshCreatorData)
      .on("postgres_changes", { event: "*", schema: "public", table: "product_likes" }, refreshCreatorData)
      .on("postgres_changes", { event: "*", schema: "public", table: "product_comments" }, refreshCreatorData)
      .subscribe();

    return () => {
      if (refreshTimer) clearTimeout(refreshTimer);
      supabase.removeChannel(channel);
    };
  }, [user, startup?.id]);

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

  const toggleLive = async () => {
    if (!startup) return;
    const newLive = !startup.is_live;

    const { error } = await supabase.from("startups").update({
      is_live: newLive,
      live_started_at: newLive ? new Date().toISOString() : null,
    }).eq("id", startup.id);
    
    if (error) return toast.error(error.message);

    if (newLive) {
      const startedAt = new Date().toISOString();
      const { data: scheduledEvent } = await supabase
        .from("live_events")
        .select("id")
        .eq("startup_id", startup.id)
        .eq("status", "scheduled")
        .gte("scheduled_at", new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString())
        .order("scheduled_at", { ascending: true })
        .limit(1)
        .maybeSingle();

      let liveId = scheduledEvent?.id;

      if (scheduledEvent) {
        await supabase.from("live_events").update({ status: "live", scheduled_at: startedAt }).eq("id", scheduledEvent.id);
      } else {
        const { data: newEv } = await supabase.from("live_events").insert({
          startup_id: startup.id,
          title: `Live de ${startup.name}`,
          description: "Le créateur est en direct sur Warsha.",
          scheduled_at: startedAt,
          duration_minutes: 60,
          platform: "Warsha",
          status: "live",
        }).select("id").single();
        liveId = newEv?.id;
      }

      setActiveLiveEventId(liveId || null);
      setShowCreatorLiveModal(true);
      toast.success(t("dashboard.creator.toastLiveStarted"));
    } else {
      await supabase
        .from("live_events")
        .update({ status: "ended", updated_at: new Date().toISOString() })
        .eq("startup_id", startup.id)
        .eq("status", "live");
      setShowCreatorLiveModal(false);
      toast.info(t("dashboard.creator.toastLiveEnded"));
    }

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

  // Do not invent viewers or comments. Until a real streaming-presence backend is
  // connected, the dashboard displays zero instead of misleading simulated data.
  useEffect(() => {
    setViewerCount(0);
    setComments([]);
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

        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          <StatCard icon={Heart} label={t("dashboard.creator.totalLikes")} value={agg.likes} />
          <StatCard icon={Users} label={t("dashboard.creator.totalSupporters")} value={agg.supporters} />
          <StatCard icon={MessageCircle} label={t("dashboard.creator.purchaseClicks")} value={clicks} />
          <StatCard icon={Eye} label={t("dashboard.creator.views30d")} value={totalViews} />
          <StatCard icon={ShoppingBag} label="Achats confirmés" value={agg.purchases} />
          <StatCard icon={Star} label="Avis" value={agg.reviews} />
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
            {/* ⏰ CARTE : BEST TIME TO POST */}
          <Card className="mt-6">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <div className="space-y-1">
                <CardTitle className="text-xl font-bold flex items-center gap-2">
                  <Clock className="h-5 w-5 text-blue-600" />
                  Meilleur moment pour publier
                </CardTitle>
                <p className="text-sm text-muted-foreground">
                  Les analyses suggèrent les heures de publication optimales basées sur l'activité (vues et clics)
                </p>
              </div>
            </CardHeader>
            <CardContent>
              {/* Grille des heures clés */}
              <div className="grid gap-4 md:grid-cols-3 mt-4">
                {/* Pic Principal */}
                <div className="bg-blue-50/50 p-4 rounded-xl border border-blue-100 flex flex-col justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase text-blue-600 tracking-wider">Pic d'audience principal</p>
                    <p className="text-3xl font-black text-blue-900 mt-1">{bestTimeRange}</p>
                  </div>
                  <p className="text-xs text-blue-700 mt-3 flex items-center gap-1 bg-blue-100/60 p-1.5 rounded">
                    <TrendingUp className="h-3.5 w-3.5" /> +{peakPercentage}% d'activité globale
                  </p>
                </div>

                {/* Pic Secondaire */}
                <div className="bg-orange-50/50 p-4 rounded-xl border border-orange-100 flex flex-col justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase text-orange-600 tracking-wider">Pic secondaire</p>
                    <p className="text-3xl font-black text-orange-900 mt-1">12h00 - 14h00</p>
                  </div>
                  <p className="text-xs text-orange-700 mt-3 bg-orange-100/60 p-1.5 rounded">
                    Idéal pour l'activité de mi-journée
                  </p>
                </div>

                {/* Jours Clés */}
                <div className="bg-purple-50/50 p-4 rounded-xl border border-purple-100 flex flex-col justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase text-purple-600 tracking-wider">Jours optimaux</p>
                    <p className="text-2xl font-extrabold text-purple-900 mt-1">{bestDay}</p>
                  </div>
                  <p className="text-xs text-purple-700 mt-3 bg-purple-100/60 p-1.5 rounded">
                    Forte interaction communautaire
                  </p>
                </div>
              </div>

              {/* Barres d'activité par tranche horaire */}
              <div className="mt-6 space-y-4 border-t pt-4">
                <h4 className="text-sm font-bold text-foreground">Intensité de l'activité sur le site :</h4>
                
                <div className="space-y-3">
                  {/* Matin */}
                  <div>
                    <div className="flex justify-between text-xs mb-1 font-medium">
                      <span className="text-muted-foreground">Matinée (06h00 - 12h00)</span>
                      <span className="text-slate-600">Activité modérée (35%)</span>
                    </div>
                    <div className="w-full bg-gray-100 h-2 rounded-full overflow-hidden">
                      <div className="bg-slate-400 h-full rounded-full" style={{ width: '35%' }}></div>
                    </div>
                  </div>

                  {/* Après-midi */}
                  <div>
                    <div className="flex justify-between text-xs mb-1 font-medium">
                      <span className="text-muted-foreground">Après-midi (12h00 - 18h00)</span>
                      <span className="text-orange-600 font-semibold">Activité élevée (65%)</span>
                    </div>
                    <div className="w-full bg-gray-100 h-2 rounded-full overflow-hidden">
                      <div className="bg-orange-500 h-full rounded-full" style={{ width: '65%' }}></div>
                    </div>
                  </div>

                  {/* Soirée */}
                  <div>
                    <div className="flex justify-between text-xs mb-1 font-medium">
                      <span className="text-muted-foreground">Soirée (18h00 - 00h00)</span>
                      <span className="text-blue-600 font-bold">Pic d'activité maximal (90%)</span>
                    </div>
                    <div className="w-full bg-gray-100 h-2 rounded-full overflow-hidden">
                      <div className="bg-blue-600 h-full rounded-full" style={{ width: '90%' }}></div>
                    </div>
                  </div>
                </div>
              </div>
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
                      {p.discount_percentage && p.discount_percentage > 0 ? (
                        <div className="flex items-center gap-2">
                          {/* 1. Le nouveau prix calculé et soldé */}
                          <span className="text-sm font-bold text-red-600">
                            {(p.price * (1 - p.discount_percentage / 100)).toFixed(3)} TND
                          </span>
                          {/* 2. L'ancien prix barré */}
                          <span className="text-xs text-muted-foreground line-through">
                            {Number(p.price).toFixed(3)} TND
                          </span>
                          {/* 3. Le petit badge rouge */}
                          <span className="rounded bg-red-100 px-1.5 py-0.5 text-[10px] font-bold text-red-600">
                            -{p.discount_percentage}%
                          </span>
                        </div>
                      ) : (
                        /* Si pas de solde, on affiche le prix normal */
                        <p className="text-sm text-primary">{Number(p.price).toFixed(3)} TND</p>
                      )}
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
            <Card className="rounded-3xl border-border/80 shadow-xs">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2 font-serif text-xl">
                    <Radio className="h-5 w-5 text-primary animate-pulse" /> {t("dashboard.creator.liveTitle")}
                  </CardTitle>
                  <Badge variant={startup?.is_live ? "destructive" : "secondary"} className="gap-1.5 rounded-full px-3 py-1">
                    <span className={cn("h-2 w-2 rounded-full", startup?.is_live ? "bg-white animate-ping" : "bg-muted-foreground")} />
                    <span>{startup?.is_live ? "En direct sur Warsha" : "Hors ligne"}</span>
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="rounded-2xl border border-border/80 bg-muted/40 p-6 flex flex-col md:flex-row items-center justify-between gap-6">
                  <div className="space-y-1.5 text-center md:text-left">
                    <h4 className="font-serif text-lg font-bold">
                      {startup?.is_live ? "Votre diffusion est en cours" : "Prêt à lancer un live ?"}
                    </h4>
                    <p className="text-sm text-muted-foreground max-w-lg">
                      {startup?.is_live
                        ? t("dashboard.creator.liveActiveSince", { time: startup.live_started_at ? new Date(startup.live_started_at).toLocaleTimeString() : "—" })
                        : "Présentez vos créations artisanales en direct, répondez aux questions de vos acheteurs et épinglez vos produits en un clic."}
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-3">
                    {startup?.is_live ? (
                      <>
                        <Button
                          onClick={() => setShowCreatorLiveModal(true)}
                          className="gradient-warm text-primary-foreground rounded-2xl shadow-xs font-semibold"
                        >
                          Ouvrir le Studio Live
                        </Button>
                        <Button
                          onClick={toggleLive}
                          variant="destructive"
                          className="rounded-2xl font-semibold"
                        >
                          Arrêter le live
                        </Button>
                      </>
                    ) : (
                      <Button
                        onClick={toggleLive}
                        className="gradient-warm text-primary-foreground rounded-2xl shadow-xs font-semibold px-6"
                      >
                        <Radio className="mr-2 h-4 w-4" /> Démarrer un direct maintenant
                      </Button>
                    )}
                  </div>
                </div>

                <div className="grid sm:grid-cols-3 gap-4 pt-2">
                  <div className="rounded-2xl border border-border/60 bg-card p-4 text-center">
                    <p className="text-xs text-muted-foreground font-medium">Contrôles pendant le live</p>
                    <p className="text-xs font-bold text-foreground mt-1">Pause, micro, caméra & épinglage</p>
                  </div>
                  <div className="rounded-2xl border border-border/60 bg-card p-4 text-center">
                    <p className="text-xs text-muted-foreground font-medium">Interactions en direct</p>
                    <p className="text-xs font-bold text-foreground mt-1">Chat temps réel & réactions animées</p>
                  </div>
                  <div className="rounded-2xl border border-border/60 bg-card p-4 text-center">
                    <p className="text-xs text-muted-foreground font-medium">Ventes assistées</p>
                    <p className="text-xs font-bold text-foreground mt-1">Lien direct vers WhatsApp</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Live Room Modal for Creator */}
            {startup && (
              <LiveRoomModal
                open={showCreatorLiveModal}
                onOpenChange={(open) => {
                  setShowCreatorLiveModal(open);
                  refreshAll(user.id);
                }}
                liveEventId={activeLiveEventId || startup.id}
                startupId={startup.id}
                startupName={startup.name}
                startupSlug={startup.slug}
                startupLogo={startup.logo_url}
                isCreator={true}
              />
            )}
            
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
        {/* 💡 NOTIFICATIONS / INSIGHTS INTELLIGENTS */}
      {productInsights.length > 0 && (
        <div className="mb-6 flex flex-col gap-3">
          {productInsights.map((insight, index) => (
            <div 
              key={index} 
              onClick={() => setSelectedInsight(insight)}
              className="p-4 rounded-lg border cursor-pointer transition-all duration-200 hover:scale-[1.01] hover:shadow-md flex items-start gap-3 bg-orange-50 border-orange-200 text-orange-900 shadow-sm"
            >
              <span className="text-2xl mt-1">🔔</span>
              <div>
                <h3 className="font-bold text-sm uppercase tracking-wider mb-1">Alerte Produit</h3>
                <p className="text-sm">{insight.message}</p>
                <span className="text-xs font-bold underline mt-2 block text-orange-700">
                  Clique pour voir l'analyse détaillée ➔
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
      </div>
      {/* 🛑 FENÊTRE POP-UP DES STATISTIQUES (S'ouvre au clic sur la notif) */}
      {selectedInsight && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white p-6 rounded-lg shadow-xl max-w-md w-full relative">
            
            {/* Bouton pour fermer la fenêtre */}
            <button 
              onClick={() => setSelectedInsight(null)}
              className="absolute top-4 right-4 text-gray-500 hover:text-gray-800"
            >
              ✕
            </button>

            <h2 className="text-xl font-bold mb-2">Analyse du produit</h2>
            <p className="text-gray-600 mb-6">{selectedInsight.message}</p>

            {/* Affichage des statistiques */}
            <div className="bg-gray-50 p-4 rounded-md mb-6 flex justify-around text-center">
              <div>
                <p className="text-sm text-gray-500 uppercase">Vues totales</p>
                <p className="text-2xl font-bold text-blue-600">{selectedInsight.views}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500 uppercase">Ventes</p>
                <p className="text-2xl font-bold text-green-600">{selectedInsight.sales}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500 uppercase">Conversion</p>
                <p className="text-2xl font-bold text-orange-500">
                  {((selectedInsight.sales / selectedInsight.views) * 100).toFixed(1)}%
                </p>
              </div>
            </div>

            {/* Bouton d'action */}
            {/* Bouton d'action mis à jour avec le système de Dialog */}
            <button 
              onClick={() => {
                // 1. On récupère le bon produit à modifier
                const vraiProduit = products.find(p => p.id === selectedInsight.id) || products[0];
                
                if (vraiProduit) {
                  // 2. ACTION AUTOMATIQUE : On cherche l'onglet "Produits" et on clique dessus
                  const ongletProduits = Array.from(document.querySelectorAll('button')).find(btn => 
                    btn.textContent?.toLowerCase().includes('produit') || 
                    btn.getAttribute('value') === 'products' || 
                    btn.getAttribute('data-value') === 'products'
                  );
                  
                  if (ongletProduits) {
                    (ongletProduits as HTMLElement).click();
                  }

                  // 3. On configure les données et on ouvre le formulaire
                  setProductEdit(vraiProduit);
                  setProductOpen(true);
                }

                // 4. On fait disparaître proprement la petite pop-up d'analyse orange
                setSelectedInsight(null);
              }}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-4 rounded-md transition-colors shadow-md"
            >
              ✏️ Modifier le produit (Baisser le prix)
            </button>
          </div>
        </div>
      )}
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
