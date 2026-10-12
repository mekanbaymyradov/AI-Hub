import { motion, AnimatePresence } from "framer-motion";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface DeleteChatModalProps {
  isOpen: boolean;
  chat: { id: number; name: string } | null;
  onClose: () => void;
  onDelete: () => Promise<void>;
  isDeleting: boolean;
}

export function DeleteChatModal({
  isOpen,
  chat,
  onClose,
  onDelete,
  isDeleting,
}: DeleteChatModalProps) {
  return (
    <AnimatePresence>
      {isOpen && chat && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 dark:bg-black/70 backdrop-blur-xs">
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ duration: 0.15 }}
            className="w-full max-w-sm bg-white dark:bg-[#1c1c1f] border border-zinc-200 dark:border-white/10 rounded-2xl p-5 shadow-2xl space-y-4 text-zinc-900 dark:text-foreground"
          >
            <div className="space-y-1.5">
              <div className="flex items-center gap-2 text-red-500">
                <Trash2 className="h-4 w-4" />
                <h3 className="text-base font-semibold text-zinc-900 dark:text-white">Delete Chat?</h3>
              </div>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
                Are you sure you want to delete <span className="text-zinc-900 dark:text-zinc-200 font-medium">"{chat.name}"</span>? This will permanently remove the conversation and its history.
              </p>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="ghost"
                onClick={onClose}
                disabled={isDeleting}
                className="h-9 px-4 text-xs text-zinc-600 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-white/10 rounded-lg cursor-pointer"
              >
                Cancel
              </Button>
              <Button
                type="button"
                onClick={onDelete}
                disabled={isDeleting}
                className="h-9 px-4 text-xs font-medium bg-red-600 hover:bg-red-500 text-white rounded-lg transition-colors shadow-xs cursor-pointer"
              >
                {isDeleting ? "Deleting..." : "Delete"}
              </Button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
