# Commit Strategy

## When to Commit

Commit **immediately** after any of these events:

1. **After a phase gate passes** — Every time a test suite (test_phase1.js, test_phase2.js, etc.) passes, commit all work from that phase before starting the next one.

2. **After a meaningful unit of work** — If a phase has distinct, independently valuable steps (e.g., schema creation, extraction script, ingestion script), commit after each one works.

3. **After a bug fix** — When you fix an issue (e.g., code fence stripping in JSON parser, slide ordering fix), commit the fix with a clear message explaining what was broken and why.

4. **After adding a new feature** — When you add new functionality (e.g., clickable citations), commit once it's verified working.

5. **Before starting risky changes** — If you're about to refactor or make a significant change, commit the current working state first so you can roll back.

## When NOT to Commit

- Do not commit broken or half-finished code
- Do not commit if tests are failing
- Do not commit .env files or secrets

## Commit Cadence Rule

**Minimum: 1 commit per completed phase or sub-task. Maximum gap: 30 minutes of working code without a commit.**

## Push Rule

**Always push to the remote upstream branch immediately after committing.** If a remote tracking branch exists (check with `git remote -v`), push after every commit. Do not accumulate local-only commits.

## Execution

When it's time to commit, use the `/commit-style` skill to format the commit message properly. After committing, push to upstream.
