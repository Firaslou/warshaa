import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Radio, Bell, BellRing, Calendar as CalendarIcon, Clock, ExternalLink, CalendarOff, Play } from "lucide-react";
import { PageLayout } from "@/components/layout/PageLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { LiveRoomModal } from "@/components/live/LiveRoomModal";
import { LiveReplayDialog } from "@/components/live/LiveReplayDialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface LiveEvent {
  id: string;
  startup_id: string;
  title: string;
  description: string | null;
  scheduled_at: string;
  duration_minutes: number;
  platform: string | null;
  stream_url: string | null;
  recording_url?: string | null;
  cover_url: string | null;
  status: string;
  startups?: { name: string; slug: string; logo_url: string | null; owner_id: string } | null;
}

export default function LiveCalendar() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [events, setEvents] = useState<LiveEvent[]>([]);
  const [reminderIds, setReminderIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"upcoming" | "past">("upcoming");
  const [activeLiveModal, setActiveLiveModal] = useState<LiveEvent | null>(null);
  const [activeReplay, setActiveReplay] = useState<LiveEvent | null>(null);

  const load = async () => {
    const { data } = await (supabase.from("live_events" as any) as any).select("*").order("scheduled_at", { ascending: true });
    const rows = data ?? [];
    const startupIds = [...new Set(rows.map((event: any) => event.startup_id))];
    const { data: startups } = startupIds.length
      ? await supabase.from("startups").select("id, name, slug, logo_url, owner_id, status").in("id", startupIds).eq("status", "approved")
      : { data: [] };
    const startupsById = new Map((startups ?? []).map((startup) => [startup.id, startup]));
    setEvents(rows.filter((event: any) => startupsById.has(event.startup_id)).map((event: any) => ({ ...event, startups: startupsById.get(event.startup_id) })) as LiveEvent[]);

    if (user) {
      const { data: rems } = await supabase.from("live_reminders").select("live_event_id").eq("user_id", user.id);
      setReminderIds(new Set((rems ?? []).map((r: any) => r.live_event_id)));
    }
    setLoading(false);
  };

  useEffect(() => { void load(); }, [user?.id]);

  useEffect(() => {
    let refreshTimer: ReturnType<typeof setTimeout> | undefined;
    const refresh = () => { if (refreshTimer) clearTimeout(refreshTimer); refreshTimer = setTimeout(() => void load(), 250); };
    const channel = supabase.channel("public-live-calendar-updates").on("postgres_changes", { event: "*", schema: "public", table: "live_events" }, refresh).on("postgres_changes", { event: "UPDATE", schema: "public", table: "startups" }, refresh).subscribe();
    return () => { if (refreshTimer) clearTimeout(refreshTimer); supabase.removeChannel(channel); };
  }, [user?.id]);

  const toggleReminder = async (eventId: string) => {
    if (!user) { toast.info("Connectez-vous pour activer le rappel."); return; }
    if (reminderIds.has(eventId)) {
      await supabase.from("live_reminders").delete().eq("user_id", user.id).eq("live_event_id", eventId);
      const next = new Set(reminderIds); next.delete(eventId); setReminderIds(next); toast.info("Rappel désactivé");
    } else {
      await supabase.from("live_reminders").insert({ user_id: user.id, live_event_id: eventId });
      const next = new Set(reminderIds); next.add(eventId); setReminderIds(next); toast.success("Rappel activé pour ce live 🔔");
    }
  };

  const now = Date.now();
  const filtered = events.filter((e) => {
    const endTime = new Date(e.scheduled_at).getTime() + e.duration_minutes * 60_000;
    const finished = e.status === "ended" || e.status === "cancelled";
    return tab === "upcoming" ? !finished && (e.status === "live" || (e.status === "scheduled" && endTime >= now)) : finished || endTime < now;
  }).sort((a, b) => { if (a.status === "live" && b.status !== "live") return -1; if (b.status === "live" && a.status !== "live") return 1; return new Date(b.scheduled_at).getTime() - new Date(a.scheduled_at).getTime(); });

  useEffect(() => {
    const liveId = searchParams.get("live");
    if (!liveId || loading) return;
    const found = events.find((item) => item.id === liveId);
    if (found) setActiveLiveModal(found);
  }, [events, loading, searchParams]);

  return (
    <PageLayout>
      <div className="container py-10 max-w-6xl">
        <div className="mb-8 text-center"><div className="mb-3 inline-flex items-center gap-2 rounded-full bg-primary/10 px-3.5 py-1 text-xs font-semibold text-primary"><Radio className="h-3.5 w-3.5 animate-pulse" /> {t("liveCalendar.nav")}</div><h1 className="font-serif text-3xl font-bold tracking-tight md:text-5xl">{t("liveCalendar.page.title")}</h1><p className="mt-2 text-sm text-muted-foreground max-w-xl mx-auto">{t("liveCalendar.page.subtitle")}</p></div>
        <div className="mb-8 flex justify-center"><div className="inline-flex rounded-2xl border border-border/80 bg-card p-1 shadow-xs">{(["upcoming", "past"] as const).map((k) => <button key={k} onClick={() => setTab(k)} className={cn("rounded-xl px-5 py-2 text-xs font-bold transition", tab === k ? "bg-primary text-primary-foreground shadow-xs" : "text-muted-foreground hover:text-foreground")}>{t(`liveCalendar.page.${k}`)}</button>)}</div></div>

        {loading ? <p className="text-center text-sm text-muted-foreground py-20">{t("common.loading")}</p> : filtered.length === 0 ? <div className="py-12 max-w-lg mx-auto"><EmptyState icon={CalendarOff} title={tab === "upcoming" ? "Aucun direct prévu pour le moment" : "Aucun live passé"} description={tab === "upcoming" ? "Les créateurs et artisans planifient régulièrement des sessions de présentation en direct." : "L'historique des diffusions terminées apparaîtra ici."} action={{ label: "Découvrir les créateurs", to: "/creators" }} secondaryAction={{ label: "Explorer les produits", to: "/products" }} /></div> : <div className="grid gap-5 md:grid-cols-2">
          {filtered.map((e) => {
            const date = new Date(e.scheduled_at); const isLiveNow = e.status === "live"; const isEnded = e.status === "ended" || e.status === "cancelled"; const reminded = reminderIds.has(e.id);
            return <Card id={`live-${e.id}`} key={e.id} className={cn("scroll-mt-24 overflow-hidden rounded-3xl border border-border/80 bg-card shadow-xs transition hover:shadow-md", isLiveNow && "border-destructive/60 ring-1 ring-destructive/40")}>
              <div className="grid sm:grid-cols-[160px_1fr]">
                <div className="relative aspect-video bg-muted sm:aspect-auto overflow-hidden">{e.cover_url || e.startups?.logo_url ? <img src={e.cover_url || e.startups!.logo_url!} alt="" className={`h-full w-full transition-transform duration-500 hover:scale-105 ${e.cover_url ? "object-cover" : "object-contain p-6"}`} /> : <div className="flex h-full w-full items-center justify-center gradient-soft"><Radio className="h-10 w-10 text-primary/40" /></div>}{isLiveNow && <div className="absolute left-2.5 top-2.5 inline-flex items-center gap-1.5 rounded-full bg-destructive px-2.5 py-1 text-[10px] font-extrabold text-destructive-foreground shadow-md animate-pulse"><span className="h-2 w-2 rounded-full bg-white animate-ping" />EN DIRECT</div>}{isEnded && <div className="absolute left-2.5 top-2.5 inline-flex items-center gap-1 rounded-full bg-zinc-800/90 px-2.5 py-0.5 text-[10px] font-semibold text-white">Terminé</div>}</div>
                <div className="p-5 flex flex-col justify-between"><div><Link to={`/startup/${e.startups?.slug ?? ""}`} className="inline-flex items-center gap-2 text-xs font-semibold text-primary hover:underline">{e.startups?.logo_url ? <img src={e.startups.logo_url} className="h-5 w-5 rounded-full object-cover" alt="" /> : <span className="h-5 w-5 rounded-full bg-primary/15 text-[10px] flex items-center justify-center font-bold">{e.startups?.name.charAt(0)}</span>}<span>{e.startups?.name}</span></Link><h3 className="mt-1.5 font-serif text-lg font-bold leading-tight">{e.title}</h3>{e.description && <p className="mt-1 line-clamp-2 text-xs text-muted-foreground leading-relaxed">{e.description}</p>}<div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground"><span className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-0.5 text-[11px]"><CalendarIcon className="h-3 w-3" />{date.toLocaleDateString()}</span><span className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-0.5 text-[11px]"><Clock className="h-3 w-3" />{date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} · {e.duration_minutes} min</span>{e.platform && <Badge variant="outline" className="text-[10px] rounded-md">{e.platform}</Badge>}</div></div>
                  <div className="mt-4 flex flex-wrap items-center gap-2 pt-3 border-t border-border/60">
                    {isLiveNow ? <Button size="sm" className="gradient-warm text-primary-foreground rounded-xl text-xs font-bold gap-1.5" onClick={() => setActiveLiveModal(e)}><Play className="h-3.5 w-3.5 fill-current" />Rejoindre le direct</Button> : tab === "upcoming" ? <Button size="sm" variant={reminded ? "secondary" : "default"} onClick={() => void toggleReminder(e.id)} className="rounded-xl text-xs">{reminded ? <><BellRing className="mr-1.5 h-3.5 w-3.5 text-primary" />{t("liveCalendar.page.reminded")}</> : <><Bell className="mr-1.5 h-3.5 w-3.5" />{t("liveCalendar.page.remindMe")}</>}</Button> : <Button size="sm" variant="outline" className="rounded-xl text-xs" onClick={() => setActiveReplay(e)}><Play className="mr-1.5 h-3.5 w-3.5" />Voir l'enregistrement / résumé</Button>}
                    {e.stream_url && <Button size="sm" variant="ghost" asChild className="rounded-xl text-xs"><a href={e.stream_url} target="_blank" rel="noopener noreferrer"><ExternalLink className="mr-1 h-3.5 w-3.5" />Lien externe</a></Button>}
                    {isEnded && e.recording_url && <Badge className="ml-auto text-[10px]">Replay disponible</Badge>}
                  </div>
                </div>
              </div>
            </Card>;
          })}
        </div>}
      </div>

      {activeLiveModal && <LiveRoomModal open={!!activeLiveModal} onOpenChange={(open) => { if (!open) { setActiveLiveModal(null); setSearchParams({}); void load(); } }} liveEventId={activeLiveModal.id} startupId={activeLiveModal.startup_id} startupName={activeLiveModal.startups?.name || "Créateur"} startupSlug={activeLiveModal.startups?.slug || ""} startupLogo={activeLiveModal.startups?.logo_url} initialStreamUrl={activeLiveModal.stream_url} isCreator={user?.id === activeLiveModal.startups?.owner_id} />}
      {activeReplay && <LiveReplayDialog open={!!activeReplay} onOpenChange={(open) => { if (!open) setActiveReplay(null); }} liveEventId={activeReplay.id} title={activeReplay.title} creatorName={activeReplay.startups?.name || "Créateur"} recordingUrl={activeReplay.recording_url} />}
    </PageLayout>
  );
}
