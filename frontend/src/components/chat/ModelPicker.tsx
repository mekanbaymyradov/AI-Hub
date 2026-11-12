import { Menu as MenuPrimitive } from "@base-ui/react/menu";
import { Brain, ChevronDown } from "lucide-react";

import { type Effort, type ModelPublic } from "@/api/types";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { ModelLogo } from "./model-logos";
import { modelOrigin } from "./model-origin";
import { MENU_CONTENT } from "./menu-styles";

// "auto" stands in for null, which sends no effort and leaves the model on its own default.
const EFFORTS: { value: Effort | "auto"; label: string; hint: string }[] = [
  { value: "auto", label: "Auto", hint: "The model decides how long to think" },
  { value: "low", label: "Low", hint: "Quick answers, little reasoning" },
  { value: "medium", label: "Medium", hint: "Balanced speed and reasoning" },
  { value: "high", label: "High", hint: "Thinks longest, for hard problems" },
];

const SECTION_LABEL = "px-2 pt-1 pb-1.5 text-[11px] font-medium text-fg-7";

interface ModelPickerProps {
  models: ModelPublic[];
  selected: ModelPublic | undefined;
  onSelect: (id: string) => void;
  effort: Effort | null;
  onEffortChange: (effort: Effort | null) => void;
  disabled?: boolean;
}

export function ModelPicker({ models, selected, onSelect, effort, onEffortChange, disabled }: ModelPickerProps) {
  const current = EFFORTS.find((option) => option.value === (effort ?? "auto")) ?? EFFORTS[0];
  const name = selected?.display_name ?? "Select model";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={
        <Button
          type="button"
          variant="ghost"
          disabled={disabled}
          aria-label={`Model: ${name}. Thinking: ${current.label}`}
          className="h-8 gap-1.5 rounded-full pl-2 pr-1.5 sm:pl-2.5 sm:pr-2 text-xs font-medium text-fg-5 hover:bg-fill-1 hover:text-fg-1 dark:hover:bg-fill-1 cursor-pointer transition-colors"
        >
          {selected && <ModelLogo model={selected} className="size-4" />}
          <span className="truncate max-w-24 min-[400px]:max-w-36 sm:max-w-44">{name}</span>
          {/* Shown only when set, so a non-default effort is never forgotten. */}
          {effort && (
            <span className="flex items-center gap-1 rounded-full bg-blue-500/10 px-1.5 py-0.5 text-[11px] text-blue-600 dark:text-blue-400">
              <Brain className="size-3" />
              <span className="hidden sm:inline">{current.label}</span>
            </span>
          )}
          <ChevronDown className="size-3 shrink-0 opacity-60" />
        </Button>
      } />

      <DropdownMenuContent side="top" align="end" sideOffset={8} className={cn(MENU_CONTENT, "w-72 p-1.5")}>
        <DropdownMenuGroup>
          <DropdownMenuLabel className={SECTION_LABEL}>Model</DropdownMenuLabel>
          <DropdownMenuRadioGroup value={selected?.id ?? null} onValueChange={(id: string) => onSelect(id)}>
            {models.map((model) => {
              const { makerName, host } = modelOrigin(model);
              const details = [makerName, host && `via ${host}`, !model.supports_files && "Text only"]
                .filter(Boolean)
                .join(" · ");
              return (
                <DropdownMenuRadioItem
                  key={model.id}
                  value={model.id}
                  closeOnClick
                  className="cursor-pointer gap-2.5 rounded-lg py-1.5 pl-1.5 pr-8 text-blue-600 transition-colors focus:bg-fill-1 data-checked:bg-blue-50 dark:text-blue-400 dark:data-checked:bg-white/10"
                >
                  <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-overlay ring-1 ring-line-1 dark:bg-fill-2">
                    <ModelLogo model={model} className="size-4" />
                  </span>
                  <span className="flex min-w-0 flex-col">
                    <span className="truncate text-xs font-medium text-fg-2">{model.display_name}</span>
                    <span className="truncate text-[11px] text-fg-7">{details}</span>
                  </span>
                </DropdownMenuRadioItem>
              );
            })}
          </DropdownMenuRadioGroup>
        </DropdownMenuGroup>

        <DropdownMenuSeparator className="mx-0 my-1.5 bg-line-1" />

        <DropdownMenuGroup>
          <DropdownMenuLabel className={cn(SECTION_LABEL, "flex items-center gap-1.5")}>
            <Brain className="size-3" />
            Thinking
          </DropdownMenuLabel>
          {/* Stays open on a change, so model and effort can be set in one visit. */}
          <DropdownMenuRadioGroup
            value={current.value}
            onValueChange={(value: Effort | "auto") => onEffortChange(value === "auto" ? null : value)}
            className="mx-1 grid grid-cols-4 gap-0.5 rounded-lg bg-fill-2 p-0.5"
          >
            {EFFORTS.map((option) => (
              <MenuPrimitive.RadioItem
                key={option.value}
                value={option.value}
                className="cursor-pointer rounded-md py-1 text-center text-[11px] font-medium text-fg-6 outline-none transition-colors data-highlighted:text-fg-1 data-checked:bg-overlay data-checked:text-fg-1 data-checked:shadow-xs data-checked:ring-1 data-checked:ring-line-1 dark:data-checked:bg-fill-1"
              >
                {option.label}
              </MenuPrimitive.RadioItem>
            ))}
          </DropdownMenuRadioGroup>
          <p className="px-2 pt-1.5 pb-1 text-[11px] text-fg-7">{current.hint}</p>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
