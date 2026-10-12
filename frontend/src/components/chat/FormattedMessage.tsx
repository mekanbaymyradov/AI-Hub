import { useState, useMemo, type ReactElement } from "react";
import Markdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import { Copy, Check } from "lucide-react";

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
  javascript: JAVASCRIPT_KEYWORDS,
  jsx: JAVASCRIPT_KEYWORDS,
  typescript: TYPESCRIPT_KEYWORDS,
  tsx: TYPESCRIPT_KEYWORDS,
  sql: new Set([
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

// Fence labels that name the same language. JSX and TSX stay apart, since only they have tags.
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
    if (lang === "python" && (remaining.startsWith('"""') || remaining.startsWith("'''"))) {
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
      (lang === "python" || lang === "bash" || lang === "yaml" || lang === "dockerfile") &&
      remaining.startsWith("#")
    ) {
      tokens.push({ type: "comment", value: remaining });
      break;
    }
    if (remaining.startsWith("//")) {
      tokens.push({ type: "comment", value: remaining });
      break;
    }
    if (lang === "sql" && remaining.startsWith("--")) {
      tokens.push({ type: "comment", value: remaining });
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
      const isJsonKey = lang === "json" && /^\s*:/.test(remaining.slice(end));
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

const SUBHEADING = "text-sm font-semibold text-zinc-800 dark:text-zinc-100 mt-3 mb-1 first:mt-0 tracking-tight";

const components: Components = {
  h1: ({ children }) => (
    <h1 className="text-lg font-bold text-zinc-900 dark:text-white mt-4 mb-2 first:mt-0 tracking-tight">{children}</h1>
  ),
  h2: ({ children }) => (
    <h2 className="text-base font-semibold text-zinc-900 dark:text-white mt-3.5 mb-1.5 first:mt-0 tracking-tight">{children}</h2>
  ),
  h3: ({ children }) => <h3 className={SUBHEADING}>{children}</h3>,
  h4: ({ children }) => <h4 className={SUBHEADING}>{children}</h4>,
  p: ({ children }) => <p className="my-1.5">{children}</p>,
  strong: ({ children }) => <strong className="font-semibold text-zinc-900 dark:text-white">{children}</strong>,
  em: ({ children }) => <em className="italic text-zinc-700 dark:text-zinc-200">{children}</em>,
  del: ({ children }) => <del className="line-through text-zinc-500">{children}</del>,
  a: ({ href, children }) => (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 underline underline-offset-2 transition-colors font-medium"
    >
      {children}
    </a>
  ),
  ul: ({ children }) => (
    <ul className="my-2.5 space-y-1.5 pl-5 list-disc marker:text-zinc-400 dark:marker:text-zinc-500">{children}</ul>
  ),
  ol: ({ start, children }) => (
    <ol
      start={start}
      className="my-2.5 space-y-1.5 pl-6 list-decimal marker:font-mono marker:text-xs marker:font-medium marker:text-zinc-500 dark:marker:text-zinc-400"
    >
      {children}
    </ol>
  ),
  li: ({ children }) => <li className="pl-1">{children}</li>,
  blockquote: ({ children }) => (
    <blockquote className="border-l-2 border-blue-500 bg-blue-50/50 dark:bg-blue-950/20 pl-3.5 py-0.5 my-2 rounded-r-md text-zinc-700 dark:text-zinc-300 italic text-[14px]">
      {children}
    </blockquote>
  ),
  hr: () => <hr className="my-3.5 border-zinc-200 dark:border-zinc-800" />,
  table: ({ children }) => (
    <div className="my-3 overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-white/[0.02]">
      <table className="w-full text-xs text-left border-collapse">{children}</table>
    </div>
  ),
  thead: ({ children }) => (
    <thead className="bg-zinc-100 dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-200 font-medium select-none">
      {children}
    </thead>
  ),
  tbody: ({ children }) => (
    <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800 text-zinc-800 dark:text-zinc-300">{children}</tbody>
  ),
  tr: ({ children }) => <tr className="hover:bg-zinc-100/60 dark:hover:bg-white/[0.02] transition-colors">{children}</tr>,
  // style carries the column's alignment from the table's divider row.
  th: ({ style, children }) => <th style={style} className="px-3.5 py-2">{children}</th>,
  td: ({ style, children }) => <td style={style} className="px-3.5 py-2">{children}</td>,
  // Fenced code arrives as <pre><code class="language-…">; inline code has no <pre>.
  pre: ({ children }) => {
    const { className = "", children: code = "" } = (
      children as ReactElement<{ className?: string; children?: string }>
    ).props;
    return <CodeBlock language={className.replace("language-", "")} code={code.replace(/\n$/, "")} />;
  },
  code: ({ children }) => (
    <code className="font-mono text-[12px] bg-zinc-100 dark:bg-zinc-800 text-blue-600 dark:text-blue-400 px-1.5 py-0.5 rounded-md border border-zinc-200 dark:border-zinc-700/60 font-medium selection:bg-blue-500/20 shadow-2xs">
      {children}
    </code>
  ),
};

export function FormattedMessage({ content, isStreaming }: FormattedMessageProps) {
  return (
    <div>
      <Markdown remarkPlugins={[remarkGfm]} components={components}>
        {content}
      </Markdown>
      {isStreaming && (
        <span className="inline-block w-1.5 h-3.5 ml-1 align-baseline bg-blue-400/90 rounded-xs animate-pulse" />
      )}
    </div>
  );
}
