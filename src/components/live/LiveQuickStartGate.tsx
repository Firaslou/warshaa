import { useEffect, useState } from "react";
import { Link2, Radio, Video, Youtube, Facebook } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { AgoraLivePlayer } from "@/components/live/AgoraLivePlayer";
import { ExternalLiveEmbed, type ExternalPlatform } from "@/components/live/ExternalLiveEmbed";
import { toast } from "sonner";

type Mode = "agora" | "external";

type Startup = { id: string; name: string; slug?: string | null; logo_url?: string | null };
type LiveEvent = { id: string; live_mode?: Mode | null; agora_channel?: string | null; external_url?: string | null; external_platform?: ExternalPlatform | null; title: string };

const channelFor = (startupId: string) => `warsha-${startupId.slice(0, 8)}-${Date.now().toString(36)}`;

export function LiveQuickStartGate() {
  const { user } = useAuth();
  const [chooserOpen, setChooserOpen] = useState(false);
  const [studioOpen, setStudioOpen] = useState(false);
  const [startup, setStartup] = useState<Startup | null>(null);
  const [activeEvent, setActiveEvent] = useState<LiveEvent | null>(null);
  const [mode, setMode] = useState<Mode>("agora");
  const [platform, setPlatform] = useState<ExternalPlatform>("facebook");
  const [externalUrl, setExternalUrl] = useState("");
  const [starting, setStarting] = useState(false);

  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      const button = target?.closest("button");
      if (!button) return;
      if (button.textContent?.trim() !== "Démarrer un direct maintenant") return;
      if (!window.location.pathname.includes("/dashboard")) return;
      event.preventDefault();
      event.stopPropagation();
      void openChooser();
    };

    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, [user]);

  const openChooser = async () => {
    if (!user) return toast.error("Connectez-vous pour démarrer un live.");
    const { data, error } = await (supabase as any)
      .from("startups")
      .select("id,name,slug,logo_url")
      .eq("owner_id", user.id)
      .maybeSingle();
    if (error || !data) return toast.error(error?.message ?? "Votre profil créateur est introuvable.");
    setStartup(data as Startup);
    setMode("agora");
    setPlatform("facebook");
    setExternalUrl("");
    setChooserOpen(true);
  };

  const startLive = async () => {
    if (!startup) return;
    if (mode === "external") {
      try {
        new URL(externalUrl.trim());
      } catch {
        toast.error("Collez une URL de Live valide.");
        return;
      }
    }

    setStarting(true);
    const startedAt = new Date().toISOString();
    const channel = mode === "agora" ? channelFor(startup.id) : null;
    const payload = {
      startup_id: startup.id,
      title: `Live de ${startup.name}`,
      description: mode === "agora" ? "Le créateur est en direct sur Warsha." : `Live ${platform} relayé sur Warsha.`,
      scheduled_at: startedAt,
      duration_minutes: 60,
      platform: mode === "agora" ? "Agora" : platform,
      status: "live",
      live_mode: mode,
      agora_channel: channel,
      stream_url: mode === "external" ? externalUrl.trim() : null,
      external_url: mode === "external" ? externalUrl.trim() : null,
      external_platform: mode === "external" ? platform : null,
      chat_enabled: mode === "agora",
    };

    const { data: eventRow, error } = await (supabase as any)
      .from("live_events")
      .insert(payload)
      .select("id,title,live_mode,agora_channel,external_url,external_platform")
      .single();

    if (error || !eventRow) {
      setStarting(false);
      toast.error(error?.message ?? "Impossible de créer le Live.");
      return;
    }

    const { error: startupError } = await (supabase as any)
      .from("startups")
      .update({ is_live: true, live_started_at: startedAt })
      .eq("id", startup.id);

    if (startupError) {
      await (supabase as any).from("live_events").update({ status: "ended" }).eq("id", eventRow.id);
      setStarting(false);
      toast.error(startupError.message);
      return;
    }

    setActiveEvent(eventRow as LiveEvent);
    setChooserOpen(false);
    setStudioOpen(true);
    setStarting(false);
    toast.success("Votre Live est lancé.");
  };

  const stopLive = async () => {
    if (!startup || !activeEvent) return;
    await (supabase as any).from("live_events").update({ status: "ended", updated_at: new Date().toISOString() }).eq("id", activeEvent.id);
    await (supabase as any).from("startups").update({ is_live: false, live_started_at: null }).eq("id", startup.id);
    setStudioOpen(false);
    setActiveEvent(null);
    toast.success("Live terminé.");
  };

  return (
    <>
      <Dialog open={chooserOpen} onOpenChange={setChooserOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle className="font-serif text-2xl">Choisissez votre mode de diffusion</DialogTitle>
            <DialogDescription>Vous pouvez diffuser directement sur Warsha ou relayer un Live déjà lancé sur un réseau social.</DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 md:grid-cols-2">
            <Card className={mode === "agora" ? "cursor-pointer border-primary ring-2 ring-primary/20" : "cursor-pointer"} onClick={() => setMode("agora")}>
              <CardContent className="space-y-4 p-5">
                <div className="flex items-center gap-3"><div className="rounded-xl bg-primary/10 p-3"><Video className="h-6 w-6 text-primary" /></div><div><h3 className="font-semibold">Option A — Direct sur Warsha</h3><p className="text-xs text-muted-foreground">Agora • vidéo HD • faible latence</p></div></div>
                <ul className="space-y-1 text-sm text-muted-foreground"><li>• Caméra et micro depuis le navigateur</li><li>• Chat Warsha en temps réel</li><li>• Le créateur peut aimer les commentaires</li></ul>
              </CardContent>
            </Card>

            <Card className={mode === "external" ? "cursor-pointer border-primary ring-2 ring-primary/20" : "cursor-pointer"} onClick={() => setMode("external")}>
              <CardContent className="space-y-4 p-5">
                <div className="flex items-center gap-3"><div className="rounded-xl bg-primary/10 p-3"><Link2 className="h-6 w-6 text-primary" /></div><div><h3 className="font-semibold">Option B — Relais externe</h3><p className="text-xs text-muted-foreground">Facebook, YouTube, Instagram ou TikTok</p></div></div>
                <p className="text-sm text-muted-foreground">Collez le lien de votre Live. Warsha détectera la plateforme et affichera le lecteur lorsqu'un embed est disponible.</p>
              </CardContent>
            </Card>
          </div>

          {mode === "external" && (
            <div className="space-y-3 rounded-2xl border bg-muted/30 p-4">
              <div><Label>Réseau social</Label><Select value={platform} onValueChange={(v) => setPlatform(v as ExternalPlatform)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="facebook"><span className="inline-flex items-center gap-2"><Facebook className="h-4 w-4" /> Facebook Live</span></SelectItem><SelectItem value="youtube"><span className="inline-flex items-center gap-2"><Youtube className="h-4 w-4" /> YouTube Live</span></SelectItem><SelectItem value="instagram">Instagram Live</SelectItem><SelectItem value="tiktok">TikTok LIVE</SelectItem></SelectContent></Select></div>
              <div><Label>URL du Live</Label><Input type="url" placeholder="https://…" value={externalUrl} onChange={(e) => setExternalUrl(e.target.value)} /></div>
            </div>
          )}

          <div className="flex justify-end gap-2"><Button variant="outline" onClick={() => setChooserOpen(false)}>Annuler</Button><Button onClick={() => void startLive()} disabled={starting} className="gradient-warm text-primary-foreground"><Radio className="mr-2 h-4 w-4" />{starting ? "Démarrage…" : "Démarrer le Live"}</Button></div>
        </DialogContent>
      </Dialog>

      <Dialog open={studioOpen} onOpenChange={(open) => { if (!open) void stopLive(); }}>
        <DialogContent className="max-w-6xl p-3 sm:p-5">
          <DialogHeader><DialogTitle>{activeEvent?.title ?? "Studio Live"}</DialogTitle></DialogHeader>
          {activeEvent?.live_mode === "agora" && activeEvent.agora_channel ? <AgoraLivePlayer liveEventId={activeEvent.id} channel={activeEvent.agora_channel} startupId={startup?.id ?? ""} isHost /> : activeEvent?.external_url ? <ExternalLiveEmbed url={activeEvent.external_url} platform={activeEvent.external_platform ?? "facebook"} /> : null}
          <div className="flex justify-end"><Button variant="destructive" onClick={() => void stopLive()}>Terminer le live</Button></div>
        </DialogContent>
      </Dialog>
    </>
  );
}
