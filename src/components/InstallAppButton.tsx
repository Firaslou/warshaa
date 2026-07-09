import { useEffect, useState } from "react";
import { Download, Smartphone, Share, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";

type BIPEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

function isIos() {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  return /iPhone|iPad|iPod/i.test(ua) || (/Macintosh/i.test(ua) && "ontouchend" in document);
}

function isStandalone() {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia?.("(display-mode: standalone)").matches ||
    // @ts-expect-error iOS Safari
    window.navigator.standalone === true
  );
}

export function InstallAppButton() {
  const [deferred, setDeferred] = useState<BIPEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [showIos, setShowIos] = useState(false);

  useEffect(() => {
    if (isStandalone()) setInstalled(true);
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BIPEvent);
    };
    const onInstalled = () => {
      setInstalled(true);
      setDeferred(null);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (installed) return null;

  const onClick = async () => {
    if (deferred) {
      await deferred.prompt();
      await deferred.userChoice;
      setDeferred(null);
      return;
    }
    // iOS Safari or unsupported browser → show instructions
    setShowIos(true);
  };

  return (
    <>
      <section className="container py-10">
        <div className="relative overflow-hidden rounded-3xl border border-primary/20 bg-card p-8 shadow-elegant md:p-10">
          <div className="absolute inset-0 gradient-soft opacity-40" aria-hidden />
          <div className="relative flex flex-col items-center gap-6 md:flex-row md:justify-between">
            <div className="flex items-center gap-5">
              <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl gradient-warm shadow-elegant">
                <Smartphone className="h-8 w-8 text-primary-foreground" />
              </div>
              <div>
                <h3 className="font-serif text-2xl font-bold md:text-3xl">Télécharger l'application</h3>
                <p className="mt-1 max-w-xl text-sm text-muted-foreground md:text-base">
                  Installez Warsha sur votre téléphone — accès instantané, notifications et fonctions bonus réservées à l'app.
                </p>
              </div>
            </div>
            <Button
              size="lg"
              onClick={onClick}
              className="gradient-warm text-primary-foreground shadow-elegant"
            >
              <Download className="mr-2 h-5 w-5" />
              Télécharger l'application
            </Button>
            <Button
              size="lg"
              variant="outline"
              onClick={() => (window.location.href = "/app-preview")}
            >
              Voir un aperçu
            </Button>
          </div>
        </div>
      </section>

      <Dialog open={showIos} onOpenChange={setShowIos}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Installer Warsha sur votre appareil</DialogTitle>
            <DialogDescription>
              {isIos()
                ? "Sur iPhone / iPad, suivez ces 2 étapes dans Safari :"
                : "Depuis le menu de votre navigateur, choisissez « Ajouter à l'écran d'accueil » ou « Installer l'application »."}
            </DialogDescription>
          </DialogHeader>
          {isIos() && (
            <ol className="mt-2 space-y-3 text-sm">
              <li className="flex items-start gap-3">
                <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <Share className="h-4 w-4" />
                </span>
                <span>Touchez l'icône <strong>Partager</strong> en bas de Safari.</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <Plus className="h-4 w-4" />
                </span>
                <span>Sélectionnez <strong>« Sur l'écran d'accueil »</strong> puis <strong>Ajouter</strong>.</span>
              </li>
            </ol>
          )}
          <Button variant="outline" onClick={() => setShowIos(false)} className="mt-2">
            <X className="mr-2 h-4 w-4" /> Fermer
          </Button>
        </DialogContent>
      </Dialog>
    </>
  );
}