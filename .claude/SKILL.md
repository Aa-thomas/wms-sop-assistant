---
name: cc-workflow-pack
description: |
  Claude Code workflow patterns from the Anthropic team. Triggers on any coding task, bug fix, feature implementation, or technical work. Enforces plan-first development, autonomous bug fixing, self-correcting behavior, subagent delegation, and learning-focused explanations. Use this skill for all development work to apply battle-tested patterns from the Claude Code creators.
---

# Claude Code Workflow Pack

Patterns from the Claude Code team for high-quality, autonomous development work.

## Core Behaviors

### 1. Plan Before Implementation

For any task involving 2+ files or architectural decisions:

1. Enter plan mode before writing code
2. Outline the approach, files to modify, and potential risks
3. Get explicit approval or refine until the plan is solid
4. Execute the plan — aim for 1-shot implementation

**When things go sideways**: Stop. Return to plan mode. Re-plan from current state. Don't push through a broken approach.

**For verification steps**: Use plan mode to design the verification strategy, not just the build.

### 2. Autonomous Bug Fixing

When given a bug report, error log, or failing CI:

1. Investigate autonomously — read logs, trace the error, check recent changes
2. Form a hypothesis
3. Implement the fix
4. Verify the fix works
5. Only ask clarifying questions if truly blocked

Acceptable inputs for autonomous fixing:
- "fix" + Slack thread / GitHub issue / error log
- "Go fix the failing CI tests"
- Docker logs for distributed system debugging

Do NOT ask "what would you like me to do?" — investigate and fix.

### 3. Self-Correction Protocol

After any correction from the user:

1. Acknowledge the mistake
2. Fix the immediate issue
3. Ask: "Should I update CLAUDE.md so I don't make this mistake again?"
4. If yes, append a clear rule to prevent recurrence

Good CLAUDE.md rules are:
- Specific and actionable
- Reference the exact mistake pattern
- Include the correct approach

### 4. Subagent Delegation

Use subagents when:
- Task has 3+ independent subtasks
- User says "use subagents" or "throw more compute at this"
- Main context is getting cluttered with implementation details

Subagent patterns:
- **Parallel execution**: Spawn subagents for independent tasks
- **Context isolation**: Offload detail-heavy work to keep main context clean
- **Specialist delegation**: Route specific domains (tests, docs, refactoring) to focused subagents

### 5. Explanatory Mode

When modifying unfamiliar code or when user is learning:

- Explain the *why* behind changes, not just the *what*
- Draw ASCII diagrams for complex architectures or data flows
- Offer to generate HTML presentations for deep-dives
- Connect changes to broader patterns and principles

## Task-Specific Workflows

### Feature Implementation

```
1. [PLAN] Understand requirements, identify files, outline approach
2. [APPROVE] Get user sign-off on plan
3. [IMPLEMENT] Write the code
4. [VERIFY] Run tests, check for regressions
5. [CLEANUP] Remove dead code, ensure consistency
```

### Bug Fix

```
1. [INVESTIGATE] Read error, trace cause, check logs
2. [HYPOTHESIZE] Form theory about root cause
3. [FIX] Implement minimal fix
4. [VERIFY] Confirm fix works, no new issues
5. [PREVENT] Consider if CLAUDE.md rule needed
```

### Code Review / PR Prep

```
1. [DIFF] Review all changes against main
2. [CHALLENGE] "Grill me on these changes" — identify weak points
3. [HARDEN] Address concerns
4. [PROVE] "Prove to me this works" — diff behavior between branches
```

### End-of-Session Cleanup

```
1. [TECHDEBT] Scan for duplicated code, inconsistent patterns
2. [NOTES] Update project notes with session learnings  
3. [CLAUDE.md] Append any new rules from corrections
```

## Prompting Patterns Reference

See `references/prompting-patterns.md` for advanced prompting techniques including:
- Challenge patterns ("Grill me", "Prove to me")
- Refinement patterns ("Knowing everything you know now...")
- Spec-driven development

## Slash Commands

See `commands/` for installable slash commands:
- `/techdebt` — End-of-session code quality scan
- `/plan` — Force plan mode for current task
- `/learnings` — Generate session learnings summary
