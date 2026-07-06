import { useEffect, useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Link } from "react-router-dom";
import { X, ChevronLeft, ChevronRight, Trash2, Eye, Heart, Send, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";

export interface StoryItem {
  id: string;
  media_url: string | null;
  media_type: "image" | "video" | "text";
  caption: string | null;
  created_at: string;
  user_id: string;
  background?: string | null;
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
const REACTIONS = ["❤️", "😍", "😂", "😮", "😢", "🔥"];

export function StoryViewer({ open, onOpenChange, groups, startGroupIdx, onDeleted }: Props) {
  const { user } = useAuth();
  const [gIdx, setGIdx] = useState(startGroupIdx);
  const [sIdx, setSIdx] = useState(0);
  const [progress, setProgress] = useState(0);
  const [paused, setPaused] = useState(false);
  const [viewsCount, setViewsCount] = useState(0);
  const [reactionsCount, setReactionsCount] = useState(0);
  const [myReaction, setMyReaction] = useState<string | null>(null);
  const [commentsCount, setCommentsCount] = useState(0);
  const [comment, setComment] = useState("");
  const [showPanel, setShowPanel] = useState<null | "views" | "comments">(null);
  const [panelData, setPanelData] = useState<any[]>([]);

  useEffect(() => { if (open) { setGIdx(startGroupIdx); setSIdx(0); setProgress(0); } }, [open, startGroupIdx]);

  const group = groups[gIdx];
  const story = group?.stories[sIdx];
  const isOwner = user?.id === story?.user_id;

  // Load stats + record view whenever story changes
  useEffect(() => {
    if (!open || !story || !user) return;
    let cancelled = false;
    (async () => {
      // Record view (ignore duplicate error)
      if (story.user_id !== user.id) {
        await supabase.from("story_views").insert({ story_id: story.id, user_id: user.id });
      }
      const [{ count: vc }, { count: rc }, { count: cc }, mine] = await Promise.all([
        supabase.from("story_views").select("*", { count: "exact", head: true }).eq("story_id", story.id),
        supabase.from("story_reactions").select("*", { count: "exact", head: true }).eq("story_id", story.id),
        supabase.from("story_comments").select("*", { count: "exact", head: true }).eq("story_id", story.id),
        supabase.from("story_reactions").select("emoji").eq("story_id", story.id).eq("user_id", user.id).maybeSingle(),
      ]);
      if (cancelled) return;
      setViewsCount(vc ?? 0);
      setReactionsCount(rc ?? 0);
      setCommentsCount(cc ?? 0);
      setMyReaction((mine.data as any)?.emoji ?? null);
    })();
    return () => { cancelled = true; };
  }, [open, story?.id, user?.id]);

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
    if (!open || !story || story.media_type === "video") return;
    setProgress(0);
    let elapsed = 0;
    let last = Date.now();
    const id = setInterval(() => {
      const now = Date.now();
      if (!paused && !showPanel) elapsed += now - last;
      last = now;
      const p = Math.min(100, (elapsed / DURATION_IMG) * 100);
      setProgress(p);
      if (p >= 100) { clearInterval(id); next(); }
    }, 50);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, gIdx, sIdx, story?.id, paused, showPanel]);

  if (!group || !story) return null;

  const handleDelete = async () => {
    const { error } = await supabase.from("stories").delete().eq("id", story.id);
    if (error) { toast.error("Suppression impossible"); return; }
    toast.success("Story supprimée");
    onDeleted?.(story.id);
    next();
  };

  const react = async (emoji: string) => {
    if (!user) { toast.error("Connecte-toi pour réagir"); return; }
    if (myReaction === emoji) {
      await supabase.from("story_reactions").delete().eq("story_id", story.id).eq("user_id", user.id);
      setMyReaction(null);
      setReactionsCount((c) => Math.max(0, c - 1));
      return;
    }
    const wasNew = !myReaction;
    const { error } = await supabase
      .from("story_reactions")
      .upsert({ story_id: story.id, user_id: user.id, emoji }, { onConflict: "story_id,user_id" });
    if (error) { toast.error("Réaction impossible"); return; }
    setMyReaction(emoji);
    if (wasNew) setReactionsCount((c) => c + 1);
  };

  const sendComment = async () => {
    if (!user) { toast.error("Connecte-toi pour commenter"); return; }
    const text = comment.trim();
    if (!text) return;
    const { error } = await supabase.from("story_comments").insert({
      story_id: story.id, user_id: user.id, content: text.slice(0, 500),
    });
    if (error) { toast.error("Envoi impossible"); return; }
    setComment("");
    setCommentsCount((c) => c + 1);
    toast.success("Commentaire envoyé");
    if (showPanel === "comments") openPanel("comments");
  };

  const openPanel = async (kind: "views" | "comments") => {
    setShowPanel(kind);
    if (kind === "views") {
      const { data } = await supabase
        .from("story_views")
        .select("user_id, created_at, profiles:profiles(full_name, avatar_url)" as any)
        .eq("story_id", story.id)
        .order("created_at", { ascending: false });
      setPanelData((data as any) ?? []);
    } else {
      const { data } = await supabase
        .from("story_comments")
        .select("id, user_id, content, created_at, profiles:profiles(full_name, avatar_url)" as any)
        .eq("story_id", story.id)
        .order("created_at", { ascending: false });
      setPanelData((data as any) ?? []);
    }
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
        <div
          className="relative aspect-[9/16] w-full max-h-[80vh] bg-black select-none"
          onPointerDown={() => setPaused(true)}
          onPointerUp={() => setPaused(false)}
          onPointerLeave={() => setPaused(false)}
        >
          {story.media_type === "text" ? (
            <div
              className="flex h-full w-full items-center justify-center p-8"
              style={{ backgroundImage: story.background || "linear-gradient(135deg,#833ab4,#fd1d1d,#fcb045)" }}
            >
              <p className="text-center text-2xl font-bold leading-tight text-white drop-shadow">
                {story.caption}
              </p>
            </div>
          ) : story.media_type === "image" ? (
            <img src={story.media_url!} alt="" className="h-full w-full object-contain" />
          ) : (
            <video
              key={story.id}
              src={story.media_url!}
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

          {story.caption && story.media_type !== "text" && (
            <div className="absolute bottom-16 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-4 pb-6">
              <p className="text-center text-sm text-white">{story.caption}</p>
            </div>
          )}
        </div>

        {/* Footer: reactions bar + comment input, or owner stats */}
        <div className="relative z-10 border-t border-white/10 bg-black px-3 py-2">
          {isOwner ? (
            <div className="flex items-center justify-around text-white">
              <button onClick={() => openPanel("views")} className="flex flex-col items-center gap-0.5 px-3 py-1 text-xs hover:opacity-80">
                <Eye className="h-5 w-5" />
                <span className="font-semibold">{viewsCount}</span>
                <span className="text-[10px] opacity-70">vues</span>
              </button>
              <div className="flex flex-col items-center gap-0.5 px-3 py-1 text-xs">
                <Heart className="h-5 w-5" />
                <span className="font-semibold">{reactionsCount}</span>
                <span className="text-[10px] opacity-70">réactions</span>
              </div>
              <button onClick={() => openPanel("comments")} className="flex flex-col items-center gap-0.5 px-3 py-1 text-xs hover:opacity-80">
                <MessageCircle className="h-5 w-5" />
                <span className="font-semibold">{commentsCount}</span>
                <span className="text-[10px] opacity-70">commentaires</span>
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-around">
                {REACTIONS.map((e) => (
                  <button
                    key={e}
                    onClick={() => react(e)}
                    className={`text-2xl transition-transform hover:scale-125 ${myReaction === e ? "scale-125" : "opacity-80"}`}
                    aria-label={`Réagir ${e}`}
                  >
                    {e}
                  </button>
                ))}
              </div>
              <form
                onSubmit={(e) => { e.preventDefault(); sendComment(); }}
                className="flex items-center gap-2"
              >
                <Input
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  onFocus={() => setPaused(true)}
                  onBlur={() => setPaused(false)}
                  placeholder={`Répondre à ${group.startup_name}...`}
                  className="h-9 border-white/30 bg-white/10 text-white placeholder:text-white/50"
                  maxLength={500}
                />
                <Button type="submit" size="icon" className="h-9 w-9 shrink-0" disabled={!comment.trim()}>
                  <Send className="h-4 w-4" />
                </Button>
              </form>
            </div>
          )}
        </div>

        {/* Views/Comments panel for owner */}
        {showPanel && (
          <div className="absolute inset-0 z-30 flex flex-col bg-black/95">
            <div className="flex items-center justify-between border-b border-white/10 p-3">
              <h3 className="text-sm font-semibold text-white">
                {showPanel === "views" ? `Vues (${viewsCount})` : `Commentaires (${commentsCount})`}
              </h3>
              <Button size="icon" variant="ghost" className="h-8 w-8 text-white hover:bg-white/20" onClick={() => setShowPanel(null)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="flex-1 space-y-2 overflow-y-auto p-3">
              {panelData.length === 0 && (
                <p className="pt-10 text-center text-sm text-white/60">Rien pour l'instant</p>
              )}
              {panelData.map((row: any) => (
                <div key={row.id ?? row.user_id} className="flex items-start gap-2 rounded-lg bg-white/5 p-2 text-white">
                  <div className="h-8 w-8 shrink-0 overflow-hidden rounded-full bg-white/20">
                    {row.profiles?.avatar_url ? (
                      <img src={row.profiles.avatar_url} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-xs font-bold">
                        {(row.profiles?.full_name || "?").charAt(0).toUpperCase()}
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-semibold">{row.profiles?.full_name || "Utilisateur"}</p>
                    {showPanel === "comments" && <p className="text-sm">{row.content}</p>}
                    <p className="text-[10px] text-white/50">{new Date(row.created_at).toLocaleString("fr-FR")}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}