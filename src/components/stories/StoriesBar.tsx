import { useEffect, useState, useCallback } from "react";
import { Plus, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { StoryViewer, StoryGroup } from "./StoryViewer";
import { CreateStoryDialog } from "./CreateStoryDialog";
import { cn } from "@/lib/utils";

interface Props {
  /** Filter to a single startup (used on the startup profile page). */
  startupId?: string;
  /** Slug of the startup when filtering, used to keep avatar link consistent. */
  startupSlug?: string;
  className?: string;
}

interface RawStory {
  id: string;
  startup_id: string;
  user_id: string;
  media_url: string;
  media_type: "image" | "video";
  caption: string | null;
  created_at: string;
}

export function StoriesBar({ startupId, startupSlug, className }: Props) {
  const { user } = useAuth();
  const [groups, setGroups] = useState<StoryGroup[]>([]);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [startIdx, setStartIdx] = useState(0);
  const [ownStartup, setOwnStartup] = useState<{ id: string; slug: string; name: string; logo_url: string | null } | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

  const load = useCallback(async () => {
    let q = supabase
      .from("stories")
      .select("id, startup_id, user_id, media_url, media_type, caption, created_at")
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: true });
    if (startupId) q = q.eq("startup_id", startupId);
    const { data: stories } = await q;
    if (!stories || stories.length === 0) { setGroups([]); return; }
    const ids = Array.from(new Set(stories.map((s) => s.startup_id)));
    const { data: starts } = await supabase
      .from("startups")
      .select("id, slug, name, logo_url")
      .in("id", ids);
    const startMap = new Map((starts ?? []).map((s: any) => [s.id, s]));
    const groupMap = new Map<string, StoryGroup>();
    (stories as RawStory[]).forEach((s) => {
      const st = startMap.get(s.startup_id);
      if (!st) return;
      if (!groupMap.has(s.startup_id)) {
        groupMap.set(s.startup_id, {
          startup_id: s.startup_id,
          startup_slug: st.slug,
          startup_name: st.name,
          logo_url: st.logo_url,
          stories: [],
        });
      }
      groupMap.get(s.startup_id)!.stories.push({
        id: s.id, media_url: s.media_url, media_type: s.media_type,
        caption: s.caption, created_at: s.created_at, user_id: s.user_id,
      });
    });
    setGroups(Array.from(groupMap.values()));
  }, [startupId]);

  useEffect(() => { load(); }, [load]);

  // Detect if current user owns a startup (for the "+" button)
  useEffect(() => {
    if (!user) { setOwnStartup(null); return; }
    (async () => {
      let q = supabase
        .from("startups")
        .select("id, slug, name, logo_url, status")
        .eq("owner_id", user.id)
        .eq("status", "approved")
        .limit(1);
      const { data } = await q;
      const s = data?.[0];
      if (!s) { setOwnStartup(null); return; }
      if (startupId && s.id !== startupId) { setOwnStartup(null); return; }
      setOwnStartup({ id: s.id, slug: s.slug, name: s.name, logo_url: s.logo_url });
    })();
  }, [user, startupId]);

  const handleDeleted = (id: string) => {
    setGroups((gs) =>
      gs
        .map((g) => ({ ...g, stories: g.stories.filter((s) => s.id !== id) }))
        .filter((g) => g.stories.length > 0),
    );
  };

  if (groups.length === 0 && !ownStartup) return null;

  return (
    <>
      <div className={cn("flex gap-4 overflow-x-auto py-3 px-1 scrollbar-none", className)}>
        {ownStartup && (
          <button
            onClick={() => setCreateOpen(true)}
            className="group flex w-16 shrink-0 flex-col items-center gap-1.5"
          >
            <div className="relative h-16 w-16 rounded-full border-2 border-dashed border-primary/60 p-0.5 transition group-hover:border-primary">
              <div className="flex h-full w-full items-center justify-center rounded-full bg-secondary/60">
                {ownStartup.logo_url ? (
                  <img src={ownStartup.logo_url} alt="" className="h-full w-full rounded-full object-cover opacity-80" />
                ) : (
                  <Sparkles className="h-5 w-5 text-primary" />
                )}
              </div>
              <span className="absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full gradient-warm text-primary-foreground shadow-elegant">
                <Plus className="h-3.5 w-3.5" />
              </span>
            </div>
            <span className="max-w-[64px] truncate text-[11px] font-medium text-foreground/80">Ta story</span>
          </button>
        )}
        {groups.map((g, i) => (
          <button
            key={g.startup_id}
            onClick={() => { setStartIdx(i); setViewerOpen(true); }}
            className="group flex w-16 shrink-0 flex-col items-center gap-1.5"
          >
            <div className="rounded-full bg-gradient-to-tr from-primary via-accent to-primary p-[2px] transition group-hover:scale-105">
              <div className="rounded-full bg-background p-0.5">
                {g.logo_url ? (
                  <img src={g.logo_url} alt={g.startup_name} className="h-14 w-14 rounded-full object-cover" />
                ) : (
                  <div className="flex h-14 w-14 items-center justify-center rounded-full gradient-warm text-base font-bold text-primary-foreground">
                    {g.startup_name.charAt(0).toUpperCase()}
                  </div>
                )}
              </div>
            </div>
            <span className="max-w-[64px] truncate text-[11px] font-medium text-foreground/80">{g.startup_name}</span>
          </button>
        ))}
      </div>

      {viewerOpen && (
        <StoryViewer
          open={viewerOpen}
          onOpenChange={setViewerOpen}
          groups={groups}
          startGroupIdx={startIdx}
          onDeleted={handleDeleted}
        />
      )}
      {ownStartup && (
        <CreateStoryDialog
          open={createOpen}
          onOpenChange={setCreateOpen}
          startupId={ownStartup.id}
          userId={user!.id}
          onPublished={load}
        />
      )}
    </>
  );
}