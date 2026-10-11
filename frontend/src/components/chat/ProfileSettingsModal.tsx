import React, { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { User as UserIcon, Camera, Loader2, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAuth } from "@/context/AuthContext";
import { resizeAndCompressImageToWebP } from "@/utils/image";
import { cn } from "@/lib/utils";

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
        "Failed to process and upload avatar.";
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
        "Failed to remove avatar.";
      setAvatarError(errorMsg);
    } finally {
      setIsUploadingAvatar(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 dark:bg-black/70 backdrop-blur-xs">
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ duration: 0.15 }}
            className="w-full max-w-md bg-white dark:bg-[#1c1c1f] border border-zinc-200 dark:border-white/10 rounded-2xl p-6 shadow-2xl space-y-5 text-zinc-900 dark:text-foreground"
          >
            <div className="flex items-center justify-between pb-3 border-b border-zinc-100 dark:border-white/10">
              <div className="flex items-center gap-2">
                <UserIcon className="h-4 w-4 text-zinc-600 dark:text-zinc-300" />
                <h3 className="text-base font-semibold text-zinc-900 dark:text-white">Profile Settings</h3>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="p-1 rounded-lg text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-white/10 transition-colors cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="flex items-center gap-4">
              <div className="relative group/avatar shrink-0">
                <Avatar className="h-16 w-16 bg-zinc-100 dark:bg-zinc-800 border-2 border-zinc-200 dark:border-white/10">
                  {user?.avatar_url && <AvatarImage src={user.avatar_url} alt={user?.name || "User"} />}
                  <AvatarFallback className="text-lg text-zinc-700 dark:text-zinc-200 uppercase font-semibold">
                    {user?.avatar_initial || user?.name?.slice(0, 1) || user?.email?.slice(0, 1) || "U"}
                  </AvatarFallback>
                </Avatar>
                {isUploadingAvatar && (
                  <div className="absolute inset-0 bg-black/60 rounded-full flex items-center justify-center">
                    <Loader2 className="h-5 w-5 text-white animate-spin" />
                  </div>
                )}
              </div>

              <div className="flex flex-col gap-1.5 flex-1 min-w-0">
                <input
                  type="file"
                  ref={avatarInputRef}
                  onChange={handleAvatarChange}
                  accept="image/*"
                  className="hidden"
                />
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => avatarInputRef.current?.click()}
                    disabled={isUploadingAvatar}
                    className="h-8 px-3 text-xs bg-zinc-100 dark:bg-white/5 border-zinc-200 dark:border-white/10 text-zinc-700 dark:text-zinc-200 hover:bg-zinc-200 dark:hover:bg-white/10 cursor-pointer"
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
                      className="h-8 px-2.5 text-xs text-red-500 hover:text-red-600 dark:text-red-400 dark:hover:text-red-300 hover:bg-red-50 dark:hover:bg-red-500/10 cursor-pointer"
                    >
                      Remove
                    </Button>
                  )}
                </div>
                <span className="text-[11px] text-zinc-500">
                  Automatically resized & compressed to WebP (max 2MB)
                </span>
                {avatarError && (
                  <span className="text-[11px] text-red-500 font-medium">
                    {avatarError}
                  </span>
                )}
              </div>
            </div>

            <form onSubmit={handleProfileSave} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Email Address</label>
                <Input
                  value={user?.email || ""}
                  disabled
                  className="h-10 bg-zinc-100 dark:bg-[#121214]/60 border-zinc-200 dark:border-white/5 text-zinc-500 dark:text-zinc-400 text-sm rounded-xl cursor-not-allowed"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300">Display Name</label>
                <Input
                  value={profileNameInput}
                  onChange={(e) => setProfileNameInput(e.target.value)}
                  placeholder="Enter your name"
                  className="h-10 bg-zinc-50 dark:bg-[#121214] border-zinc-200 dark:border-white/10 text-zinc-900 dark:text-white text-sm focus-visible:ring-1 focus-visible:ring-blue-500 rounded-xl"
                />
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300">Custom Instructions</label>
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
                  placeholder="How would you like the AI to respond to you? (optional)"
                  rows={3}
                  className={cn(
                    "min-h-[80px] bg-zinc-50 dark:bg-[#121214] border-zinc-200 dark:border-white/10 text-zinc-900 dark:text-white text-xs rounded-xl resize-none",
                    "focus-visible:ring-1 focus-visible:ring-blue-500",
                    profileInstructionsInput.length > 255 && "border-red-500/50 focus-visible:ring-red-500"
                  )}
                />
              </div>

              <div className="flex items-center justify-between pt-2">
                <div className="text-xs text-emerald-500 dark:text-emerald-400 font-medium">
                  {profileSaveSuccess && (
                    <span className="flex items-center gap-1">
                      <Check className="h-3.5 w-3.5" /> Saved successfully
                    </span>
                  )}
                </div>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={onClose}
                    disabled={isSavingProfile}
                    className="h-9 px-4 text-xs text-zinc-600 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-white/10 rounded-lg cursor-pointer"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={isSavingProfile || profileInstructionsInput.length > 255}
                    className="h-9 px-4 text-xs font-medium bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors cursor-pointer shadow-xs"
                  >
                    {isSavingProfile ? "Saving..." : "Save Changes"}
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
