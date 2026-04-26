import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";

import fr from "./locales/fr.json";
import en from "./locales/en.json";
import ar from "./locales/ar.json";

// Languages with full translations
const fullLocales = { fr, en, ar };

// Placeholder languages — fall back to FR but the selector still shows them.
// Translations can be progressively added later in src/i18n/locales/{code}.json.
const placeholderLocales = ["es", "it", "de", "ru", "zh"];

export const SUPPORTED_LANGUAGES = [
  { code: "fr", name: "Français", flag: "🇫🇷" },
  { code: "en", name: "English", flag: "🇬🇧" },
  { code: "ar", name: "العربية", flag: "🇹🇳", rtl: true },
  { code: "es", name: "Español", flag: "🇪🇸" },
  { code: "it", name: "Italiano", flag: "🇮🇹" },
  { code: "de", name: "Deutsch", flag: "🇩🇪" },
  { code: "ru", name: "Русский", flag: "🇷🇺" },
  { code: "zh", name: "中文", flag: "🇨🇳" },
] as const;

const resources: Record<string, { translation: typeof fr }> = {
  fr: { translation: fr },
  en: { translation: en },
  ar: { translation: ar },
};

// Placeholders inherit the FR bundle until proper translations are added
placeholderLocales.forEach((code) => {
  resources[code] = { translation: fr };
});

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: "fr",
    supportedLngs: SUPPORTED_LANGUAGES.map((l) => l.code),
    interpolation: { escapeValue: false },
    detection: {
      order: ["localStorage", "navigator"],
      caches: ["localStorage"],
      lookupLocalStorage: "sanaa-lang",
    },
  });

// Apply RTL direction when needed
const applyDirection = (lng: string) => {
  const lang = SUPPORTED_LANGUAGES.find((l) => l.code === lng);
  const dir = lang && "rtl" in lang && lang.rtl ? "rtl" : "ltr";
  document.documentElement.setAttribute("dir", dir);
  document.documentElement.setAttribute("lang", lng);
};

applyDirection(i18n.language);
i18n.on("languageChanged", applyDirection);

export default i18n;