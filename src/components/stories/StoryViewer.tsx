import { useEffect, useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Link } from "react-router-dom";
import { X, ChevronLeft, ChevronRight, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";

export interface StoryItem {
  id: string;
  media_url: string;
  media_type: "image" | "video";
  caption: string | null;
  created_at: string;
  user_id: string;
}

export interface StoryGroup {
  startup_id: string;
  startup_slug: string;
  startup_name: string;
  logo_url?: string | null;
  stories: StoryItem[];
}

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  groups: StoryGroup[];
  startGroupIdx: number;
  onDeleted?: (id: string) => void;
}

const DURATION_IMG = 5000;

export function StoryViewer({ open, onOpenChange, groups, startGroupIdx, onDeleted }: Props) {
  const { user } = useAuth();
  const [gIdx, setGIdx] = useState(startGroupIdx);
  const [sIdx, setSIdx] = useState(0);
  const [progress, setProgress] = useState(0);

  useEffect(() => { if (open) { setGIdx(startGroupIdx); setSIdx(0); setProgress(0); } }, [open, startGroupIdx]);

  const group = groups[gIdx];
  const story = group?.stories[sIdx];

  const next = () => {
    if (!group) return;
    if (sIdx + 1 < group.stories.length) { setSIdx(sIdx + 1); setProgress(0); }
    else if (gIdx + 1 < groups.length) { setGIdx(gIdx + 1); setSIdx(0); setProgress(0); }
    else onOpenChange(false);
  };
  const prev = () => {
    if (sIdx > 0) { setSIdx(sIdx - 1); setProgress(0); }
    else if (gIdx > 0) { setGIdx(gIdx - 1); setSIdx(groups[gIdx - 1].stories.length - 1); setProgress(0); }
  };

  useEffect(() => {
    if (!open || !story || story.media_type !== "image") return;
    setProgress(0);
    const start = Date.now();
    const id = setInterval(() => {
      const p = Math.min(100, ((Date.now() - start) / DURATION_IMG) * 100);
      setProgress(p);
      if (p >= 100) { clearInterval(id); next(); }
    }, 50);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, gIdx, sIdx, story?.id]);

  if (!group || !story) return null;

  const isOwner = user?.id === story.user_id;

  const handleDelete = async () => {
    const { error } = await supabase.from("stories").delete().eq("id", story.id);
    if (error) { toast.error("Suppression impossible"); return; }
    toast.success("Story supprimée");
    onDeleted?.(story.id);
    next();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md gap-0 overflow-hidden border-0 bg-black p-0">
        {/* Progress bars */}
        <div className="absolute left-0 right-0 top-0 z-20 flex gap-1 p-2">
          {group.stories.map((_, i) => (
            <div key={i} className="h-0.5 flex-1 overflow-hidden rounded-full bg-white/30">
              <div
                className="h-full bg-white transition-[width] duration-100"
                style={{ width: i < sIdx ? "100%" : i === sIdx ? `${progress}%` : "0%" }}
              />
            </div>
          ))}
        </div>
        {/* Header */}
        <div className="absolute left-0 right-0 top-4 z-20 flex items-center justify-between px-3 pt-2">
          <Link to={`/startup/${group.startup_slug}`} onClick={() => onOpenChange(false)} className="flex items-center gap-2">
            {group.logo_url ? (
              <img src={group.logo_url} alt="" className="h-8 w-8 rounded-full border border-white/50 object-cover" />
            ) : (
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/20 text-xs font-bold text-white">
                {group.startup_name.charAt(0).toUpperCase()}
              </div>
            )}
            <span className="text-sm font-semibold text-white drop-shadow">{group.startup_name}</span>
          </Link>
          <div className="flex items-center gap-1">
            {isOwner && (
              <Button size="icon" variant="ghost" className="h-8 w-8 text-white hover:bg-white/20" onClick={handleDelete}>
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
            <Button size="icon" variant="ghost" className="h-8 w-8 text-white hover:bg-white/20" onClick={() => onOpenChange(false)}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Media */}
        <div className="relative aspect-[9/16] w-full max-h-[85vh] bg-black">
          {story.media_type === "image" ? (
            <img src={story.media_url} alt="" className="h-full w-full object-contain" />
          ) : (
            <video
              key={story.id}
              src={story.media_url}
              className="h-full w-full object-contain"
              autoPlay
              playsInline
              controls={false}
              onEnded={next}
              onTimeUpdate={(e) => {
                const v = e.currentTarget;
                setProgress((v.currentTime / Math.max(v.duration, 0.1)) * 100);
              }}
            />
          )}
          {/* Tap zones */}
          <button aria-label="Précédent" onClick={prev} className="absolute left-0 top-0 h-full w-1/3" />
          <button aria-label="Suivant" onClick={next} className="absolute right-0 top-0 h-full w-2/3" />
          {/* Side nav (desktop hint) */}
          <button onClick={prev} className="absolute left-2 top-1/2 hidden -translate-y-1/2 rounded-full bg-black/40 p-1.5 text-white hover:bg-black/60 md:block">
            <ChevronLeft className="h-5 w-5" />
          </button>
          <button onClick={next} className="absolute right-2 top-1/2 hidden -translate-y-1/2 rounded-full bg-black/40 p-1.5 text-white hover:bg-black/60 md:block">
            <ChevronRight className="h-5 w-5" />
          </button>

          {story.caption && (
            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-4 pb-6">
              <p className="text-center text-sm text-white">{story.caption}</p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}