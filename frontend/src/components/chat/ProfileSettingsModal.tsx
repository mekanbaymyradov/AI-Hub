import React, { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { User as UserIcon, Camera, Loader2, Check, X, Trash2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAuth } from "@/context/AuthContext";
import { resizeAndCompressImageToWebP } from "@/utils/image";
import { cn } from "@/lib/utils";

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

interface ProfileSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ProfileSettingsModal({ isOpen, onClose }: ProfileSettingsModalProps) {
  const { user, updateUser, uploadAvatar, removeAvatar } = useAuth();

  const [profileNameInput, setProfileNameInput] = useState("");
  const [profileInstructionsInput, setProfileInstructionsInput] = useState("");
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [profileSaveSuccess, setProfileSaveSuccess] = useState(false);
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen && user) {
      setProfileNameInput(user.name || "");
      setProfileInstructionsInput(user.instructions || "");
      setProfileSaveSuccess(false);
      setAvatarError(null);
    }
  }, [isOpen, user]);

  const handleProfileSave = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (profileInstructionsInput.length > 255) return;
    setIsSavingProfile(true);
    try {
      await updateUser({
        name: profileNameInput.trim() || null,
        instructions: profileInstructionsInput.trim() || null,
      });
      setProfileSaveSuccess(true);
      setTimeout(() => {
        onClose();
        setProfileSaveSuccess(false);
      }, 500);
    } catch (err) {
      console.error("Failed to update profile:", err);
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setAvatarError(null);
    setIsUploadingAvatar(true);
    try {
      const webpFile = await resizeAndCompressImageToWebP(file, 256, 0.85);
      await uploadAvatar(webpFile);
    } catch (err: any) {
      console.error("Failed to upload avatar:", err);
      const errorMsg =
        err?.response?.data?.detail?.[0]?.msg ||
        (typeof err?.response?.data?.detail === "string" ? err.response.data.detail : null) ||
        err?.message ||
        "Failed to upload photo.";
      setAvatarError(errorMsg);
    } finally {
      setIsUploadingAvatar(false);
      if (avatarInputRef.current) avatarInputRef.current.value = "";
    }
  };

  const handleAvatarRemove = async () => {
    setAvatarError(null);
    setIsUploadingAvatar(true);
    try {
      await removeAvatar();
    } catch (err: any) {
      console.error("Failed to remove avatar:", err);
      const errorMsg =
        err?.response?.data?.detail?.[0]?.msg ||
        (typeof err?.response?.data?.detail === "string" ? err.response.data.detail : null) ||
        err?.message ||
        "Failed to remove photo.";
      setAvatarError(errorMsg);
    } finally {
      setIsUploadingAvatar(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/50 dark:bg-black/75 backdrop-blur-xs">
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 12 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            className="w-full max-w-xl bg-white dark:bg-[#18181b] border border-zinc-200 dark:border-white/10 rounded-2xl sm:rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6 text-zinc-900 dark:text-foreground max-h-[90vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between pb-4 border-b border-zinc-100 dark:border-white/10">
              <div className="flex items-center gap-2.5">
                <div className="flex items-center justify-center w-8 h-8 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 border border-blue-100 dark:border-blue-900/40">
                  <UserIcon className="h-4 w-4" />
                </div>
                <h3 className="text-lg font-semibold tracking-tight text-zinc-900 dark:text-white">Profile</h3>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="p-1.5 rounded-xl text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-white/10 transition-colors cursor-pointer"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="flex items-center gap-5 p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-900/60 border border-zinc-200/70 dark:border-white/5">
              <div className="relative group/avatar shrink-0">
                <Avatar className="h-20 w-20 bg-zinc-200 dark:bg-zinc-800 border-2 border-white dark:border-zinc-700 shadow-sm">
                  {user?.avatar_url && <AvatarImage src={user.avatar_url} alt={user?.name || "User"} />}
                  <AvatarFallback className="text-xl text-zinc-700 dark:text-zinc-200 uppercase font-semibold">
                    {user?.avatar_initial || user?.name?.slice(0, 1) || user?.email?.slice(0, 1) || "U"}
                  </AvatarFallback>
                </Avatar>
                {isUploadingAvatar && (
                  <div className="absolute inset-0 bg-black/60 rounded-full flex items-center justify-center">
                    <Loader2 className="h-6 w-6 text-white animate-spin" />
                  </div>
                )}
              </div>

              <div className="flex flex-col gap-2 flex-1 min-w-0">
                <input
                  type="file"
                  ref={avatarInputRef}
                  onChange={handleAvatarChange}
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  className="hidden"
                />
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => avatarInputRef.current?.click()}
                    disabled={isUploadingAvatar}
                    className="h-8 px-3 text-xs bg-white dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 text-zinc-800 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-700/80 rounded-xl cursor-pointer"
                  >
                    <Camera className="h-3.5 w-3.5 mr-1.5" />
                    Upload photo
                  </Button>
                  {user?.avatar_url && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={handleAvatarRemove}
                      disabled={isUploadingAvatar}
                      className="h-8 px-2.5 text-xs text-red-500 hover:text-red-600 dark:text-red-400 dark:hover:text-red-300 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-xl cursor-pointer"
                    >
                      <Trash2 className="h-3.5 w-3.5 mr-1.5" />
                      Remove
                    </Button>
                  )}
                </div>
                <span className="text-xs text-zinc-500 dark:text-zinc-400">
                  JPG, PNG, or WebP up to 2MB
                </span>
                {avatarError && (
                  <span className="text-xs text-red-500 font-medium">
                    {avatarError}
                  </span>
                )}
              </div>
            </div>

            <form onSubmit={handleProfileSave} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300">Name</label>
                  <Input
                    value={profileNameInput}
                    onChange={(e) => setProfileNameInput(e.target.value)}
                    placeholder="Your name"
                    className="h-10 bg-zinc-50 dark:bg-zinc-900 border-zinc-200 dark:border-white/10 text-zinc-900 dark:text-white text-sm focus-visible:ring-1 focus-visible:ring-blue-500 rounded-xl"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Email</label>
                  <Input
                    value={user?.email || ""}
                    disabled
                    className="h-10 bg-zinc-100 dark:bg-zinc-900/60 border-zinc-200 dark:border-white/5 text-zinc-500 dark:text-zinc-400 text-sm rounded-xl cursor-not-allowed"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300">Instructions</label>
                  <span
                    className={cn(
                      "text-[11px] tabular-nums font-mono transition-colors",
                      profileInstructionsInput.length > 255
                        ? "text-red-500 font-semibold"
                        : profileInstructionsInput.length >= 240
                        ? "text-amber-500 font-medium"
                        : "text-zinc-400 dark:text-zinc-500"
                    )}
                  >
                    {profileInstructionsInput.length}/255
                  </span>
                </div>
                <Textarea
                  value={profileInstructionsInput}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val.length <= 255) {
                      setProfileInstructionsInput(val);
                    }
                  }}
                  maxLength={255}
                  placeholder="How would you like the AI to respond? (e.g., concise, code-first)"
                  rows={4}
                  className={cn(
                    "min-h-[110px] bg-zinc-50 dark:bg-zinc-900 border-zinc-200 dark:border-white/10 text-zinc-900 dark:text-white text-sm rounded-xl resize-none",
                    "focus-visible:ring-1 focus-visible:ring-blue-500",
                    profileInstructionsInput.length > 255 && "border-red-500/50 focus-visible:ring-red-500"
                  )}
                />
                <div className="space-y-2 pt-1">
                  <div className="flex items-center gap-1.5 text-xs text-zinc-500 dark:text-zinc-400">
                    <Sparkles className="h-3 w-3 text-blue-500" />
                    <span>Suggestions</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {INSTRUCTION_SUGGESTIONS.map((item) => {
                      const isSelected = profileInstructionsInput === item.text;
                      return (
                        <button
                          key={item.label}
                          type="button"
                          onClick={() => {
                            if (isSelected) {
                              setProfileInstructionsInput("");
                            } else {
                              setProfileInstructionsInput(item.text);
                            }
                          }}
                          className={cn(
                            "text-xs px-2.5 py-1 rounded-lg border transition-all cursor-pointer text-left select-none",
                            isSelected
                              ? "border-blue-500 bg-blue-50 text-blue-600 dark:bg-blue-950/60 dark:text-blue-400 dark:border-blue-500/60 font-medium shadow-xs"
                              : "border-zinc-200 dark:border-white/10 bg-zinc-50 dark:bg-zinc-900/50 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800/80 hover:border-zinc-300 dark:hover:border-white/20"
                          )}
                          title={item.text}
                        >
                          {item.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-zinc-100 dark:border-white/5">
                <div className="text-xs text-emerald-500 dark:text-emerald-400 font-medium">
                  {profileSaveSuccess && (
                    <span className="flex items-center gap-1.5">
                      <Check className="h-4 w-4" /> Saved
                    </span>
                  )}
                </div>
                <div className="flex gap-2.5">
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={onClose}
                    disabled={isSavingProfile}
                    className="h-10 px-4 text-xs font-medium text-zinc-600 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-white/10 rounded-xl cursor-pointer"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={isSavingProfile || profileInstructionsInput.length > 255}
                    className="h-10 px-5 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-xl transition-all shadow-md shadow-blue-500/20 cursor-pointer"
                  >
                    {isSavingProfile ? "Saving..." : "Save"}
                  </Button>
                </div>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
