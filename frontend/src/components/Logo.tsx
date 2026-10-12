import { cn } from "@/lib/utils";

interface LogoProps {
  // Sizes the wordmark; the icon scales with the text.
  className?: string;
}

export function Logo({ className }: LogoProps) {
  return (
    <span className={cn("flex items-center gap-2 font-bold tracking-tight text-zinc-900 dark:text-white", className)}>
      <img src="/favicon.svg" alt="" className="size-[1.4em] shrink-0 object-contain" />
      <span>
        AI<span className="text-blue-600 dark:text-blue-500">Hub</span>
      </span>
    </span>
  );
}
