import { useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { Camera, Check, Loader2, Sparkles, Trash2, User as UserIcon, X } from "lucide-react";
import { getErrorMessage } from "@/api/errors";
import { type UserPublic } from "@/api/types";
import { useAuth } from "@/context/auth";
import { toSquareWebP } from "@/lib/image";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Modal, ModalTitle } from "@/components/Modal";
import { UserAvatar } from "@/components/UserAvatar";

// The API's limits for UserUpdate.
const NAME_MAX_LENGTH = 50;
const INSTRUCTIONS_MAX_LENGTH = 1500;

const INSTRUCTION_SUGGESTIONS = [
  {
    label: "Concise & direct",
    text: "Be concise and direct. Focus on actionable answers without unnecessary filler.",
  },
  {
    label: "Code-first",
    text: "Prioritize clean, production-ready code with minimal explanation.",
  },
  {
    label: "Step-by-step",
    text: "Break down complex topics and explain step-by-step with clear examples.",
  },
  {
    label: "Senior engineer",
    text: "Act as a senior software engineer. Focus on best practices and architecture.",
  },
  {
    label: "Simple & clear",
    text: "Explain in simple, everyday language without overly technical jargon.",
  },
];

const FIELD = "h-10 rounded-xl border-zinc-200 bg-zinc-50 text-sm text-zinc-900 focus-visible:ring-1 focus-visible:ring-blue-500 dark:border-white/10 dark:bg-zinc-900 dark:text-white";

interface ProfileSettingsModalProps {
  open: boolean;
  onClose: () => void;
}

export function ProfileSettingsModal({ open, onClose }: ProfileSettingsModalProps) {
  const { user } = useAuth();
  return (
    <Modal
      open={open}
      onClose={onClose}
      className="max-h-[90vh] max-w-xl space-y-6 overflow-y-auto p-6 sm:rounded-3xl sm:p-8 dark:bg-[#18181b]"
    >
      <div className="flex items-center justify-between border-b border-zinc-100 pb-4 dark:border-white/10">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl border border-blue-100 bg-blue-50 text-blue-600 dark:border-blue-900/40 dark:bg-blue-950/60 dark:text-blue-400">
            <UserIcon className="h-4 w-4" />
          </div>
          <ModalTitle className="text-lg font-semibold tracking-tight text-zinc-900 dark:text-white">Profile</ModalTitle>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="cursor-pointer rounded-xl p-1.5 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-white/10 dark:hover:text-white"
          aria-label="Close"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* The popup's content mounts on each open, so the fields start from the saved profile. */}
      {user && (
        <>
          <AvatarSection user={user} />
          <ProfileForm user={user} onClose={onClose} />
        </>
      )}
    </Modal>
  );
}

function AvatarSection({ user }: { user: UserPublic }) {
  const { uploadAvatar, removeAvatar } = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const run = async (action: () => Promise<unknown>, fallback: string) => {
    setError(null);
    setBusy(true);
    try {
      await action();
    } catch (err) {
      setError(getErrorMessage(err, fallback));
    } finally {
      setBusy(false);
    }
  };

  const handleFile = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    // Cleared now, so choosing the same file again still fires a change.
    e.target.value = "";
    if (file) run(async () => uploadAvatar(await toSquareWebP(file)), "Failed to upload photo.");
  };

  return (
    <div className="flex items-center gap-5 rounded-2xl border border-zinc-200/70 bg-zinc-50 p-4 dark:border-white/5 dark:bg-zinc-900/60">
      <div className="relative shrink-0">
        <UserAvatar
          user={user}
          className="h-20 w-20 border-2 border-white bg-zinc-200 shadow-sm dark:border-zinc-700"
          fallbackClassName="text-xl"
        />
        {busy && (
          <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/60">
            <Loader2 className="h-6 w-6 animate-spin text-white" />
          </div>
        )}
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <input
          type="file"
          ref={inputRef}
          onChange={handleFile}
          accept="image/jpeg,image/png,image/webp,image/gif"
          className="hidden"
        />
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => inputRef.current?.click()}
            disabled={busy}
            className="h-8 cursor-pointer rounded-xl border-zinc-200 bg-white px-3 text-xs text-zinc-800 hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700/80"
          >
            <Camera className="mr-1.5 h-3.5 w-3.5" />
            Upload photo
          </Button>
          {user.avatar_url && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => run(removeAvatar, "Failed to remove photo.")}
              disabled={busy}
              className="h-8 cursor-pointer rounded-xl px-2.5 text-xs text-red-500 hover:bg-red-50 hover:text-red-600 dark:text-red-400 dark:hover:bg-red-500/10 dark:hover:text-red-300"
            >
              <Trash2 className="mr-1.5 h-3.5 w-3.5" />
              Remove
            </Button>
          )}
        </div>
        <span className="text-xs text-zinc-500 dark:text-zinc-400">JPG, PNG, or WebP up to 2MB</span>
        {error && <span className="text-xs font-medium text-red-500">{error}</span>}
      </div>
    </div>
  );
}

function ProfileForm({ user, onClose }: { user: UserPublic; onClose: () => void }) {
  const { updateUser } = useAuth();
  const [name, setName] = useState(user.name ?? "");
  const [instructions, setInstructions] = useState(user.instructions ?? "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      await updateUser({ name: name.trim() || null, instructions: instructions.trim() || null });
      setSaved(true);
      // A beat to show "Saved" before closing.
      setTimeout(onClose, 500);
    } catch (err) {
      setError(getErrorMessage(err, "Failed to save your profile."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <label htmlFor="profile-name" className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
            Name
          </label>
          <Input
            id="profile-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={NAME_MAX_LENGTH}
            placeholder="Your name"
            className={FIELD}
          />
        </div>

        <div className="space-y-1.5">
          <label htmlFor="profile-email" className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
            Email
          </label>
          <Input
            id="profile-email"
            value={user.email}
            disabled
            className="h-10 cursor-not-allowed rounded-xl border-zinc-200 bg-zinc-100 text-sm text-zinc-500 dark:border-white/5 dark:bg-zinc-900/60 dark:text-zinc-400"
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <label htmlFor="profile-instructions" className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
            Instructions
          </label>
          <span
            className={cn(
              "font-mono text-[11px] tabular-nums transition-colors",
              instructions.length >= INSTRUCTIONS_MAX_LENGTH - 100
                ? "font-medium text-amber-500"
                : "text-zinc-400 dark:text-zinc-500"
            )}
          >
            {instructions.length}/{INSTRUCTIONS_MAX_LENGTH}
          </span>
        </div>
        <Textarea
          id="profile-instructions"
          value={instructions}
          onChange={(e) => setInstructions(e.target.value)}
          maxLength={INSTRUCTIONS_MAX_LENGTH}
          placeholder="How would you like the AI to respond? (e.g., concise, code-first)"
          rows={4}
          className={cn(FIELD, "h-auto min-h-[110px] resize-none")}
        />
        <div className="space-y-2 pt-1">
          <div className="flex items-center gap-1.5 text-xs text-zinc-500 dark:text-zinc-400">
            <Sparkles className="h-3 w-3 text-blue-500" />
            <span>Suggestions</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {INSTRUCTION_SUGGESTIONS.map((item) => {
              const isSelected = instructions === item.text;
              return (
                <button
                  key={item.label}
                  type="button"
                  onClick={() => setInstructions(isSelected ? "" : item.text)}
                  aria-pressed={isSelected}
                  title={item.text}
                  className={cn(
                    "cursor-pointer rounded-lg border px-2.5 py-1 text-left text-xs transition-all select-none",
                    isSelected
                      ? "border-blue-500 bg-blue-50 font-medium text-blue-600 shadow-xs dark:border-blue-500/60 dark:bg-blue-950/60 dark:text-blue-400"
                      : "border-zinc-200 bg-zinc-50 text-zinc-600 hover:border-zinc-300 hover:bg-zinc-100 hover:text-zinc-900 dark:border-white/10 dark:bg-zinc-900/50 dark:text-zinc-400 dark:hover:border-white/20 dark:hover:bg-zinc-800/80 dark:hover:text-zinc-200"
                  )}
                >
                  {item.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between border-t border-zinc-100 pt-3 dark:border-white/5">
        <div className="text-xs font-medium">
          {saved && (
            <span className="flex items-center gap-1.5 text-emerald-500 dark:text-emerald-400">
              <Check className="h-4 w-4" /> Saved
            </span>
          )}
          {error && <span className="text-red-500">{error}</span>}
        </div>
        <div className="flex gap-2.5">
          <Button
            type="button"
            variant="ghost"
            onClick={onClose}
            disabled={saving}
            className="h-10 cursor-pointer rounded-xl px-4 text-xs font-medium text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-300 dark:hover:bg-white/10 dark:hover:text-white"
          >
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={saving}
            className="h-10 cursor-pointer rounded-xl bg-blue-600 px-5 text-xs font-semibold text-white shadow-md shadow-blue-500/20 transition-all hover:bg-blue-700"
          >
            {saving ? "Saving..." : "Save"}
          </Button>
        </div>
      </div>
    </form>
  );
}
