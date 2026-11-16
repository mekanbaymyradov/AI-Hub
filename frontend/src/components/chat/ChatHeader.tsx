import { memo } from "react";
import { useMutation } from "@tanstack/react-query";
import { CircleAlert, Download, Loader2, SquarePen } from "lucide-react";
import { useModels } from "@/api/queries";
import { downloadChatAsMarkdown } from "@/lib/export-chat";
import { ThemeToggle } from "@/components/ThemeToggle";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";

interface ChatHeaderProps {
  chatId?: number | null;
  chatTitle?: string;
  onNewThread?: () => void;
}

const ICON_BUTTON =
  "h-8 w-8 rounded-lg text-fg-5 hover:text-fg-1 hover:bg-fill-1 dark:hover:bg-fill-1 cursor-pointer";

export const ChatHeader = memo(function ChatHeader({ chatId, chatTitle, onNewThread }: ChatHeaderProps) {
  return (
    <header className="h-12 border-b border-zinc-200/80 dark:border-white/5 flex items-center justify-between px-3 sm:px-4 z-10 shrink-0 bg-chrome/80 backdrop-blur-xs transition-colors duration-200">
      <div className="flex items-center gap-2 min-w-0">
        <SidebarTrigger className="md:hidden h-8 w-8 rounded-lg text-fg-5 hover:text-fg-1 hover:bg-fill-1 shrink-0 cursor-pointer" />
        {chatTitle ? (
          <span className="text-xs font-medium text-fg-6 truncate sm:max-w-[320px]">
            {chatTitle}
          </span>
        ) : (
          <span className="text-xs font-semibold text-fg-4 md:hidden">
            AI-Hub
          </span>
        )}
      </div>
      <div className="flex items-center gap-1.5 sm:gap-2">
        {chatId != null && chatTitle && (
          // Keyed so a failed export doesn't stay flagged after switching chats.
          <ExportChatButton key={chatId} chatId={chatId} chatTitle={chatTitle} />
        )}
        {onNewThread && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={onNewThread}
            aria-label="New thread"
            title="New thread"
            className={`md:hidden ${ICON_BUTTON}`}
          >
            <SquarePen className="h-4 w-4" />
          </Button>
        )}
        <ThemeToggle />
      </div>
    </header>
  );
});

function ExportChatButton({ chatId, chatTitle }: { chatId: number; chatTitle: string }) {
  const { data: models = [] } = useModels();
  const exportChat = useMutation({
    mutationFn: () => downloadChatAsMarkdown(chatId, chatTitle, models),
  });
  const label = exportChat.isError ? "Couldn't export the chat. Try again" : "Export as Markdown";

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      onClick={() => exportChat.mutate()}
      disabled={exportChat.isPending}
      aria-label={label}
      title={label}
      className={ICON_BUTTON}
    >
      {exportChat.isPending ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : exportChat.isError ? (
        <CircleAlert className="h-4 w-4 text-red-500" />
      ) : (
        <Download className="h-4 w-4" />
      )}
    </Button>
  );
}
