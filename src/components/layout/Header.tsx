import { Link, NavLink, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Menu, Sparkles, User as UserIcon, LogOut, Heart, LayoutDashboard, Shield, ShoppingBag, MessageCircle, MapPin } from "lucide-react";
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
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { cn } from "@/lib/utils";

export function Header() {
  const { t } = useTranslation();
  const { user, isAdmin, isCreator, signOut } = useAuth();
  const navigate = useNavigate();

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
      <NavLink to="/lives" className={navLinkClass}>{t("liveCalendar.nav")}</NavLink>
      <NavLink to="/image-search" className={navLinkClass}>Recherche image</NavLink>
      <NavLink to="/smart-search" className={navLinkClass}>Recherche IA</NavLink>
      <NavLink to="/apply" className={navLinkClass}>{t("nav.apply")}</NavLink>
    </>
  );

  return (
    <header className="sticky top-0 z-40 w-full border-b border-border/60 bg-background/80 backdrop-blur-xl">
      <div className="container flex h-16 items-center justify-between gap-4">
        <Link to="/" className="flex items-center gap-2">
          <Sparkles className="h-6 w-6 text-primary" />
          <span className="font-serif text-xl font-bold tracking-tight">{t("common.appName")}</span>
        </Link>

        <nav className="hidden items-center gap-7 md:flex">{links}</nav>

        <div className="flex items-center gap-2">
          <LanguageSwitcher />
          {user ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="gap-2">
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
                    <Sparkles className="mr-2 h-4 w-4" /> {t("dashboard.creator.title")}
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
              <Button variant="ghost" size="icon" className="md:hidden">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right">
              <nav className="mt-8 flex flex-col gap-4">{links}</nav>
              {!user && (
                <div className="mt-6 flex flex-col gap-2">
                  <Button variant="outline" onClick={() => navigate("/login")}>{t("nav.login")}</Button>
                  <Button className="gradient-warm text-primary-foreground" onClick={() => navigate("/signup")}>
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