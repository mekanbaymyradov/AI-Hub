import React, { memo } from "react";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { ThemeToggle } from "@/components/ThemeToggle";

interface ChatHeaderProps {
  chatTitle?: string;
}

export const ChatHeader = memo(function ChatHeader({ chatTitle }: ChatHeaderProps) {
  return (
    <header className="h-12 border-b border-zinc-200/80 dark:border-white/5 flex items-center justify-between px-4 z-10 shrink-0 bg-white/80 dark:bg-[#0a0a0a]/80 backdrop-blur-xs transition-colors duration-200">
      <div className="flex items-center gap-2">
        <SidebarTrigger className="h-8 w-8 text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white" />
        {chatTitle && (
          <span className="text-xs font-medium text-zinc-600 dark:text-zinc-400 truncate max-w-[200px] sm:max-w-[320px]">
            {chatTitle}
          </span>
        )}
      </div>
      <div className="flex items-center gap-2">
        <ThemeToggle size="icon-sm" className="h-8 w-8" />
      </div>
    </header>
  );
});
