// remark-math reads only $ and $$, but models often write \( \) and \[ \].
// A single $ counts only by Pandoc's rule, a non-space inside each delimiter
// and no digit after the closing one, so "costs $5 and $10" stays text.
// Code is left alone, so a backslash in a code sample stays as typed.
export function normalizeMath(markdown: string): string {
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
