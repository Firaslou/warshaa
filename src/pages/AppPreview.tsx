import { useNavigate } from "react-router-dom";
import {
  Bell, Home, Search, Heart, User, Plus, Sparkles, ShoppingBag,
  MessageCircle, Video, Zap, ArrowLeft, MapPin, BadgeCheck, Camera,
} from "lucide-react";
import { Button } from "@/components/ui/button";

export default function AppPreview() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gradient-to-b from-primary/5 via-background to-background py-8">
      <div className="container">
        <Button variant="ghost" onClick={() => navigate("/")} className="mb-4">
          <ArrowLeft className="mr-2 h-4 w-4" /> Retour au site
        </Button>

        <div className="mx-auto max-w-md">
          <div className="mb-6 text-center">
            <h1 className="font-serif text-3xl font-bold">Aperçu de l'application Warsha</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Voici à quoi ressemblera l'app mobile — pensée pour le téléphone, avec des fonctions
              en plus du site (notifications push, caméra intégrée, live en direct, mode hors-ligne).
            </p>
          </div>

          {/* Phone frame */}
          <div className="relative mx-auto w-[340px] rounded-[3rem] border-[10px] border-foreground bg-foreground p-2 shadow-2xl">
            <div className="absolute left-1/2 top-2 z-20 h-6 w-32 -translate-x-1/2 rounded-b-2xl bg-foreground" />
            <div className="relative overflow-hidden rounded-[2.3rem] bg-background">
              {/* Status bar */}
              <div className="flex items-center justify-between px-6 pt-3 pb-1 text-[10px] font-semibold">
                <span>9:41</span>
                <span>●●● 5G 100%</span>
              </div>

              {/* App header */}
              <div className="flex items-center justify-between px-4 py-3">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-6 w-6 text-primary" />
                  <span className="font-serif text-xl font-bold">Warsha</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <Bell className="h-5 w-5" />
                    <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[9px] font-bold text-primary-foreground">3</span>
                  </div>
                  <MessageCircle className="h-5 w-5" />
                </div>
              </div>

              {/* Stories row */}
              <div className="flex gap-3 overflow-hidden px-4 pb-3">
                {["M", "A", "S", "L"].map((l, i) => (
                  <div key={i} className="flex flex-col items-center gap-1">
                    <div className="rounded-full bg-gradient-to-tr from-primary via-warning to-destructive p-[2px]">
                      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-background text-lg font-bold">{l}</div>
                    </div>
                    <span className="text-[10px] text-muted-foreground">créateur</span>
                  </div>
                ))}
              </div>

              {/* Live badge */}
              <div className="mx-4 mb-3 flex items-center gap-2 rounded-2xl border border-destructive/30 bg-destructive/5 p-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-destructive">
                  <Video className="h-5 w-5 text-destructive-foreground" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="rounded-sm bg-destructive px-1.5 py-0.5 text-[9px] font-bold text-destructive-foreground">LIVE</span>
                    <span className="text-xs font-semibold">Missou vend en direct</span>
                  </div>
                  <p className="text-[10px] text-muted-foreground">142 personnes regardent</p>
                </div>
                <Button size="sm" className="h-7 text-xs">Voir</Button>
              </div>

              {/* Feed card */}
              <div className="mx-4 mb-3 overflow-hidden rounded-2xl border bg-card">
                <div className="flex items-center gap-2 p-3">
                  <div className="h-8 w-8 rounded-full bg-primary/20" />
                  <div className="flex-1">
                    <div className="flex items-center gap-1 text-xs font-semibold">
                      Amira <BadgeCheck className="h-3 w-3 text-primary" />
                    </div>
                    <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                      <MapPin className="h-2.5 w-2.5" /> Tunis
                    </div>
                  </div>
                </div>
                <div className="aspect-square bg-gradient-to-br from-primary/30 via-warning/30 to-destructive/30" />
                <div className="flex items-center gap-3 p-3">
                  <Heart className="h-5 w-5" />
                  <MessageCircle className="h-5 w-5" />
                  <ShoppingBag className="ml-auto h-5 w-5" />
                </div>
              </div>

              {/* Bonus feature banner */}
              <div className="mx-4 mb-20 flex items-center gap-2 rounded-xl bg-primary/10 p-3">
                <Zap className="h-4 w-4 text-primary" />
                <p className="text-[10px] leading-tight">
                  <strong>Bonus app :</strong> notifications quand tes créateurs favoris publient une story
                </p>
              </div>

              {/* Bottom nav */}
              <div className="absolute inset-x-0 bottom-0 flex items-center justify-around border-t bg-background/95 px-4 py-3 backdrop-blur">
                <Home className="h-5 w-5 text-primary" />
                <Search className="h-5 w-5 text-muted-foreground" />
                <div className="-mt-6 flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-tr from-primary to-warning shadow-lg">
                  <Plus className="h-5 w-5 text-primary-foreground" />
                </div>
                <Heart className="h-5 w-5 text-muted-foreground" />
                <User className="h-5 w-5 text-muted-foreground" />
              </div>
            </div>
          </div>

          {/* Bonus features list */}
          <div className="mt-8 space-y-3">
            <h2 className="font-serif text-xl font-bold">Ce que l'app aura en plus du site</h2>
            {[
              { icon: Bell, title: "Notifications push", desc: "Alerte quand un créateur publie, quand un live démarre, quand ta commande avance." },
              { icon: Camera, title: "Caméra intégrée", desc: "Publie une story ou une photo produit en un tap, sans passer par la galerie." },
              { icon: Video, title: "Lives natifs", desc: "Lance et regarde des lives directement dans l'app, avec meilleure qualité." },
              { icon: Zap, title: "Ouverture instantanée", desc: "L'icône reste sur ton écran d'accueil, l'app s'ouvre en une seconde sans navigateur." },
              { icon: MapPin, title: "Créateurs près de toi", desc: "Utilise ta position pour trouver les artisans autour de toi." },
            ].map((f) => (
              <div key={f.title} className="flex gap-3 rounded-xl border bg-card p-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                  <f.icon className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold">{f.title}</h3>
                  <p className="text-xs text-muted-foreground">{f.desc}</p>
                </div>
              </div>
            ))}
          </div>

          <p className="mt-6 text-center text-xs text-muted-foreground">
            Une fois le site publié, tu pourras installer cette app depuis ton téléphone
            via le bouton "Télécharger l'application" sur la page d'accueil.
          </p>
        </div>
      </div>
    </div>
  );
}