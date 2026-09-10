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
