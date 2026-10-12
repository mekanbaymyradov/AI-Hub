import { memo } from "react";
import { motion } from "framer-motion";
import { Code2, FileText, Lightbulb, Sparkles } from "lucide-react";
import { useAuth } from "@/context/auth";
import { displayName } from "@/lib/user";

const STARTER_PROMPTS = [
  {
    icon: Code2,
    label: "Write & debug code",
    prompt: "Help me write and optimize a clean, modular code solution.",
  },
  {
    icon: Lightbulb,
    label: "Brainstorm ideas",
    prompt: "Let's brainstorm creative and practical ideas for my next project.",
  },
  {
    icon: FileText,
    label: "Summarize text",
    prompt: "Summarize the key takeaways and actionable points from this text.",
  },
  {
    icon: Sparkles,
    label: "Explain a concept",
    prompt: "Explain this concept in a clear, beginner-friendly way with examples.",
  },
];

function timeGreeting(hour: number): string {
  if (hour >= 5 && hour < 12) return "Good morning";
  if (hour >= 12 && hour < 17) return "Good afternoon";
  if (hour >= 17 && hour < 22) return "Good evening";
  return "Welcome back";
}

interface ChatGreetingProps {
  onSelectPrompt: (prompt: string) => void;
}

export const ChatGreeting = memo(function ChatGreeting({ onSelectPrompt }: ChatGreetingProps) {
  const { user } = useAuth();

  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -12, filter: "blur(4px)" }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      className="text-center mb-6 sm:mb-8 px-4 max-w-xl mx-auto select-none"
    >
      <div className="flex flex-col items-center mb-4">
        <div className="relative flex items-center justify-center w-12 h-12 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-white/10 shadow-md shadow-zinc-200/50 dark:shadow-black/40 mb-3 transition-transform hover:scale-105">
          <img src="/favicon.svg" alt="" className="w-6 h-6 object-contain" />
          <div className="absolute -inset-1 rounded-2xl bg-blue-500/10 dark:bg-blue-500/20 blur-xs -z-10" />
        </div>
      </div>

      <h2 className="text-2xl sm:text-3xl md:text-[32px] font-semibold tracking-tight text-zinc-900 dark:text-white leading-tight">
        {timeGreeting(new Date().getHours())}
        {user && (
          <>
            {", "}
            <span className="text-blue-600 dark:text-blue-400">{displayName(user)}</span>
          </>
        )}
      </h2>

      <p className="mt-2 text-sm sm:text-[15px] text-zinc-500 dark:text-zinc-400 font-normal leading-relaxed">
        How can I help you today?
      </p>

      <div className="flex flex-wrap items-center justify-center gap-2 mt-5">
        {STARTER_PROMPTS.map(({ icon: Icon, label, prompt }) => (
          <button
            key={label}
            type="button"
            onClick={() => onSelectPrompt(prompt)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium bg-white/80 dark:bg-zinc-900/80 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white border border-zinc-200/80 dark:border-white/10 hover:border-blue-500/40 dark:hover:border-blue-500/40 transition-all shadow-2xs cursor-pointer group"
          >
            <Icon className="w-3.5 h-3.5 text-zinc-400 dark:text-zinc-500 group-hover:text-blue-500 transition-colors" />
            <span>{label}</span>
          </button>
        ))}
      </div>
    </motion.div>
  );
});
