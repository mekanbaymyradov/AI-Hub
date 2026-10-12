import React, { memo, useMemo } from "react";
import { motion } from "framer-motion";

interface ChatGreetingProps {
  userName?: string | null;
  userEmail?: string;
}

export const ChatGreeting = memo(function ChatGreeting({
  userName,
  userEmail,
}: ChatGreetingProps) {
  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    let timeGreeting = "GOOD MORNING";
    if (hour >= 12 && hour < 18) {
      timeGreeting = "GOOD AFTERNOON";
    } else if (hour >= 18 || hour < 5) {
      timeGreeting = "GOOD EVENING";
    }

    const displayName = userName?.trim() || userEmail?.split("@")[0] || "";
    if (displayName) {
      return `${timeGreeting}, ${displayName.toUpperCase()}`;
    }
    return timeGreeting;
  }, [userName, userEmail]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10, filter: "blur(4px)" }}
      transition={{ duration: 0.3 }}
      className="text-center mb-8"
    >
      <h2 className="text-[28px] font-medium tracking-tight text-zinc-900 dark:text-white mb-8">
        {greeting}
      </h2>
    </motion.div>
  );
});
