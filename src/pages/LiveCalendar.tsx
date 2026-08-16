import { useCallback, useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { CalendarOff, ExternalLink, Play, Radio } from "lucide-react";
import { PageLayout } from "@/components/layout/PageLayout";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { ExternalLiveEmbed, type ExternalPlatform } from "@/components/live/ExternalLiveEmbed";
import { supabase } from "@/integrations/supabase/client";

interface LiveEvent {
  id: string;
  startup_id: string;
  title: string;
  description: string | null;
  platform: string | null;
  stream_url: string | null;
  cover_url: string | null;
  status: "live";
  external_platform?: ExternalPlatform | null;
  external_url?: string | null;
  startups?: { name: string; slug: string; logo_url: string | null } | null;
}

export default function LiveCalendar() {
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const [events, setEvents] = useState<LiveEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeLive, setActiveLive] = useState<LiveEvent | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await (supabase.from("live_events" as any) as any)
      .select("id,startup_id,title,description,platform,stream_url,cover_url,status,external_platform,external_url")
      .eq("status", "live")
      .order("scheduled_at", { ascending: false });

    if (error) {
      console.error("Unable to load active live events", error.message);
      setEvents([]);
      setLoading(false);
      return;
    }

    const rows = (data ?? []) as LiveEvent[];
    const startupIds = [...new Set(rows.map((event) => event.startup_id).filter(Boolean))];
    const startupResult = startupIds.length
      ? await supabase.from("startups").select("id,name,slug,logo_url").in("id", startupIds).eq("status", "approved")
      : { data: [] };
    const startupsById = new Map((startupResult.data ?? []).map((startup) => [startup.id, startup]));

    setEvents(rows.filter((event) => startupsById.has(event.startup_id)).map((event) => ({ ...event, startups: startupsById.get(event.startup_id) })));
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const refresh = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => void load(), 250);
    };
    const channel = supabase
      .channel("public-active-live-updates")
      .on("postgres_changes", { event: "*", schema: "public", table: "live_events" }, refresh)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "startups" }, refresh)
      .subscribe();
    return () => {
      if (timer) clearTimeout(timer);
      supabase.removeChannel(channel);
    };
  }, [load]);

  useEffect(() => {
    const liveId = searchParams.get("live");
    if (!liveId || loading) return;
    const currentLive = events.find((event) => event.id === liveId);
    if (currentLive) setActiveLive(currentLive);
    else setSearchParams({}, { replace: true });
  }, [events, loading, searchParams, setSearchParams]);

  useEffect(() => {
    if (activeLive && !events.some((event) => event.id === activeLive.id)) {
      setActiveLive(null);
      setSearchParams({}, { replace: true });
    }
  }, [activeLive, events, setSearchParams]);

  const closeLive = () => {
    setActiveLive(null);
    setSearchParams({}, { replace: true });
    void load();
  };

  return (
    <PageLayout>
      <div className="container max-w-6xl py-10">
        <div className="mb-8 text-center">
          <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-destructive/10 px-3.5 py-1 text-xs font-semibold text-destructive"><Radio className="h-3.5 w-3.5 animate-pulse" /> En direct maintenant</div>
          <h1 className="font-serif text-3xl font-bold tracking-tight md:text-5xl">{t("liveCalendar.page.title")}</h1>
          <p className="mx-auto mt-2 max-w-xl text-sm text-muted-foreground">Seuls les directs actuellement actifs sont affichés.</p>
        </div>

        {loading ? (
          <p className="py-20 text-center text-sm text-muted-foreground">{t("common.loading")}</p>
        ) : events.length === 0 ? (
          <div className="mx-auto max-w-lg py-12"><EmptyState icon={CalendarOff} title="Aucun direct en cours" description="Revenez plus tard pour découvrir les prochains créateurs en direct." action={{ label: "Découvrir les créateurs", to: "/creators" }} secondaryAction={{ label: "Explorer les produits", to: "/products" }} /></div>
        ) : (
          <div className="grid gap-5 md:grid-cols-2">
            {events.map((event) => (
              <Card key={event.id} id={`live-${event.id}`} className="overflow-hidden rounded-3xl border-destructive/60 bg-card shadow-xs ring-1 ring-destructive/30">
                <div className="grid sm:grid-cols-[160px_1fr]">
                  <div className="relative aspect-video overflow-hidden bg-muted sm:aspect-auto">
                    {event.cover_url || event.startups?.logo_url ? <img src={event.cover_url || event.startups!.logo_url!} alt="" className={`h-full w-full ${event.cover_url ? "object-cover" : "object-contain p-6"}`} /> : <div className="flex h-full items-center justify-center"><Radio className="h-10 w-10 text-primary/40" /></div>}
                    <div className="absolute left-2.5 top-2.5 inline-flex items-center gap-1.5 rounded-full bg-destructive px-2.5 py-1 text-[10px] font-extrabold text-white shadow-md"><span className="h-2 w-2 animate-pulse rounded-full bg-white" /> EN DIRECT</div>
                  </div>
                  <div className="flex flex-col justify-between p-5">
                    <div>
                      <Link to={`/startup/${event.startups?.slug ?? ""}`} className="text-xs font-semibold text-primary hover:underline">{event.startups?.name}</Link>
                      <h2 className="mt-1.5 font-serif text-lg font-bold">{event.title}</h2>
                      {event.description && <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{event.description}</p>}
                      {event.platform && <Badge variant="outline" className="mt-3">{event.platform}</Badge>}
                    </div>
                    <div className="mt-4 flex flex-wrap gap-2 border-t pt-3">
                      <Button size="sm" className="gradient-warm text-primary-foreground" onClick={() => setActiveLive(event)}><Play className="mr-1.5 h-3.5 w-3.5 fill-current" />Rejoindre le direct</Button>
                      {event.stream_url && <Button size="sm" variant="ghost" asChild><a href={event.stream_url} target="_blank" rel="noopener noreferrer"><ExternalLink className="mr-1 h-3.5 w-3.5" />Lien externe</a></Button>}
                    </div>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
      {activeLive && <DialogLive event={activeLive} onClose={closeLive} />}
    </PageLayout>
  );
}

function DialogLive({ event, onClose }: { event: LiveEvent; onClose: () => void }) {
  const externalUrl = event.external_url || event.stream_url;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-3">
      <div className="max-h-[94vh] w-full max-w-5xl overflow-auto rounded-3xl bg-background p-4 shadow-2xl">
        <div className="mb-3 flex items-center justify-between"><h2 className="font-serif text-xl font-bold">{event.title}</h2><Button variant="outline" onClick={onClose}>Fermer</Button></div>
        {externalUrl ? <ExternalLiveEmbed url={externalUrl} platform={event.external_platform} /> : <div className="rounded-2xl border border-dashed p-10 text-center"><p className="font-semibold">Ce direct n’a pas de lien externe.</p><p className="mt-2 text-sm text-muted-foreground">Le créateur doit ajouter un lien YouTube, Facebook, Instagram ou TikTok.</p></div>}
      </div>
    </div>
  );
}
