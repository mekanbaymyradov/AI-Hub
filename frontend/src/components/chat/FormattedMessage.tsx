import React, { useState, useMemo } from "react";
import { Copy, Check, AlertCircle } from "lucide-react";

interface FormattedMessageProps {
  content: string;
  isStreaming?: boolean;
}

const TOKEN_STYLES: Record<string, string> = {
  keyword: "text-purple-700 dark:text-purple-400 font-medium",
  string: "text-emerald-700 dark:text-emerald-300",
  number: "text-amber-700 dark:text-amber-300",
  boolean: "text-cyan-700 dark:text-cyan-400",
  constant: "text-cyan-700 dark:text-cyan-400",
  comment: "text-zinc-500 italic",
  function: "text-blue-700 dark:text-blue-400",
  type: "text-teal-700 dark:text-teal-300",
  operator: "text-pink-600 dark:text-pink-400/90",
  punctuation: "text-zinc-500 dark:text-zinc-400",
  property: "text-sky-700 dark:text-sky-300",
  tag: "text-red-600 dark:text-red-400 font-medium",
  attribute: "text-purple-600 dark:text-purple-300",
  text: "text-zinc-800 dark:text-zinc-200",
};

const PYTHON_KEYWORDS = new Set([
  "def", "class", "return", "import", "from", "as", "if", "elif", "else",
  "for", "while", "break", "continue", "try", "except", "finally", "raise",
  "with", "yield", "lambda", "async", "await", "pass", "global", "nonlocal",
  "assert", "del", "in", "is", "not", "and", "or", "match", "case"
]);

const JAVASCRIPT_KEYWORD_LIST = [
  "const", "let", "var", "function", "return", "import", "from", "export",
  "default", "class", "extends", "if", "else", "switch", "case", "break",
  "continue", "for", "while", "do", "try", "catch", "finally", "throw",
  "new", "typeof", "instanceof", "async", "await", "yield", "this", "super",
  "void", "delete", "static", "debugger", "of", "in"
];
const JAVASCRIPT_KEYWORDS = new Set(JAVASCRIPT_KEYWORD_LIST);

const TYPESCRIPT_KEYWORDS = new Set([
  ...JAVASCRIPT_KEYWORD_LIST,
  "interface", "type", "enum", "implements", "package", "private", "protected",
  "public", "readonly", "as", "is", "keyof", "declare", "never", "unknown",
  "any", "abstract", "override"
]);

const KEYWORDS_BY_LANG: Record<string, Set<string>> = {
  python: PYTHON_KEYWORDS,
  py: PYTHON_KEYWORDS,
  javascript: JAVASCRIPT_KEYWORDS,
  js: JAVASCRIPT_KEYWORDS,
  jsx: JAVASCRIPT_KEYWORDS,
  typescript: TYPESCRIPT_KEYWORDS,
  ts: TYPESCRIPT_KEYWORDS,
  tsx: TYPESCRIPT_KEYWORDS,
  sql: new Set([
    "select", "from", "where", "insert", "into", "update", "delete", "join",
    "left", "right", "inner", "outer", "on", "group", "by", "order", "having",
    "limit", "offset", "create", "table", "alter", "drop", "index", "view",
    "union", "all", "and", "or", "not", "in", "exists", "between", "like",
    "is", "null", "as", "case", "when", "then", "else", "end", "distinct",
    "primary", "key", "foreign", "references", "cascade", "default", "values"
  ]),
  pgsql: new Set([
    "select", "from", "where", "insert", "into", "update", "delete", "join",
    "left", "right", "inner", "outer", "on", "group", "by", "order", "having",
    "limit", "offset", "create", "table", "alter", "drop", "index", "view",
    "union", "all", "and", "or", "not", "in", "exists", "between", "like",
    "is", "null", "as", "case", "when", "then", "else", "end", "distinct",
    "primary", "key", "foreign", "references", "cascade", "default", "values"
  ]),
  mysql: new Set([
    "select", "from", "where", "insert", "into", "update", "delete", "join",
    "left", "right", "inner", "outer", "on", "group", "by", "order", "having",
    "limit", "offset", "create", "table", "alter", "drop", "index", "view",
    "union", "all", "and", "or", "not", "in", "exists", "between", "like",
    "is", "null", "as", "case", "when", "then", "else", "end", "distinct",
    "primary", "key", "foreign", "references", "cascade", "default", "values"
  ]),
  bash: new Set([
    "if", "then", "else", "elif", "fi", "for", "while", "do", "done", "case",
    "esac", "function", "select", "time", "until", "echo", "cd", "ls", "cat",
    "mkdir", "rm", "cp", "mv", "chmod", "chown", "grep", "curl", "wget", "git",
    "npm", "pnpm", "yarn", "bun", "python", "node", "docker", "sudo", "exit",
    "return", "source", "export"
  ]),
  sh: new Set([
    "if", "then", "else", "elif", "fi", "for", "while", "do", "done", "case",
    "esac", "function", "select", "time", "until", "echo", "cd", "ls", "cat",
    "mkdir", "rm", "cp", "mv", "chmod", "chown", "grep", "curl", "wget", "git",
    "npm", "pnpm", "yarn", "bun", "python", "node", "docker", "sudo", "exit",
    "return", "source", "export"
  ]),
  shell: new Set([
    "if", "then", "else", "elif", "fi", "for", "while", "do", "done", "case",
    "esac", "function", "select", "time", "until", "echo", "cd", "ls", "cat",
    "mkdir", "rm", "cp", "mv", "chmod", "chown", "grep", "curl", "wget", "git",
    "npm", "pnpm", "yarn", "bun", "python", "node", "docker", "sudo", "exit",
    "return", "source", "export"
  ]),
  rust: new Set([
    "fn", "pub", "mut", "let", "impl", "trait", "struct", "enum", "type",
    "match", "if", "else", "loop", "while", "for", "in", "return", "break",
    "continue", "use", "mod", "as", "const", "static", "unsafe", "async", "await", "where"
  ]),
  go: new Set([
    "package", "import", "func", "return", "var", "const", "type", "struct",
    "interface", "if", "else", "for", "range", "switch", "case", "default",
    "select", "go", "defer", "chan", "map", "make", "new", "break", "continue"
  ]),
};

const LANGUAGE_ALIASES: Record<string, string> = {
  py: "python",
  js: "javascript",
  ts: "typescript",
  sh: "bash",
  shell: "bash",
  zsh: "bash",
  yml: "yaml",
  jsonc: "json",
  pgsql: "sql",
  mysql: "sql",
};

const COMMON_KEYWORDS = new Set([
  "if", "else", "for", "while", "return", "function", "class", "import",
  "export", "const", "let", "var", "def", "public", "private", "new", "this",
  "try", "catch", "finally", "throw", "async", "await", "switch", "case"
]);

function isKeyword(word: string, lang: string): boolean {
  const set = KEYWORDS_BY_LANG[lang];
  if (set) {
    return set.has(word) || set.has(word.toLowerCase());
  }
  return COMMON_KEYWORDS.has(word.toLowerCase());
}

const BOOLEANS_AND_CONSTANTS = new Set([
  "true", "false", "null", "undefined", "True", "False", "None",
  "nil", "NaN", "Infinity", "NULL"
]);

const BUILTIN_TYPES = new Set([
  "string", "number", "boolean", "any", "unknown", "never", "void",
  "object", "Promise", "Array", "Record", "Map", "Set", "int", "float",
  "str", "dict", "list", "tuple", "bool", "bytes", "Exception", "Error",
  "char", "double", "long", "short", "byte", "uint", "int32", "int64"
]);

interface Token {
  type: string;
  value: string;
}

interface MultilineState {
  inComment: boolean;
  inString: string | null;
}

function tokenizeLine(
  line: string,
  lang: string,
  multilineState: MultilineState
): Token[] {
  const tokens: Token[] = [];
  let pos = 0;
  const len = line.length;

  if (multilineState.inComment) {
    const endIdx = line.indexOf("*/");
    if (endIdx === -1) {
      tokens.push({ type: "comment", value: line });
      return tokens;
    } else {
      tokens.push({ type: "comment", value: line.slice(0, endIdx + 2) });
      pos = endIdx + 2;
      multilineState.inComment = false;
    }
  }

  if (multilineState.inString) {
    const delimiter = multilineState.inString;
    const endIdx = line.indexOf(delimiter);
    if (endIdx === -1) {
      tokens.push({ type: "string", value: line });
      return tokens;
    } else {
      tokens.push({ type: "string", value: line.slice(0, endIdx + delimiter.length) });
      pos = endIdx + delimiter.length;
      multilineState.inString = null;
    }
  }

  while (pos < len) {
    const remaining = line.slice(pos);

    // Whitespace
    const wsMatch = remaining.match(/^\s+/);
    if (wsMatch) {
      tokens.push({ type: "text", value: wsMatch[0] });
      pos += wsMatch[0].length;
      continue;
    }

    // Python multiline string start (""" or ''')
    if ((lang === "python" || lang === "py") && (remaining.startsWith('"""') || remaining.startsWith("'''"))) {
      const delim = remaining.slice(0, 3);
      const closeIdx = remaining.indexOf(delim, 3);
      if (closeIdx !== -1) {
        const val = remaining.slice(0, closeIdx + 3);
        tokens.push({ type: "string", value: val });
        pos += val.length;
      } else {
        tokens.push({ type: "string", value: remaining });
        multilineState.inString = delim;
        pos = len;
      }
      continue;
    }

    // Multiline comment start (/* ... */)
    if (remaining.startsWith("/*")) {
      const closeIdx = remaining.indexOf("*/", 2);
      if (closeIdx !== -1) {
        const val = remaining.slice(0, closeIdx + 2);
        tokens.push({ type: "comment", value: val });
        pos += val.length;
      } else {
        tokens.push({ type: "comment", value: remaining });
        multilineState.inComment = true;
        pos = len;
      }
      continue;
    }

    // Single-line comments
    if (
      (lang === "python" || lang === "py" || lang === "bash" || lang === "sh" || lang === "shell" || lang === "yaml" || lang === "yml" || lang === "dockerfile") &&
      remaining.startsWith("#")
    ) {
      tokens.push({ type: "comment", value: remaining });
      pos = len;
      break;
    }
    if (remaining.startsWith("//")) {
      tokens.push({ type: "comment", value: remaining });
      pos = len;
      break;
    }
    if ((lang === "sql" || lang === "pgsql" || lang === "mysql") && remaining.startsWith("--")) {
      tokens.push({ type: "comment", value: remaining });
      pos = len;
      break;
    }

    // Regular Strings: "...", '...', `...`
    if (remaining[0] === '"' || remaining[0] === "'" || remaining[0] === "`") {
      const quote = remaining[0];
      let end = 1;
      let escaped = false;
      while (end < remaining.length) {
        if (escaped) {
          escaped = false;
        } else if (remaining[end] === "\\") {
          escaped = true;
        } else if (remaining[end] === quote) {
          end++;
          break;
        }
        end++;
      }
      const strVal = remaining.slice(0, end);
      const isJsonKey = (lang === "json" || lang === "jsonc") && /^\s*:/.test(remaining.slice(end));
      tokens.push({ type: isJsonKey ? "property" : "string", value: strVal });
      pos += end;
      continue;
    }

    // Numbers: hex, float, int
    const numMatch = remaining.match(/^(0x[0-9a-fA-F]+|\b\d+(\.\d+)?([eE][+-]?\d+)?\b)/);
    if (numMatch) {
      tokens.push({ type: "number", value: numMatch[0] });
      pos += numMatch[0].length;
      continue;
    }

    // Identifiers & words
    const wordMatch = remaining.match(/^[a-zA-Z_$][a-zA-Z0-9_$]*/);
    if (wordMatch) {
      const word = wordMatch[0];
      const afterWord = remaining.slice(word.length);

      if (isKeyword(word, lang)) {
        tokens.push({ type: "keyword", value: word });
      } else if (BOOLEANS_AND_CONSTANTS.has(word)) {
        tokens.push({ type: "boolean", value: word });
      } else if (BUILTIN_TYPES.has(word)) {
        tokens.push({ type: "type", value: word });
      } else if (/^\s*\(/.test(afterWord)) {
        tokens.push({ type: "function", value: word });
      } else if (/^[A-Z][a-zA-Z0-9_]*$/.test(word)) {
        tokens.push({ type: "type", value: word });
      } else {
        tokens.push({ type: "text", value: word });
      }

      pos += word.length;
      continue;
    }

    // HTML / JSX tags: </?[a-zA-Z0-9_]+
    if ((lang === "html" || lang === "jsx" || lang === "tsx" || lang === "xml") && remaining.startsWith("<")) {
      const tagMatch = remaining.match(/^<\/?([a-zA-Z0-9_-]+)/);
      if (tagMatch) {
        tokens.push({ type: "tag", value: tagMatch[0] });
        pos += tagMatch[0].length;
        continue;
      }
    }

    // Multi-char operators
    const opMatch = remaining.match(/^(===|!==|=>|<=|>=|==|!=|&&|\|\||\+\+|--|\+=|-=|\*=|\/=|%=|<<|>>)/);
    if (opMatch) {
      tokens.push({ type: "operator", value: opMatch[0] });
      pos += opMatch[0].length;
      continue;
    }

    // Single-char operators and punctuation
    const char = remaining[0];
    if ("=+-*/%&|^!<>?".includes(char)) {
      tokens.push({ type: "operator", value: char });
    } else if ("{}()[]:;,.".includes(char)) {
      tokens.push({ type: "punctuation", value: char });
    } else {
      tokens.push({ type: "text", value: char });
    }
    pos++;
  }

  return tokens;
}

function CodeBlock({ language, code }: { language: string; code: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy code:", err);
    }
  };

  const displayLang = (language || "code").toLowerCase();

  const lines = useMemo(() => {
    const rawLines = code.split(/\r?\n/);
    const multilineState: MultilineState = { inComment: false, inString: null };
    const lang = LANGUAGE_ALIASES[displayLang] ?? displayLang;
    return rawLines.map((line) => tokenizeLine(line, lang, multilineState));
  }, [code, displayLang]);

  return (
    <div className="relative my-3.5 rounded-xl overflow-hidden border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-[#0c0c0e] shadow-xs dark:shadow-md group/code">
      {/* Code Header Bar */}
      <div className="flex items-center justify-between px-3.5 py-1.5 bg-zinc-100 dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 text-xs select-none">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 opacity-60">
            <span className="h-2.5 w-2.5 rounded-full bg-red-500/80" />
            <span className="h-2.5 w-2.5 rounded-full bg-yellow-500/80" />
            <span className="h-2.5 w-2.5 rounded-full bg-green-500/80" />
          </div>
          <span className="font-mono text-[11px] font-medium tracking-wider uppercase text-zinc-500 dark:text-zinc-400 ml-1.5">
            {displayLang}
          </span>
        </div>
        <button
          type="button"
          onClick={handleCopy}
          className="flex items-center gap-1.5 py-1 px-2.5 rounded-md text-zinc-500 hover:bg-zinc-200 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-white/10 dark:hover:text-white transition-colors cursor-pointer text-[11px]"
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

      {/* Code Table with line numbers */}
      <div className="p-3.5 overflow-x-auto text-xs sm:text-[13px] font-mono leading-relaxed selection:bg-blue-200 dark:selection:bg-blue-600/40">
        <table className="w-full border-collapse">
          <tbody>
            {lines.map((lineTokens, lineIdx) => (
              <tr key={lineIdx} className="hover:bg-black/[0.03] dark:hover:bg-white/[0.02] transition-colors">
                <td className="text-right pr-4 text-zinc-400 dark:text-zinc-600 select-none text-[11px] align-top w-7 tabular-nums">
                  {lineIdx + 1}
                </td>
                <td className="whitespace-pre align-top text-zinc-800 dark:text-zinc-200">
                  {lineTokens.length === 0 ? (
                    " "
                  ) : (
                    lineTokens.map((token, tIdx) => (
                      <span key={tIdx} className={TOKEN_STYLES[token.type] || TOKEN_STYLES.text}>
                        {token.value}
                      </span>
                    ))
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function renderInline(text: string): React.ReactNode {
  if (!text) return null;

  const regex = /(`[^`]+`|\*\*\*[^*]+\*\*\*|\*\*[^*]+\*\*|\*[^*]+\*|~~[^~]+~~|\[[^\]]+\]\([^)]+\))/g;
  const parts = text.split(regex);

  return parts.map((part, index) => {
    if (!part) return null;

    // Inline code
    if (part.startsWith("`") && part.endsWith("`") && part.length >= 2) {
      return (
        <code
          key={index}
          className="font-mono text-[12px] bg-zinc-100 dark:bg-zinc-800 text-blue-600 dark:text-blue-400 px-1.5 py-0.5 rounded-md border border-zinc-200 dark:border-zinc-700/60 font-medium selection:bg-blue-500/20 shadow-2xs"
        >
          {part.slice(1, -1)}
        </code>
      );
    }

    // Bold + Italic
    if (part.startsWith("***") && part.endsWith("***") && part.length >= 6) {
      return (
        <strong key={index} className="font-semibold italic text-zinc-900 dark:text-white">
          {part.slice(3, -3)}
        </strong>
      );
    }

    // Bold
    if (part.startsWith("**") && part.endsWith("**") && part.length >= 4) {
      return (
        <strong key={index} className="font-semibold text-zinc-900 dark:text-white">
          {part.slice(2, -2)}
        </strong>
      );
    }

    // Italic
    if (part.startsWith("*") && part.endsWith("*") && part.length >= 2) {
      return (
        <em key={index} className="italic text-zinc-700 dark:text-zinc-200">
          {part.slice(1, -1)}
        </em>
      );
    }

    // Strikethrough
    if (part.startsWith("~~") && part.endsWith("~~") && part.length >= 4) {
      return (
        <del key={index} className="line-through text-zinc-500">
          {part.slice(2, -2)}
        </del>
      );
    }

    // Links [label](url)
    if (part.startsWith("[") && part.includes("](") && part.endsWith(")")) {
      const match = part.match(/^\[(.*?)\]\((.*?)\)$/);
      if (match) {
        return (
          <a
            key={index}
            href={match[2]}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 underline underline-offset-2 transition-colors font-medium"
          >
            {match[1]}
          </a>
        );
      }
    }

    return <span key={index}>{part}</span>;
  });
}

function parseTable(lines: string[], start: number): { tableNode: React.ReactNode; consumed: number } | null {
  const headerLine = lines[start].trim();
  const dividerLine = lines[start + 1]?.trim() || "";

  if (!headerLine.includes("|") || !dividerLine.includes("|")) return null;
  if (!/^\|?(\s*:?-+:?\s*\|)+\s*:?-+:?\s*\|?$/.test(dividerLine)) return null;

  const extractCells = (row: string) => {
    let clean = row.trim();
    if (clean.startsWith("|")) clean = clean.slice(1);
    if (clean.endsWith("|")) clean = clean.slice(0, -1);
    return clean.split("|").map(c => c.trim());
  };

  const headers = extractCells(headerLine);
  const rows: string[][] = [];
  let i = start + 2;

  while (i < lines.length) {
    const rowLine = lines[i].trim();
    if (!rowLine.includes("|")) break;
    rows.push(extractCells(rowLine));
    i++;
  }

  const consumed = i - start;

  const tableNode = (
    <div key={`table-${start}`} className="my-3 overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-white/[0.02]">
      <table className="w-full text-xs text-left border-collapse">
        <thead className="bg-zinc-100 dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-200 font-medium select-none">
          <tr>
            {headers.map((h, hIdx) => (
              <th key={hIdx} className="px-3.5 py-2">
                {renderInline(h)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800 text-zinc-800 dark:text-zinc-300">
          {rows.map((row, rIdx) => (
            <tr key={rIdx} className="hover:bg-zinc-100/60 dark:hover:bg-white/[0.02] transition-colors">
              {row.map((cell, cIdx) => (
                <td key={cIdx} className="px-3.5 py-2">
                  {renderInline(cell)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  return { tableNode, consumed };
}

function renderTextLines(text: string, blockKey: string | number) {
  const lines = text.split(/\r?\n/);
  const elements: React.ReactNode[] = [];
  let currentList: { type: "ul" | "ol"; items: React.ReactNode[] } | null = null;

  const flushList = () => {
    if (currentList) {
      if (currentList.type === "ul") {
        elements.push(
          <ul key={`ul-${elements.length}`} className="my-2.5 space-y-1.5 pl-1">
            {currentList.items.map((item, idx) => (
              <li key={idx} className="flex items-start gap-2.5 leading-relaxed text-[15px] text-zinc-800 dark:text-zinc-200">
                <span className="h-1.5 w-1.5 rounded-full bg-zinc-400 dark:bg-zinc-500 shrink-0 mt-2" />
                <span className="flex-1">{item}</span>
              </li>
            ))}
          </ul>
        );
      } else {
        elements.push(
          <ol key={`ol-${elements.length}`} className="my-2.5 space-y-1.5 pl-1">
            {currentList.items.map((item, idx) => (
              <li key={idx} className="flex items-start gap-2 leading-relaxed text-[15px] text-zinc-800 dark:text-zinc-200">
                <span className="font-mono text-xs text-zinc-500 dark:text-zinc-400 shrink-0 mt-0.5 select-none font-medium">
                  {idx + 1}.
                </span>
                <span className="flex-1">{item}</span>
              </li>
            ))}
          </ol>
        );
      }
      currentList = null;
    }
  };

  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    if (!trimmed) {
      flushList();
      i++;
      continue;
    }

    // Error callout
    if (trimmed.startsWith("**Error:**")) {
      flushList();
      elements.push(
        <div key={`err-${i}`} className="my-2.5 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-300 text-xs flex items-start gap-2">
          <AlertCircle className="h-4 w-4 text-red-500 dark:text-red-400 shrink-0 mt-0.5" />
          <div className="flex-1 leading-relaxed">
            {renderInline(trimmed.replace(/^\*\*Error:\*\*\s*/, ""))}
          </div>
        </div>
      );
      i++;
      continue;
    }

    // Markdown Table
    if (trimmed.includes("|") && i + 1 < lines.length) {
      const tableResult = parseTable(lines, i);
      if (tableResult) {
        flushList();
        elements.push(tableResult.tableNode);
        i += tableResult.consumed;
        continue;
      }
    }

    // Heading 1 (# ...)
    if (line.startsWith("# ")) {
      flushList();
      elements.push(
        <h1 key={`h1-${i}`} className="text-lg font-bold text-zinc-900 dark:text-white mt-4 mb-2 first:mt-0 tracking-tight">
          {renderInline(line.slice(2))}
        </h1>
      );
      i++;
      continue;
    }

    // Heading 2 (## ...)
    if (line.startsWith("## ")) {
      flushList();
      elements.push(
        <h2 key={`h2-${i}`} className="text-base font-semibold text-zinc-900 dark:text-white mt-3.5 mb-1.5 first:mt-0 tracking-tight">
          {renderInline(line.slice(3))}
        </h2>
      );
      i++;
      continue;
    }

    // Heading 3 (### ...)
    if (line.startsWith("### ")) {
      flushList();
      elements.push(
        <h3 key={`h3-${i}`} className="text-sm font-semibold text-zinc-800 dark:text-zinc-100 mt-3 mb-1 first:mt-0 tracking-tight">
          {renderInline(line.slice(4))}
        </h3>
      );
      i++;
      continue;
    }

    // Horizontal Rule
    if (/^(---|___|\*\*\*)$/.test(trimmed)) {
      flushList();
      elements.push(<hr key={`hr-${i}`} className="my-3.5 border-zinc-200 dark:border-zinc-800" />);
      i++;
      continue;
    }

    // Blockquote (> ...)
    if (line.startsWith("> ")) {
      flushList();
      elements.push(
        <blockquote
          key={`quote-${i}`}
          className="border-l-2 border-blue-500 bg-blue-50/50 dark:bg-blue-950/20 pl-3.5 py-1.5 my-2 rounded-r-md text-zinc-700 dark:text-zinc-300 italic text-[14px]"
        >
          {renderInline(line.slice(2))}
        </blockquote>
      );
      i++;
      continue;
    }

    // Bullet List (- or *)
    const bulletMatch = line.match(/^(\s*)([-*])\s+(.+)$/);
    if (bulletMatch) {
      if (!currentList || currentList.type !== "ul") {
        flushList();
        currentList = { type: "ul", items: [] };
      }
      currentList.items.push(renderInline(bulletMatch[3]));
      i++;
      continue;
    }

    // Numbered List (1. ...)
    const numberMatch = line.match(/^(\s*)\d+\.\s+(.+)$/);
    if (numberMatch) {
      if (!currentList || currentList.type !== "ol") {
        flushList();
        currentList = { type: "ol", items: [] };
      }
      currentList.items.push(renderInline(numberMatch[2]));
      i++;
      continue;
    }

    // Normal paragraph
    flushList();
    elements.push(
      <p key={`p-${i}`} className="my-1.5 leading-relaxed text-[15px] text-zinc-800 dark:text-zinc-200">
        {renderInline(line)}
      </p>
    );
    i++;
  }

  flushList();

  return <div key={blockKey} className="space-y-0.5">{elements}</div>;
}

type ContentBlock =
  | { type: "code"; language: string; code: string }
  | { type: "text"; text: string };

function splitContent(raw: string): ContentBlock[] {
  const blocks: ContentBlock[] = [];
  const regex = /```([a-zA-Z0-9_-]*)\r?\n?([\s\S]*?)(?:```|$)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(raw)) !== null) {
    if (match.index === regex.lastIndex && match[0].length === 0) {
      regex.lastIndex++;
      continue;
    }

    const textBefore = raw.slice(lastIndex, match.index);
    if (textBefore) {
      blocks.push({ type: "text", text: textBefore });
    }

    const language = (match[1] || "").trim();
    let code = match[2] || "";
    if (code.endsWith("\n")) {
      code = code.slice(0, -1);
    }

    blocks.push({
      type: "code",
      language,
      code,
    });

    lastIndex = match.index + match[0].length;
  }

  const remaining = raw.slice(lastIndex);
  if (remaining) {
    blocks.push({ type: "text", text: remaining });
  }

  return blocks;
}

export function FormattedMessage({ content, isStreaming }: FormattedMessageProps) {
  if (!content) return null;

  const blocks = splitContent(content);

  return (
    <div className="formatted-message space-y-1">
      {blocks.map((block, index) => {
        if (block.type === "code") {
          return (
            <CodeBlock
              key={`code-${index}`}
              language={block.language}
              code={block.code}
            />
          );
        }
        return renderTextLines(block.text, `text-${index}`);
      })}

      {/* Subtle cursor indicator while streaming */}
      {isStreaming && (
        <span className="inline-block w-1.5 h-3.5 ml-1 align-baseline bg-blue-400/90 rounded-xs animate-pulse" />
      )}
    </div>
  );
}
