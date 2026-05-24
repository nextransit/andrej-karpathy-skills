// Guidelines content - The four Karpathy principles
export const GUIDELINES_CONTENT = `# Karpathy Behavioral Guidelines

Behavioral guidelines to reduce common LLM coding mistakes.

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
- "Add validation" → "Write tests for invalid inputs, then make them pass"
- "Fix the bug" → "Write a test that reproduces it, then make it pass"
- "Refactor X" → "Ensure tests pass before and after"

For multi-step tasks, state a brief plan:
\`\`\`
1. [Step] → verify: [check]
2. [Step] → verify: [check]
3. [Step] → verify: [check]
\`\`\`

Strong success criteria let you loop independently. Weak criteria ("make it work") require constant clarification.

---

**These guidelines work if:** fewer unnecessary changes in diffs, fewer rewrites due to overcomplication, and clarifying questions come before implementation rather than after mistakes.
`;

export const QUICK_REFERENCE = `## Karpathy Guidelines - Quick Ref

| # | Principle | Key Action |
|---|-----------|------------|
| 1 | Think Before Coding | State assumptions, ask if unclear |
| 2 | Simplicity First | Minimize code, no speculative features |
| 3 | Surgical Changes | Only touch what you must |
| 4 | Goal-Driven | Define success criteria, verify each step |
`;

export const CONFIG_TEMPLATES = {
  cursor: `---
description: Behavioral guidelines to reduce common LLM coding mistakes. Use when writing, reviewing, or refactoring code.
alwaysApply: true
---

# Karpathy Guidelines

(Same content as CLAUDE.md - see project root)
`,

  windsurf: `---
name: karpathy-guidelines
description: Behavioral guidelines to reduce common LLM coding mistakes
alwaysApply: true
---

# Karpathy Guidelines

(Same content as CLAUDE.md - see project root)
`,

  cline: `---
name: karpathy-guidelines
description: Behavioral guidelines to reduce common LLM coding mistakes
alwaysApply: true
---

# Karpathy Guidelines

(Same content as CLAUDE.md - see project root)
`,

  continue: `# Place this in .continue/checks/karpathy-guidelines.md

---
name: karpathy-guidelines
description: Behavioral guidelines check
---

# Karpathy Guidelines Check

Verify code changes follow the four principles.
`,

  copilot: `# Karpathy Guidelines for Copilot

When assisting with code, follow these principles:

1. **Think Before Coding** - State assumptions, ask for clarification
2. **Simplicity First** - Minimum code that solves the problem
3. **Surgical Changes** - Only touch what you must
4. **Goal-Driven** - Define and verify success criteria
`
};
