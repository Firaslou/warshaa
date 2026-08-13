import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Bell, Video, Heart, MessageCircle, Camera, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";

type PrefKey = "lives" | "trending" | "messages" | "stories";

const ITEMS: { key: PrefKey; icon: any; title: string; desc: string; optional?: boolean }[] = [
  { key: "lives", icon: Video, title: "Lives des créateurs suivis", desc: "Sois averti quand un créateur que tu soutiens démarre un live." },
  { key: "trending", icon: Heart, title: "Nouveaux produits populaires", desc: "Les nouveautés qui reçoivent le plus de j'aime." },
  { key: "messages", icon: MessageCircle, title: "Messages", desc: "Nouveaux messages privés avec les créateurs." },
  { key: "stories", icon: Camera, title: "Stories", desc: "Nouvelles stories des créateurs que tu suis.", optional: true },
];

const STORAGE_KEY = "warsha.notif.prefs";

export default function Notifications() {
  const navigate = useNavigate();
  const [enabled, setEnabled] = useState(false);
  const [prefs, setPrefs] = useState<Record<PrefKey, boolean>>({
    lives: true, trending: true, messages: true, stories: false,
  });
  const [permission, setPermission] = useState<NotificationPermission>(
    typeof Notification !== "undefined" ? Notification.permission : "default",
  );

  useEffect(() => {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      try {
        const p = JSON.parse(raw);
        setEnabled(!!p.enabled);
        setPrefs({ ...prefs, ...p.prefs });
      } catch {}
    }
     
  }, []);

  const save = (next: { enabled?: boolean; prefs?: Record<PrefKey, boolean> }) => {
    const payload = {
      enabled: next.enabled ?? enabled,
      prefs: next.prefs ?? prefs,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  };

  const toggleEnabled = async (v: boolean) => {
    if (v && typeof Notification !== "undefined" && Notification.permission !== "granted") {
      const res = await Notification.requestPermission();
      setPermission(res);
      if (res !== "granted") {
        toast.error("Autorisation refusée par le navigateur.");
        return;
      }
    }
    setEnabled(v);
    save({ enabled: v });
    toast.success(v ? "Notifications activées" : "Notifications désactivées");
  };

  const togglePref = (key: PrefKey, v: boolean) => {
    const next = { ...prefs, [key]: v };
    setPrefs(next);
    save({ prefs: next });
  };

  const sendTest = () => {
    if (!enabled) { toast.error("Active d'abord les notifications."); return; }
    if (typeof Notification === "undefined" || Notification.permission !== "granted") {
      toast.error("Le navigateur n'a pas donné l'autorisation.");
      return;
    }
    new Notification("Warsha ✨", {
      body: "Ceci est une notification de test — tout fonctionne !",
      icon: "/icon-512.png",
      badge: "/icon-512.png",
    });
    toast.success("Notification de test envoyée");
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-primary/5 via-background to-background py-8">
      <div className="container max-w-xl">
        <Button variant="ghost" onClick={() => navigate(-1)} className="mb-4">
          <ArrowLeft className="mr-2 h-4 w-4" /> Retour
        </Button>

        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10">
            <Bell className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="font-serif text-2xl font-bold">Notifications</h1>
            <p className="text-sm text-muted-foreground">Choisis ce que tu veux recevoir.</p>
          </div>
        </div>

        <div className="rounded-2xl border bg-card p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-semibold">Activer les notifications</p>
              <p className="text-xs text-muted-foreground">
                {permission === "denied"
                  ? "Bloquées par le navigateur — modifie les permissions du site."
                  : "Autorisation requise dans le navigateur."}
              </p>
            </div>
            <Switch checked={enabled} onCheckedChange={toggleEnabled} disabled={permission === "denied"} />
          </div>
        </div>

        <div className="mt-4 space-y-3">
          {ITEMS.map(({ key, icon: Icon, title, desc, optional }) => (
            <div key={key} className="flex items-start justify-between gap-3 rounded-2xl border bg-card p-4">
              <div className="flex gap-3">
                <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10">
                  <Icon className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="font-medium">
                    {title}{" "}
                    {optional && <span className="ml-1 rounded-full bg-muted px-2 py-0.5 text-[10px] uppercase tracking-wide">Optionnel</span>}
                  </p>
                  <p className="text-xs text-muted-foreground">{desc}</p>
                </div>
              </div>
              <Switch
                checked={prefs[key]}
                onCheckedChange={(v) => togglePref(key, v)}
                disabled={!enabled}
              />
            </div>
          ))}
        </div>

        <Button
          onClick={sendTest}
          className="mt-6 w-full gradient-warm text-primary-foreground"
          size="lg"
        >
          <Send className="mr-2 h-4 w-4" /> Envoyer une notification de test
        </Button>

        <p className="mt-4 text-center text-xs text-muted-foreground">
          Sur iPhone, installe d'abord l'app depuis Safari (Partager → Ajouter à l'écran d'accueil) pour recevoir les notifications.
        </p>
      </div>
    </div>
  );
}
