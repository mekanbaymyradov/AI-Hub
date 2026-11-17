import { useEffect, useRef, useState } from "react";
import { copyToClipboard } from "@/lib/clipboard";

export type CopyState = "idle" | "copied" | "failed";

/** Return how the last copy went, shown for two seconds, and a function that copies text. */
export function useCopy(): [CopyState, (text: string) => Promise<void>] {
  const [state, setState] = useState<CopyState>("idle");
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  const copy = async (text: string) => {
    const ok = await copyToClipboard(text);
    setState(ok ? "copied" : "failed");
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setState("idle"), 2000);
  };

  return [state, copy];
}
