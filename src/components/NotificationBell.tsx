import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Bell, CheckCheck, MessageCircle, Settings } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";
import type { Database } from "@/integrations/supabase/types";

type NotificationRow = Database["public"]["Tables"]["notifications"]["Row"];

const browserNotificationEnabled = (type: string) => {
  try {
    const stored = JSON.parse(localStorage.getItem("warsha.notif.prefs") ?? "{}");
    if (!stored.enabled) return false;
    const prefKey = type === "message"
      ? "messages"
      : type === "live"
        ? "lives"
        : type === "story"
          ? "stories"
          : "trending";
    return stored.prefs?.[prefKey] !== false;
  } catch {
    return false;
  }
};

export function NotificationBell() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [items, setItems] = useState<NotificationRow[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!user) {
      setItems([]);
      setUnreadCount(0);
      return;
    }

    const load = async () => {
      const [{ data }, { count }] = await Promise.all([
        supabase.from("notifications").select("*").eq("user_id", user.id).order("created_at", { ascending: false }).limit(30),
        supabase.from("notifications").select("id", { count: "exact", head: true }).eq("user_id", user.id).eq("read", false),
      ]);
      setItems(data ?? []);
      setUnreadCount(count ?? 0);
    };
    load();

    const channel = supabase
      .channel(`notifications:${user.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` },
        (payload) => {
          const notification = payload.new as NotificationRow;
          const isAlreadyViewing = notification.type === "message"
            && notification.link === `${location.pathname}${location.search}`
            && document.visibilityState === "visible";
          if (isAlreadyViewing) {
            void supabase.from("notifications").update({ read: true }).eq("id", notification.id).eq("user_id", user.id);
            return;
          }
          setItems((current) => [notification, ...current.filter((item) => item.id !== notification.id)].slice(0, 30));
          setUnreadCount((count) => count + 1);
          toast(notification.title, {
            description: notification.body ?? undefined,
            action: notification.link
              ? { label: "Voir", onClick: () => navigate(notification.link!) }
              : undefined,
          });

          if (
            typeof Notification !== "undefined"
            && Notification.permission === "granted"
            && browserNotificationEnabled(notification.type)
            && document.visibilityState !== "visible"
          ) {
            const browserNotification = new Notification(notification.title, {
              body: notification.body ?? undefined,
              icon: "/icon-512.png",
              badge: "/icon-512.png",
            });
            browserNotification.onclick = () => {
              window.focus();
              if (notification.link) navigate(notification.link);
              browserNotification.close();
            };
          }
        },
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user, navigate, location.pathname, location.search]);

  const openNotification = async (notification: NotificationRow) => {
    if (!notification.read) {
      const { error } = await supabase.from("notifications").update({ read: true }).eq("id", notification.id).eq("user_id", user.id);
      if (!error) {
        setItems((current) => current.map((item) => item.id === notification.id ? { ...item, read: true } : item));
        setUnreadCount((count) => Math.max(0, count - 1));
      }
    }
    setOpen(false);
    if (notification.link) navigate(notification.link);
  };

  const markAllRead = async () => {
    const { error } = await supabase.from("notifications").update({ read: true }).eq("user_id", user.id).eq("read", false);
    if (error) {
      toast.error("Impossible de marquer les notifications comme lues.");
      return;
    }
    setItems((current) => current.map((item) => ({ ...item, read: true })));
    setUnreadCount(0);
  };

  if (!user) return null;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative" aria-label="Notifications">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex min-h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold leading-none text-destructive-foreground">
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[min(380px,calc(100vw-2rem))] p-0">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <div>
            <p className="font-semibold">Notifications</p>
            <p className="text-xs text-muted-foreground">{unreadCount} non lue{unreadCount === 1 ? "" : "s"}</p>
          </div>
          {unreadCount > 0 && (
            <Button variant="ghost" size="sm" onClick={markAllRead}>
              <CheckCheck className="mr-1 h-4 w-4" /> Tout lire
            </Button>
          )}
        </div>

        <ScrollArea className="h-[min(420px,65vh)]">
          {items.length === 0 ? (
            <div className="px-4 py-10 text-center text-sm text-muted-foreground">
              <Bell className="mx-auto mb-2 h-8 w-8 opacity-40" />
              Aucune notification pour le moment.
            </div>
          ) : items.map((notification) => (
            <button
              key={notification.id}
              type="button"
              onClick={() => openNotification(notification)}
              className={cn(
                "flex w-full gap-3 border-b px-4 py-3 text-left transition hover:bg-muted/60",
                !notification.read && "bg-primary/5",
              )}
            >
              <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                {notification.type === "message" ? <MessageCircle className="h-4 w-4" /> : <Bell className="h-4 w-4" />}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-start gap-2">
                  <p className="flex-1 text-sm font-medium">{notification.title}</p>
                  {!notification.read && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary" />}
                </div>
                {notification.body && <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{notification.body}</p>}
                <p className="mt-1 text-[10px] text-muted-foreground">
                  {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true, locale: fr })}
                </p>
              </div>
            </button>
          ))}
        </ScrollArea>

        <div className="border-t p-2">
          <Button variant="ghost" size="sm" className="w-full" onClick={() => { setOpen(false); navigate("/notifications"); }}>
            <Settings className="mr-2 h-4 w-4" /> Paramètres des notifications
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
