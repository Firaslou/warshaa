import { useEffect, useState } from "react";
import { Navigate, Link } from "react-router-dom";
import { Check, X, Flag, Trash2, Users, Store, MessageSquare, Star, FileText, TrendingUp, Eye, Heart, ShoppingBag, Package, Radio, ShieldCheck, Award, MessageCircle, Video } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { PageLayout } from "@/components/layout/PageLayout";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";

type Stats = {
  users: number;
  creators: number;
  startups: number;
  products: number;
  reviews: number;
  comments: number;
  complaints: number;
  pendingApps: number;
  pendingComplaints: number;
  views: number;
  likes: number;
  purchases: number;
  signups7d: number;
  confirmedPurchases: number;
  supporters: number;
};

const applicationStoragePath = (value: string) => {
  if (!value) return "";
  const marker = "/applications/";
  const markerIndex = value.indexOf(marker);
  if (markerIndex >= 0) return decodeURIComponent(value.slice(markerIndex + marker.length).split("?")[0]);
  return value.replace(/^\/+/, "");
};

export default function AdminDashboard() {
  const { t } = useTranslation();
  const { user, loading, isAdmin } = useAuth();
  const [stats, setStats] = useState<Stats | null>(null);
  const [apps, setApps] = useState<any[]>([]);
  const [complaints, setComplaints] = useState<any[]>([]);
  const [creators, setCreators] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [comments, setComments] = useState<any[]>([]);
  const [reviews, setReviews] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [conversations, setConversations] = useState<any[]>([]);
  const [activeConv, setActiveConv] = useState<string | null>(null);
  const [convMessages, setConvMessages] = useState<any[]>([]);
  const [convPreviews, setConvPreviews] = useState<Record<string, { content: string; count: number }>>({});
  const [responses, setResponses] = useState<Record<string, string>>({});
  const [search, setSearch] = useState("");
  const [creatorLikes, setCreatorLikes] = useState<Record<string, number>>({});

  const fetchAll = async () => {
    const sevenAgo = new Date(Date.now() - 7 * 86400000).toISOString();
    const [
      profilesC, rolesC, startupsC, productsC, reviewsC, commentsC, complaintsC,
      pendingAppsC, pendingComplaintsC, viewsC, likesC, purchasesC, signups7C,
      appsR, complaintsR, creatorsR, usersR, commentsR, reviewsR,
      confirmedC, supportersC, likesRows,
    ] = await Promise.all([
      supabase.from("profiles").select("*", { count: "exact", head: true }),
      supabase.from("user_roles").select("*", { count: "exact", head: true }).eq("role", "startup"),
      supabase.from("startups").select("*", { count: "exact", head: true }).eq("status", "approved"),
      supabase.from("products").select("*", { count: "exact", head: true }),
      supabase.from("reviews").select("*", { count: "exact", head: true }),
      supabase.from("product_comments").select("*", { count: "exact", head: true }),
      supabase.from("complaints").select("*", { count: "exact", head: true }),
      supabase.from("startup_applications").select("*", { count: "exact", head: true }).eq("status", "pending"),
      supabase.from("complaints").select("*", { count: "exact", head: true }).eq("status", "pending"),
      supabase.from("product_views").select("*", { count: "exact", head: true }),
      supabase.from("product_likes").select("*", { count: "exact", head: true }),
      supabase.from("purchase_clicks").select("*", { count: "exact", head: true }),
      supabase.from("profiles").select("*", { count: "exact", head: true }).gte("created_at", sevenAgo),
      supabase.from("startup_applications").select("*").order("created_at", { ascending: false }).limit(50),
      supabase.from("complaints").select("*").order("created_at", { ascending: false }),
      supabase.from("startups").select("id, name, slug, city, status, badge, is_live, supporters_count, likes_count, created_at").order("created_at", { ascending: false }).limit(100),
      supabase.from("profiles").select("id, full_name, city, preferred_language, created_at").order("created_at", { ascending: false }).limit(100),
      supabase.from("product_comments").select("id, content, created_at, is_anonymous, user_id, product_id, profiles:user_id(full_name), products:product_id(name)").order("created_at", { ascending: false }).limit(50),
      supabase.from("reviews").select("id, rating, comment, photo_url, created_at, user_id, profiles:user_id(full_name), startups:startup_id(name, slug)").order("created_at", { ascending: false }).limit(50),
      supabase.from("purchase_confirmations").select("*", { count: "exact", head: true }),
      supabase.from("startup_supporters").select("*", { count: "exact", head: true }),
      supabase.from("product_likes").select("product_id, products!inner(startup_id)"),
    ]);

    setStats({
      users: profilesC.count ?? 0,
      creators: rolesC.count ?? 0,
      startups: startupsC.count ?? 0,
      products: productsC.count ?? 0,
      reviews: reviewsC.count ?? 0,
      comments: commentsC.count ?? 0,
      complaints: complaintsC.count ?? 0,
      pendingApps: pendingAppsC.count ?? 0,
      pendingComplaints: pendingComplaintsC.count ?? 0,
      views: viewsC.count ?? 0,
      likes: likesC.count ?? 0,
      purchases: purchasesC.count ?? 0,
      signups7d: signups7C.count ?? 0,
      confirmedPurchases: confirmedC.count ?? 0,
      supporters: supportersC.count ?? 0,
    });
    const likeMap: Record<string, number> = {};
    ((likesRows as any).data ?? []).forEach((l: any) => {
      const sid = l.products?.startup_id;
      if (sid) likeMap[sid] = (likeMap[sid] ?? 0) + 1;
    });
    setCreatorLikes(likeMap);
    const applicationRows = appsR.data ?? [];
    const applicationPaths = [...new Set(applicationRows.flatMap((application: any) => [
      application.proof_video_url,
      ...(application.proof_photos ?? []),
    ]).filter(Boolean).map(applicationStoragePath))];
    const { data: signedApplicationFiles, error: signedFilesError } = applicationPaths.length
      ? await supabase.storage.from("applications").createSignedUrls(applicationPaths, 60 * 60)
      : { data: [], error: null };
    if (signedFilesError) toast.error(signedFilesError.message);
    const signedUrlsByPath = new Map(
      (signedApplicationFiles ?? [])
        .filter((file) => file.signedUrl)
        .map((file) => [file.path, file.signedUrl]),
    );
    setApps(applicationRows.map((application: any) => ({
      ...application,
      proof_video_signed_url: application.proof_video_url
        ? signedUrlsByPath.get(applicationStoragePath(application.proof_video_url)) ?? null
        : null,
      proof_photo_signed_urls: (application.proof_photos ?? [])
        .map((url: string) => signedUrlsByPath.get(applicationStoragePath(url)))
        .filter(Boolean),
    })));
    const complaintRows = complaintsR.data ?? [];
    const complaintReporterIds = [...new Set(complaintRows.map((c: any) => c.reporter_id).filter(Boolean))];
    const complaintStartupIds = [...new Set(complaintRows.map((c: any) => c.startup_id).filter(Boolean))];
    const [complaintProfilesR, complaintStartupsR] = await Promise.all([
      complaintReporterIds.length
        ? supabase.from("profiles").select("id, full_name").in("id", complaintReporterIds)
        : Promise.resolve({ data: [] }),
      complaintStartupIds.length
        ? supabase.from("startups").select("id, name, slug").in("id", complaintStartupIds)
        : Promise.resolve({ data: [] }),
    ]);
    const complaintProfiles = new Map((complaintProfilesR.data ?? []).map((profile: any) => [profile.id, profile]));
    const complaintStartups = new Map((complaintStartupsR.data ?? []).map((startup: any) => [startup.id, startup]));
    setComplaints(complaintRows.map((complaint: any) => ({
      ...complaint,
      profiles: complaintProfiles.get(complaint.reporter_id) ?? null,
      startups: complaintStartups.get(complaint.startup_id) ?? null,
    })));
    setCreators(creatorsR.data ?? []);
    setUsers(usersR.data ?? []);
    setComments(commentsR.data ?? []);
    setReviews(reviewsR.data ?? []);

    const [productsR, convsR] = await Promise.all([
      supabase.from("products").select("id, name, images, in_stock, created_at, startup_id, startups:startup_id(name, slug)").order("created_at", { ascending: false }).limit(100),
      supabase.from("chat_conversations").select("id, created_at, last_message_at, buyer_id, startup_id").order("last_message_at", { ascending: false }).limit(100),
    ]);
    setProducts(productsR.data ?? []);
    const conversationRows = convsR.data ?? [];
    const buyerIds = [...new Set(conversationRows.map((c: any) => c.buyer_id).filter(Boolean))];
    const conversationStartupIds = [...new Set(conversationRows.map((c: any) => c.startup_id).filter(Boolean))];
    const [buyerProfilesR, conversationStartupsR] = await Promise.all([
      buyerIds.length
        ? supabase.from("profiles").select("id, full_name").in("id", buyerIds)
        : Promise.resolve({ data: [] }),
      conversationStartupIds.length
        ? supabase.from("startups").select("id, name, slug").in("id", conversationStartupIds)
        : Promise.resolve({ data: [] }),
    ]);
    const buyerProfiles = new Map((buyerProfilesR.data ?? []).map((profile: any) => [profile.id, profile]));
    const conversationStartups = new Map((conversationStartupsR.data ?? []).map((startup: any) => [startup.id, startup]));
    setConversations(conversationRows.map((conversation: any) => ({
      ...conversation,
      profiles: buyerProfiles.get(conversation.buyer_id) ?? null,
      startups: conversationStartups.get(conversation.startup_id) ?? null,
    })));

    // Fetch a preview (latest message content + total count) per conversation
    const convIds = (convsR.data ?? []).map((c: any) => c.id);
    if (convIds.length > 0) {
      const { data: msgs } = await supabase
        .from("chat_messages")
        .select("conversation_id, content, created_at")
        .in("conversation_id", convIds)
        .order("created_at", { ascending: false });
      const previews: Record<string, { content: string; count: number }> = {};
      (msgs ?? []).forEach((m: any) => {
        if (!previews[m.conversation_id]) {
          previews[m.conversation_id] = { content: m.content ?? "", count: 0 };
        }
        previews[m.conversation_id].count += 1;
      });
      setConvPreviews(previews);
    } else {
      setConvPreviews({});
    }
  };

  useEffect(() => { if (isAdmin) fetchAll(); }, [isAdmin]);

  const decide = async (app: any, status: "approved" | "rejected") => {
    if (status === "approved") {
      const { data, error } = await supabase.functions.invoke("approve-creator-application", { body: { application_id: app.id } });
      if (error) { toast.error(error.message); return; }
      if ((data as any)?.error) { toast.error((data as any).error); return; }
      toast.success(t("dashboard.admin.approved"));
    } else {
      await supabase.from("startup_applications").update({ status, reviewed_at: new Date().toISOString() }).eq("id", app.id);
      toast.success(t("dashboard.admin.rejectedToast"));
    }
    fetchAll();
  };

  const updateComplaint = async (id: string, status: string) => {
    const { error } = await supabase.from("complaints").update({ status: status as any, admin_response: responses[id] ?? null }).eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success(t("dashboard.admin.updated")); fetchAll();
  };

  const deleteComplaint = async (id: string) => {
    await supabase.from("complaints").delete().eq("id", id);
    toast.success(t("dashboard.admin.complaintDeleted")); fetchAll();
  };

  const deleteComment = async (id: string) => {
    await supabase.from("product_comments").delete().eq("id", id);
    toast.success(t("dashboard.admin.commentDeleted")); fetchAll();
  };

  const deleteReview = async (id: string) => {
    await supabase.from("reviews").delete().eq("id", id);
    toast.success(t("dashboard.admin.reviewDeleted")); fetchAll();
  };

  const deleteStartup = async (id: string) => {
    if (!confirm(t("dashboard.admin.confirmDeleteCreator"))) return;
    await supabase.from("startups").delete().eq("id", id);
    toast.success(t("dashboard.admin.creatorDeleted")); fetchAll();
  };

  const deleteProduct = async (id: string) => {
    if (!confirm(t("dashboard.admin.confirmDeleteProduct"))) return;
    await supabase.from("products").delete().eq("id", id);
    toast.success(t("dashboard.admin.productDeleted")); fetchAll();
  };

  const stopLive = async (id: string) => {
    await supabase.from("startups").update({ is_live: false, live_started_at: null }).eq("id", id);
    toast.success(t("dashboard.admin.liveStopped")); fetchAll();
  };

  const setBadge = async (id: string, badge: "new" | "verified" | "certified") => {
    const { error } = await supabase.from("startups").update({ badge }).eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success(`Badge: ${badge}`); fetchAll();
  };

  const openConversation = async (id: string) => {
    setActiveConv(id);
    const { data, error } = await supabase.from("chat_messages").select("id, content, created_at, sender_id, attachments").eq("conversation_id", id).order("created_at", { ascending: true });
    if (error) {
      toast.error(error.message);
      setConvMessages([]);
      return;
    }
    const messages = data ?? [];
    const senderIds = [...new Set(messages.map((message: any) => message.sender_id).filter(Boolean))];
    const { data: senderProfiles } = senderIds.length
      ? await supabase.from("profiles").select("id, full_name").in("id", senderIds)
      : { data: [] };
    const profilesById = new Map((senderProfiles ?? []).map((profile: any) => [profile.id, profile]));
    setConvMessages(messages.map((message: any) => ({
      ...message,
      profiles: profilesById.get(message.sender_id) ?? null,
    })));
  };

  if (loading) return <PageLayout><div className="container py-20 text-center">{t("dashboard.admin.loading")}</div></PageLayout>;
  if (!user) return <Navigate to="/login" replace />;
  if (!isAdmin) return <PageLayout><div className="container py-20 text-center text-muted-foreground">{t("dashboard.admin.accessDenied")}</div></PageLayout>;

  const filteredCreators = creators.filter((c) => c.name?.toLowerCase().includes(search.toLowerCase()) || c.city?.toLowerCase().includes(search.toLowerCase()));
  const filteredUsers = users.filter((u) => u.full_name?.toLowerCase().includes(search.toLowerCase()));

  return (
    <PageLayout>
      <div className="container py-10">
        <div className="mb-8">
          <h1 className="font-serif text-4xl font-bold">{t("dashboard.admin.headerTitle")}</h1>
          <p className="mt-2 text-muted-foreground">{t("dashboard.admin.headerSubtitle")}</p>
        </div>

        {/* STAT CARDS */}
        {stats && (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard icon={<Users className="h-5 w-5" />} label={t("dashboard.admin.users")} value={stats.users} sub={t("dashboard.admin.thisWeek", { n: stats.signups7d })} />
            <StatCard icon={<Store className="h-5 w-5" />} label={t("dashboard.admin.activeCreators")} value={stats.startups} sub={t("dashboard.admin.creatorAccounts", { n: stats.creators })} />
            <StatCard icon={<ShoppingBag className="h-5 w-5" />} label={t("dashboard.admin.products")} value={stats.products} sub={t("dashboard.admin.purchaseClicks", { n: stats.purchases })} />
            <StatCard icon={<Eye className="h-5 w-5" />} label={t("dashboard.admin.productViews")} value={stats.views} sub={t("dashboard.admin.likes", { n: stats.likes })} />
            <StatCard icon={<Star className="h-5 w-5" />} label={t("dashboard.admin.reviews")} value={stats.reviews} />
            <StatCard icon={<MessageSquare className="h-5 w-5" />} label={t("dashboard.admin.comments")} value={stats.comments} />
            <StatCard icon={<FileText className="h-5 w-5" />} label={t("dashboard.admin.pendingApplications")} value={stats.pendingApps} highlight={stats.pendingApps > 0} />
            <StatCard icon={<Flag className="h-5 w-5" />} label={t("dashboard.admin.pendingComplaints")} value={stats.pendingComplaints} highlight={stats.pendingComplaints > 0} />
            <StatCard icon={<ShoppingBag className="h-5 w-5" />} label="Achats confirmés" value={stats.confirmedPurchases} />
            <StatCard icon={<Users className="h-5 w-5" />} label="Soutiens" value={stats.supporters} />
          </div>
        )}

        <Tabs defaultValue="applications" className="mt-10">
          <TabsList className="flex w-full flex-wrap justify-start gap-1 h-auto">
            <TabsTrigger value="applications">{t("dashboard.admin.tabApps")} ({stats?.pendingApps ?? 0})</TabsTrigger>
            <TabsTrigger value="complaints">{t("dashboard.admin.tabComplaints")} ({stats?.pendingComplaints ?? 0})</TabsTrigger>
            <TabsTrigger value="creators">{t("dashboard.admin.tabCreators")}</TabsTrigger>
            <TabsTrigger value="products">{t("dashboard.admin.tabProducts")}</TabsTrigger>
            <TabsTrigger value="chats">{t("dashboard.admin.tabChats")}</TabsTrigger>
            <TabsTrigger value="users">{t("dashboard.admin.tabUsers")}</TabsTrigger>
            <TabsTrigger value="comments">{t("dashboard.admin.tabComments")}</TabsTrigger>
            <TabsTrigger value="reviews">{t("dashboard.admin.tabReviews")}</TabsTrigger>
          </TabsList>

          {/* APPLICATIONS */}
          <TabsContent value="applications" className="mt-6 space-y-4">
            {apps.length === 0 ? (
              <p className="text-muted-foreground">{t("dashboard.admin.noApps")}</p>
            ) : apps.map((a) => (
              <Card key={a.id}>
                <CardContent className="pt-6">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-serif text-xl font-bold">{a.brand_name}</h3>
                        <Badge variant="outline">{a.status}</Badge>
                        <Badge variant="outline">{a.city}</Badge>
                        {(a.categories ?? [a.category]).filter(Boolean).map((c: string) => <Badge key={c} variant="secondary">{c}</Badge>)}
                      </div>
                      <p className="mt-3 text-sm">{a.description}</p>
                      {a.creator_story && <p className="mt-2 text-xs italic text-muted-foreground">"{a.creator_story}"</p>}
                      <p className="mt-2 text-xs text-muted-foreground">📱 {a.whatsapp_number} {a.instagram_url && `· IG`} {a.facebook_url && `· FB`} {a.tiktok_url && `· TikTok`}</p>
                      <p className="mt-1 text-xs text-muted-foreground">{new Date(a.created_at).toLocaleString()}</p>
                      <div className="mt-5 border-t pt-4">
                        <h4 className="mb-3 flex items-center gap-2 text-sm font-semibold">
                          <Video className="h-4 w-4" /> Documents de vérification
                        </h4>
                        <div className="grid gap-4 lg:grid-cols-[minmax(240px,360px)_1fr]">
                          <div>
                            <p className="mb-2 text-xs font-medium text-muted-foreground">Vidéo de preuve</p>
                            {a.proof_video_signed_url ? (
                              <video
                                src={a.proof_video_signed_url}
                                controls
                                preload="metadata"
                                className="max-h-64 w-full rounded-lg border bg-black"
                              />
                            ) : (
                              <p className="rounded-md border border-dashed p-3 text-xs text-muted-foreground">
                                Aucune vidéo disponible.
                              </p>
                            )}
                          </div>
                          <div>
                            <p className="mb-2 text-xs font-medium text-muted-foreground">
                              Photos de preuve ({a.proof_photo_signed_urls?.length ?? 0})
                            </p>
                            {a.proof_photo_signed_urls?.length ? (
                              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                                {a.proof_photo_signed_urls.map((url: string, index: number) => (
                                  <a key={url} href={url} target="_blank" rel="noreferrer" className="group block">
                                    <img
                                      src={url}
                                      alt={`Document de vérification ${index + 1}`}
                                      loading="lazy"
                                      className="aspect-square w-full rounded-lg border object-cover transition group-hover:opacity-80"
                                    />
                                  </a>
                                ))}
                              </div>
                            ) : (
                              <p className="rounded-md border border-dashed p-3 text-xs text-muted-foreground">
                                Aucune photo disponible.
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                    {a.status === "pending" && (
                      <div className="flex gap-2">
                        <Button size="sm" onClick={() => decide(a, "approved")} className="gradient-warm text-primary-foreground"><Check className="mr-1 h-3 w-3" /> {t("dashboard.admin.approve")}</Button>
                        <Button size="sm" variant="outline" onClick={() => decide(a, "rejected")}><X className="mr-1 h-3 w-3" /> {t("dashboard.admin.reject")}</Button>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </TabsContent>

          {/* COMPLAINTS */}
          <TabsContent value="complaints" className="mt-6 space-y-4">
            {complaints.length === 0 ? <p className="text-muted-foreground">{t("dashboard.admin.noComplaints")}</p> : complaints.map((c) => (
              <Card key={c.id}>
                <CardContent className="pt-6">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-serif text-lg font-bold">{c.subject}</h3>
                        <Badge variant="outline">{c.status}</Badge>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {t("dashboard.admin.against")} <strong>{c.startups?.name ?? "—"}</strong> · {t("dashboard.admin.by")} {c.profiles?.full_name ?? t("dashboard.admin.user")} · {new Date(c.created_at).toLocaleString()}
                      </p>
                      <p className="mt-3 whitespace-pre-wrap rounded-md bg-muted/40 p-3 text-sm">{c.message}</p>
                    </div>
                    <Button size="sm" variant="ghost" onClick={() => deleteComplaint(c.id)}><Trash2 className="h-4 w-4" /></Button>
                  </div>
                  <div className="mt-4 grid gap-2 md:grid-cols-[1fr_200px_auto]">
                    <Textarea rows={2} placeholder={t("dashboard.admin.internalReply")} defaultValue={c.admin_response ?? ""} onChange={(e) => setResponses((r) => ({ ...r, [c.id]: e.target.value }))} />
                    <Select defaultValue={c.status} onValueChange={(v) => updateComplaint(c.id, v)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent className="bg-popover">
                        <SelectItem value="pending">{t("dashboard.admin.statusPending")}</SelectItem>
                        <SelectItem value="reviewing">{t("dashboard.admin.statusReviewing")}</SelectItem>
                        <SelectItem value="resolved">{t("dashboard.admin.statusResolved")}</SelectItem>
                        <SelectItem value="rejected">{t("dashboard.admin.statusRejected")}</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button onClick={() => updateComplaint(c.id, c.status)} className="gradient-warm text-primary-foreground">{t("dashboard.admin.save")}</Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </TabsContent>

          {/* CREATORS */}
          <TabsContent value="creators" className="mt-6">
            <Input placeholder={t("dashboard.admin.searchCreator")} value={search} onChange={(e) => setSearch(e.target.value)} className="mb-4 max-w-sm" />
            <Card><CardContent className="p-0">
              <Table>
                <TableHeader><TableRow>
                  <TableHead>{t("dashboard.admin.name")}</TableHead><TableHead>{t("dashboard.admin.city")}</TableHead><TableHead>{t("dashboard.admin.status")}</TableHead>
                  <TableHead>{t("dashboard.admin.badge")}</TableHead>
                  <TableHead className="text-right"><Heart className="inline h-3 w-3" /></TableHead>
                  <TableHead className="text-right">{t("dashboard.admin.supporters")}</TableHead>
                  <TableHead>{t("dashboard.admin.registered")}</TableHead><TableHead className="text-right">{t("dashboard.admin.actions")}</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {filteredCreators.map((c) => (
                    <TableRow key={c.id}>
                      <TableCell className="font-medium"><Link to={`/startup/${c.slug}`} className="hover:underline">{c.name}</Link></TableCell>
                      <TableCell>{c.city ?? "—"}</TableCell>
                      <TableCell><Badge variant="outline">{c.status}</Badge></TableCell>
                      <TableCell>
                        <Select defaultValue={c.badge ?? "new"} onValueChange={(v) => setBadge(c.id, v as any)}>
                          <SelectTrigger className="h-8 w-[120px]"><SelectValue /></SelectTrigger>
                          <SelectContent className="bg-popover">
                            <SelectItem value="new">{t("dashboard.admin.badgeNew")}</SelectItem>
                            <SelectItem value="verified">{t("dashboard.admin.badgeVerified")}</SelectItem>
                            <SelectItem value="certified">{t("dashboard.admin.badgeCertified")}</SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell className="text-right">{creatorLikes[c.id] ?? 0}</TableCell>
                      <TableCell className="text-right">{c.supporters_count ?? 0}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{new Date(c.created_at).toLocaleDateString()}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          {c.is_live && (
                            <Button size="sm" variant="outline" onClick={() => stopLive(c.id)} title={t("dashboard.admin.stopLiveTitle")}>
                              <Radio className="h-4 w-4 text-red-500" />
                            </Button>
                          )}
                          <Button size="sm" variant="ghost" onClick={() => deleteStartup(c.id)} title={t("dashboard.admin.deleteCreator")}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent></Card>
          </TabsContent>

          {/* PRODUCTS */}
          <TabsContent value="products" className="mt-6">
            <Card><CardContent className="p-0">
              <Table>
                <TableHeader><TableRow>
                  <TableHead></TableHead>
                  <TableHead>{t("dashboard.admin.product")}</TableHead>
                  <TableHead>{t("dashboard.admin.creator")}</TableHead>
                  <TableHead>{t("dashboard.admin.stock")}</TableHead>
                  <TableHead>{t("dashboard.admin.published")}</TableHead>
                  <TableHead className="text-right">{t("dashboard.admin.actions")}</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {products.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell>{p.images?.[0] && <img src={p.images[0]} className="h-10 w-10 rounded object-cover" />}</TableCell>
                      <TableCell className="font-medium">{p.name}</TableCell>
                      <TableCell><Link to={`/startup/${p.startups?.slug}`} className="hover:underline text-sm">{p.startups?.name ?? "—"}</Link></TableCell>
                      <TableCell><Badge variant={p.in_stock ? "outline" : "secondary"}>{p.in_stock ? t("common.yes") : t("common.no")}</Badge></TableCell>
                      <TableCell className="text-xs text-muted-foreground">{new Date(p.created_at).toLocaleDateString()}</TableCell>
                      <TableCell className="text-right">
                        <Button size="sm" variant="ghost" onClick={() => deleteProduct(p.id)} title={t("dashboard.admin.deleteProduct")}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent></Card>
          </TabsContent>

          {/* CHATS */}
          <TabsContent value="chats" className="mt-6">
            <div className="grid gap-4 md:grid-cols-[320px_1fr]">
              <Card className="h-[600px] overflow-y-auto">
                <CardContent className="p-2">
                  {conversations.length === 0 ? (
                    <p className="p-3 text-sm text-muted-foreground">{t("dashboard.admin.noConversations")}</p>
                  ) : conversations.map((c) => (
                    <button
                      key={c.id}
                      onClick={() => openConversation(c.id)}
                      className={`w-full rounded-md p-3 text-left text-sm transition-colors hover:bg-muted ${activeConv === c.id ? "bg-muted" : ""}`}
                    >
                      <div className="flex items-center gap-2 font-medium">
                        <MessageCircle className="h-3 w-3 shrink-0" />
                        <span className="truncate">{c.profiles?.full_name ?? t("dashboard.admin.user")}</span>
                      </div>
                      <div className="mt-1 truncate text-xs text-muted-foreground">↔ {c.startups?.name ?? "—"}</div>
                      {convPreviews[c.id]?.content && (
                        <div className="mt-1 truncate text-xs italic text-foreground/70">"{convPreviews[c.id].content}"</div>
                      )}
                      <div className="mt-1 flex items-center justify-between text-[10px] text-muted-foreground">
                        <span>{new Date(c.last_message_at).toLocaleString()}</span>
                        {convPreviews[c.id]?.count ? <span>{convPreviews[c.id].count} msg</span> : null}
                      </div>
                    </button>
                  ))}
                </CardContent>
              </Card>
              <Card className="h-[600px] overflow-y-auto">
                <CardContent className="space-y-3 p-4">
                  {!activeConv && <p className="text-sm text-muted-foreground">{t("dashboard.admin.selectConversation")}</p>}
                  {activeConv && convMessages.length === 0 && <p className="text-sm text-muted-foreground">{t("dashboard.admin.noMessages")}</p>}
                  {convMessages.map((m) => (
                    <div key={m.id} className="rounded-md border p-3">
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <strong>{m.profiles?.full_name ?? "—"}</strong>
                        <span>{new Date(m.created_at).toLocaleString()}</span>
                      </div>
                      <p className="mt-2 whitespace-pre-wrap text-sm">{m.content}</p>
                      {m.attachments?.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-2">
                          {m.attachments.map((a: string, i: number) => (
                            <a key={i} href={a} target="_blank" rel="noreferrer" className="text-xs underline">{t("dashboard.admin.attachment", { n: i + 1 })}</a>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* USERS */}
          <TabsContent value="users" className="mt-6">
            <Input placeholder={t("dashboard.admin.searchUser")} value={search} onChange={(e) => setSearch(e.target.value)} className="mb-4 max-w-sm" />
            <Card><CardContent className="p-0">
              <Table>
                <TableHeader><TableRow>
                  <TableHead>{t("dashboard.admin.name")}</TableHead><TableHead>{t("dashboard.admin.city")}</TableHead><TableHead>{t("dashboard.admin.language")}</TableHead><TableHead>{t("dashboard.admin.registeredAt")}</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {filteredUsers.map((u) => (
                    <TableRow key={u.id}>
                      <TableCell className="font-medium">{u.full_name ?? "—"}</TableCell>
                      <TableCell>{u.city ?? "—"}</TableCell>
                      <TableCell>{u.preferred_language}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{new Date(u.created_at).toLocaleString()}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent></Card>
          </TabsContent>

          {/* COMMENTS */}
          <TabsContent value="comments" className="mt-6 space-y-3">
            {comments.length === 0 ? <p className="text-muted-foreground">{t("dashboard.admin.noComments")}</p> : comments.map((c) => (
              <Card key={c.id}><CardContent className="pt-6">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-xs text-muted-foreground">
                      <strong>{c.is_anonymous ? t("dashboard.admin.anonymous") : (c.profiles?.full_name ?? t("dashboard.admin.user"))}</strong> · {t("dashboard.admin.on")} <em>{c.products?.name ?? "—"}</em> · {new Date(c.created_at).toLocaleString()}
                    </p>
                    <p className="mt-2 text-sm">{c.content}</p>
                  </div>
                  <Button size="sm" variant="ghost" onClick={() => deleteComment(c.id)}><Trash2 className="h-4 w-4" /></Button>
                </div>
              </CardContent></Card>
            ))}
          </TabsContent>

          {/* REVIEWS */}
          <TabsContent value="reviews" className="mt-6 space-y-3">
            {reviews.length === 0 ? <p className="text-muted-foreground">{t("dashboard.admin.noReviews")}</p> : reviews.map((r) => (
              <Card key={r.id}><CardContent className="pt-6">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-xs text-muted-foreground">
                      <strong>{r.profiles?.full_name ?? t("dashboard.admin.user")}</strong> · {t("dashboard.admin.on")} <Link className="hover:underline" to={`/startup/${r.startups?.slug}`}><em>{r.startups?.name}</em></Link> · {new Date(r.created_at).toLocaleString()}
                    </p>
                    <div className="mt-1 flex">{Array.from({ length: 5 }).map((_, i) => <Star key={i} className={`h-3 w-3 ${i < r.rating ? "fill-amber-500 text-amber-500" : "text-muted"}`} />)}</div>
                    {r.comment && <p className="mt-2 text-sm">{r.comment}</p>}
                    {r.photo_url && <img src={r.photo_url} alt="review" className="mt-2 h-20 w-20 rounded object-cover" />}
                  </div>
                  <Button size="sm" variant="ghost" onClick={() => deleteReview(r.id)}><Trash2 className="h-4 w-4" /></Button>
                </div>
              </CardContent></Card>
            ))}
          </TabsContent>
        </Tabs>
      </div>
    </PageLayout>
  );
}

function StatCard({ icon, label, value, sub, highlight }: { icon: React.ReactNode; label: string; value: number; sub?: string; highlight?: boolean }) {
  return (
    <Card className={highlight ? "border-primary/40 bg-primary/5" : ""}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
        <div className="text-muted-foreground">{icon}</div>
      </CardHeader>
      <CardContent>
        <div className="text-3xl font-bold">{value.toLocaleString()}</div>
        {sub && <p className="mt-1 text-xs text-muted-foreground">{sub}</p>}
      </CardContent>
    </Card>
  );
}
