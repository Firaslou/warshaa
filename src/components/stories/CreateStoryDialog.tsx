import { useEffect, useRef, useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, ImagePlus, X, Send, Camera, Video as VideoIcon, Type, RefreshCw, Circle, Square, SwitchCamera } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  startupId: string;
  userId: string;
  onPublished?: () => void;
}

type Mode = "camera" | "text";

const TEXT_BGS = [
  "linear-gradient(135deg,#833ab4,#fd1d1d,#fcb045)",
  "linear-gradient(135deg,#2193b0,#6dd5ed)",
  "linear-gradient(135deg,#f7971e,#ffd200)",
  "linear-gradient(135deg,#11998e,#38ef7d)",
  "linear-gradient(135deg,#1f1c2c,#928dab)",
  "linear-gradient(135deg,#ee0979,#ff6a00)",
];

export function CreateStoryDialog({ open, onOpenChange, startupId, userId, onPublished }: Props) {
  const [mode, setMode] = useState<Mode>("camera");
  const [file, setFile] = useState<File | null>(null);
  const [caption, setCaption] = useState("");
  const [uploading, setUploading] = useState(false);
  const [bgIdx, setBgIdx] = useState(0);
  const [facing, setFacing] = useState<"user" | "environment">("environment");
  const [recording, setRecording] = useState(false);
  const [recordSec, setRecordSec] = useState(0);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const recordTimer = useRef<number | null>(null);

  const reset = () => {
    setFile(null); setCaption(""); setRecording(false); setRecordSec(0);
  };

  const stopStream = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  };

  const startCamera = async () => {
    stopStream();
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: facing },
        audio: true,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => {});
      }
    } catch {
      // camera not available — silently allow gallery fallback
    }
  };

  useEffect(() => {
    if (open && mode === "camera" && !file) startCamera();
    return () => { if (!open) stopStream(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, mode, file, facing]);

  useEffect(() => () => stopStream(), []);

  const takePhoto = () => {
    const v = videoRef.current;
    if (!v || !v.videoWidth) { toast.error("Caméra indisponible"); return; }
    const c = document.createElement("canvas");
    c.width = v.videoWidth; c.height = v.videoHeight;
    c.getContext("2d")?.drawImage(v, 0, 0);
    c.toBlob((blob) => {
      if (!blob) return;
      setFile(new File([blob], `photo-${Date.now()}.jpg`, { type: "image/jpeg" }));
      stopStream();
    }, "image/jpeg", 0.92);
  };

  const startRecording = () => {
    const stream = streamRef.current;
    if (!stream) { toast.error("Caméra indisponible"); return; }
    chunksRef.current = [];
    const mime = MediaRecorder.isTypeSupported("video/mp4") ? "video/mp4" : "video/webm";
    const rec = new MediaRecorder(stream, { mimeType: mime });
    rec.ondataavailable = (e) => e.data.size && chunksRef.current.push(e.data);
    rec.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: mime });
      const ext = mime.includes("mp4") ? "mp4" : "webm";
      setFile(new File([blob], `video-${Date.now()}.${ext}`, { type: mime }));
      stopStream();
    };
    rec.start();
    recorderRef.current = rec;
    setRecording(true);
    setRecordSec(0);
    recordTimer.current = window.setInterval(() => {
      setRecordSec((s) => {
        if (s + 1 >= 60) { stopRecording(); return 60; }
        return s + 1;
      });
    }, 1000);
  };

  const stopRecording = () => {
    if (recordTimer.current) { clearInterval(recordTimer.current); recordTimer.current = null; }
    if (recorderRef.current?.state === "recording") recorderRef.current.stop();
    setRecording(false);
  };

  const publish = async () => {
    setUploading(true);
    try {
      if (mode === "text") {
        if (!caption.trim()) { toast.error("Écris quelque chose"); setUploading(false); return; }
        const { error } = await supabase.from("stories").insert({
          startup_id: startupId,
          user_id: userId,
          media_url: null,
          media_type: "text",
          caption: caption.trim(),
          background: TEXT_BGS[bgIdx],
        } as any);
        if (error) throw error;
      } else {
        if (!file) { toast.error("Prends une photo ou une vidéo"); setUploading(false); return; }
        const isVideo = file.type.startsWith("video/");
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
      }
      toast.success("Story publiée ! Elle disparaît dans 24 h.");
      reset();
      onOpenChange(false);
      onPublished?.();
    } catch (e: any) {
      toast.error(e.message ?? "Erreur lors de la publication");
    } finally { setUploading(false); }
  };

  const previewUrl = file ? URL.createObjectURL(file) : null;

  return (
    <Dialog open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) { stopStream(); reset(); } }}>
      <DialogContent className="max-w-none w-screen h-[100dvh] gap-0 rounded-none border-0 bg-black p-0 sm:rounded-none [&>button]:hidden">
        <div className="relative flex h-full w-full flex-col">
          {/* Top bar */}
          <div className="absolute inset-x-0 top-0 z-30 flex items-center justify-between px-4 py-3">
            <button onClick={() => onOpenChange(false)} className="rounded-full bg-black/40 p-2 text-white backdrop-blur hover:bg-black/60">
              <X className="h-5 w-5" />
            </button>
            <span className="text-sm font-semibold text-white/90">Ta story</span>
            {mode === "camera" && !file ? (
              <button onClick={() => setFacing(f => f === "user" ? "environment" : "user")}
                className="rounded-full bg-black/40 p-2 text-white backdrop-blur hover:bg-black/60">
                <SwitchCamera className="h-5 w-5" />
              </button>
            ) : mode === "text" ? (
              <button onClick={() => setBgIdx((i) => (i + 1) % TEXT_BGS.length)}
                className="rounded-full bg-black/40 p-2 text-white backdrop-blur hover:bg-black/60">
                <RefreshCw className="h-5 w-5" />
              </button>
            ) : <div className="w-9" />}
          </div>

          {/* Main area */}
          <div className="relative flex-1 overflow-hidden">
            {mode === "text" && !file && (
              <div className="absolute inset-0 flex items-center justify-center p-8" style={{ backgroundImage: TEXT_BGS[bgIdx] }}>
                <textarea
                  value={caption}
                  onChange={(e) => setCaption(e.target.value)}
                  maxLength={280}
                  autoFocus
                  placeholder="Écris quelque chose…"
                  className="w-full max-w-md resize-none bg-transparent text-center text-3xl font-bold text-white placeholder:text-white/60 focus:outline-none"
                  rows={6}
                />
              </div>
            )}

            {mode === "camera" && !file && (
              <video ref={videoRef} className="absolute inset-0 h-full w-full object-cover" playsInline muted autoPlay />
            )}

            {file && previewUrl && (
              <div className="absolute inset-0 flex items-center justify-center">
                {file.type.startsWith("video/") ? (
                  <video src={previewUrl} className="h-full w-full object-contain" autoPlay muted loop playsInline />
                ) : (
                  <img src={previewUrl} alt="" className="h-full w-full object-contain" />
                )}
                <button
                  onClick={() => { setFile(null); if (mode === "camera") startCamera(); }}
                  className="absolute right-4 top-16 rounded-full bg-black/50 px-3 py-1.5 text-xs font-medium text-white backdrop-blur hover:bg-black/70"
                >
                  Changer
                </button>
              </div>
            )}

            {/* Recording indicator */}
            {recording && (
              <div className="absolute left-1/2 top-16 z-20 -translate-x-1/2 rounded-full bg-red-600 px-3 py-1 text-xs font-semibold text-white shadow-lg">
                ● REC {recordSec}s
              </div>
            )}
          </div>

          {/* Bottom controls */}
          <div className="absolute inset-x-0 bottom-0 z-20 bg-gradient-to-t from-black/90 to-transparent px-4 pb-6 pt-4">
            {/* Caption row (when we have media OR text-mode ready) */}
            {file && (
              <div className="mb-3 flex items-center gap-2">
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

            {/* Camera controls */}
            {mode === "camera" && !file && (
              <div className="flex items-center justify-around">
                <label className="cursor-pointer rounded-full bg-white/10 p-3 text-white backdrop-blur hover:bg-white/20">
                  <ImagePlus className="h-6 w-6" />
                  <input
                    type="file"
                    accept="image/*,video/*"
                    className="hidden"
                    onChange={(e) => { const f = e.target.files?.[0]; if (f) { stopStream(); setFile(f); } }}
                  />
                </label>

                {!recording ? (
                  <div className="flex items-center gap-6">
                    <button
                      onClick={takePhoto}
                      className="flex h-20 w-20 items-center justify-center rounded-full border-4 border-white bg-white/20 backdrop-blur active:scale-95"
                      aria-label="Prendre une photo"
                    >
                      <Camera className="h-8 w-8 text-white" />
                    </button>
                    <button
                      onClick={startRecording}
                      className="flex h-14 w-14 items-center justify-center rounded-full border-2 border-white/70 bg-red-500/80 backdrop-blur active:scale-95"
                      aria-label="Enregistrer une vidéo"
                    >
                      <VideoIcon className="h-6 w-6 text-white" />
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={stopRecording}
                    className="flex h-20 w-20 items-center justify-center rounded-full border-4 border-white bg-red-600 active:scale-95"
                    aria-label="Arrêter"
                  >
                    <Square className="h-8 w-8 fill-white text-white" />
                  </button>
                )}

                <button
                  onClick={() => { stopStream(); setMode("text"); }}
                  className="rounded-full bg-white/10 p-3 text-white backdrop-blur hover:bg-white/20"
                  aria-label="Story texte"
                >
                  <Type className="h-6 w-6" />
                </button>
              </div>
            )}

            {/* Text mode publish */}
            {mode === "text" && !file && (
              <div className="flex items-center justify-between gap-3">
                <button
                  onClick={() => setMode("camera")}
                  className="rounded-full bg-white/10 p-3 text-white backdrop-blur hover:bg-white/20"
                  aria-label="Caméra"
                >
                  <Camera className="h-6 w-6" />
                </button>
                <Button
                  onClick={publish}
                  disabled={uploading || !caption.trim()}
                  className="rounded-full bg-gradient-to-br from-fuchsia-500 via-rose-500 to-amber-400 px-6 py-6 text-base font-semibold text-white shadow-xl hover:opacity-90"
                >
                  {uploading ? <Loader2 className="h-5 w-5 animate-spin" /> : <>Publier <Send className="ml-2 h-4 w-4" /></>}
                </Button>
                <div className="w-12" />
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
