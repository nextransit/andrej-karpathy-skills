// Guidelines content with i18n support

import { Language } from './i18n';

const GUIDELINES_BODY_EN = `Behavioral guidelines to reduce common LLM coding mistakes.

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

const GUIDELINES_BODY_ZH = `减少常见 LLM 编码错误的行为准则。

**权衡：** 这些准则偏向于谨慎而非速度。对于简单任务，请自行判断。

## 1. 编码前先思考

**不要假设。不要隐藏困惑。要暴露权衡。**

实现前：
- 明确陈述你的假设。如果不确定，就问。
- 如果存在多种解释，将其呈现出来——不要默默选择。
- 如果存在更简单的方法，就说出来。在合理时提出异议。
- 如果有不清楚的地方，停下来。说出什么让你困惑，然后问。

## 2. 简洁优先

**用最少的代码解决问题。不做假设性工作。**

- 不添加需求之外的功能。
- 不为一次性使用的代码创建抽象。
- 不添加未请求的"灵活性"或"可配置性"。
- 不为不可能发生的场景添加错误处理。
- 如果你能写 50 行就别写 200 行，请重写。

问自己："一位高级工程师会说这过于复杂吗？"如果是，请简化。

## 3. 精准修改

**只触碰必须修改的地方。只清理自己造成的混乱。**

编辑现有代码时：
- 不要"改进"相邻的代码、注释或格式。
- 不要重构没有损坏的东西。
- 匹配现有风格，即使你会有不同的做法。
- 如果注意到无关的死代码，提出来——不要删除它。

当你的修改产生了孤立代码时：
- 删除因你的修改而不再使用的导入/变量/函数。
- 不要删除预先存在的死代码，除非被要求。

检验标准：每一行修改都应该能追溯到用户的请求。

## 4. 目标驱动执行

**定义成功标准。循环验证直到完成。**

将任务转化为可验证的目标：
- "添加验证" → "为无效输入编写测试，然后让测试通过"
- "修复 bug" → "编写能复现问题的测试，然后让测试通过"
- "重构 X" → "确保重构前后测试都通过"

对于多步骤任务，简要说明计划：
\`\`\`
1. [步骤] → 验证：[检查项]
2. [步骤] → 验证：[检查项]
3. [步骤] → 验证：[检查项]
\`\`\`

明确的成功标准让你能独立循环验证。模糊的标准（"让它能工作"）需要不断澄清。

---

**这些准则生效的标志：** diff 中不必要的变更减少，由于过度复杂导致的返工减少，以及澄清问题出现在实现之前而非之后。
`;

const LANGUAGE_RULES_EN = `## Language Rules

- **Always respond in English**, unless the user explicitly requests another language.`;

const LANGUAGE_RULES_ZH = `## 语言规则

- **始终使用中文回复**，除非用户明确要求使用其他语言。`;

export function getGuidelinesBody(lang: Language): string {
  return lang === 'zh-CN' ? GUIDELINES_BODY_ZH : GUIDELINES_BODY_EN;
}

export function getLanguageRules(lang: Language): string {
  return lang === 'zh-CN' ? LANGUAGE_RULES_ZH : LANGUAGE_RULES_EN;
}

export function buildGuidelinesContent(lang: Language, includeLanguageRules: boolean = false): string {
  const body = getGuidelinesBody(lang);
  const langRules = includeLanguageRules ? '\n\n' + getLanguageRules(lang) : '';
  return `# Karpathy Behavioral Guidelines

${body}${langRules}`;
}

export const GUIDELINES_CONTENT = buildGuidelinesContent('en', true);

export function buildAgentsContent(lang: Language): string {
  const body = getGuidelinesBody(lang);
  const header = lang === 'zh-CN'
    ? `# Karpathy 行为准则

AI 编码代理使用的共享事实来源。

## 语言规则

- **始终使用中文回复**，除非用户明确要求使用其他语言。
`
    : `# Karpathy Behavioral Guidelines

Shared source of truth for AI coding agents used in this repository.
`;
  return header + body;
}

export function buildClaudeContent(lang: Language): string {
  // CLAUDE.md contains the full guidelines (same as AGENTS.md)
  return buildAgentsContent(lang);
}

export function buildGeminiContent(lang: Language): string {
  if (lang === 'zh-CN') {
    return `# Gemini CLI 项目上下文

从 \`AGENTS.md\` 加载共享的仓库指令。

@AGENTS.md

## Gemini 注意事项

- 使用 \`AGENTS.md\` 作为规范的项目指导。
- 仅在此处保留仅适用于 Gemini 的注意事项。
`;
  }
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

export function buildCursorRuleContent(lang: Language): string {
  const body = getGuidelinesBody(lang);
  if (lang === 'zh-CN') {
    return `---
description: Karpathy 行为准则用于 AI 编码工作
alwaysApply: true
---

# Karpathy 准则

当与 \`AGENTS.md\` 重叠时，优先使用共享的 \`AGENTS.md\` 指导。

${body}
`;
  }
  return `---
description: Karpathy behavioral guidelines for AI coding work
alwaysApply: true
---

# Karpathy Guidelines

Prefer the shared \`AGENTS.md\` guidance when there is overlap.

${body}
`;
}

export function buildWindsurfRuleContent(lang: Language): string {
  const body = getGuidelinesBody(lang);
  if (lang === 'zh-CN') {
    return `---
name: karpathy-guidelines
description: Karpathy 行为准则用于 AI 编码工作
alwaysApply: true
---

# Karpathy 准则

当与 \`AGENTS.md\` 重叠时，优先使用共享的 \`AGENTS.md\` 指导。

${body}
`;
  }
  return `---
name: karpathy-guidelines
description: Karpathy behavioral guidelines for AI coding work
alwaysApply: true
---

# Karpathy Guidelines

Prefer the shared \`AGENTS.md\` guidance when there is overlap.

${body}
`;
}

export function buildCopilotInstructionsContent(lang: Language): string {
  const body = getGuidelinesBody(lang);
  if (lang === 'zh-CN') {
    return `# Karpathy 准则用于 GitHub Copilot

仓库范围的 Copilot 指令。保持与 \`AGENTS.md\` 一致。

## 操作规则

1. 编码前先思考。陈述假设，在任务不明确时提问。
2. 优先选择满足需求的简单实现。
3. 进行精准修改。不要重构无关代码。
4. 朝着可验证的成功标准努力，在停止前检查结果。

## 完整指导

${body}
`;
  }
  return `# Karpathy Guidelines for GitHub Copilot

Repository-wide instructions for Copilot. Keep these aligned with \`AGENTS.md\`.

## Operating Rules

1. Think before coding. State assumptions and ask if the task is ambiguous.
2. Prefer the simplest implementation that satisfies the request.
3. Make surgical changes. Do not refactor unrelated code.
4. Work toward verifiable success criteria and check them before stopping.

## Full Guidance

${body}
`;
}

export function buildCopilotPathInstructionsContent(lang: Language): string {
  if (lang === 'zh-CN') {
    return `---
applyTo: "**"
---

# Karpathy 准则

在推理项目行为时，使用 \`AGENTS.md\` 作为共享的事实来源。

## 简版

- 在上下文缺失时陈述假设并提问。
- 保持实现简单，避免假设性抽象。
- 将编辑限制在请求的范围内。
- 根据明确的成功标准验证结果。
`;
  }
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

export function buildClineRuleContent(lang: Language): string {
  const body = getGuidelinesBody(lang);
  if (lang === 'zh-CN') {
    return `# Karpathy 准则用于 Cline

${body}
`;
  }
  return `# Karpathy Guidelines for Cline

${body}
`;
}

export function buildContinueRuleContent(lang: Language): string {
  const body = getGuidelinesBody(lang);
  if (lang === 'zh-CN') {
    return `---
name: karpathy-guidelines
description: 在更改代码前应用 Karpathy 行为准则
alwaysApply: true
---

# Karpathy 准则

${body}
`;
  }
  return `---
name: karpathy-guidelines
description: Apply Karpathy behavioral guidelines before changing code
alwaysApply: true
---

# Karpathy Guidelines

${body}
`;
}

export function buildAiderConfigContent(): string {
  return `# Load shared repository guidance on every aider session.
read:
  - AGENTS.md
`;
}

export function buildOpenCodeContent(lang: Language): string {
  if (lang === 'zh-CN') {
    return `# Karpathy 准则用于 OpenCode

从 \`AGENTS.md\` 加载共享的仓库指令。

@AGENTS.md

## OpenCode 注意事项

- 将 \`AGENTS.md\` 视为规范的项目指导。
- 当 AGENTS.md 存在于项目根目录时，OpenCode 会自动加载它。
`;
  }
  return `# Karpathy Guidelines for OpenCode

Load the shared repository instructions from \`AGENTS.md\`.

@AGENTS.md

## OpenCode Notes

- Treat \`AGENTS.md\` as the canonical project guidance.
- OpenCode will automatically load AGENTS.md when present in the project root.
`;
}

export function buildCopilotCliInstructionsContent(lang: Language): string {
  const body = getGuidelinesBody(lang);
  if (lang === 'zh-CN') {
    return `# Karpathy 准则用于 GitHub Copilot CLI

\`gh copilot\` CLI 会话的仓库范围指令。

## 操作规则

1. 编码前先思考。陈述假设，在任务不明确时提问。
2. 优先选择满足需求的简单实现。
3. 进行精准修改。不要重构无关代码。
4. 朝着可验证的成功标准努力，在停止前检查结果。

## 完整指导

${body}
`;
  }
  return `# Karpathy Guidelines for GitHub Copilot CLI

Repository-wide instructions for \`gh copilot\` CLI sessions.

## Operating Rules

1. Think before coding. State assumptions and ask if the task is ambiguous.
2. Prefer the simplest implementation that satisfies the request.
3. Make surgical changes. Do not refactor unrelated code.
4. Work toward verifiable success criteria and check them before stopping.

## Full Guidance

${body}
`;
}
