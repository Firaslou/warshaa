import { useNavigate } from "react-router-dom";
import {
  Bell, Home, Search, Heart, User, Plus, Sparkles, ShoppingBag,
  MessageCircle, Video, Zap, ArrowLeft, MapPin, BadgeCheck, Camera,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { BrandLogo } from "@/components/BrandLogo";

export default function AppPreview() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gradient-to-b from-primary/5 via-background to-background py-8">
      <div className="container">
        <Button variant="ghost" onClick={() => navigate("/")} className="mb-4">
          <ArrowLeft className="mr-2 h-4 w-4" /> Retour au site
        </Button>
        <div className="mb-4 flex justify-center">
          <Button variant="outline" onClick={() => navigate("/notifications")}>
            <Bell className="mr-2 h-4 w-4" /> Gérer les notifications
          </Button>
        </div>

        <div className="mx-auto max-w-md">
          <div className="mb-6 text-center">
            <h1 className="font-serif text-3xl font-bold">Aperçu de l'application Warsha</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Voici à quoi ressemblera l'app mobile — pensée pour le téléphone, avec des fonctions
              en plus du site (notifications push, caméra intégrée, live en direct, mode hors-ligne).
            </p>
          </div>

          {/* Phone frame — direction "Argile éditoriale" */}
          <div className="relative mx-auto flex h-[760px] w-[352px] flex-col overflow-hidden rounded-[48px] border-[12px] border-[hsl(26_25%_14%)] bg-clay-shell shadow-[0_32px_64px_-16px_hsl(var(--clay-deep)/0.35)]">
            {/* Status bar */}
            <div className="flex h-11 shrink-0 items-center justify-between px-7">
              <span className="font-body text-xs font-bold text-clay-deep">9:41</span>
              <div className="flex items-center gap-1.5">
                <div className="h-2 w-4 rounded-full bg-clay-deep/20" />
                <div className="h-2 w-2 rounded-full bg-clay-deep/20" />
              </div>
            </div>

            {/* Header */}
            <header className="flex items-center justify-between px-6 py-2">
              <BrandLogo markClassName="h-10" nameClassName="font-display text-xl text-clay-deep" />
              <div className="flex gap-3">
                <div className="relative flex h-10 w-10 items-center justify-center rounded-2xl bg-clay-mist text-clay-deep">
                  <Bell className="h-5 w-5" />
                  <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-clay-rose font-body text-[9px] font-bold text-white">3</span>
                </div>
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-clay-mist text-clay-deep">
                  <MessageCircle className="h-5 w-5" />
                </div>
              </div>
            </header>

            <main className="flex-1 overflow-y-auto pb-28">
              {/* Stories */}
              <div className="mt-6 flex gap-4 overflow-x-auto px-6">
                {[
                  { label: "En live", active: true, letter: "M" },
                  { label: "Textile", active: false, letter: "A" },
                  { label: "Cuivre", active: false, letter: "S" },
                  { label: "Poterie", active: false, letter: "L" },
                ].map((s) => (
                  <div key={s.label} className="flex shrink-0 flex-col items-center gap-2">
                    <div
                      className={
                        s.active
                          ? "rotate-3 rounded-[24px] bg-gradient-to-br from-clay-tan to-clay-rose p-1"
                          : "rounded-[24px] border border-clay-tan/30 p-1"
                      }
                    >
                      <div
                        className={`flex h-14 w-14 items-center justify-center rounded-[20px] font-display text-lg font-bold text-clay-deep ${s.active ? "-rotate-3 border-2 border-white bg-clay-mist" : "bg-clay-mist/60"}`}
                      >
                        {s.letter}
                      </div>
                    </div>
                    <span className={`font-body text-[10px] font-bold uppercase tracking-tighter ${s.active ? "text-clay-rose" : "text-clay-deep/50"}`}>
                      {s.label}
                    </span>
                  </div>
                ))}
              </div>

              {/* Live banner */}
              <section className="mt-8 px-6">
                <div className="relative h-48 overflow-hidden rounded-[36px] bg-gradient-to-br from-clay-tan via-clay-sand to-clay-deep shadow-xl">
                  <div className="absolute inset-0 bg-gradient-to-t from-clay-deep via-clay-deep/20 to-transparent" />
                  <div className="absolute left-4 top-4 flex items-center gap-2 rounded-full bg-clay-rose px-3 py-1">
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" />
                    <span className="font-display text-[10px] font-bold uppercase tracking-widest text-white">En direct</span>
                  </div>
                  <div className="absolute inset-x-5 bottom-5 flex items-end justify-between gap-3">
                    <div>
                      <h3 className="font-display text-xl font-bold leading-tight text-white">Missou vend en direct</h3>
                      <p className="mt-1 font-body text-xs text-white/80">142 personnes regardent</p>
                    </div>
                    <Button size="sm" className="h-8 shrink-0 rounded-2xl bg-white font-display text-xs font-bold text-clay-deep hover:bg-white/90">
                      <Video className="mr-1 h-3.5 w-3.5" /> Voir
                    </Button>
                  </div>
                </div>
              </section>

              {/* Feed card */}
              <section className="mt-8 px-6">
                <div className="overflow-hidden rounded-[40px] border border-clay-mist bg-white">
                  <div className="flex items-center gap-3 p-5">
                    <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-clay-mist font-display font-bold text-clay-deep">A</div>
                    <div className="flex-1">
                      <h4 className="flex items-center gap-1 font-display text-sm font-bold text-clay-deep">
                        Amira <BadgeCheck className="h-3.5 w-3.5 text-clay-rose" />
                      </h4>
                      <p className="flex items-center gap-1 font-body text-[10px] font-medium uppercase tracking-wider text-clay-deep/50">
                        <MapPin className="h-2.5 w-2.5" /> Tunis · Céramique
                      </p>
                    </div>
                    <button className="text-clay-sand" aria-label="Options">
                      <span className="text-lg leading-none">···</span>
                    </button>
                  </div>
                  <div className="px-4">
                    <div className="relative aspect-[4/5] overflow-hidden rounded-[32px] bg-gradient-to-br from-clay-mist via-clay-tan to-clay-rose">
                      <div className="absolute inset-x-4 bottom-4 flex items-center justify-between rounded-[24px] bg-white/30 p-4 backdrop-blur-md">
                        <div>
                          <span className="block font-display text-[10px] uppercase tracking-widest text-white/80">Prix</span>
                          <span className="font-display text-lg font-bold text-white">140 DT</span>
                        </div>
                        <button className="rounded-xl bg-white p-2.5 text-clay-deep" aria-label="Ajouter au panier">
                          <ShoppingBag className="h-5 w-5" />
                        </button>
                      </div>
                    </div>
                  </div>
                  <div className="p-6">
                    <h5 className="font-display text-lg font-bold leading-tight text-clay-deep">Jarre gravée à la main</h5>
                    <p className="mt-2 font-body text-sm leading-relaxed text-clay-deep/70">
                      Pièce signature, émaillée selon la tradition de Nabeul.
                    </p>
                    <div className="mt-4 flex items-center gap-5 text-clay-deep/50">
                      <span className="flex items-center gap-1.5 font-body text-xs font-bold">
                        <Heart className="h-5 w-5 text-clay-rose" /> 284
                      </span>
                      <span className="flex items-center gap-1.5 font-body text-xs font-bold">
                        <MessageCircle className="h-5 w-5" /> 42
                      </span>
                    </div>
                  </div>
                </div>
              </section>

              {/* Bonus banner */}
              <section className="mb-8 mt-6 px-6">
                <div className="relative overflow-hidden rounded-[36px] bg-clay-deep p-8">
                  <div className="absolute -mr-16 -mt-16 right-0 top-0 h-32 w-32 rounded-full bg-clay-sand opacity-20" />
                  <span className="font-display text-[10px] font-bold uppercase tracking-[0.2em] text-clay-tan">Bonus app</span>
                  <h3 className="mt-2 font-display text-xl font-bold leading-tight text-white">
                    Notifications dès qu'un<br />créateur favori publie
                  </h3>
                  <Button
                    size="sm"
                    className="mt-6 rounded-2xl bg-clay-tan font-display text-xs font-bold text-white hover:bg-clay-tan/90"
                    onClick={() => navigate("/notifications")}
                  >
                    <Zap className="mr-1 h-3.5 w-3.5" /> Activer
                  </Button>
                </div>
              </section>
            </main>

            {/* Bottom navigation */}
            <nav className="absolute inset-x-0 bottom-0 flex items-end justify-between border-t border-clay-mist bg-clay-shell/90 px-8 pb-8 pt-4 backdrop-blur-xl">
              <div className="flex flex-col items-center gap-1.5 text-clay-sand">
                <Home className="h-6 w-6" />
                <span className="h-1 w-1 rounded-full bg-clay-sand" />
              </div>
              <Search className="h-6 w-6 text-clay-deep/40" />
              <div className="-mb-4 flex h-14 w-14 rotate-45 items-center justify-center rounded-[22px] bg-clay-deep text-white shadow-xl">
                <Plus className="h-7 w-7 -rotate-45" />
              </div>
              <Heart className="h-6 w-6 text-clay-deep/40" />
              <User className="h-6 w-6 text-clay-deep/40" />
            </nav>

            {/* Home bar */}
            <div className="absolute inset-x-0 bottom-1 flex justify-center py-2">
              <div className="h-1.5 w-32 rounded-full bg-clay-deep/10" />
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
