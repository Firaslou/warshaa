import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Store, Radio } from "lucide-react";
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
  media_url: string | null;
  media_type: "image" | "video" | "text";
  caption: string | null;
  created_at: string;
  background?: string | null;
}

interface ActiveLive {
  id: string;
  startup_id: string;
  title: string;
  startup_name: string;
  startup_slug: string;
  logo_url: string | null;
}

export function StoriesBar({ startupId, startupSlug, className }: Props) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [groups, setGroups] = useState<StoryGroup[]>([]);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [startIdx, setStartIdx] = useState(0);
  const [ownStartup, setOwnStartup] = useState<{ id: string; slug: string; name: string; logo_url: string | null } | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [activeLives, setActiveLives] = useState<ActiveLive[]>([]);

  const load = useCallback(async () => {
    if (!user) { setGroups([]); setActiveLives([]); return; }
    // Only show stories from creators the user supports (always include own startup)
    const { data: supports } = await supabase
      .from("startup_supporters")
      .select("startup_id")
      .eq("user_id", user.id);
    const allowed = new Set((supports ?? []).map((s: any) => s.startup_id));
    // Include the user's own startup so they always see their own stories
    const { data: own } = await supabase
      .from("startups")
      .select("id")
      .eq("owner_id", user.id);
    (own ?? []).forEach((s: any) => allowed.add(s.id));
    if (startupId) {
      if (!allowed.has(startupId)) { setGroups([]); return; }
    }

    const allowedIds = Array.from(allowed);
    if (allowedIds.length > 0) {
      const { data: liveRows } = await supabase
        .from("live_events")
        .select("id, startup_id, title")
        .eq("status", "live")
        .in("startup_id", startupId ? [startupId] : allowedIds);
      const liveStartupIds = [...new Set((liveRows ?? []).map((live) => live.startup_id))];
      const { data: liveStartups } = liveStartupIds.length
        ? await supabase.from("startups").select("id, name, slug, logo_url").in("id", liveStartupIds)
        : { data: [] };
      const liveStartupMap = new Map((liveStartups ?? []).map((startup) => [startup.id, startup]));
      setActiveLives((liveRows ?? []).flatMap((live) => {
        const startup = liveStartupMap.get(live.startup_id);
        return startup ? [{ id: live.id, startup_id: live.startup_id, title: live.title, startup_name: startup.name, startup_slug: startup.slug, logo_url: startup.logo_url }] : [];
      }));
    } else {
      setActiveLives([]);
    }

    if (startupId ? !allowed.has(startupId) : allowed.size === 0) { setGroups([]); return; }
    let q = supabase
      .from("stories")
      .select("id, startup_id, user_id, media_url, media_type, caption, created_at, background")
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: true });
    if (startupId) q = q.eq("startup_id", startupId);
    else q = q.in("startup_id", Array.from(allowed));
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
        background: (s as any).background ?? null,
      });
    });
    setGroups(Array.from(groupMap.values()));
  }, [startupId, user]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!user) return;
    const channel = supabase.channel(`stories-and-lives:${user.id}:${startupId ?? "all"}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "stories" }, () => void load())
      .on("postgres_changes", { event: "*", schema: "public", table: "live_events" }, () => void load())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [load, startupId, user]);

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

  if (groups.length === 0 && activeLives.length === 0 && !ownStartup) return null;

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
                  <Store className="h-5 w-5 text-primary" />
                )}
              </div>
              <span className="absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full gradient-warm text-primary-foreground shadow-elegant">
                <Plus className="h-3.5 w-3.5" />
              </span>
            </div>
            <span className="max-w-[64px] truncate text-[11px] font-medium text-foreground/80">Ta story</span>
          </button>
        )}
        {activeLives.map((live) => (
          <button
            key={`live-${live.id}`}
            onClick={() => navigate(`/lives?live=${live.id}`)}
            className="group flex w-16 shrink-0 flex-col items-center gap-1.5"
            title={live.title}
          >
            <div className="relative rounded-full bg-gradient-to-br from-red-500 via-pink-500 to-orange-400 p-[3px] shadow-[0_0_18px_rgba(239,68,68,0.35)] transition group-hover:scale-105">
              <div className="rounded-full bg-background p-0.5">
                {live.logo_url ? <img src={live.logo_url} alt={live.startup_name} className="h-14 w-14 rounded-full object-cover" /> : <div className="flex h-14 w-14 items-center justify-center rounded-full bg-destructive text-destructive-foreground"><Radio className="h-5 w-5" /></div>}
              </div>
              <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 rounded bg-destructive px-1.5 py-0.5 text-[8px] font-black leading-none text-destructive-foreground">LIVE</span>
            </div>
            <span className="mt-1 max-w-[64px] truncate text-[11px] font-semibold text-destructive">{live.startup_name}</span>
          </button>
        ))}
        {groups.map((g, i) => (
          <button
            key={g.startup_id}
            onClick={() => { setStartIdx(i); setViewerOpen(true); }}
            className="group flex w-16 shrink-0 flex-col items-center gap-1.5"
          >
            <div className="rounded-full bg-[conic-gradient(from_180deg,#feda75,#fa7e1e,#d62976,#962fbf,#4f5bd5,#feda75)] p-[2.5px] transition group-hover:scale-105">
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
      {ownStartup && user && (
        <CreateStoryDialog
          open={createOpen}
          onOpenChange={setCreateOpen}
          startupId={ownStartup.id}
          userId={user.id}
          onPublished={load}
        />
      )}
    </>
  );
}
