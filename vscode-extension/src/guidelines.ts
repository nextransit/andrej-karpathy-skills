const GUIDELINES_BODY = `Behavioral guidelines to reduce common LLM coding mistakes.

**Tradeoff:** These guidelines bias toward caution over speed. For trivial tasks, use judgment.

## 1. Think Before Coding

**Don't assume. Don't hide confusion. Surface tradeoffs.**

Before implementing:
- State your assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them - don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.

## 2. Simplicity First

**Minimum code that solves the problem. Nothing speculative.**

- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- If you write 200 lines and it could be 50, rewrite it.

Ask yourself: "Would a senior engineer say this is overcomplicated?" If yes, simplify.

## 3. Surgical Changes

**Touch only what you must. Clean up only your own mess.**

When editing existing code:
- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently.
- If you notice unrelated dead code, mention it - don't delete it.

When your changes create orphans:
- Remove imports/variables/functions that YOUR changes made unused.
- Don't remove pre-existing dead code unless asked.

The test: Every changed line should trace directly to the user's request.

## 4. Goal-Driven Execution

**Define success criteria. Loop until verified.**

Transform tasks into verifiable goals:
- "Add validation" -> "Write tests for invalid inputs, then make them pass"
- "Fix the bug" -> "Write a test that reproduces it, then make it pass"
- "Refactor X" -> "Ensure tests pass before and after"

For multi-step tasks, state a brief plan:
\`\`\`
1. [Step] -> verify: [check]
2. [Step] -> verify: [check]
3. [Step] -> verify: [check]
\`\`\`

Strong success criteria let you loop independently. Weak criteria ("make it work") require constant clarification.

---

**These guidelines work if:** fewer unnecessary changes in diffs, fewer rewrites due to overcomplication, and clarifying questions come before implementation rather than after mistakes.
`;

export const GUIDELINES_CONTENT = `# Karpathy Behavioral Guidelines

${GUIDELINES_BODY}`;

export const QUICK_REFERENCE = `## Karpathy Guidelines - Quick Ref

| # | Principle | Key Action |
|---|-----------|------------|
| 1 | Think Before Coding | State assumptions, ask if unclear |
| 2 | Simplicity First | Minimize code, no speculative features |
| 3 | Surgical Changes | Only touch what you must |
| 4 | Goal-Driven | Define success criteria, verify each step |
`;

export function buildAgentsContent(): string {
  return `# Karpathy Behavioral Guidelines

Shared source of truth for AI coding agents used in this repository.

${GUIDELINES_BODY}
`;
}

export function buildClaudeContent(): string {
  return `# Claude Code Project Memory

Load the shared repository instructions from \`AGENTS.md\`.

@AGENTS.md

## Claude Code Notes

- Treat \`AGENTS.md\` as the canonical project guidance.
- Update \`AGENTS.md\` first when the team changes agent behavior.
`;
}

export function buildGeminiContent(): string {
  return `# Gemini CLI Project Context

Load the shared repository instructions from \`AGENTS.md\`.

@AGENTS.md

## Gemini Notes

- Use \`AGENTS.md\` as the canonical project guidance.
- Keep Gemini-specific notes here only when they do not apply to other tools.
`;
}

export function buildGeminiSettingsContent(): string {
  return `{
  "contextFileName": [
    "AGENTS.md",
    "GEMINI.md"
  ]
}
`;
}

export function buildCursorRuleContent(): string {
  return `---
description: Karpathy behavioral guidelines for AI coding work
alwaysApply: true
---

# Karpathy Guidelines

Prefer the shared \`AGENTS.md\` guidance when there is overlap.

${GUIDELINES_BODY}
`;
}

export function buildWindsurfRuleContent(): string {
  return `---
name: karpathy-guidelines
description: Karpathy behavioral guidelines for AI coding work
alwaysApply: true
---

# Karpathy Guidelines

Prefer the shared \`AGENTS.md\` guidance when there is overlap.

${GUIDELINES_BODY}
`;
}

export function buildCopilotInstructionsContent(): string {
  return `# Karpathy Guidelines for GitHub Copilot

Repository-wide instructions for Copilot. Keep these aligned with \`AGENTS.md\`.

## Operating Rules

1. Think before coding. State assumptions and ask if the task is ambiguous.
2. Prefer the simplest implementation that satisfies the request.
3. Make surgical changes. Do not refactor unrelated code.
4. Work toward verifiable success criteria and check them before stopping.

## Full Guidance

${GUIDELINES_BODY}
`;
}

export function buildCopilotPathInstructionsContent(): string {
  return `---
applyTo: "**"
---

# Karpathy Guidelines

Use \`AGENTS.md\` as the shared source of truth when reasoning about project behavior.

## Short Form

- State assumptions and ask questions when context is missing.
- Keep implementations simple and avoid speculative abstractions.
- Limit edits to the requested scope.
- Verify outcomes against explicit success criteria.
`;
}

export function buildClineRuleContent(): string {
  return `# Karpathy Guidelines for Cline

${GUIDELINES_BODY}
`;
}

export function buildContinueRuleContent(): string {
  return `---
name: karpathy-guidelines
description: Apply Karpathy behavioral guidelines before changing code
alwaysApply: true
---

# Karpathy Guidelines

${GUIDELINES_BODY}
`;
}

export function buildAiderConfigContent(): string {
  return `# Load shared repository guidance on every aider session.
read:
  - AGENTS.md
`;
}

export function buildOpenCodeContent(): string {
  return `# Karpathy Guidelines for OpenCode

Load the shared repository instructions from \`AGENTS.md\`.

@AGENTS.md

## OpenCode Notes

- Treat \`AGENTS.md\` as the canonical project guidance.
- OpenCode will automatically load AGENTS.md when present in the project root.
`;
}

export function buildCopilotCliInstructionsContent(): string {
  return `# Karpathy Guidelines for GitHub Copilot CLI

Repository-wide instructions for \`gh copilot\` CLI sessions.

## Operating Rules

1. Think before coding. State assumptions and ask if the task is ambiguous.
2. Prefer the simplest implementation that satisfies the request.
3. Make surgical changes. Do not refactor unrelated code.
4. Work toward verifiable success criteria and check them before stopping.

## Full Guidance

${GUIDELINES_BODY}
`;
}
