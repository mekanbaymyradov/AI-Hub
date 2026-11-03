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
        <ModalTitle className="text-base font-semibold text-fg-1">Rename Chat</ModalTitle>
        <ModalDescription className="text-xs text-fg-7">
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
        className="h-10 rounded-xl border-line-1 bg-field dark:bg-field text-base sm:text-sm text-fg-1 focus-visible:ring-1 focus-visible:ring-blue-500"
      />
      {error && (
        <p role="alert" className="mt-2 text-xs font-medium text-red-500">
          {error}
        </p>
      )}

      <div className="mt-5 flex flex-col-reverse sm:flex-row justify-end gap-2">
        <Button
          type="button"
          variant="ghost"
          onClick={onClose}
          disabled={pending}
          className="w-full sm:w-auto h-9 cursor-pointer rounded-lg px-4 text-xs text-fg-5 hover:bg-fill-1 dark:hover:bg-fill-1 hover:text-fg-1"
        >
          Cancel
        </Button>
        <Button
          type="submit"
          disabled={!name.trim() || pending}
          className="w-full sm:w-auto h-9 cursor-pointer rounded-lg bg-blue-600 px-4 text-xs font-medium text-white shadow-xs transition-colors hover:bg-blue-500"
        >
          {pending ? "Saving..." : "Save"}
        </Button>
      </div>
    </form>
  );
}
