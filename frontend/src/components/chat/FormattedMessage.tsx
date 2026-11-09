import { useState, type ReactNode } from "react";
import Markdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeHighlight from "rehype-highlight";
import rehypeKatex from "rehype-katex";
import { Check, Copy } from "lucide-react";
import type { Element, ElementContent } from "hast";
import type { Nodes, Root } from "mdast";
import "katex/dist/katex.min.css";
import { copyToClipboard } from "@/lib/clipboard";

interface FormattedMessageProps {
  content: string;
  isStreaming?: boolean;
}

// remark-math reads only $ and $$, but models often write \( \) and \[ \].
// A single $ counts only by Pandoc's rule, a non-space inside each delimiter
// and no digit after the closing one, so "costs $5 and $10" stays text.
// Code is left alone, so a backslash in a code sample stays as typed.
function normalizeMath(markdown: string): string {
  return markdown
    .split(/(```[\s\S]*?(?:```|$)|`[^`\n]*`)/g)
    .map((part, index) =>
      index % 2 === 1
        ? part
        : part
            .replace(/\\\[([\s\S]*?)\\\]/g, (_, tex: string) => `$$${tex}$$`)
            .replace(/\\\(([\s\S]*?)\\\)/g, (_, tex: string) => `$${tex.trim()}$`)
            .replace(
              /(\\\$)|(\$\$[\s\S]*?\$\$)|(\$[^\s$](?:[^$\n]*[^\s$])?\$(?!\d))|\$/g,
              (_, escaped, display, inline) => escaped ?? display ?? inline ?? "\\$"
            )
    )
    .join("");
}

// Show raw HTML as the text it is. Rendering it would let a reply inject
// markup, and react-markdown's default drops it, losing text like Vec<String>.
function remarkHtmlAsText() {
  return (tree: Root) => {
    const walk = (node: Nodes) => {
      if (node.type === "html") Object.assign(node, { type: "text" });
      if ("children" in node) node.children.forEach(walk);
    };
    walk(tree);
  };
}

function textOf(node: ElementContent): string {
  if (node.type === "text") return node.value;
  return "children" in node ? node.children.map(textOf).join("") : "";
}

function CodeBlock({ node, children }: { node?: Element; children?: ReactNode }) {
  const [copied, setCopied] = useState(false);

  const code = node?.children.find((child): child is Element => child.type === "element");
  const language = (code?.properties.className as string[] | undefined)
    ?.find((name) => name.startsWith("language-"))
    ?.slice("language-".length);

  const handleCopy = async () => {
    // The parser ends every code block with a newline the model didn't write.
    const ok = await copyToClipboard(code ? textOf(code).replace(/\n$/, "") : "");
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="relative my-3.5 w-full max-w-full rounded-xl overflow-hidden border border-line-2 bg-code shadow-xs dark:shadow-md">
      <div className="flex items-center justify-between px-3.5 py-1.5 bg-zinc-100 dark:bg-zinc-900 border-b border-line-2 text-xs select-none">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 opacity-60">
            <span className="h-2.5 w-2.5 rounded-full bg-red-500/80" />
            <span className="h-2.5 w-2.5 rounded-full bg-yellow-500/80" />
            <span className="h-2.5 w-2.5 rounded-full bg-green-500/80" />
          </div>
          <span className="font-mono text-[11px] font-medium tracking-wider uppercase text-fg-7 ml-1.5">
            {language ?? "code"}
          </span>
        </div>
        <button
          type="button"
          onClick={handleCopy}
          className="flex items-center gap-1.5 py-1 px-2.5 rounded-md text-fg-7 hover:bg-zinc-200 hover:text-fg-1 dark:hover:bg-white/10 transition-colors cursor-pointer text-[11px]"
          title="Copy code"
        >
          {copied ? (
            <>
              <Check className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
              <span className="text-emerald-600 dark:text-emerald-400 font-medium">Copied!</span>
            </>
          ) : (
            <>
              <Copy className="h-3.5 w-3.5" />
              <span>Copy</span>
            </>
          )}
        </button>
      </div>
      <pre className="p-3.5 w-full max-w-full overflow-x-auto text-xs sm:text-[13px] font-mono leading-relaxed text-fg-3 selection:bg-blue-200 dark:selection:bg-blue-600/40">
        {children}
      </pre>
    </div>
  );
}

const TEXT = "leading-relaxed text-[14px] sm:text-[15px] text-fg-3 break-words [overflow-wrap:anywhere]";

const components: Components = {
  pre: CodeBlock,
  p: ({ children }) => <p className={`my-1.5 ${TEXT}`}>{children}</p>,
  h1: ({ children }) => (
    <h1 className="text-lg font-bold text-fg-1 mt-4 mb-2 first:mt-0 tracking-tight break-words [overflow-wrap:anywhere]">
      {children}
    </h1>
  ),
  h2: ({ children }) => (
    <h2 className="text-base font-semibold text-fg-1 mt-3.5 mb-1.5 first:mt-0 tracking-tight break-words [overflow-wrap:anywhere]">
      {children}
    </h2>
  ),
  h3: ({ children }) => (
    <h3 className="text-sm font-semibold text-zinc-800 dark:text-zinc-100 mt-3 mb-1 first:mt-0 tracking-tight break-words [overflow-wrap:anywhere]">
      {children}
    </h3>
  ),
  h4: ({ children }) => <h4 className="text-sm font-semibold text-fg-2 mt-3 mb-1">{children}</h4>,
  ul: ({ children }) => (
    <ul className="my-2.5 space-y-1.5 pl-5 list-disc marker:text-zinc-400 dark:marker:text-zinc-500">
      {children}
    </ul>
  ),
  ol: ({ children, start }) => (
    <ol start={start} className="my-2.5 space-y-1.5 pl-6 list-decimal marker:font-mono marker:text-xs marker:font-medium marker:text-fg-7">
      {children}
    </ol>
  ),
  li: ({ children }) => <li className={`pl-1 [&>p]:my-0 [&>ul]:my-1.5 [&>ol]:my-1.5 ${TEXT}`}>{children}</li>,
  blockquote: ({ children }) => (
    <blockquote className="border-l-2 border-blue-500 bg-blue-50/50 dark:bg-blue-950/20 pl-3.5 py-1.5 my-2 rounded-r-md text-fg-4 italic [&>p]:my-0.5 [&_p]:text-fg-4">
      {children}
    </blockquote>
  ),
  hr: () => <hr className="my-3.5 border-line-2" />,
  a: ({ href, children }) => (
    <a
      // react-markdown blanks unsafe URLs such as javascript:, and an empty
      // href would open this page.
      href={href || undefined}
      target="_blank"
      rel="noopener noreferrer"
      className="text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 underline underline-offset-2 transition-colors font-medium break-all"
    >
      {children}
    </a>
  ),
  // A link instead of the image: loading any URL a reply names would let it
  // send data to that server the moment the message renders.
  img: ({ src, alt }) => (
    <a href={typeof src === "string" ? src : undefined} target="_blank" rel="noopener noreferrer" className="text-blue-600 dark:text-blue-400 underline underline-offset-2 break-all">
      {alt || src}
    </a>
  ),
  strong: ({ children }) => <strong className="font-semibold text-fg-1">{children}</strong>,
  em: ({ children }) => <em className="italic text-zinc-700 dark:text-zinc-200">{children}</em>,
  del: ({ children }) => <del className="line-through text-zinc-500">{children}</del>,
  table: ({ children }) => (
    <div className="my-3 w-full max-w-full overflow-x-auto rounded-xl border border-line-2 bg-zinc-50/50 dark:bg-white/[0.02]">
      <table className="w-full min-w-full text-xs text-left border-collapse">{children}</table>
    </div>
  ),
  thead: ({ children }) => (
    <thead className="bg-zinc-100 dark:bg-zinc-900 border-b border-line-2 text-fg-2 font-medium">{children}</thead>
  ),
  tbody: ({ children }) => (
    <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800 text-zinc-800 dark:text-zinc-300">{children}</tbody>
  ),
  tr: ({ children }) => <tr className="hover:bg-zinc-100/60 dark:hover:bg-white/[0.02] transition-colors">{children}</tr>,
  th: ({ children, style }) => <th style={style} className="px-3.5 py-2">{children}</th>,
  td: ({ children, style }) => <td style={style} className="px-3.5 py-2">{children}</td>,
};

export function FormattedMessage({ content, isStreaming }: FormattedMessageProps) {
  if (!content) return null;

  return (
    <div className="formatted-message w-full min-w-0 max-w-full overflow-hidden">
      <Markdown
        remarkPlugins={[remarkGfm, remarkMath, remarkHtmlAsText]}
        rehypePlugins={[rehypeKatex, rehypeHighlight]}
        components={components}
      >
        {normalizeMath(content)}
      </Markdown>

      {isStreaming && (
        <span className="inline-block w-1.5 h-3.5 ml-1 align-baseline bg-blue-400/90 rounded-xs animate-pulse" />
      )}
    </div>
  );
}
