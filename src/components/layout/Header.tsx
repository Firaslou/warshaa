import { useEffect, useState } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Menu, Hammer, User as UserIcon, LogOut, Heart, LayoutDashboard, Shield, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sheet,
  SheetContent,
  SheetTrigger,
} from "@/components/ui/sheet";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { NotificationBell } from "@/components/NotificationBell";
import { BrandLogo } from "@/components/BrandLogo";
import { cn } from "@/lib/utils";

export function Header() {
  const { t } = useTranslation();
  const { user, isAdmin, isCreator, signOut } = useAuth();
  const navigate = useNavigate();
  const [hasActiveLive, setHasActiveLive] = useState(false);

  useEffect(() => {
    const checkLives = async () => {
      const { count } = await supabase
        .from("live_events")
        .select("id", { count: "exact", head: true })
        .eq("status", "live");
      setHasActiveLive((count ?? 0) > 0);
    };
    void checkLives();
    const channel = supabase
      .channel("header-live-indicator")
      .on("postgres_changes", { event: "*", schema: "public", table: "live_events" }, checkLives)
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const navLinkClass = ({ isActive }: { isActive: boolean }) =>
    cn(
      "text-sm font-medium transition-colors hover:text-primary",
      isActive ? "text-primary" : "text-foreground/70",
    );

  const links = (
    <>
      <NavLink to="/" className={navLinkClass} end>{t("nav.home")}</NavLink>
      <NavLink to="/creators" className={navLinkClass}>{t("nav.creators")}</NavLink>
      <NavLink to="/products" className={navLinkClass}>{t("nav.products")}</NavLink>
      <NavLink to="/discover" className={navLinkClass}>{t("nav.discover")}</NavLink>
      <NavLink to="/map" className={navLinkClass}>{t("nav.map")}</NavLink>
      <NavLink to="/lives" className={navLinkClass}>
        <span className="relative inline-flex items-center gap-1.5">
          {t("liveCalendar.nav")}
          {hasActiveLive && (
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500" />
            </span>
          )}
        </span>
      </NavLink>
      <NavLink to="/image-search" className={navLinkClass}>Recherche image</NavLink>
      <NavLink to="/apply" className={navLinkClass}>{t("nav.apply")}</NavLink>
    </>
  );

  return (
    <header className="sticky top-0 z-40 w-full border-b border-clay-mist bg-clay-shell/90 shadow-[0_8px_30px_-24px_hsl(var(--clay-deep)/0.5)] backdrop-blur-xl md:border-border/60 md:bg-background/85">
      <div className="container flex h-16 items-center justify-between gap-4 md:h-16">
        <Link to="/" aria-label={t("common.appName")} className="group flex items-center">
          <BrandLogo
            markClassName="h-11 transition-transform duration-300 group-hover:-rotate-2 group-hover:scale-105"
            nameClassName="font-display text-[1.35rem] text-clay-deep md:text-foreground"
          />
        </Link>

        <nav className="hidden items-center gap-7 md:flex">{links}</nav>

        <div className="flex items-center gap-2">
          <span className="flex items-center gap-2 [&_button]:rounded-2xl [&_button]:bg-clay-mist [&_button]:text-clay-deep md:[&_button]:rounded-md md:[&_button]:bg-transparent md:[&_button]:text-foreground">
            <LanguageSwitcher />
            <NotificationBell />
          </span>
          {user ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="gap-2 rounded-2xl bg-clay-mist text-clay-deep md:bg-transparent md:text-foreground">
                  <UserIcon className="h-4 w-4" />
                  <span className="hidden sm:inline">{user.email?.split("@")[0]}</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="bg-popover w-56">
                <DropdownMenuItem onClick={() => navigate("/my-account")}>
                  <UserIcon className="mr-2 h-4 w-4" /> {t("nav.myAccount")}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate("/messages")}>
                  <MessageCircle className="mr-2 h-4 w-4" /> {t("header.messages")}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate("/dashboard")}>
                  <LayoutDashboard className="mr-2 h-4 w-4" /> {t("nav.dashboard")}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate("/dashboard/favorites")}>
                  <Heart className="mr-2 h-4 w-4" /> {t("nav.favorites")}
                </DropdownMenuItem>
                {isCreator && (
                  <DropdownMenuItem onClick={() => navigate("/creator")}>
                    <Hammer className="mr-2 h-4 w-4" /> {t("dashboard.creator.title")}
                  </DropdownMenuItem>
                )}
                {isAdmin && (
                  <DropdownMenuItem onClick={() => navigate("/admin")}>
                    <Shield className="mr-2 h-4 w-4" /> {t("nav.admin")}
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={async () => { await signOut(); navigate("/"); }}>
                  <LogOut className="mr-2 h-4 w-4" /> {t("nav.logout")}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <div className="hidden gap-2 md:flex">
              <Button variant="ghost" size="sm" onClick={() => navigate("/login")}>
                {t("nav.login")}
              </Button>
              <Button size="sm" className="gradient-warm text-primary-foreground" onClick={() => navigate("/signup")}>
                {t("nav.signup")}
              </Button>
            </div>
          )}

          <Sheet>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="rounded-2xl bg-clay-mist text-clay-deep md:hidden">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="border-clay-mist bg-clay-shell">
              <nav className="mt-8 flex flex-col gap-4 font-display text-clay-deep [&_a]:text-base [&_a]:font-bold">{links}</nav>
              {!user && (
                <div className="mt-6 flex flex-col gap-2">
                  <Button variant="outline" className="rounded-2xl border-clay-tan/50 font-display text-clay-deep" onClick={() => navigate("/login")}>{t("nav.login")}</Button>
                  <Button className="rounded-2xl bg-gradient-to-br from-clay-tan to-clay-rose font-display text-white" onClick={() => navigate("/signup")}>
                    {t("nav.signup")}
                  </Button>
                </div>
              )}
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}
