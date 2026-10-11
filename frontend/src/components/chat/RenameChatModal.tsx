import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface RenameChatModalProps {
  isOpen: boolean;
  chat: { id: number; name: string } | null;
  onClose: () => void;
  onRename: (newName: string) => Promise<void>;
  isRenaming: boolean;
}

export function RenameChatModal({
  isOpen,
  chat,
  onClose,
  onRename,
  isRenaming,
}: RenameChatModalProps) {
  const [renameInput, setRenameInput] = useState("");

  useEffect(() => {
    if (chat) {
      setRenameInput(chat.name || "New Chat");
    }
  }, [chat]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!renameInput.trim() || isRenaming) return;
    onRename(renameInput.trim());
  };

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
            <div className="space-y-1">
              <h3 className="text-base font-semibold text-zinc-900 dark:text-white">Rename Chat</h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">Enter a new name for this conversation.</p>
            </div>

            <form onSubmit={handleSubmit}>
              <Input
                autoFocus
                value={renameInput}
                onChange={(e) => setRenameInput(e.target.value)}
                placeholder="Chat name"
                className="h-10 bg-zinc-50 dark:bg-[#121214] border-zinc-200 dark:border-white/10 text-zinc-900 dark:text-white text-sm focus-visible:ring-1 focus-visible:ring-blue-500 rounded-xl"
              />

              <div className="flex justify-end gap-2 mt-5">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={onClose}
                  disabled={isRenaming}
                  className="h-9 px-4 text-xs text-zinc-600 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-white/10 rounded-lg cursor-pointer"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={!renameInput.trim() || isRenaming}
                  className="h-9 px-4 text-xs font-medium bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors cursor-pointer shadow-xs"
                >
                  {isRenaming ? "Saving..." : "Save"}
                </Button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
