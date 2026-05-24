import {
  buildAgentsContent,
  buildAiderConfigContent,
  buildClaudeContent,
  buildClineRuleContent,
  buildContinueRuleContent,
  buildCopilotInstructionsContent,
  buildCopilotPathInstructionsContent,
  buildCopilotCliInstructionsContent,
  buildCursorRuleContent,
  buildGeminiContent,
  buildGeminiSettingsContent,
  buildOpenCodeContent,
  buildWindsurfRuleContent,
} from '../guidelines';
import { GeneratedFileSpec, Language, ToolConfig } from './types';

function sharedAgentsFile(lang: Language): GeneratedFileSpec {
  return {
    relativePath: 'AGENTS.md',
    description: lang === 'zh-CN' ? '兼容 AI 编码代理的共享事实来源' : 'Shared source of truth for compatible AI coding agents',
    content: buildAgentsContent(lang),
  };
}

export const TOOLS: Record<string, ToolConfig> = {
  'claude-code': {
    id: 'claude-code',
    displayName: 'Claude Code',
    type: 'cli',
    description: 'Project memory via CLAUDE.md importing the shared AGENTS.md rules',
    website: 'https://code.claude.com/docs/en/memory',
    primaryPaths: ['CLAUDE.md'],
    globalPaths: ['~/.claude/CLAUDE.md'],
    detectMarkers: ['CLAUDE.md', '.claude', '.claude-plugin'],
    buildFiles: (lang: Language) => [
      sharedAgentsFile(lang),
      {
        relativePath: 'CLAUDE.md',
        description: lang === 'zh-CN' ? 'Claude Code 项目记忆入口' : 'Claude Code project memory entrypoint',
        content: buildClaudeContent(lang),
      },
    ],
  },
  codex: {
    id: 'codex',
    displayName: 'OpenAI Codex',
    type: 'cli',
    description: 'Shared AGENTS.md instructions for Codex CLI and compatible agents',
    website: 'https://developers.openai.com/codex/cli',
    primaryPaths: ['AGENTS.md'],
    globalPaths: ['~/.codex/AGENTS.md'],
    detectMarkers: ['AGENTS.md', '.codex'],
    buildFiles: (lang: Language) => [sharedAgentsFile(lang)],
  },
  'gemini-cli': {
    id: 'gemini-cli',
    displayName: 'Gemini CLI',
    type: 'cli',
    description: 'Gemini project context with AGENTS.md as the shared source',
    website: 'https://github.com/google-gemini/gemini-cli',
    primaryPaths: ['GEMINI.md', '.gemini/settings.json'],
    globalPaths: ['~/.gemini/settings.json'],
    detectMarkers: ['GEMINI.md', '.gemini', '.gemini/settings.json'],
    buildFiles: (lang: Language) => [
      sharedAgentsFile(lang),
      {
        relativePath: 'GEMINI.md',
        description: lang === 'zh-CN' ? 'Gemini CLI 项目上下文入口' : 'Gemini CLI project context entrypoint',
        content: buildGeminiContent(lang),
      },
      {
        relativePath: '.gemini/settings.json',
        description: lang === 'zh-CN' ? 'Gemini CLI 共享上下文文件名的配置' : 'Gemini CLI configuration for shared context file names',
        content: buildGeminiSettingsContent(),
      },
    ],
  },
  opencode: {
    id: 'opencode',
    displayName: 'OpenCode',
    type: 'cli',
    description: 'OpenCode CLI with shared AGENTS.md as the canonical source',
    website: 'https://opencode.ai',
    primaryPaths: ['AGENTS.md'],
    globalPaths: ['~/.config/opencode/AGENTS.md'],
    detectMarkers: ['.opencode.json', 'opencode.config.json'],
    buildFiles: (lang: Language) => [
      sharedAgentsFile(lang),
      {
        relativePath: '.opencode.json',
        description: lang === 'zh-CN' ? 'OpenCode 工作区配置' : 'OpenCode workspace configuration',
        content: buildOpenCodeContent(lang),
      },
    ],
  },
  aider: {
    id: 'aider',
    displayName: 'Aider',
    type: 'cli',
    description: 'Aider session config that loads shared AGENTS.md guidance',
    website: 'https://aider.chat',
    primaryPaths: ['.aider.conf.yml'],
    globalPaths: ['~/.aider.conf.yml'],
    detectMarkers: ['.aider.conf.yml', '.aider.conf.yaml', '.aider.conf'],
    buildFiles: (lang: Language) => [
      sharedAgentsFile(lang),
      {
        relativePath: '.aider.conf.yml',
        description: lang === 'zh-CN' ? 'Aider 自动加载 AGENTS.md 的配置' : 'Aider config that auto-loads AGENTS.md',
        content: buildAiderConfigContent(),
      },
    ],
  },
  cursor: {
    id: 'cursor',
    displayName: 'Cursor',
    type: 'ide',
    description: 'Cursor project rule plus shared AGENTS.md guidance',
    website: 'https://docs.cursor.com/en/context',
    primaryPaths: ['.cursor/rules/karpathy-guidelines.mdc'],
    globalPaths: ['~/.cursor/rules/karpathy-guidelines.mdc'],
    detectMarkers: ['.cursor', '.cursor/rules'],
    buildFiles: (lang: Language) => [
      sharedAgentsFile(lang),
      {
        relativePath: '.cursor/rules/karpathy-guidelines.mdc',
        description: lang === 'zh-CN' ? 'Cursor 项目规则' : 'Cursor project rule',
        content: buildCursorRuleContent(lang),
      },
    ],
  },
  windsurf: {
    id: 'windsurf',
    displayName: 'Windsurf',
    type: 'ide',
    description: 'Windsurf rule plus shared AGENTS.md guidance',
    website: 'https://docs.windsurf.com/windsurf/cascade/memories',
    primaryPaths: ['.windsurf/rules/karpathy-guidelines.md'],
    globalPaths: ['~/.windsurf/rules/karpathy-guidelines.md'],
    detectMarkers: ['.windsurf', '.windsurf/rules'],
    buildFiles: (lang: Language) => [
      sharedAgentsFile(lang),
      {
        relativePath: '.windsurf/rules/karpathy-guidelines.md',
        description: lang === 'zh-CN' ? 'Windsurf 规则文件' : 'Windsurf rule file',
        content: buildWindsurfRuleContent(lang),
      },
    ],
  },
  copilot: {
    id: 'copilot',
    displayName: 'GitHub Copilot',
    type: 'ide',
    description: 'Repository and path-level Copilot instructions plus shared AGENTS.md guidance',
    website: 'https://docs.github.com/en/copilot',
    primaryPaths: [
      '.github/copilot-instructions.md',
      '.github/instructions/karpathy-guidelines.instructions.md',
    ],
    detectMarkers: ['.github/copilot-instructions.md', '.github/instructions', '.github'],
    buildFiles: (lang: Language) => [
      sharedAgentsFile(lang),
      {
        relativePath: '.github/copilot-instructions.md',
        description: lang === 'zh-CN' ? '仓库级 Copilot 指令' : 'Repository-wide Copilot instructions',
        content: buildCopilotInstructionsContent(lang),
      },
      {
        relativePath: '.github/instructions/karpathy-guidelines.instructions.md',
        description: lang === 'zh-CN' ? '路径级 Copilot 指令' : 'Path-level Copilot instructions',
        content: buildCopilotPathInstructionsContent(lang),
      },
    ],
  },
  'copilot-cli': {
    id: 'copilot-cli',
    displayName: 'GitHub Copilot CLI',
    type: 'cli',
    description: 'GitHub Copilot CLI (gh copilot) with custom instructions',
    website: 'https://docs.github.com/en/copilot',
    primaryPaths: ['.copilot/instructions.md'],
    globalPaths: ['~/.copilot/instructions.md'],
    detectMarkers: ['.copilot'],
    buildFiles: (lang: Language) => [
      sharedAgentsFile(lang),
      {
        relativePath: '.copilot/instructions.md',
        description: lang === 'zh-CN' ? 'Copilot CLI 自定义指令' : 'Custom instructions for Copilot CLI',
        content: buildCopilotCliInstructionsContent(lang),
      },
    ],
  },
  cline: {
    id: 'cline',
    displayName: 'Cline',
    type: 'vscode-ext',
    description: 'Cline rules directory plus shared AGENTS.md guidance',
    website: 'https://docs.cline.bot',
    primaryPaths: ['.clinerules/karpathy-guidelines.md'],
    globalPaths: ['~/.clinerules/karpathy-guidelines.md'],
    detectMarkers: ['.clinerules', '.clinerules/karpathy-guidelines.md'],
    buildFiles: (lang: Language) => [
      sharedAgentsFile(lang),
      {
        relativePath: '.clinerules/karpathy-guidelines.md',
        description: lang === 'zh-CN' ? 'Cline 规则文件' : 'Cline rule file',
        content: buildClineRuleContent(lang),
      },
    ],
  },
  continue: {
    id: 'continue',
    displayName: 'Continue',
    type: 'vscode-ext',
    description: 'Continue local rule plus shared AGENTS.md guidance',
    website: 'https://docs.continue.dev/customize/rules',
    primaryPaths: ['.continue/rules/karpathy-guidelines.md'],
    globalPaths: ['~/.continue/rules/karpathy-guidelines.md'],
    detectMarkers: ['.continue/rules', '.continue/config.yaml', '.continue/config.json'],
    buildFiles: (lang: Language) => [
      sharedAgentsFile(lang),
      {
        relativePath: '.continue/rules/karpathy-guidelines.md',
        description: lang === 'zh-CN' ? 'Continue 本地规则文件' : 'Continue local rule file',
        content: buildContinueRuleContent(lang),
      },
    ],
  },
};

export const TOOL_DISPLAY_ORDER = [
  'claude-code',
  'codex',
  'opencode',
  'gemini-cli',
  'aider',
  'cursor',
  'windsurf',
  'copilot',
  'copilot-cli',
  'cline',
  'continue',
];

export const RECOMMENDED_TOOL_IDS = [
  'claude-code',
  'codex',
  'opencode',
  'gemini-cli',
  'cursor',
  'windsurf',
  'copilot',
  'copilot-cli',
  'cline',
  'continue',
];

export const TOOL_LIST = TOOL_DISPLAY_ORDER.map((toolId) => TOOLS[toolId]);
