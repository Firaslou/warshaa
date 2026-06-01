import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Radio, Bell, BellRing, Calendar as CalendarIcon, Clock, ExternalLink, Sparkles } from "lucide-react";
import { PageLayout } from "@/components/layout/PageLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";

interface LiveEvent {
  id: string;
  startup_id: string;
  title: string;
  description: string | null;
  scheduled_at: string;
  duration_minutes: number;
  platform: string | null;
  stream_url: string | null;
  cover_url: string | null;
  status: string;
  startups?: { name: string; slug: string; logo_url: string | null; cover_url: string | null } | null;
}

export default function LiveCalendar() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [events, setEvents] = useState<LiveEvent[]>([]);
  const [reminderIds, setReminderIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"upcoming" | "past">("upcoming");

  const load = async () => {
    const { data } = await supabase
      .from("live_events")
      .select("*, startups!inner(name, slug, logo_url, cover_url, status)")
      .eq("startups.status", "approved")
      .order("scheduled_at", { ascending: true });
    setEvents((data ?? []) as any);

    if (user) {
      const { data: rems } = await supabase
        .from("live_reminders")
        .select("live_event_id")
        .eq("user_id", user.id);
      setReminderIds(new Set((rems ?? []).map((r: any) => r.live_event_id)));
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, [user?.id]);

  const toggleReminder = async (eventId: string) => {
    if (!user) {
      toast({ title: t("common.loginRequired", "Please sign in") });
      return;
    }
    if (reminderIds.has(eventId)) {
      await supabase.from("live_reminders").delete().eq("user_id", user.id).eq("live_event_id", eventId);
      const next = new Set(reminderIds); next.delete(eventId); setReminderIds(next);
    } else {
      await supabase.from("live_reminders").insert({ user_id: user.id, live_event_id: eventId });
      const next = new Set(reminderIds); next.add(eventId); setReminderIds(next);
      toast({ title: t("liveCalendar.page.reminded") });
    }
  };

  const now = Date.now();
  const filtered = events.filter((e) => {
    const t = new Date(e.scheduled_at).getTime() + e.duration_minutes * 60_000;
    return tab === "upcoming" ? t >= now : t < now;
  });

  return (
    <PageLayout>
      <div className="container py-10">
        <div className="mb-8 text-center">
          <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
            <Radio className="h-3 w-3" /> {t("liveCalendar.nav")}
          </div>
          <h1 className="font-serif text-3xl font-bold md:text-4xl">{t("liveCalendar.page.title")}</h1>
          <p className="mt-2 text-sm text-muted-foreground">{t("liveCalendar.page.subtitle")}</p>
        </div>

        <div className="mb-6 flex justify-center gap-2">
          {(["upcoming", "past"] as const).map((k) => (
            <Button key={k} size="sm" variant={tab === k ? "default" : "outline"} onClick={() => setTab(k)}>
              {t(`liveCalendar.page.${k}`)}
            </Button>
          ))}
        </div>

        {loading ? (
          <p className="text-center text-sm text-muted-foreground">{t("common.loading")}</p>
        ) : filtered.length === 0 ? (
          <Card className="mx-auto max-w-md">
            <CardContent className="py-12 text-center">
              <Sparkles className="mx-auto mb-3 h-8 w-8 text-primary/60" />
              <p className="text-sm text-muted-foreground">{t("liveCalendar.page.empty")}</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {filtered.map((e) => {
              const date = new Date(e.scheduled_at);
              const isLiveNow = date.getTime() <= now && now < date.getTime() + e.duration_minutes * 60_000;
              const reminded = reminderIds.has(e.id);
              return (
                <Card key={e.id} className="overflow-hidden">
                  <div className="grid sm:grid-cols-[140px_1fr]">
                    <div className="relative aspect-video bg-muted sm:aspect-auto">
                      {(e.cover_url || e.startups?.cover_url) ? (
                        <img src={e.cover_url || e.startups!.cover_url!} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center gradient-soft">
                          <Radio className="h-8 w-8 text-primary/40" />
                        </div>
                      )}
                      {isLiveNow && (
                        <div className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-full bg-destructive px-2 py-0.5 text-[10px] font-bold text-destructive-foreground">
                          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-current" /> {t("liveCalendar.page.liveNow")}
                        </div>
                      )}
                    </div>
                    <div className="p-4">
                      <Link to={`/startup/${e.startups?.slug ?? ""}`} className="inline-flex items-center gap-2 text-xs font-medium text-primary hover:underline">
                        {e.startups?.logo_url && <img src={e.startups.logo_url} className="h-5 w-5 rounded-full object-cover" alt="" />}
                        {e.startups?.name}
                      </Link>
                      <h3 className="mt-1 font-serif text-lg font-bold leading-tight">{e.title}</h3>
                      {e.description && <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{e.description}</p>}
                      <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                        <span className="inline-flex items-center gap-1"><CalendarIcon className="h-3 w-3" /> {date.toLocaleDateString()}</span>
                        <span className="inline-flex items-center gap-1"><Clock className="h-3 w-3" /> {date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} · {e.duration_minutes} {t("liveCalendar.page.minutes")}</span>
                        {e.platform && <span className="rounded-full bg-secondary px-2 py-0.5">{e.platform}</span>}
                      </div>
                      <div className="mt-4 flex flex-wrap gap-2">
                        {tab === "upcoming" && (
                          <Button size="sm" variant={reminded ? "secondary" : "default"} onClick={() => toggleReminder(e.id)}>
                            {reminded ? <><BellRing className="mr-1 h-3.5 w-3.5" /> {t("liveCalendar.page.reminded")}</> : <><Bell className="mr-1 h-3.5 w-3.5" /> {t("liveCalendar.page.remindMe")}</>}
                          </Button>
                        )}
                        {isLiveNow && e.stream_url && (
                          <Button size="sm" asChild className="gradient-warm text-primary-foreground">
                            <a href={e.stream_url} target="_blank" rel="noopener noreferrer">
                              {t("liveCalendar.page.watchLive")} <ExternalLink className="ml-1 h-3.5 w-3.5" />
                            </a>
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </PageLayout>
  );
}