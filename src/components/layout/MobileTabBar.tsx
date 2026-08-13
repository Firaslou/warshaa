import { NavLink, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Home, Search, Plus, Heart, User } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";

export function MobileTabBar() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user } = useAuth();

  const item = ({ isActive }: { isActive: boolean }) =>
    cn(
      "flex flex-col items-center gap-1.5 font-body text-[10px] font-bold uppercase tracking-tight transition-colors",
      isActive ? "text-clay-rose" : "text-clay-deep/50",
    );

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 flex items-end justify-between border-t border-clay-mist bg-clay-shell/90 px-7 pb-5 pt-3 backdrop-blur-xl md:hidden">
      <NavLink to="/" end className={item}>
        <Home className="h-5 w-5" />
        <span>{t("nav.home")}</span>
      </NavLink>
      <NavLink to="/products" className={item}>
        <Search className="h-5 w-5" />
        <span>{t("nav.products")}</span>
      </NavLink>

      <button
        type="button"
        aria-label={t("nav.discover")}
        onClick={() => navigate("/discover")}
        className="-mt-8 flex h-14 w-14 rotate-45 items-center justify-center rounded-[18px] bg-gradient-to-br from-clay-tan to-clay-rose shadow-[0_12px_28px_-10px_hsl(var(--clay-deep)/0.6)]"
      >
        <Plus className="h-6 w-6 -rotate-45 text-white" />
      </button>

      <NavLink to="/dashboard/favorites" className={item}>
        <Heart className="h-5 w-5" />
        <span>{t("nav.favorites")}</span>
      </NavLink>
      <NavLink to={user ? "/my-account" : "/login"} className={item}>
        <User className="h-5 w-5" />
        <span>{t("nav.myAccount")}</span>
      </NavLink>
    </nav>
  );
}
