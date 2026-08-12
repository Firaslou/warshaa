import { useTranslation } from "react-i18next";
import { BrandLogo } from "@/components/BrandLogo";

export function Footer() {
  const { t } = useTranslation();
  return (
    <footer className="relative z-[1] mt-24 border-t border-border/60 bg-secondary/55 backdrop-blur-sm">
      <div className="container flex flex-col items-center justify-between gap-4 py-10 sm:flex-row">
        <div className="flex flex-col items-center gap-1 sm:items-start">
          <BrandLogo markClassName="h-12" nameClassName="text-lg" />
          <span className="text-sm text-muted-foreground">{t("common.tagline")}</span>
        </div>
        <p className="text-sm text-muted-foreground">
          © {new Date().getFullYear()} {t("common.appName")}. {t("footer.rights")} {t("footer.made")}
        </p>
      </div>
    </footer>
  );
}
