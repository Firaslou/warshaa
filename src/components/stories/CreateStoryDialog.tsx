import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Upload } from "lucide-react";

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
      const path = `stories/${startupId}/${Date.now()}.${ext}`;
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
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="font-serif">Nouvelle story</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <label className="flex aspect-[9/16] max-h-[50vh] w-full cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border bg-secondary/40 transition hover:border-primary">
            {file ? (
              file.type.startsWith("video/") ? (
                <video src={URL.createObjectURL(file)} className="h-full w-full rounded-xl object-cover" controls />
              ) : (
                <img src={URL.createObjectURL(file)} alt="" className="h-full w-full rounded-xl object-cover" />
              )
            ) : (
              <>
                <Upload className="h-8 w-8 text-primary" />
                <p className="text-sm text-muted-foreground">Photo ou vidéo (≤30s)</p>
              </>
            )}
            <Input
              type="file"
              accept="image/*,video/*"
              className="hidden"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
          </label>
          <Textarea
            placeholder="Légende (optionnelle)"
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            maxLength={200}
            rows={2}
          />
          <Button onClick={publish} disabled={uploading || !file} className="w-full gradient-warm text-primary-foreground">
            {uploading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Publication…</> : "Publier la story"}
          </Button>
          <p className="text-center text-xs text-muted-foreground">Visible pendant 24 h puis supprimée automatiquement.</p>
        </div>
      </DialogContent>
    </Dialog>
  );
}