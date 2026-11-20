import { Check, Globe } from "lucide-react";
import { useTranslation } from "react-i18next";

import { LANGUAGES } from "@/i18n";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MENU_CONTENT, MENU_ITEM, MENU_ITEM_SELECTED } from "@/components/chat/menu-styles";

// Each name is in its own language and marked so, so a screen reader says "Русский" in Russian.

/** Three side-by-side buttons, for settings. The choice applies at once and is kept in this browser. */
export function LanguageSwitch({ className }: { className?: string }) {
  const { t, i18n } = useTranslation();

  return (
    <div role="group" aria-label={t("common.language")} className={cn("grid grid-cols-3 gap-1 rounded-xl bg-fill-2 p-1", className)}>
      {LANGUAGES.map(({ code, name }) => {
        const selected = i18n.resolvedLanguage === code;
        return (
          <button
            key={code}
            type="button"
            lang={code}
            aria-pressed={selected}
            onClick={() => void i18n.changeLanguage(code)}
            className={cn(
              "h-8 cursor-pointer rounded-lg text-xs font-medium transition-colors pointer-coarse:h-10",
              selected
                ? "bg-overlay text-fg-1 shadow-xs ring-1 ring-line-1 dark:bg-fill-1"
                : "text-fg-6 hover:text-fg-1"
            )}
          >
            {name}
          </button>
        );
      })}
    </div>
  );
}

/** A globe button with a menu, for the landing page's navbar. */
export function LanguageMenu({ className }: { className?: string }) {
  const { t, i18n } = useTranslation();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={
        <Button
          type="button"
          variant="ghost"
          size="sm"
          aria-label={t("common.language")}
          className={cn(
            "h-9 cursor-pointer gap-1.5 rounded-xl px-2.5 text-xs font-medium uppercase text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800/80 dark:hover:text-zinc-100",
            className
          )}
        >
          <Globe className="h-4 w-4" />
          {i18n.resolvedLanguage}
        </Button>
      } />
      <DropdownMenuContent side="bottom" align="end" sideOffset={6} className={cn(MENU_CONTENT, "w-40")}>
        {LANGUAGES.map(({ code, name }) => {
          const selected = i18n.resolvedLanguage === code;
          return (
            <DropdownMenuItem
              key={code}
              lang={code}
              onClick={() => void i18n.changeLanguage(code)}
              className={cn(selected ? MENU_ITEM_SELECTED : MENU_ITEM, "justify-between")}
            >
              {name}
              {selected && <Check className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
