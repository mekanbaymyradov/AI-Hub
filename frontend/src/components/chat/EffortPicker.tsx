import { Brain, Check, ChevronDown } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { type Effort } from "@/api/types";
import { cn } from "@/lib/utils";
import { MENU_CONTENT } from "./menu-styles";

// null sends no effort, which leaves the model on its own default.
const OPTIONS: { value: Effort | null; label: string; hint: string }[] = [
  { value: null, label: "Auto", hint: "Let the model decide" },
  { value: "low", label: "Low", hint: "Quick answers, little reasoning" },
  { value: "medium", label: "Medium", hint: "Balanced speed and reasoning" },
  { value: "high", label: "High", hint: "Deepest reasoning, slowest" },
];

interface EffortPickerProps {
  value: Effort | null;
  onChange: (value: Effort | null) => void;
  disabled?: boolean;
}

export function EffortPicker({ value, onChange, disabled }: EffortPickerProps) {
  const current = OPTIONS.find((option) => option.value === value) ?? OPTIONS[0];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={
        <Button
          type="button"
          variant="ghost"
          disabled={disabled}
          aria-label={`Reasoning effort: ${current.label}`}
          className={cn(
            "h-8 px-2.5 rounded-full text-xs font-normal flex items-center gap-1.5 cursor-pointer transition-colors hover:bg-zinc-100 dark:hover:bg-white/10",
            // Highlighted when set, so a non-default effort is never forgotten.
            value
              ? "text-blue-600 dark:text-blue-400"
              : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white"
          )}
        >
          <Brain className="h-3.5 w-3.5 shrink-0" />
          <span>{current.label}</span>
          <ChevronDown className="h-3 w-3 opacity-60 shrink-0" />
        </Button>
      } />
      <DropdownMenuContent
        side="top"
        align="start"
        sideOffset={8}
        className={cn(MENU_CONTENT, "w-60")}
      >
        <DropdownMenuGroup>
          <DropdownMenuLabel className="px-2.5 pt-1.5 pb-1 text-[11px] font-medium text-zinc-500 dark:text-zinc-400">
            Reasoning effort
          </DropdownMenuLabel>
          {OPTIONS.map((option) => {
            const isSelected = option.value === value;
            return (
              <DropdownMenuItem
                key={option.label}
                onClick={() => onChange(option.value)}
                className={cn(
                  "cursor-pointer flex items-center justify-between gap-3 px-2.5 py-1.5 rounded-lg transition-colors",
                  isSelected
                    ? "bg-blue-50 dark:bg-white/10"
                    : "hover:bg-zinc-100 dark:hover:bg-white/10 focus:bg-zinc-100 dark:focus:bg-white/10"
                )}
              >
                <span className="flex flex-col">
                  <span
                    className={cn(
                      "text-xs font-medium",
                      isSelected ? "text-blue-600 dark:text-white" : "text-zinc-800 dark:text-zinc-200"
                    )}
                  >
                    {option.label}
                  </span>
                  <span className="text-[11px] text-zinc-500 dark:text-zinc-400">{option.hint}</span>
                </span>
                {isSelected && <Check className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400 shrink-0" />}
              </DropdownMenuItem>
            );
          })}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
