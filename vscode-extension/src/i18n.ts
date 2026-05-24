// Internationalization module

export type Language = 'en' | 'zh-CN';

export const LANGUAGES: { id: Language; label: string }[] = [
  { id: 'en', label: 'English' },
  { id: 'zh-CN', label: '中文' },
];

export const LANGUAGE_OPTIONS = ['auto', 'en', 'zh-CN'] as const;
export type LanguageOption = typeof LANGUAGE_OPTIONS[number];

export function getSystemLanguage(): Language {
  const locale = Intl.DateTimeFormat().resolvedOptions().locale;
  if (locale.startsWith('zh')) {
    return 'zh-CN';
  }
  return 'en';
}

export function resolveLanguage(option: LanguageOption): Language {
  if (option === 'auto') {
    return getSystemLanguage();
  }
  return option;
}

export interface I18nStrings {
  // Commands
  cmdShowRules: string;
  cmdQuickRef: string;
  cmdInsertRules: string;
  cmdCreateConfig: string;
  cmdCreateDetectedConfigs: string;
  cmdCreateAllConfigs: string;
  cmdListTools: string;
  cmdCheckConfigs: string;
  cmdInstallGlobal: string;
  cmdInstallGlobalAll: string;

  // Quick Reference
  qrTitle: string;
  qrPrinciple: string;
  qrKeyAction: string;
  qrPrinciple1Title: string;
  qrPrinciple1Desc: string;
  qrPrinciple2Title: string;
  qrPrinciple2Desc: string;
  qrPrinciple3Title: string;
  qrPrinciple3Desc: string;
  qrPrinciple4Title: string;
  qrPrinciple4Desc: string;
  qrCrossToolStrategy: string;
  qrMainCommands: string;

  // Status messages
  msgInstalled: string;
  msgSkipped: string;
  msgErrors: string;
  msgNoWorkspace: string;
  msgSelectTools: string;

  // Tool types
  typeCli: string;
  typeIde: string;
  typeVscodeExt: string;
}

export const i18n: Record<Language, I18nStrings> = {
  en: {
    // Commands
    cmdShowRules: 'Display the full behavioral guidelines in a new tab',
    cmdQuickRef: 'Open the quick reference panel with four principles',
    cmdInsertRules: 'Insert guidelines at cursor position (as comments or markdown)',
    cmdCreateConfig: 'Generate config files for one or more selected AI coding tools',
    cmdCreateDetectedConfigs: "Detect AI tools from the workspace and generate compatible config files",
    cmdCreateAllConfigs: 'Generate config files for every supported AI coding tool',
    cmdListTools: 'Show supported AI coding tools and the files generated for them',
    cmdCheckConfigs: 'Check which config files exist in the current workspace',
    cmdInstallGlobal: 'Install global configs for selected CLI tools to ~/.claude, ~/.codex, etc.',
    cmdInstallGlobalAll: 'Install global configs for all supported CLI tools',

    // Quick Reference
    qrTitle: 'Karpathy Guidelines - Quick Reference',
    qrPrinciple: 'Principle',
    qrKeyAction: 'Key Action',
    qrPrinciple1Title: 'Think Before Coding',
    qrPrinciple1Desc: 'State your assumptions explicitly. If uncertain, ask.',
    qrPrinciple2Title: 'Simplicity First',
    qrPrinciple2Desc: 'No features beyond what was asked. No abstractions for single-use code.',
    qrPrinciple3Title: 'Surgical Changes',
    qrPrinciple3Desc: "Don't improve adjacent code. Every changed line should trace to the user's request.",
    qrPrinciple4Title: 'Goal-Driven Execution',
    qrPrinciple4Desc: 'Transform tasks into verifiable goals. Define success criteria, verify each step.',
    qrCrossToolStrategy: 'Use AGENTS.md as the shared source of truth, then generate tool-specific entrypoints only for tools that need them.',
    qrMainCommands: 'Create Configs for Selected Tools, Create Detected Tool Configs, Create All Configs, and Check Workspace Configs.',

    // Status messages
    msgInstalled: 'Installed',
    msgSkipped: 'skipped',
    msgErrors: 'errors',
    msgNoWorkspace: 'No workspace folder open',
    msgSelectTools: 'Select AI tools to generate configs for',

    // Tool types
    typeCli: 'CLI',
    typeIde: 'IDE',
    typeVscodeExt: 'VSCode Extension',
  },

  'zh-CN': {
    // Commands
    cmdShowRules: '在新标签页显示完整的行为准则',
    cmdQuickRef: '打开包含四项准则的快速参考面板',
    cmdInsertRules: '在光标位置插入准则（支持注释或 Markdown 格式）',
    cmdCreateConfig: '为选定的 AI 编码工具生成配置文件',
    cmdCreateDetectedConfigs: '检测工作区中的 AI 工具并生成兼容的配置文件',
    cmdCreateAllConfigs: '为所有支持的 AI 编码工具生成配置文件',
    cmdListTools: '显示支持的 AI 编码工具及其生成的文件',
    cmdCheckConfigs: '检查当前工作区存在哪些配置文件',
    cmdInstallGlobal: '为选定的 CLI 工具安装全局配置到 ~/.claude、~/.codex 等',
    cmdInstallGlobalAll: '为所有支持的 CLI 工具安装全局配置',

    // Quick Reference
    qrTitle: 'Karpathy 准则 - 快速参考',
    qrPrinciple: '准则',
    qrKeyAction: '关键行动',
    qrPrinciple1Title: '编码前先思考',
    qrPrinciple1Desc: '明确陈述假设。如果不确定，就问。',
    qrPrinciple2Title: '简洁优先',
    qrPrinciple2Desc: '不添加需求之外的功能。不为一次性代码创建抽象。',
    qrPrinciple3Title: '精准修改',
    qrPrinciple3Desc: '不要改进相邻代码。每一行修改都应该追溯到用户的请求。',
    qrPrinciple4Title: '目标驱动执行',
    qrPrinciple4Desc: '将任务转化为可验证的目标。定义成功标准，验证每一步。',
    qrCrossToolStrategy: '使用 AGENTS.md 作为共享的事实来源，然后仅为需要的工具生成特定的入口点。',
    qrMainCommands: '为选定工具创建配置、检测工具创建配置、创建所有配置、检查工作区配置。',

    // Status messages
    msgInstalled: '已安装',
    msgSkipped: '跳过',
    msgErrors: '错误',
    msgNoWorkspace: '没有打开的工作区文件夹',
    msgSelectTools: '选择要生成配置的 AI 工具',

    // Tool types
    typeCli: '命令行工具',
    typeIde: 'IDE',
    typeVscodeExt: 'VSCode 扩展',
  },
};

export function t(lang: Language, key: keyof I18nStrings): string {
  return i18n[lang][key];
}
