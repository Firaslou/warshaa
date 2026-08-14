import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Plus, Pencil, Trash2, Bell, Calendar as CalendarIcon, Clock, Radio, Video } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { AgoraLivePlayer } from "@/components/live/AgoraLivePlayer";
import { ExternalLiveEmbed, type ExternalPlatform } from "@/components/live/ExternalLiveEmbed";

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
  live_mode: "agora" | "external";
  external_platform: ExternalPlatform | null;
  external_url: string | null;
  agora_channel: string | null;
  chat_enabled: boolean;
}

type Mode = "agora" | "external";

function makeChannel(startupId: string) {
  return `warsha-${startupId.slice(0, 8)}-${Date.now().toString(36)}`.replace(/[^a-zA-Z0-9_-]/g, "");
}

export function LiveScheduleManager({ startupId }: { startupId: string }) {
  const { t } = useTranslation();
  const [events, setEvents] = useState<LiveEvent[]>([]);
  const [reminderCounts, setReminderCounts] = useState<Record<string, number>>({});
  const [open, setOpen] = useState(false);
  const [studioOpen, setStudioOpen] = useState(false);
  const [editing, setEditing] = useState<LiveEvent | null>(null);
  const [activeEvent, setActiveEvent] = useState<LiveEvent | null>(null);
  const [form, setForm] = useState({
    title: "", description: "", date: "", time: "", duration_minutes: 60,
    mode: "agora" as Mode, external_platform: "facebook" as ExternalPlatform,
    external_url: "", cover_url: "", chat_enabled: true,
  });

  const load = async () => {
    const { data } = await supabase.from("live_events").select("*").eq("startup_id", startupId).order("scheduled_at", { ascending: false });
    const list = (data ?? []) as LiveEvent[];
    setEvents(list);
    if (list.length > 0) {
      const { data: rems } = await supabase.from("live_reminders").select("live_event_id").in("live_event_id", list.map((e) => e.id));
      const counts: Record<string, number> = {};
      (rems ?? []).forEach((r: any) => { counts[r.live_event_id] = (counts[r.live_event_id] ?? 0) + 1; });
      setReminderCounts(counts);
    }
  };

  useEffect(() => { if (startupId) void load(); }, [startupId]);

  const openCreate = () => {
    setEditing(null);
    setForm({ title: "", description: "", date: "", time: "", duration_minutes: 60, mode: "agora", external_platform: "facebook", external_url: "", cover_url: "", chat_enabled: true });
    setOpen(true);
  };

  const openEdit = (e: LiveEvent) => {
    setEditing(e);
    const d = new Date(e.scheduled_at);
    const pad = (n: number) => String(n).padStart(2, "0");
    setForm({
      title: e.title,
      description: e.description ?? "",
      date: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
      time: `${pad(d.getHours())}:${pad(d.getMinutes())}`,
      duration_minutes: e.duration_minutes,
      mode: e.live_mode ?? "agora",
      external_platform: e.external_platform ?? "facebook",
      external_url: e.external_url ?? e.stream_url ?? "",
      cover_url: e.cover_url ?? "",
      chat_enabled: e.chat_enabled ?? true,
    });
    setOpen(true);
  };

  const save = async () => {
    if (!form.title.trim()) { toast({ title: t("liveCalendar.creator.titleRequired"), variant: "destructive" }); return; }
    if (!form.date || !form.time) { toast({ title: t("liveCalendar.creator.dateRequired"), variant: "destructive" }); return; }
    if (form.mode === "external" && !form.external_url.trim()) { toast({ title: "Ajoutez le lien du Live externe.", variant: "destructive" }); return; }
    try { new URL(form.external_url); } catch { if (form.mode === "external") { toast({ title: "Le lien du Live est invalide.", variant: "destructive" }); return; } }
    const scheduled = new Date(`${form.date}T${form.time}`);
    if (!editing && scheduled.getTime() < Date.now()) { toast({ title: t("liveCalendar.creator.dateRequired"), variant: "destructive" }); return; }
    const payload = {
      startup_id: startupId,
      title: form.title.trim(),
      description: form.description.trim() || null,
      scheduled_at: scheduled.toISOString(),
      duration_minutes: Number(form.duration_minutes) || 60,
      platform: form.mode === "agora" ? "Agora" : form.external_platform,
      stream_url: form.mode === "external" ? form.external_url.trim() : null,
      external_url: form.mode === "external" ? form.external_url.trim() : null,
      external_platform: form.mode === "external" ? form.external_platform : null,
      live_mode: form.mode,
      agora_channel: form.mode === "agora" ? (editing?.agora_channel || makeChannel(startupId)) : null,
      chat_enabled: form.chat_enabled,
      cover_url: form.cover_url.trim() || null,
    };
    const res = editing ? await supabase.from("live_events").update(payload).eq("id", editing.id) : await supabase.from("live_events").insert(payload);
    if (res.error) { toast({ title: res.error.message, variant: "destructive" }); return; }
    toast({ title: t("liveCalendar.creator.saved") });
    setOpen(false);
    await load();
  };

  const startEvent = async (event: LiveEvent) => {
    const { data, error } = await supabase.from("live_events").update({ status: "live", scheduled_at: new Date().toISOString() }).eq("id", event.id).select("*").single();
    if (error || !data) return toast({ title: error?.message || "Impossible de démarrer le live.", variant: "destructive" });
    await supabase.from("startups").update({ is_live: true, live_started_at: new Date().toISOString() }).eq("id", startupId);
    const live = data as LiveEvent;
    setActiveEvent(live);
    setStudioOpen(true);
    await load();
  };

  const stopEvent = async () => {
    if (!activeEvent) return;
    await supabase.from("live_events").update({ status: "ended", updated_at: new Date().toISOString() }).eq("id", activeEvent.id);
    await supabase.from("startups").update({ is_live: false, live_started_at: null }).eq("id", startupId);
    setStudioOpen(false);
    setActiveEvent(null);
    await load();
  };

  const remove = async (id: string) => {
    if (!confirm(t("liveCalendar.creator.deleteConfirm"))) return;
    await supabase.from("live_events").delete().eq("id", id);
    toast({ title: t("liveCalendar.creator.deleted") });
    await load();
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><h3 className="font-serif text-lg font-semibold">{t("liveCalendar.creator.tab")}</h3><p className="text-xs text-muted-foreground">Choisissez Live Warsha (Agora) ou relais Facebook / YouTube / Instagram / TikTok.</p></div>
        <div className="flex gap-2"><Button size="sm" variant="outline" onClick={() => { const live = events.find((e) => e.status === "live"); if (live) { setActiveEvent(live); setStudioOpen(true); } else openCreate(); }}><Radio className="mr-1 h-4 w-4" /> Studio Live</Button><Button size="sm" onClick={openCreate} className="gradient-warm text-primary-foreground"><Plus className="mr-1 h-4 w-4" /> {t("liveCalendar.creator.addLive")}</Button></div>
      </div>

      {events.length === 0 ? <Card><CardContent className="py-8 text-center text-sm text-muted-foreground">{t("liveCalendar.creator.noEvents")}</CardContent></Card> : <div className="space-y-2">
        {events.map((e) => {
          const d = new Date(e.scheduled_at);
          const isPast = d.getTime() + e.duration_minutes * 60_000 < Date.now();
          return <Card key={e.id} className={isPast && e.status !== "live" ? "opacity-60" : ""}>
            <CardContent className="flex flex-wrap items-center gap-3 p-4">
              <div className="min-w-0 flex-1"><div className="flex items-center gap-2"><p className="truncate font-semibold">{e.title}</p>{e.status === "live" && <span className="rounded-full bg-red-500 px-2 py-0.5 text-[10px] font-bold text-white">EN DIRECT</span>}{e.live_mode === "agora" ? <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">Warsha / Agora</span> : <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold">{e.external_platform}</span>}</div>
                <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-muted-foreground"><span className="inline-flex items-center gap-1"><CalendarIcon className="h-3 w-3" /> {d.toLocaleDateString()}</span><span className="inline-flex items-center gap-1"><Clock className="h-3 w-3" /> {d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span><span className="inline-flex items-center gap-1"><Bell className="h-3 w-3 text-primary" /> {reminderCounts[e.id] ?? 0} {t("liveCalendar.page.reminders")}</span></div>
              </div>
              {e.status === "live" ? <Button size="sm" onClick={() => { setActiveEvent(e); setStudioOpen(true); }} className="gap-1"><Video className="h-4 w-4" /> Ouvrir</Button> : <Button size="sm" variant="outline" onClick={() => void startEvent(e)} className="gap-1"><Radio className="h-4 w-4" /> Démarrer</Button>}
              <Button size="icon" variant="ghost" onClick={() => openEdit(e)}><Pencil className="h-4 w-4" /></Button><Button size="icon" variant="ghost" onClick={() => void remove(e.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
            </CardContent>
          </Card>;
        })}
      </div>}

      <Dialog open={open} onOpenChange={setOpen}><DialogContent className="max-w-lg"><DialogHeader><DialogTitle>{editing ? t("liveCalendar.creator.editLive") : "Créer un Live"}</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div><Label>{t("liveCalendar.creator.title")} *</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
          <div><Label>{t("liveCalendar.creator.description")}</Label><Textarea rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
          <div className="grid grid-cols-2 gap-3"><div><Label>{t("liveCalendar.creator.date")} *</Label><Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></div><div><Label>{t("liveCalendar.creator.time")} *</Label><Input type="time" value={form.time} onChange={(e) => setForm({ ...form, time: e.target.value })} /></div></div>
          <div><Label>Mode de diffusion *</Label><Select value={form.mode} onValueChange={(value: Mode) => setForm({ ...form, mode: value })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="agora">Option A — Direct Warsha (Agora)</SelectItem><SelectItem value="external">Option B — Relais externe</SelectItem></SelectContent></Select></div>
          {form.mode === "external" && <><div><Label>Réseau social *</Label><Select value={form.external_platform} onValueChange={(value: ExternalPlatform) => setForm({ ...form, external_platform: value })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="facebook">Facebook Live</SelectItem><SelectItem value="youtube">YouTube Live</SelectItem><SelectItem value="instagram">Instagram Live</SelectItem><SelectItem value="tiktok">TikTok LIVE</SelectItem></SelectContent></Select></div><div><Label>URL du Live *</Label><Input type="url" placeholder="https://…" value={form.external_url} onChange={(e) => setForm({ ...form, external_url: e.target.value })} /></div></>}
          <div><Label>{t("liveCalendar.creator.duration")}</Label><Input type="number" min={5} max={600} value={form.duration_minutes} onChange={(e) => setForm({ ...form, duration_minutes: Number(e.target.value) })} /></div>
          <div><Label>{t("liveCalendar.creator.cover")}</Label><Input type="url" placeholder="https://…" value={form.cover_url} onChange={(e) => setForm({ ...form, cover_url: e.target.value })} /></div>
        </div>
        <DialogFooter><Button variant="outline" onClick={() => setOpen(false)}>{t("liveCalendar.creator.cancel")}</Button><Button onClick={() => void save()} className="gradient-warm text-primary-foreground">{t("liveCalendar.creator.save")}</Button></DialogFooter>
      </DialogContent></Dialog>

      <Dialog open={studioOpen} onOpenChange={(value) => { if (!value) void stopEvent(); else setStudioOpen(true); }}>
        <DialogContent className="max-w-6xl p-3 sm:p-5"><DialogHeader><DialogTitle>{activeEvent?.title || "Studio Live"}</DialogTitle></DialogHeader>
          {activeEvent?.live_mode === "agora" && activeEvent.agora_channel ? <AgoraLivePlayer liveEventId={activeEvent.id} channel={activeEvent.agora_channel} startupId={startupId} isHost /> : activeEvent?.external_url ? <ExternalLiveEmbed url={activeEvent.external_url} platform={activeEvent.external_platform} /> : <p className="p-8 text-center text-sm text-muted-foreground">Configurez le mode et le lien du Live.</p>}
          <DialogFooter><Button variant="destructive" onClick={() => void stopEvent()}>Terminer le live</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
