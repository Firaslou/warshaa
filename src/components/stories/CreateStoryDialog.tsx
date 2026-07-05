import { useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, ImagePlus, X, Send } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  startupId: string;
  userId: string;
  onPublished?: () => void;
}

export function CreateStoryDialog({ open, onOpenChange, startupId, userId, onPublished }: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [caption, setCaption] = useState("");
  const [uploading, setUploading] = useState(false);

  const reset = () => { setFile(null); setCaption(""); };

  const publish = async () => {
    if (!file) { toast.error("Choisis une photo ou une vidéo"); return; }
    const isVideo = file.type.startsWith("video/");
    if (isVideo && file.size > 30 * 1024 * 1024) {
      toast.error("Vidéo trop lourde (max ~30 Mo)"); return;
    }
    if (isVideo) {
      // Check duration ≤ 30s
      const duration = await new Promise<number>((resolve) => {
        const v = document.createElement("video");
        v.preload = "metadata";
        v.onloadedmetadata = () => resolve(v.duration);
        v.onerror = () => resolve(0);
        v.src = URL.createObjectURL(file);
      });
      if (duration > 31) { toast.error("Vidéo trop longue (max 30 s)"); return; }
    }
    setUploading(true);
    try {
      const ext = file.name.split(".").pop() || (isVideo ? "mp4" : "jpg");
      const path = `${userId}/stories/${startupId}/${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("startup-assets").upload(path, file, {
        cacheControl: "3600", upsert: false, contentType: file.type,
      });
      if (upErr) throw upErr;
      const { data: pub } = supabase.storage.from("startup-assets").getPublicUrl(path);
      const { error: insErr } = await supabase.from("stories").insert({
        startup_id: startupId,
        user_id: userId,
        media_url: pub.publicUrl,
        media_type: isVideo ? "video" : "image",
        caption: caption.trim() || null,
      });
      if (insErr) throw insErr;
      toast.success("Story publiée ! Elle disparaît dans 24 h.");
      reset();
      onOpenChange(false);
      onPublished?.();
    } catch (e: any) {
      toast.error(e.message ?? "Erreur lors de la publication");
    } finally { setUploading(false); }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) reset(); }}>
      <DialogContent className="max-w-none w-screen h-[100dvh] gap-0 rounded-none border-0 bg-black p-0 sm:rounded-none [&>button]:hidden">
        <div className="relative flex h-full w-full flex-col">
          {/* Top bar */}
          <div className="absolute inset-x-0 top-0 z-20 flex items-center justify-between px-4 py-3">
            <button onClick={() => onOpenChange(false)} className="rounded-full bg-black/40 p-2 text-white backdrop-blur hover:bg-black/60">
              <X className="h-5 w-5" />
            </button>
            <span className="text-sm font-semibold text-white/90">Ta story</span>
            <div className="w-9" />
          </div>

          {/* Media area */}
          <div className="relative flex-1 overflow-hidden">
            {file ? (
              <div className="absolute inset-0 flex items-center justify-center">
                {file.type.startsWith("video/") ? (
                  <video src={URL.createObjectURL(file)} className="h-full w-full object-contain" autoPlay muted loop playsInline />
                ) : (
                  <img src={URL.createObjectURL(file)} alt="" className="h-full w-full object-contain" />
                )}
                {/* Reset */}
                <button
                  onClick={() => setFile(null)}
                  className="absolute right-4 top-16 rounded-full bg-black/50 px-3 py-1.5 text-xs font-medium text-white backdrop-blur hover:bg-black/70"
                >
                  Changer
                </button>
              </div>
            ) : (
              <label className="absolute inset-0 flex cursor-pointer flex-col items-center justify-center gap-4">
                <div className="flex h-24 w-24 items-center justify-center rounded-full bg-gradient-to-br from-fuchsia-500 via-rose-500 to-amber-400 shadow-2xl">
                  <ImagePlus className="h-10 w-10 text-white" />
                </div>
                <p className="text-lg font-semibold text-white">Ajoute une photo ou vidéo</p>
                <p className="text-sm text-white/60">Vidéo ≤ 30 s • max 30 Mo</p>
                <Input
                  type="file"
                  accept="image/*,video/*"
                  className="hidden"
                  onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                />
              </label>
            )}
          </div>

          {/* Bottom composer */}
          {file && (
            <div className="absolute inset-x-0 bottom-0 z-20 flex items-center gap-2 bg-gradient-to-t from-black/90 to-transparent p-4 pb-6">
              <input
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                maxLength={200}
                placeholder="Écris une légende…"
                className="flex-1 rounded-full border border-white/20 bg-white/10 px-4 py-3 text-sm text-white placeholder:text-white/50 backdrop-blur focus:border-white/40 focus:outline-none"
              />
              <Button
                onClick={publish}
                disabled={uploading}
                size="icon"
                className="h-12 w-12 shrink-0 rounded-full bg-gradient-to-br from-fuchsia-500 via-rose-500 to-amber-400 text-white shadow-xl hover:opacity-90"
              >
                {uploading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}