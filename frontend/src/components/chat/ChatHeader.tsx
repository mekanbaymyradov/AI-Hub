import { memo } from "react";
import { SquarePen } from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";

interface ChatHeaderProps {
  chatTitle?: string;
  onNewThread?: () => void;
}

export const ChatHeader = memo(function ChatHeader({ chatTitle, onNewThread }: ChatHeaderProps) {
  return (
    <header className="h-12 border-b border-zinc-200/80 dark:border-white/5 flex items-center justify-between px-3 sm:px-4 z-10 shrink-0 bg-white/80 dark:bg-[#0a0a0a]/80 backdrop-blur-xs transition-colors duration-200">
      <div className="flex items-center gap-2 min-w-0">
        <SidebarTrigger className="md:hidden h-8 w-8 rounded-lg text-zinc-600 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-white/10 shrink-0 cursor-pointer" />
        {chatTitle ? (
          <span className="text-xs font-medium text-zinc-600 dark:text-zinc-400 truncate sm:max-w-[320px]">
            {chatTitle}
          </span>
        ) : (
          <span className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 md:hidden">
            AI-Hub
          </span>
        )}
      </div>
      <div className="flex items-center gap-1.5 sm:gap-2">
        {onNewThread && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={onNewThread}
            aria-label="New thread"
            title="New thread"
            className="md:hidden h-8 w-8 rounded-lg text-zinc-600 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-white/10 cursor-pointer"
          >
            <SquarePen className="h-4 w-4" />
          </Button>
        )}
        <ThemeToggle />
      </div>
    </header>
  );
});
