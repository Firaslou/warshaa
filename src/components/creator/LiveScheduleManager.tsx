import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Plus, Pencil, Trash2, Bell, Calendar as CalendarIcon, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
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
}

export function LiveScheduleManager({ startupId }: { startupId: string }) {
  const { t } = useTranslation();
  const [events, setEvents] = useState<LiveEvent[]>([]);
  const [reminderCounts, setReminderCounts] = useState<Record<string, number>>({});
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<LiveEvent | null>(null);
  const [form, setForm] = useState({
    title: "", description: "", date: "", time: "",
    duration_minutes: 60, platform: "", stream_url: "", cover_url: "",
  });

  const load = async () => {
    const { data } = await supabase
      .from("live_events")
      .select("*")
      .eq("startup_id", startupId)
      .order("scheduled_at", { ascending: false });
    const list = (data ?? []) as LiveEvent[];
    setEvents(list);

    if (list.length > 0) {
      const { data: rems } = await supabase
        .from("live_reminders")
        .select("live_event_id")
        .in("live_event_id", list.map((e) => e.id));
      const counts: Record<string, number> = {};
      (rems ?? []).forEach((r: any) => { counts[r.live_event_id] = (counts[r.live_event_id] ?? 0) + 1; });
      setReminderCounts(counts);
    }
  };

  useEffect(() => { if (startupId) load(); }, [startupId]);

  const openCreate = () => {
    setEditing(null);
    setForm({ title: "", description: "", date: "", time: "", duration_minutes: 60, platform: "", stream_url: "", cover_url: "" });
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
      platform: e.platform ?? "",
      stream_url: e.stream_url ?? "",
      cover_url: e.cover_url ?? "",
    });
    setOpen(true);
  };

  const save = async () => {
    if (!form.title.trim()) { toast({ title: t("liveCalendar.creator.titleRequired"), variant: "destructive" }); return; }
    if (!form.date || !form.time) { toast({ title: t("liveCalendar.creator.dateRequired"), variant: "destructive" }); return; }
    const scheduled = new Date(`${form.date}T${form.time}`);
    if (!editing && scheduled.getTime() < Date.now()) {
      toast({ title: t("liveCalendar.creator.dateRequired"), variant: "destructive" }); return;
    }
    const payload = {
      startup_id: startupId,
      title: form.title.trim(),
      description: form.description.trim() || null,
      scheduled_at: scheduled.toISOString(),
      duration_minutes: Number(form.duration_minutes) || 60,
      platform: form.platform.trim() || null,
      stream_url: form.stream_url.trim() || null,
      cover_url: form.cover_url.trim() || null,
    };
    const res = editing
      ? await supabase.from("live_events").update(payload).eq("id", editing.id)
      : await supabase.from("live_events").insert(payload);
    if (res.error) { toast({ title: res.error.message, variant: "destructive" }); return; }
    toast({ title: t("liveCalendar.creator.saved") });
    setOpen(false);
    load();
  };

  const remove = async (id: string) => {
    if (!confirm(t("liveCalendar.creator.deleteConfirm"))) return;
    await supabase.from("live_events").delete().eq("id", id);
    toast({ title: t("liveCalendar.creator.deleted") });
    load();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-serif text-lg font-semibold">{t("liveCalendar.creator.tab")}</h3>
        <Button size="sm" onClick={openCreate} className="gradient-warm text-primary-foreground">
          <Plus className="mr-1 h-4 w-4" /> {t("liveCalendar.creator.addLive")}
        </Button>
      </div>

      {events.length === 0 ? (
        <Card><CardContent className="py-8 text-center text-sm text-muted-foreground">{t("liveCalendar.creator.noEvents")}</CardContent></Card>
      ) : (
        <div className="space-y-2">
          {events.map((e) => {
            const d = new Date(e.scheduled_at);
            const isPast = d.getTime() + e.duration_minutes * 60_000 < Date.now();
            return (
              <Card key={e.id} className={isPast ? "opacity-60" : ""}>
                <CardContent className="flex flex-wrap items-center gap-3 p-4">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold">{e.title}</p>
                    <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                      <span className="inline-flex items-center gap-1"><CalendarIcon className="h-3 w-3" /> {d.toLocaleDateString()}</span>
                      <span className="inline-flex items-center gap-1"><Clock className="h-3 w-3" /> {d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                      <span className="inline-flex items-center gap-1"><Bell className="h-3 w-3 text-primary" /> {reminderCounts[e.id] ?? 0} {t("liveCalendar.page.reminders")}</span>
                    </div>
                  </div>
                  <Button size="icon" variant="ghost" onClick={() => openEdit(e)}><Pencil className="h-4 w-4" /></Button>
                  <Button size="icon" variant="ghost" onClick={() => remove(e.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? t("liveCalendar.creator.editLive") : t("liveCalendar.creator.addLive")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>{t("liveCalendar.creator.title")} *</Label>
              <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            </div>
            <div>
              <Label>{t("liveCalendar.creator.description")}</Label>
              <Textarea rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>{t("liveCalendar.creator.date")} *</Label>
                <Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
              </div>
              <div>
                <Label>{t("liveCalendar.creator.time")} *</Label>
                <Input type="time" value={form.time} onChange={(e) => setForm({ ...form, time: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>{t("liveCalendar.creator.duration")}</Label>
                <Input type="number" min={5} max={600} value={form.duration_minutes} onChange={(e) => setForm({ ...form, duration_minutes: Number(e.target.value) })} />
              </div>
              <div>
                <Label>{t("liveCalendar.creator.platform")}</Label>
                <Input placeholder="Instagram, TikTok…" value={form.platform} onChange={(e) => setForm({ ...form, platform: e.target.value })} />
              </div>
            </div>
            <div>
              <Label>{t("liveCalendar.creator.streamUrl")}</Label>
              <Input type="url" placeholder="https://…" value={form.stream_url} onChange={(e) => setForm({ ...form, stream_url: e.target.value })} />
            </div>
            <div>
              <Label>{t("liveCalendar.creator.cover")}</Label>
              <Input type="url" placeholder="https://…" value={form.cover_url} onChange={(e) => setForm({ ...form, cover_url: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>{t("liveCalendar.creator.cancel")}</Button>
            <Button onClick={save} className="gradient-warm text-primary-foreground">{t("liveCalendar.creator.save")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}