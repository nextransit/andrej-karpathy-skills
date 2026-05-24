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
import { GeneratedFileSpec, ToolConfig } from './types';

function sharedAgentsFile(): GeneratedFileSpec {
  return {
    relativePath: 'AGENTS.md',
    description: 'Shared source of truth for compatible AI coding agents',
    content: buildAgentsContent(),
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
    buildFiles: () => [
      sharedAgentsFile(),
      {
        relativePath: 'CLAUDE.md',
        description: 'Claude Code project memory entrypoint',
        content: buildClaudeContent(),
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
    buildFiles: () => [sharedAgentsFile()],
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
    buildFiles: () => [
      sharedAgentsFile(),
      {
        relativePath: 'GEMINI.md',
        description: 'Gemini CLI project context entrypoint',
        content: buildGeminiContent(),
      },
      {
        relativePath: '.gemini/settings.json',
        description: 'Gemini CLI configuration for shared context file names',
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
    globalPaths: ['~/.config/opencode/config.json'],
    detectMarkers: ['.opencode.json', 'opencode.config.json'],
    buildFiles: () => [
      sharedAgentsFile(),
      {
        relativePath: '.opencode.json',
        description: 'OpenCode workspace configuration',
        content: buildOpenCodeContent(),
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
    buildFiles: () => [
      sharedAgentsFile(),
      {
        relativePath: '.aider.conf.yml',
        description: 'Aider config that auto-loads AGENTS.md',
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
    buildFiles: () => [
      sharedAgentsFile(),
      {
        relativePath: '.cursor/rules/karpathy-guidelines.mdc',
        description: 'Cursor project rule',
        content: buildCursorRuleContent(),
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
    buildFiles: () => [
      sharedAgentsFile(),
      {
        relativePath: '.windsurf/rules/karpathy-guidelines.md',
        description: 'Windsurf rule file',
        content: buildWindsurfRuleContent(),
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
    buildFiles: () => [
      sharedAgentsFile(),
      {
        relativePath: '.github/copilot-instructions.md',
        description: 'Repository-wide Copilot instructions',
        content: buildCopilotInstructionsContent(),
      },
      {
        relativePath: '.github/instructions/karpathy-guidelines.instructions.md',
        description: 'Path-level Copilot instructions',
        content: buildCopilotPathInstructionsContent(),
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
    buildFiles: () => [
      sharedAgentsFile(),
      {
        relativePath: '.copilot/instructions.md',
        description: 'Custom instructions for Copilot CLI',
        content: buildCopilotCliInstructionsContent(),
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
    globalPaths: ['~/.clinerules'],
    detectMarkers: ['.clinerules', '.clinerules/karpathy-guidelines.md'],
    buildFiles: () => [
      sharedAgentsFile(),
      {
        relativePath: '.clinerules/karpathy-guidelines.md',
        description: 'Cline rule file',
        content: buildClineRuleContent(),
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
    buildFiles: () => [
      sharedAgentsFile(),
      {
        relativePath: '.continue/rules/karpathy-guidelines.md',
        description: 'Continue local rule file',
        content: buildContinueRuleContent(),
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
