# Working Style

When I say "let's discuss," stay conversational — don't produce a plan or code until I say "go ahead."

## Think Before Coding

Don't assume. Don't hide confusion. Surface tradeoffs.

Before implementing:

- State your assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them. Don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.

## Simplicity First

Minimum code that solves the problem. Nothing speculative.

- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- If you write 200 lines and it could be 50, rewrite it.
- Ask yourself: "Would a senior engineer say this is overcomplicated?" If yes, simplify.

# Conventions

## Dependency alias naming

`Annotated[...]` aliases are named for what they inject. Append `Dep` only when
the bare name would shadow the class being injected.

- `CurrentUser`, `DbSession` — nothing shadowed, no suffix.
- `ChatDep`, `ModelDep`, `RedisDep` — `Chat`, `Model` and `Redis` are real
  symbols in scope, so the alias needs the suffix.

This looks inconsistent at a glance; it isn't. Don't unify it.

## Docstrings and comments

A docstring is for the caller reading only the signature. Write one only when
it says something the name, signature and types don't: an unusual arg, what
None means, units, a side effect, a precondition, a failure mode. No docstring
means nothing surprising; never add one for consistency.

- One line, imperative mood ("Return…"), ending with a period. Add a paragraph
  after a blank line only when needed.
- Never restate the signature, like "Return every model." on `models()`.
- One unusual arg: name it in the sentence. Two or more: an `Args:` block
  listing only the unusual ones.
- No `Raises:` sections; mention an exception only when callers must handle it.
- Why a line is written that way goes in a `#` comment next to that line.
- No noisy comments. A comment says why; it never restates what the code
  below it does.
- Route handlers: `summary=`/`description=` in the decorator, not a docstring.
- API model fields: `Field(description=...)`. ORM columns: a `#` comment.
