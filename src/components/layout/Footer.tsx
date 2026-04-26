import { useTranslation } from "react-i18next";
import { Sparkles } from "lucide-react";

export function Footer() {
  const { t } = useTranslation();
  return (
    <footer className="mt-24 border-t border-border/60 bg-secondary/40">
      <div className="container flex flex-col items-center justify-between gap-4 py-10 sm:flex-row">
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" />
          <span className="font-serif text-lg font-bold">{t("common.appName")}</span>
          <span className="text-sm text-muted-foreground">— {t("common.tagline")}</span>
        </div>
        <p className="text-sm text-muted-foreground">
          © {new Date().getFullYear()} {t("common.appName")}. {t("footer.rights")} {t("footer.made")}
        </p>
      </div>
    </footer>
  );
}