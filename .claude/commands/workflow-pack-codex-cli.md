---
name: codex-workflow-pack
description: |
  Codex CLI workflow patterns for coding tasks, bug fixes, feature implementation, and technical work. Triggers on development requests and enforces plan-first development, autonomous bug fixing, self-correcting behavior, parallel task execution, and learning-focused explanations. Use this skill for day-to-day software engineering work in OpenAI Codex CLI.
---

# Codex CLI Workflow Pack (Combined)

Equivalent workflow pack adapted for OpenAI Codex CLI while preserving the same operational intent and outcomes.

## Core Behaviors

### 1. Plan Before Implementation

For any task involving 2+ files or architectural decisions:

1. Start with a concrete plan before writing code
2. Outline the approach, files to modify, and potential risks
3. Get explicit approval or refine until the plan is solid
4. Execute the plan - aim for 1-shot implementation

**When things go sideways**: Stop. Re-plan from current state. Don't push through a broken approach.

**For verification steps**: Design the verification strategy before implementation, not just the build.

### 2. Autonomous Bug Fixing

When given a bug report, error log, or failing CI:

1. Investigate autonomously - read logs, trace the error, check recent changes
2. Form a hypothesis
3. Implement the fix
4. Verify the fix works
5. Only ask clarifying questions if truly blocked

Acceptable inputs for autonomous fixing:
- "fix" + Slack thread / GitHub issue / error log
- "Go fix the failing CI tests"
- Docker logs for distributed system debugging

Do NOT ask "what would you like me to do?" - investigate and fix.

### 3. Self-Correction Protocol

After any correction from the user:

1. Acknowledge the mistake
2. Fix the immediate issue
3. Ask: "Should I update AGENTS.md so I don't make this mistake again?"
4. If yes, append a clear rule to prevent recurrence

Good `AGENTS.md` rules are:
- Specific and actionable
- Reference the exact mistake pattern
- Include the correct approach

### 4. Parallel Task Delegation

Use parallelized execution patterns when:
- Task has 3+ independent subtasks
- User asks to use more compute in parallel
- Main context is getting cluttered with implementation details

Parallel patterns:
- **Parallel execution**: Run independent exploration or validation tasks concurrently
- **Context isolation**: Keep each investigation focused and summarize back into one thread
- **Specialist routing**: Split testing, docs, and refactoring streams while preserving a clear integration point

### 5. Explanatory Mode

When modifying unfamiliar code or when user is learning:

- Explain the *why* behind changes, not just the *what*
- Draw ASCII diagrams for complex architectures or data flows
- Offer to generate HTML presentations for deep dives
- Connect changes to broader patterns and principles

## Task-Specific Workflows

### Feature Implementation

```text
1. [PLAN] Understand requirements, identify files, outline approach
2. [APPROVE] Get user sign-off on plan
3. [IMPLEMENT] Write the code
4. [VERIFY] Run tests, check for regressions
5. [CLEANUP] Remove dead code, ensure consistency
```

### Bug Fix

```text
1. [INVESTIGATE] Read error, trace cause, check logs
2. [HYPOTHESIZE] Form theory about root cause
3. [FIX] Implement minimal fix
4. [VERIFY] Confirm fix works, no new issues
5. [PREVENT] Consider if AGENTS.md rule is needed
```

### Code Review / PR Prep

```text
1. [DIFF] Review all changes against main
2. [CHALLENGE] "Grill me on these changes" - identify weak points
3. [HARDEN] Address concerns
4. [PROVE] "Prove to me this works" - diff behavior between branches
```

### End-of-Session Cleanup

```text
1. [TECHDEBT] Scan for duplicated code, inconsistent patterns
2. [NOTES] Update project notes with session learnings
3. [AGENTS.md] Append any new rules from corrections
```

## Prompting Patterns Reference

Use challenge and refinement patterns as part of reviews and iteration:
- "Grill me"
- "Prove to me"
- "Knowing everything you know now..."

## Embedded Command Equivalent: Commit Style

# Conventional Commit Style

## Format

```text
<type>(<scope>): <short description>

<optional body>

Co-Authored-By: OpenAI Codex <noreply@openai.com>
```

## Types

- `feat` - New feature or capability
- `fix` - Bug fix
- `refactor` - Code change that neither fixes a bug nor adds a feature
- `docs` - Documentation only
- `chore` - Build process, dependencies, tooling
- `test` - Adding or updating tests
- `style` - Formatting, CSS changes (no logic change)

## Scopes (for this project)

- `setup` - Project initialization, dependencies, config
- `db` - Database schema, migrations
- `ingestion` - PPTX extraction, embedding, Postgres loading
- `api` - Express server, routes, retrieval, generation
- `ui` - React components, CSS, frontend
- `docs` - README, documentation

## Rules

1. Subject line: imperative mood, lowercase, no period, max 72 chars
2. Body: explain WHY, not WHAT (the diff shows what)
3. One logical change per commit - don't bundle unrelated changes
4. Always include `Co-Authored-By` trailer

## Examples

```text
feat(ingestion): add PPTX extraction with correct slide ordering

Uses presentation.xml slide ID list to determine visual order
instead of relationship XML order which can be shuffled.

Co-Authored-By: OpenAI Codex <noreply@openai.com>
```

```text
fix(api): strip markdown code fences from model JSON responses

The model can wrap JSON in ```json fences, causing parse
failures. Now strips fences before parsing.

Co-Authored-By: OpenAI Codex <noreply@openai.com>
```

```text
feat(ui): add inline expandable citations showing slide content

Co-Authored-By: OpenAI Codex <noreply@openai.com>
```

## Embedded Command Equivalent: Commit Strategy

# Commit Strategy

## When to Commit

Commit **immediately** after any of these events:

1. **After a phase gate passes** - Every time a test suite (`test_phase1.js`, `test_phase2.js`, etc.) passes, commit all work from that phase before starting the next one.
2. **After a meaningful unit of work** - If a phase has distinct, independently valuable steps (for example schema creation, extraction script, ingestion script), commit after each one works.
3. **After a bug fix** - When you fix an issue (for example code fence stripping in JSON parser, slide ordering fix), commit the fix with a clear message explaining what was broken and why.
4. **After adding a new feature** - When you add new functionality (for example clickable citations), commit once it's verified working.
5. **Before starting risky changes** - If you're about to refactor or make a significant change, commit the current working state first so you can roll back.

## When NOT to Commit

- Do not commit broken or half-finished code
- Do not commit if tests are failing
- Do not commit `.env` files or secrets

## Commit Cadence Rule

**Minimum: 1 commit per completed phase or sub-task. Maximum gap: 30 minutes of working code without a commit.**

## Push Rule

**Always push to the remote upstream branch immediately after committing.** If a remote tracking branch exists (check with `git remote -v`), push after every commit. Do not accumulate local-only commits.

## Execution

When it's time to commit, apply the Conventional Commit Style section above to format the message. After committing, push to upstream.
