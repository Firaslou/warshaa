import { useTranslation } from "react-i18next";
import { Globe } from "lucide-react";
import { SUPPORTED_LANGUAGES } from "@/i18n";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export function LanguageSwitcher() {
  const { i18n } = useTranslation();
  const { user } = useAuth();
  const current = SUPPORTED_LANGUAGES.find((l) => l.code === i18n.language) ?? SUPPORTED_LANGUAGES[0];

  const change = async (code: string) => {
    await i18n.changeLanguage(code);
    if (user) {
      await supabase.from("profiles").update({ preferred_language: code }).eq("id", user.id);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="h-9 w-9 gap-0 rounded-xl bg-clay-mist p-0 text-clay-deep xl:w-auto xl:gap-2 xl:bg-transparent xl:px-3 xl:text-foreground">
          <Globe className="h-4 w-4" />
          <span className="hidden xl:inline">{current.flag} {current.name}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="bg-popover">
        {SUPPORTED_LANGUAGES.map((lang) => (
          <DropdownMenuItem
            key={lang.code}
            onClick={() => change(lang.code)}
            className={i18n.language === lang.code ? "bg-accent" : ""}
          >
            <span className="mr-2">{lang.flag}</span>
            {lang.name}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
