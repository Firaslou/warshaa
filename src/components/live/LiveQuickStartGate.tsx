import { useEffect, useState } from "react";
import { Facebook, Instagram, Music2, Radio, Youtube } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { detectExternalPlatform, ExternalLiveEmbed, externalPlatformLabel, type ExternalPlatform } from "@/components/live/ExternalLiveEmbed";
import { toast } from "sonner";

type Startup = { id: string; name: string };
type LiveEvent = { id: string; title: string; external_url: string; external_platform: ExternalPlatform };

export const OPEN_EXTERNAL_LIVE_EVENT = "warsha:open-external-live";

export function LiveQuickStartGate() {
  const { user } = useAuth();
  const [chooserOpen, setChooserOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [startup, setStartup] = useState<Startup | null>(null);
  const [activeEvent, setActiveEvent] = useState<LiveEvent | null>(null);
  const [platform, setPlatform] = useState<ExternalPlatform>("youtube");
  const [externalUrl, setExternalUrl] = useState("");
  const [starting, setStarting] = useState(false);

  const openManager = async () => {
    if (!user) return toast.error("Connectez-vous pour annoncer un live.");
    const { data, error } = await supabase.from("startups").select("id,name").eq("owner_id", user.id).maybeSingle();
    if (error || !data) return toast.error(error?.message ?? "Votre profil créateur est introuvable.");
    setStartup(data as Startup);

    const { data: current } = await (supabase as any)
      .from("live_events")
      .select("id,title,external_url,external_platform")
      .eq("startup_id", data.id)
      .eq("status", "live")
      .maybeSingle();
    if (current?.external_url) {
      setActiveEvent(current as LiveEvent);
      setPreviewOpen(true);
      return;
    }
    setPlatform("youtube");
    setExternalUrl("");
    setChooserOpen(true);
  };

  useEffect(() => {
    const onCustomOpen = () => void openManager();
    const onClick = (event: MouseEvent) => {
      const button = (event.target as HTMLElement | null)?.closest("button");
      if (!button || button.textContent?.trim() !== "Démarrer un direct maintenant") return;
      if (!window.location.pathname.includes("/creator")) return;
      event.preventDefault();
      event.stopPropagation();
      void openManager();
    };
    window.addEventListener(OPEN_EXTERNAL_LIVE_EVENT, onCustomOpen);
    document.addEventListener("click", onClick, true);
    return () => {
      window.removeEventListener(OPEN_EXTERNAL_LIVE_EVENT, onCustomOpen);
      document.removeEventListener("click", onClick, true);
    };
  }, [user]);

  const startLive = async () => {
    if (!startup) return;
    const url = externalUrl.trim();
    const detectedPlatform = detectExternalPlatform(url);
    if (!detectedPlatform) return toast.error("Utilisez un lien YouTube, Facebook, Instagram ou TikTok valide.");
    const selectedPlatform = detectedPlatform || platform;

    setStarting(true);
    const startedAt = new Date().toISOString();
    const payload = {
      startup_id: startup.id,
      title: `Live de ${startup.name}`,
      description: `Direct hébergé sur ${externalPlatformLabel(selectedPlatform)}.`,
      scheduled_at: startedAt,
      duration_minutes: 60,
      platform: selectedPlatform,
      status: "live",
      live_mode: "external",
      stream_url: url,
      external_url: url,
      external_platform: selectedPlatform,
      chat_enabled: false,
    };
    const { data: eventRow, error } = await (supabase as any).from("live_events").insert(payload).select("id,title,external_url,external_platform").single();
    if (error || !eventRow) {
      setStarting(false);
      return toast.error(error?.message ?? "Impossible d’annoncer le Live.");
    }
    const { error: startupError } = await supabase.from("startups").update({ is_live: true, live_started_at: startedAt }).eq("id", startup.id);
    if (startupError) {
      await (supabase as any).from("live_events").update({ status: "ended" }).eq("id", eventRow.id);
      setStarting(false);
      return toast.error(startupError.message);
    }
    setActiveEvent(eventRow as LiveEvent);
    setStarting(false);
    setChooserOpen(false);
    setPreviewOpen(true);
    toast.success("Le Live est maintenant visible sur Warsha.");
  };

  const stopLive = async () => {
    if (!startup || !activeEvent) return;
    await (supabase as any).from("live_events").update({ status: "ended", updated_at: new Date().toISOString() }).eq("id", activeEvent.id);
    await supabase.from("startups").update({ is_live: false, live_started_at: null }).eq("id", startup.id);
    setPreviewOpen(false);
    setActiveEvent(null);
    toast.success("Live terminé sur Warsha. Pensez aussi à l’arrêter sur le réseau social.");
  };

  return (
    <>
      <Dialog open={chooserOpen} onOpenChange={setChooserOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle className="font-serif text-2xl">Annoncer un direct externe</DialogTitle>
            <DialogDescription>Lancez d’abord votre direct sur le réseau social, puis collez son lien ici. Warsha ne transporte ni ne stocke la vidéo.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Plateforme</Label>
              <Select value={platform} onValueChange={(value: ExternalPlatform) => setPlatform(value)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="youtube"><span className="inline-flex items-center gap-2"><Youtube className="h-4 w-4" />YouTube Live</span></SelectItem>
                  <SelectItem value="facebook"><span className="inline-flex items-center gap-2"><Facebook className="h-4 w-4" />Facebook Live</span></SelectItem>
                  <SelectItem value="instagram"><span className="inline-flex items-center gap-2"><Instagram className="h-4 w-4" />Instagram Live</span></SelectItem>
                  <SelectItem value="tiktok"><span className="inline-flex items-center gap-2"><Music2 className="h-4 w-4" />TikTok LIVE</span></SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Lien public du direct</Label>
              <Input type="url" placeholder="https://youtube.com/live/…" value={externalUrl} onChange={(event) => setExternalUrl(event.target.value)} />
              <p className="mt-2 text-xs text-muted-foreground">YouTube et Facebook peuvent s’afficher dans Warsha. Instagram et TikTok s’ouvrent directement sur leur plateforme.</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setChooserOpen(false)}>Annuler</Button>
            <Button onClick={() => void startLive()} disabled={starting || !externalUrl.trim()} className="gradient-warm text-primary-foreground">
              <Radio className="mr-2 h-4 w-4" />{starting ? "Publication…" : "Afficher le Live sur Warsha"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-5xl">
          <DialogHeader><DialogTitle>{activeEvent?.title ?? "Live externe"}</DialogTitle></DialogHeader>
          {activeEvent && <ExternalLiveEmbed url={activeEvent.external_url} platform={activeEvent.external_platform} />}
          <DialogFooter>
            <Button variant="outline" onClick={() => setPreviewOpen(false)}>Fermer l’aperçu</Button>
            <Button variant="destructive" onClick={() => void stopLive()}>Terminer sur Warsha</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
