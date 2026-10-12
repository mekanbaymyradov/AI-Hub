import { Check, ChevronDown } from "lucide-react";

import { type ModelPublic } from "@/api/types";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { MENU_CONTENT, MENU_ITEM, MENU_ITEM_SELECTED } from "./menu-styles";

interface ModelPickerProps {
  models: ModelPublic[];
  selected: ModelPublic | undefined;
  onSelect: (id: string) => void;
  disabled?: boolean;
}

export function ModelPicker({ models, selected, onSelect, disabled }: ModelPickerProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={
        <Button
          type="button"
          variant="ghost"
          disabled={disabled}
          className="h-8 px-2.5 rounded-full text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-white/10 text-xs font-normal flex items-center gap-1 cursor-pointer transition-colors"
        >
          <span className="truncate max-w-[140px]">{selected?.display_name ?? "Select Model"}</span>
          <ChevronDown className="h-3 w-3 opacity-60 shrink-0" />
        </Button>
      } />
      <DropdownMenuContent side="top" align="end" sideOffset={8} className={cn(MENU_CONTENT, "w-48")}>
        {models.map((model) => {
          const isSelected = model.id === selected?.id;
          return (
            <DropdownMenuItem
              key={model.id}
              onClick={() => onSelect(model.id)}
              className={cn(isSelected ? MENU_ITEM_SELECTED : MENU_ITEM, "justify-between")}
            >
              <span className="truncate">{model.display_name}</span>
              {isSelected && <Check className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400 shrink-0" />}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
