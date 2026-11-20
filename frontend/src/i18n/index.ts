import i18n from "i18next";
import LanguageDetector from "i18next-browser-languagedetector";
import { initReactI18next } from "react-i18next";

import { en } from "./en";
import { ru } from "./ru";
import { tk } from "./tk";

// Each name in its own language, so people find theirs whatever is showing.
export const LANGUAGES = [
  { code: "en", name: "English" },
  { code: "ru", name: "Русский" },
  { code: "tk", name: "Türkmençe" },
] as const;

export type Language = (typeof LANGUAGES)[number]["code"];

void i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: { en: { translation: en }, ru: { translation: ru }, tk: { translation: tk } },
    supportedLngs: LANGUAGES.map((language) => language.code),
    // A browser set to "ru-RU" gets Russian.
    nonExplicitSupportedLngs: true,
    fallbackLng: "en",
    // Bundled, so the first render already has the text.
    initAsync: false,
    // React escapes what it renders.
    interpolation: { escapeValue: false },
    detection: {
      order: ["localStorage", "navigator"],
      lookupLocalStorage: "ai_hub_language",
      caches: ["localStorage"],
    },
  });

// Screen readers pick their voice, and browsers their spell checker, from this.
// Skipped without a page, as in unit tests.
const setPageLanguage = (language: string) => {
  if (typeof document !== "undefined") document.documentElement.lang = language;
};
setPageLanguage(i18n.resolvedLanguage ?? "en");
i18n.on("languageChanged", () => setPageLanguage(i18n.resolvedLanguage ?? "en"));

export default i18n;
