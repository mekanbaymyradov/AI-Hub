import { useState, type FormEvent } from "react";
import { getErrorMessage } from "@/api/errors";
import { useAuth } from "@/context/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal, ModalDescription, ModalTitle } from "@/components/Modal";

// The API's limit for a name.
const NAME_MAX_LENGTH = 50;

// Remembered per user, so a skipped prompt doesn't come back on every visit.
const skippedKey = (userId: number) => `name-prompt-skipped:${userId}`;

/** Ask a user without a name what to call them, until they answer or skip. */
export function NamePromptModal() {
  const { user, updateUser } = useAuth();
  const [skipped, setSkipped] = useState(() => user !== null && localStorage.getItem(skippedKey(user.id)) !== null);
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const skip = () => {
    if (user) localStorage.setItem(skippedKey(user.id), "1");
    setSkipped(true);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed || saving) return;

    setSaving(true);
    setError(null);
    try {
      // On success the user has a name, which closes the modal.
      await updateUser({ name: trimmed });
    } catch (err) {
      setError(getErrorMessage(err, "Couldn't save your name. Please try again."));
      setSaving(false);
    }
  };

  return (
    // Not dismissible: a stray click outside shouldn't count as skipping. Escape still skips, below.
    <Modal open={user !== null && user.name === null && !skipped} onClose={skip} dismissible={false} className="p-6 text-center">
      <form
        onSubmit={handleSubmit}
        onKeyDown={(e) => {
          if (e.key === "Escape" && !saving) skip();
        }}
      >
        <ModalTitle className="text-lg font-semibold text-zinc-900 dark:text-white">Hey, what should I call you?</ModalTitle>
        <ModalDescription className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          You can change it anytime in Profile Settings.
        </ModalDescription>

        <Input
          autoFocus
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            setError(null);
          }}
          placeholder="Your name"
          autoComplete="given-name"
          maxLength={NAME_MAX_LENGTH}
          aria-label="Your name"
          aria-invalid={error !== null}
          className="mt-5 h-11 rounded-xl border-zinc-200 bg-zinc-50 px-3.5 text-center text-zinc-900 dark:border-white/10 dark:bg-[#121214] dark:text-white"
        />
        {error && (
          <p role="alert" className="mt-2 text-sm font-medium text-red-500">
            {error}
          </p>
        )}

        <div className="mt-5 grid grid-cols-2 gap-2">
          <Button
            type="button"
            variant="ghost"
            onClick={skip}
            disabled={saving}
            className="h-10 rounded-xl text-sm text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-300 dark:hover:bg-white/10 dark:hover:text-white"
          >
            Skip
          </Button>
          <Button
            type="submit"
            disabled={!name.trim() || saving}
            className="h-10 rounded-xl bg-blue-600 text-sm font-semibold text-white hover:bg-blue-500"
          >
            {saving ? "Saving…" : "Continue"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
