import { useState, type FormEvent } from "react";
import { type ChatPublic } from "@/api/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal, ModalDescription, ModalTitle } from "@/components/Modal";

interface RenameChatModalProps {
  open: boolean;
  chat: ChatPublic | null;
  onClose: () => void;
  onRename: (name: string) => void;
  pending: boolean;
  error?: string | null;
}

export function RenameChatModal({ open, chat, onClose, onRename, pending, error }: RenameChatModalProps) {
  return (
    <Modal open={open} onClose={onClose} dismissible={!pending} className="space-y-4">
      <div className="space-y-1">
        <ModalTitle className="text-base font-semibold text-zinc-900 dark:text-white">Rename Chat</ModalTitle>
        <ModalDescription className="text-xs text-zinc-500 dark:text-zinc-400">
          Enter a new name for this conversation.
        </ModalDescription>
      </div>
      {/* The popup's content mounts on each open, so the field starts from the chat's current name. */}
      {chat && <RenameForm initialName={chat.name} onClose={onClose} onRename={onRename} pending={pending} error={error} />}
    </Modal>
  );
}

function RenameForm({
  initialName,
  onClose,
  onRename,
  pending,
  error,
}: Omit<RenameChatModalProps, "open" | "chat"> & { initialName: string }) {
  const [name, setName] = useState(initialName);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (name.trim() && !pending) onRename(name.trim());
  };

  return (
    <form onSubmit={handleSubmit}>
      <Input
        autoFocus
        value={name}
        onChange={(e) => setName(e.target.value)}
        onFocus={(e) => e.target.select()}
        placeholder="Chat name"
        aria-label="Chat name"
        className="h-10 rounded-xl border-zinc-200 bg-zinc-50 text-sm text-zinc-900 focus-visible:ring-1 focus-visible:ring-blue-500 dark:border-white/10 dark:bg-[#121214] dark:text-white"
      />
      {error && (
        <p role="alert" className="mt-2 text-xs font-medium text-red-500">
          {error}
        </p>
      )}

      <div className="mt-5 flex justify-end gap-2">
        <Button
          type="button"
          variant="ghost"
          onClick={onClose}
          disabled={pending}
          className="h-9 cursor-pointer rounded-lg px-4 text-xs text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-300 dark:hover:bg-white/10 dark:hover:text-white"
        >
          Cancel
        </Button>
        <Button
          type="submit"
          disabled={!name.trim() || pending}
          className="h-9 cursor-pointer rounded-lg bg-blue-600 px-4 text-xs font-medium text-white shadow-xs transition-colors hover:bg-blue-500"
        >
          {pending ? "Saving..." : "Save"}
        </Button>
      </div>
    </form>
  );
}
