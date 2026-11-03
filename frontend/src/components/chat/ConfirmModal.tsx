import { type ReactNode } from "react";
import { type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Modal, ModalDescription, ModalTitle } from "@/components/Modal";

interface ConfirmModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  pending: boolean;
  error?: string | null;
  icon: LucideIcon;
  title: string;
  description: ReactNode;
  confirmLabel: string;
  pendingLabel: string;
}

/** Ask before a destructive action, such as deleting a chat. */
export function ConfirmModal({
  open,
  onClose,
  onConfirm,
  pending,
  error,
  icon: Icon,
  title,
  description,
  confirmLabel,
  pendingLabel,
}: ConfirmModalProps) {
  return (
    <Modal open={open} onClose={onClose} dismissible={!pending} className="space-y-4">
      <div className="space-y-1.5">
        <div className="flex items-center gap-2 text-red-500">
          <Icon className="h-4 w-4" />
          <ModalTitle className="text-base font-semibold text-fg-1">{title}</ModalTitle>
        </div>
        <ModalDescription className="text-xs leading-relaxed text-fg-7">
          {description}
        </ModalDescription>
      </div>

      {error && (
        <p role="alert" className="text-xs font-medium text-red-500">
          {error}
        </p>
      )}

      <div className="flex flex-col-reverse sm:flex-row justify-end gap-2 pt-2">
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
          type="button"
          onClick={onConfirm}
          disabled={pending}
          className="w-full sm:w-auto h-9 cursor-pointer rounded-lg bg-red-600 px-4 text-xs font-medium text-white shadow-xs transition-colors hover:bg-red-500"
        >
          {pending ? pendingLabel : confirmLabel}
        </Button>
      </div>
    </Modal>
  );
}
