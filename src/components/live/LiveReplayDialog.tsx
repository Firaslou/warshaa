import { useEffect, useState } from "react";
import { Play, X, Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface LiveReplayDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  liveEventId: string;
  title: string;
  creatorName: string;
  recordingUrl?: string | null;
}

export function LiveReplayDialog({
  open,
  onOpenChange,
  liveEventId,
  title,
  creatorName,
  recordingUrl: initialRecordingUrl,
}: LiveReplayDialogProps) {
  const [recordingUrl, setRecordingUrl] = useState<string | null>(initialRecordingUrl ?? null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setRecordingUrl(initialRecordingUrl ?? null);
  }, [initialRecordingUrl, open]);

  useEffect(() => {
    if (!open || initialRecordingUrl) return;

    let cancelled = false;
    setLoading(true);
    void (async () => {
      const { data, error } = await (supabase.from("live_events" as any) as any)
        .select("recording_url")
        .eq("id", liveEventId)
        .maybeSingle();

      if (cancelled) return;
      setLoading(false);
      if (error) {
        console.error("Could not load live recording:", error);
        return;
      }
      setRecordingUrl(data?.recording_url ?? null);
    })();

    return () => {
      cancelled = true;
    };
  }, [open, liveEventId, initialRecordingUrl]);

  const handleVideoError = () => {
    toast.error("L'enregistrement est indisponible ou a été supprimé.");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl overflow-hidden rounded-3xl p-0">
        <DialogHeader className="px-6 pt-6">
          <DialogTitle className="font-serif text-xl">Enregistrement du live</DialogTitle>
          <p className="text-sm text-muted-foreground">
            {title} · {creatorName}
          </p>
        </DialogHeader>

        <div className="px-6 pb-6">
          {loading ? (
            <div className="flex min-h-[360px] items-center justify-center rounded-2xl bg-muted">
              <Loader2 className="h-7 w-7 animate-spin text-primary" />
            </div>
          ) : recordingUrl ? (
            <div className="overflow-hidden rounded-2xl bg-black shadow-lg">
              <video
                key={recordingUrl}
                src={recordingUrl}
                controls
                playsInline
                preload="metadata"
                className="max-h-[65vh] w-full bg-black"
                onError={handleVideoError}
              />
              <div className="flex items-center justify-between gap-3 px-4 py-3 text-xs text-white/70">
                <span className="inline-flex items-center gap-1.5">
                  <Play className="h-3.5 w-3.5 text-primary" /> Replay du direct
                </span>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => onOpenChange(false)}
                  className="text-white/70 hover:text-white"
                >
                  Fermer
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex min-h-[360px] flex-col items-center justify-center rounded-2xl bg-muted px-6 text-center">
              <div className="mb-4 rounded-full bg-primary/10 p-4 text-primary">
                <Play className="h-8 w-8" />
              </div>
              <h3 className="font-serif text-lg font-bold">Aucun enregistrement disponible</h3>
              <p className="mt-1 max-w-md text-sm text-muted-foreground">
                Ce live n'a pas encore de replay enregistré. Les prochains lives seront automatiquement enregistrés lorsqu'ils sont lancés depuis Warsha.
              </p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
