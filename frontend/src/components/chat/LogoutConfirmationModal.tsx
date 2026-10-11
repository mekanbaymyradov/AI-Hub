import { motion, AnimatePresence } from "framer-motion";
import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";

interface LogoutConfirmationModalProps {
  isOpen: boolean;
  email?: string;
  onClose: () => void;
  onConfirm: () => Promise<void>;
  isLoggingOut: boolean;
}

export function LogoutConfirmationModal({
  isOpen,
  email,
  onClose,
  onConfirm,
  isLoggingOut,
}: LogoutConfirmationModalProps) {
  return (
    <AnimatePresence>
      {isOpen && (
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
                <LogOut className="h-4 w-4" />
                <h3 className="text-base font-semibold text-zinc-900 dark:text-white">Log out?</h3>
              </div>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
                Are you sure you want to log out of <span className="text-zinc-900 dark:text-zinc-200 font-medium">{email}</span>? You will need to sign in again to access your account.
              </p>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="ghost"
                onClick={onClose}
                disabled={isLoggingOut}
                className="h-9 px-4 text-xs text-zinc-600 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-white/10 rounded-lg cursor-pointer"
              >
                Cancel
              </Button>
              <Button
                type="button"
                onClick={onConfirm}
                disabled={isLoggingOut}
                className="h-9 px-4 text-xs font-medium bg-red-600 hover:bg-red-500 text-white rounded-lg transition-colors shadow-xs cursor-pointer"
              >
                {isLoggingOut ? "Logging out..." : "Log out"}
              </Button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
