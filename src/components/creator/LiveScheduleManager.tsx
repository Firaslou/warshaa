import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Bell, Calendar as CalendarIcon, Clock, ExternalLink, Pencil, Play, Plus, Radio, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  detectExternalPlatform,
  externalPlatformLabel,
  ExternalLiveEmbed,
  type ExternalPlatform,
} from "@/components/live/ExternalLiveEmbed";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

type LiveEvent = Record<string, any>;
const db = supabase as any;

const emptyForm = {
  title: "",
  description: "",
  date: "",
  time: "",
  duration_minutes: 60,
  external_platform: "youtube" as ExternalPlatform,
  external_url: "",
  cover_url: "",
};

export function LiveScheduleManager({ startupId }: { startupId: string }) {
  const { t } = useTranslation();
  const [events, setEvents] = useState<LiveEvent[]>([]);
  const [reminderCounts, setReminderCounts] = useState<Record<string, number>>({});
  const [open, setOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [editing, setEditing] = useState<LiveEvent | null>(null);
  const [activeEvent, setActiveEvent] = useState<LiveEvent | null>(null);
  const [form, setForm] = useState(emptyForm);

  const load = useCallback(async () => {
    const { data } = await db.from("live_events").select("*").eq("startup_id", startupId).order("scheduled_at", { ascending: false });
    const list = data ?? [];
    setEvents(list);
    if (!list.length) return setReminderCounts({});
    const { data: reminders } = await db.from("live_reminders").select("live_event_id").in("live_event_id", list.map((event: LiveEvent) => event.id));
    const counts: Record<string, number> = {};
    (reminders ?? []).forEach((reminder: any) => { counts[reminder.live_event_id] = (counts[reminder.live_event_id] ?? 0) + 1; });
    setReminderCounts(counts);
  }, [startupId]);

  useEffect(() => { if (startupId) void load(); }, [startupId, load]);

  const openCreate = () => { setEditing(null); setForm(emptyForm); setOpen(true); };
  const openEdit = (event: LiveEvent) => {
    const scheduled = new Date(event.scheduled_at);
    const pad = (value: number) => String(value).padStart(2, "0");
    setEditing(event);
    setForm({
      title: event.title,
      description: event.description ?? "",
      date: `${scheduled.getFullYear()}-${pad(scheduled.getMonth() + 1)}-${pad(scheduled.getDate())}`,
      time: `${pad(scheduled.getHours())}:${pad(scheduled.getMinutes())}`,
      duration_minutes: event.duration_minutes ?? 60,
      external_platform: event.external_platform ?? detectExternalPlatform(event.external_url ?? event.stream_url ?? "") ?? "youtube",
      external_url: event.external_url ?? event.stream_url ?? "",
      cover_url: event.cover_url ?? "",
    });
    setOpen(true);
  };

  const save = async () => {
    if (!form.title.trim() || !form.date || !form.time) return toast({ title: "Titre, date et heure sont obligatoires.", variant: "destructive" });
    const detectedPlatform = detectExternalPlatform(form.external_url.trim());
    if (!detectedPlatform) return toast({ title: "Ajoutez un lien Live YouTube, Facebook, Instagram ou TikTok valide.", variant: "destructive" });
    const scheduled = new Date(`${form.date}T${form.time}`);
    if (!editing && scheduled.getTime() < Date.now()) return toast({ title: "La date doit être dans le futur.", variant: "destructive" });
    const externalUrl = form.external_url.trim();
    const payload = {
      startup_id: startupId,
      title: form.title.trim(),
      description: form.description.trim() || null,
      scheduled_at: scheduled.toISOString(),
      duration_minutes: Number(form.duration_minutes) || 60,
      platform: externalPlatformLabel(detectedPlatform),
      stream_url: externalUrl,
      external_url: externalUrl,
      external_platform: detectedPlatform,
      live_mode: "external",
      chat_enabled: false,
      cover_url: form.cover_url.trim() || null,
    };
    const result = editing
      ? await db.from("live_events").update(payload).eq("id", editing.id)
      : await db.from("live_events").insert(payload);
    if (result.error) return toast({ title: result.error.message, variant: "destructive" });
    setOpen(false);
    toast({ title: "Live externe enregistré." });
    await load();
  };

  const startEvent = async (event: LiveEvent) => {
    const externalUrl = event.external_url ?? event.stream_url;
    if (!detectExternalPlatform(externalUrl ?? "")) return toast({ title: "Modifiez ce Live et ajoutez d’abord son lien public.", variant: "destructive" });
    const startedAt = new Date().toISOString();
    const { data, error } = await db.from("live_events").update({ status: "live", live_mode: "external", scheduled_at: startedAt }).eq("id", event.id).select("*").single();
    if (error || !data) return toast({ title: error?.message || "Impossible de démarrer le Live.", variant: "destructive" });
    await db.from("startups").update({ is_live: true, live_started_at: startedAt }).eq("id", startupId);
    setActiveEvent(data);
    setPreviewOpen(true);
    toast({ title: "Le Live est visible sur Warsha. Démarrez aussi la diffusion sur votre réseau social." });
    await load();
  };

  const stopEvent = async (event = activeEvent) => {
    if (!event) return;
    await db.from("live_events").update({ status: "ended", updated_at: new Date().toISOString() }).eq("id", event.id);
    await db.from("startups").update({ is_live: false, live_started_at: null }).eq("id", startupId);
    setPreviewOpen(false);
    setActiveEvent(null);
    toast({ title: "Live terminé sur Warsha. Pensez à arrêter la diffusion sur le réseau social." });
    await load();
  };

  const remove = async (id: string) => {
    if (!confirm(t("liveCalendar.creator.deleteConfirm"))) return;
    await db.from("live_events").delete().eq("id", id);
    await load();
  };

  return <div className="space-y-4">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><h3 className="font-serif text-lg font-semibold">{t("liveCalendar.creator.tab")}</h3><p className="text-xs text-muted-foreground">Planifiez vos directs YouTube, Facebook, Instagram ou TikTok sans héberger la vidéo sur Warsha.</p></div>
      <Button size="sm" onClick={openCreate} className="gradient-warm text-primary-foreground"><Plus className="mr-1 h-4 w-4" /> {t("liveCalendar.creator.addLive")}</Button>
    </div>
    {events.length === 0 ? <Card><CardContent className="py-8 text-center text-sm text-muted-foreground">{t("liveCalendar.creator.noEvents")}</CardContent></Card> : <div className="space-y-2">{events.map((event) => {
      const date = new Date(event.scheduled_at);
      const platform = event.external_platform ?? detectExternalPlatform(event.external_url ?? event.stream_url ?? "");
      return <Card key={event.id} className={event.status === "ended" ? "opacity-60" : ""}><CardContent className="flex flex-wrap items-center gap-3 p-4">
        <div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><p className="truncate font-semibold">{event.title}</p>{event.status === "live" && <span className="rounded-full bg-red-500 px-2 py-0.5 text-[10px] font-bold text-white">EN DIRECT</span>}<span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold">{platform ? externalPlatformLabel(platform) : "Lien requis"}</span></div><div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-muted-foreground"><span className="inline-flex items-center gap-1"><CalendarIcon className="h-3 w-3" />{date.toLocaleDateString()}</span><span className="inline-flex items-center gap-1"><Clock className="h-3 w-3" />{date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span><span className="inline-flex items-center gap-1"><Bell className="h-3 w-3 text-primary" />{reminderCounts[event.id] ?? 0}</span></div></div>
        {event.status === "live" ? <><Button size="sm" onClick={() => { setActiveEvent(event); setPreviewOpen(true); }}><Play className="mr-1 h-4 w-4" />Aperçu</Button><Button size="sm" variant="destructive" onClick={() => void stopEvent(event)}>Terminer</Button></> : event.status !== "ended" && <Button size="sm" variant="outline" onClick={() => void startEvent(event)}><Radio className="mr-1 h-4 w-4" />Démarrer</Button>}
        {(event.external_url || event.stream_url) && <Button size="icon" variant="ghost" asChild><a href={event.external_url || event.stream_url} target="_blank" rel="noopener noreferrer" aria-label="Ouvrir sur la plateforme"><ExternalLink className="h-4 w-4" /></a></Button>}
        <Button size="icon" variant="ghost" onClick={() => openEdit(event)}><Pencil className="h-4 w-4" /></Button><Button size="icon" variant="ghost" onClick={() => void remove(event.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
      </CardContent></Card>;
    })}</div>}

    <Dialog open={open} onOpenChange={setOpen}><DialogContent className="max-w-lg"><DialogHeader><DialogTitle>{editing ? "Modifier le Live" : "Créer un Live externe"}</DialogTitle></DialogHeader><div className="space-y-4">
      <div><Label>Titre *</Label><Input value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} /></div>
      <div><Label>Description</Label><Textarea rows={3} value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} /></div>
      <div className="grid grid-cols-2 gap-3"><div><Label>Date *</Label><Input type="date" value={form.date} onChange={(event) => setForm({ ...form, date: event.target.value })} /></div><div><Label>Heure *</Label><Input type="time" value={form.time} onChange={(event) => setForm({ ...form, time: event.target.value })} /></div></div>
      <div><Label>Réseau social</Label><Select value={form.external_platform} onValueChange={(value: ExternalPlatform) => setForm({ ...form, external_platform: value })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="youtube">YouTube Live</SelectItem><SelectItem value="facebook">Facebook Live</SelectItem><SelectItem value="instagram">Instagram Live</SelectItem><SelectItem value="tiktok">TikTok LIVE</SelectItem></SelectContent></Select></div>
      <div><Label>URL publique du Live *</Label><Input type="url" placeholder="https://youtube.com/live/..." value={form.external_url} onChange={(event) => setForm({ ...form, external_url: event.target.value })} /><p className="mt-1 text-xs text-muted-foreground">YouTube et Facebook peuvent s’afficher dans Warsha. Instagram et TikTok s’ouvriront dans leur application ou site.</p></div>
      <div><Label>Durée (minutes)</Label><Input type="number" min={5} max={600} value={form.duration_minutes} onChange={(event) => setForm({ ...form, duration_minutes: Number(event.target.value) })} /></div>
      <div><Label>Image de couverture</Label><Input type="url" value={form.cover_url} onChange={(event) => setForm({ ...form, cover_url: event.target.value })} /></div>
    </div><DialogFooter><Button variant="outline" onClick={() => setOpen(false)}>{t("liveCalendar.creator.cancel")}</Button><Button onClick={() => void save()} className="gradient-warm text-primary-foreground">{t("liveCalendar.creator.save")}</Button></DialogFooter></DialogContent></Dialog>

    <Dialog open={previewOpen} onOpenChange={setPreviewOpen}><DialogContent className="max-w-5xl p-3 sm:p-5"><DialogHeader><DialogTitle>{activeEvent?.title || "Aperçu du Live"}</DialogTitle></DialogHeader>{activeEvent && (activeEvent.external_url || activeEvent.stream_url) ? <ExternalLiveEmbed url={activeEvent.external_url || activeEvent.stream_url} platform={activeEvent.external_platform ?? detectExternalPlatform(activeEvent.external_url || activeEvent.stream_url)} /> : <p className="p-8 text-center text-sm text-muted-foreground">Ajoutez le lien public du Live.</p>}<DialogFooter><Button variant="outline" onClick={() => setPreviewOpen(false)}>Fermer l’aperçu</Button>{activeEvent?.status === "live" && <Button variant="destructive" onClick={() => void stopEvent()}>Terminer sur Warsha</Button>}</DialogFooter></DialogContent></Dialog>
  </div>;
}
