# Conventional Commit Style

## Format

```
<type>(<scope>): <short description>

<optional body>

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>
```

## Types

- `feat` — New feature or capability
- `fix` — Bug fix
- `refactor` — Code change that neither fixes a bug nor adds a feature
- `docs` — Documentation only
- `chore` — Build process, dependencies, tooling
- `test` — Adding or updating tests
- `style` — Formatting, CSS changes (no logic change)

## Scopes (for this project)

- `setup` — Project initialization, dependencies, config
- `db` — Database schema, migrations
- `ingestion` — PPTX extraction, embedding, Postgres loading
- `api` — Express server, routes, retrieval, generation
- `ui` — React components, CSS, frontend
- `docs` — README, documentation

## Rules

1. Subject line: imperative mood, lowercase, no period, max 72 chars
2. Body: explain WHY, not WHAT (the diff shows what)
3. One logical change per commit — don't bundle unrelated changes
4. Always include `Co-Authored-By` trailer

## Examples

```
feat(ingestion): add PPTX extraction with correct slide ordering

Uses presentation.xml slide ID list to determine visual order
instead of relationship XML order which can be shuffled.

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>
```

```
fix(api): strip markdown code fences from Claude JSON responses

Claude sometimes wraps JSON in ```json fences, causing parse
failures. Now strips fences before parsing.

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>
```

```
feat(ui): add inline expandable citations showing slide content

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>
```
