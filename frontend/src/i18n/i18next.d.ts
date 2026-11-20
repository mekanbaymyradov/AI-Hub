import "i18next";
import { type en } from "./en";

// Checks every t("…") key against the English file.
declare module "i18next" {
  interface CustomTypeOptions {
    resources: { translation: typeof en };
  }
}
