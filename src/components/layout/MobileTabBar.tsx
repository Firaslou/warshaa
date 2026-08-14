import { NavLink } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Home, Search, Compass, Heart, User } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";

export function MobileTabBar() {
  const { t } = useTranslation();
  const { user } = useAuth();

  const item = ({ isActive }: { isActive: boolean }) =>
    cn(
      "flex min-h-11 min-w-0 flex-col items-center justify-center gap-1 rounded-xl px-0.5 font-body text-[9px] font-semibold leading-none transition-colors active:bg-clay-mist/70",
      isActive ? "text-clay-rose" : "text-clay-deep/50",
    );

  return (
    <nav aria-label="Navigation principale" className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 items-center border-t border-clay-mist bg-clay-shell/95 px-1.5 pb-[calc(0.5rem+env(safe-area-inset-bottom))] pt-1.5 shadow-[0_-8px_30px_-24px_hsl(var(--clay-deep)/0.5)] backdrop-blur-xl md:hidden">
      <NavLink to="/" end className={item}>
        <Home className="h-5 w-5" />
        <span className="max-w-full truncate">Accueil</span>
      </NavLink>
      <NavLink to="/products" className={item}>
        <Search className="h-5 w-5" />
        <span className="max-w-full truncate">{t("nav.products")}</span>
      </NavLink>

      <NavLink
        to="/discover"
        aria-label={t("nav.discover")}
        className={({ isActive }) => cn(
          "-mt-3 flex min-w-0 flex-col items-center gap-1 text-[9px] font-semibold leading-none",
          isActive ? "text-clay-rose" : "text-clay-deep/60",
        )}
      >
        <span className="flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br from-clay-tan to-clay-rose text-white shadow-[0_10px_24px_-10px_hsl(var(--clay-deep)/0.65)] transition-transform active:scale-95">
          <Compass className="h-5 w-5" />
        </span>
        <span className="max-w-full truncate">Découvrir</span>
      </NavLink>

      <NavLink to="/dashboard/favorites" className={item}>
        <Heart className="h-5 w-5" />
        <span className="max-w-full truncate">Favoris</span>
      </NavLink>
      <NavLink to={user ? "/my-account" : "/login"} className={item}>
        <User className="h-5 w-5" />
        <span className="max-w-full truncate">Compte</span>
      </NavLink>
    </nav>
  );
}
