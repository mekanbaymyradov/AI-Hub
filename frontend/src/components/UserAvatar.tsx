import { type UserPublic } from "@/api/types";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

interface UserAvatarProps {
  user: UserPublic;
  className?: string;
  fallbackClassName?: string;
}

export function UserAvatar({ user, className, fallbackClassName }: UserAvatarProps) {
  return (
    <Avatar className={cn("shrink-0 border border-zinc-200 bg-zinc-100 dark:border-white/10 dark:bg-zinc-800", className)}>
      {user.avatar_url && <AvatarImage src={user.avatar_url} alt="" />}
      <AvatarFallback className={cn("font-semibold text-zinc-700 uppercase dark:text-zinc-200", fallbackClassName)}>
        {user.avatar_initial}
      </AvatarFallback>
    </Avatar>
  );
}
