import * as fs from 'fs';
import * as vscode from 'vscode';
import { buildGuidelinesContent } from './guidelines';
import { Language, LanguageOption, resolveLanguage } from './i18n';
import { t } from './i18n';
import {
  discoverPopularSkills,
  getSkillById,
  getSkillBody,
  getSkillDescription,
  getSkillDisplayName,
  KARPATHY_SKILL,
} from './skills';
import {
  detectTools,
  generateConfigsForTools,
  getAllTools,
  getGlobalSkillPathForTool,
  getRecommendedToolIds,
  getWorkspaceSkillRelativePath,
  InstructionSkill,
  installGlobalSkills,
  installWorkspaceSkill,
  inspectWorkspace,
  ToolConfig,
  WorkspaceToolStatus,
} from './tools';

interface ToolQuickPickItem {
  label: string;
  description: string;
  detail: string;
  picked: boolean;
  tool: ToolConfig;
}

type InstallType = 'global' | 'workspace';

interface InstallDialogState {
  installType: InstallType;
  selectedToolIds: string[];
  selectedSkillId?: string;
}

const CONFIG_BASE = 'karpathyGuidelines';
const INSTALL_DIALOG_SHOWN_INSTALL_ID_KEY = 'karpathyGuidelines.installDialogShownInstallId';

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function jsonForScript(value: unknown): string {
  return JSON.stringify(value)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026');
}

function getWorkspaceRoot(uri?: vscode.Uri): string {
  if (uri?.fsPath) {
    return uri.fsPath;
  }
  return vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || '';
}

function getCurrentLanguage(): Language {
  const config = vscode.workspace.getConfiguration(CONFIG_BASE);
  const option = config.get('language', 'auto') as LanguageOption;
  return resolveLanguage(option);
}

async function openMarkdownDocument(content: string): Promise<void> {
  const document = await vscode.workspace.openTextDocument({
    content,
    language: 'markdown',
  });
  await vscode.window.showTextDocument(document, { preview: false });
}

function getCommentPrefix(languageId: string): string {
  const prefixes: Record<string, string> = {
    typescript: '// ',
    javascript: '// ',
    python: '# ',
    java: '// ',
    csharp: '// ',
    cpp: '// ',
    c: '// ',
    go: '// ',
    rust: '// ',
    ruby: '# ',
    php: '// ',
    swift: '// ',
    kotlin: '// ',
    scala: '// ',
    shell: '# ',
    bash: '# ',
    powershell: '# ',
    sql: '-- ',
    html: '<!-- ',
    css: '/* ',
    json: '// ',
    yaml: '# ',
    markdown: '> ',
  };
  return prefixes[languageId] || '# ';
}

function buildGenerationMarkdown(rootPath: string, toolIds: string[], report: Awaited<ReturnType<typeof generateConfigsForTools>>, note?: string, lang: Language = 'en', skill: InstructionSkill = KARPATHY_SKILL): string {
  const str = (key: string) => {
    const translations: Record<string, Record<Language, string>> = {
      'title': { en: 'Karpathy Config Generation', 'zh-CN': 'Karpathy 配置生成' },
      'targetPath': { en: 'Target path', 'zh-CN': '目标路径' },
      'skill': { en: 'Skill', 'zh-CN': 'Skill' },
      'generatedFor': { en: 'Generated for', 'zh-CN': '为以下工具生成' },
      'fileResults': { en: 'File Results', 'zh-CN': '文件结果' },
      'status': { en: 'Status', 'zh-CN': '状态' },
      'file': { en: 'File', 'zh-CN': '文件' },
      'description': { en: 'Description', 'zh-CN': '描述' },
      'toolCoverage': { en: 'Tool Coverage', 'zh-CN': '工具覆盖' },
      'tool': { en: 'Tool', 'zh-CN': '工具' },
      'type': { en: 'Type', 'zh-CN': '类型' },
      'files': { en: 'Files', 'zh-CN': '文件' },
      'noFiles': { en: 'No files generated', 'zh-CN': '未生成文件' },
      'created': { en: 'created', 'zh-CN': '已创建' },
      'updated': { en: 'updated', 'zh-CN': '已更新' },
      'skipped': { en: 'skipped', 'zh-CN': '已跳过' },
      'unchanged': { en: 'unchanged', 'zh-CN': '未更改' },
      'error': { en: 'error', 'zh-CN': '错误' },
      'cli': { en: 'CLI', 'zh-CN': '命令行工具' },
      'ide': { en: 'IDE', 'zh-CN': 'IDE' },
      'vscode-ext': { en: 'VSCode Extension', 'zh-CN': 'VSCode 扩展' },
    };
    return translations[key]?.[lang] || translations[key]?.['en'] || key;
  };

  const fileRows = report.allFiles
    .map((file) => `| ${str(file.status)} | \`${file.relativePath}\` | ${file.description} |`)
    .join('\n');
  const toolRows = report.tools
    .map((result) => `| ${result.tool.displayName} | ${str(result.tool.type)} | ${result.files.map((file) => `\`${file.relativePath}\``).join('<br>')} |`)
    .join('\n');

  return `# ${getSkillDisplayName(skill, lang)} ${str('title')}

${str('targetPath')}: \`${rootPath}\`

${str('skill')}: ${getSkillDescription(skill, lang)}

${str('generatedFor')}: ${toolIds.join(', ')}
${note ? `\n${note}\n` : ''}

## ${str('fileResults')}

| ${str('status')} | ${str('file')} | ${str('description')} |
|---|---|---|
${fileRows || `| - | - | ${str('noFiles')} |`}

## ${str('toolCoverage')}

| ${str('tool')} | ${str('type')} | ${str('files')} |
|---|---|---|
${toolRows || '| - | - | - |'}
`;
}

async function getSelectedSkillFromConfig(): Promise<InstructionSkill> {
  const config = vscode.workspace.getConfiguration(CONFIG_BASE);
  const skillId = config.get('defaultSkill', KARPATHY_SKILL.id) as string;
  if (skillId === KARPATHY_SKILL.id) {
    return KARPATHY_SKILL;
  }
  const skills = await getDiscoveredSkills();
  return getSkillById(skills, skillId);
}

function buildSupportedToolsMarkdown(tools: ToolConfig[], lang: Language = 'en'): string {
  const str = (key: string) => {
    const translations: Record<string, Record<Language, string>> = {
      'title': { en: 'Supported AI Tools', 'zh-CN': '支持的 AI 工具' },
      'subtitle': { en: 'This extension generates a shared `AGENTS.md` source of truth where possible, then adds tool-specific entrypoints only when a tool needs them.', 'zh-CN': '此扩展尽可能生成共享的 `AGENTS.md` 作为事实来源，仅在工具需要时添加特定入口点。' },
      'tool': { en: 'Tool', 'zh-CN': '工具' },
      'type': { en: 'Type', 'zh-CN': '类型' },
      'primaryFiles': { en: 'Primary Files', 'zh-CN': '主要文件' },
      'notes': { en: 'Notes', 'zh-CN': '备注' },
      'cli': { en: 'CLI', 'zh-CN': '命令行工具' },
      'ide': { en: 'IDE', 'zh-CN': 'IDE' },
      'vscode-ext': { en: 'VSCode Extension', 'zh-CN': 'VSCode 扩展' },
    };
    return translations[key]?.[lang] || translations[key]?.['en'] || key;
  };

  const rows = tools
    .map(
      (tool) =>
        `| ${tool.displayName} | ${str(tool.type)} | ${tool.primaryPaths.map((relativePath) => `\`${relativePath}\``).join('<br>')} | ${tool.description} |`
    )
    .join('\n');

  return `# ${str('title')}

${str('subtitle')}

| ${str('tool')} | ${str('type')} | ${str('primaryFiles')} | ${str('notes')} |
|---|---|---|---|
${rows}
`;
}

function buildWorkspaceStatusMarkdown(rootPath: string, statuses: WorkspaceToolStatus[], lang: Language = 'en'): string {
  const str = (key: string) => {
    const translations: Record<string, Record<Language, string>> = {
      'title': { en: 'Workspace AI Tool Status', 'zh-CN': '工作区 AI 工具状态' },
      'workspace': { en: 'Workspace', 'zh-CN': '工作区' },
      'tool': { en: 'Tool', 'zh-CN': '工具' },
      'detected': { en: 'Detected', 'zh-CN': '已检测' },
      'configured': { en: 'Fully Configured', 'zh-CN': '已配置' },
      'existingFiles': { en: 'Existing Primary Files', 'zh-CN': '存在的主要文件' },
      'yes': { en: 'yes', 'zh-CN': '是' },
      'no': { en: 'no', 'zh-CN': '否' },
    };
    return translations[key]?.[lang] || translations[key]?.['en'] || key;
  };

  const rows = statuses
    .map((status) => {
      const configuredPaths = status.existingPrimaryPaths.length
        ? status.existingPrimaryPaths.map((relativePath) => `\`${relativePath}\``).join('<br>')
        : '-';
      return `| ${status.tool.displayName} | ${status.detected ? str('yes') : str('no')} | ${status.configured ? str('yes') : str('no')} | ${configuredPaths} |`;
    })
    .join('\n');

  return `# ${str('title')}

${str('workspace')}: \`${rootPath}\`

| ${str('tool')} | ${str('detected')} | ${str('configured')} | ${str('existingFiles')} |
|---|---|---|---|
${rows}
`;
}

function buildQuickRefHtml(lang: Language): string {
  const str = (key: 'qrTitle' | 'qrPrinciple' | 'qrKeyAction' | 'qrPrinciple1Title' | 'qrPrinciple1Desc' | 'qrPrinciple2Title' | 'qrPrinciple2Desc' | 'qrPrinciple3Title' | 'qrPrinciple3Desc' | 'qrPrinciple4Title' | 'qrPrinciple4Desc' | 'qrCrossToolStrategy' | 'qrMainCommands') => t(lang, key);

  const principles = [
    { num: 1, name: str('qrPrinciple1Title'), action: str('qrPrinciple1Desc') },
    { num: 2, name: str('qrPrinciple2Title'), action: str('qrPrinciple2Desc') },
    { num: 3, name: str('qrPrinciple3Title'), action: str('qrPrinciple3Desc') },
    { num: 4, name: str('qrPrinciple4Title'), action: str('qrPrinciple4Desc') },
  ];

  const tableRows = principles.map(p => `
    <tr>
      <td><strong>${p.num}</strong></td>
      <td><strong>${p.name}</strong></td>
      <td>${p.action}</td>
    </tr>`).join('');

  return `<!DOCTYPE html>
<html>
<head>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      padding: 20px;
      background: #101826;
      color: #dbe4f0;
    }
    h1 {
      color: #93c5fd;
      border-bottom: 1px solid #22324e;
      padding-bottom: 10px;
    }
    h2 { color: #60a5fa; margin-top: 20px; }
    table { width: 100%; border-collapse: collapse; margin: 15px 0; }
    th, td { border: 1px solid #22324e; padding: 10px 12px; text-align: left; }
    th { background: #15233a; color: #93c5fd; }
    tr:hover { background: #15233a; }
    .card {
      background: #15233a;
      border: 1px solid #22324e;
      border-radius: 10px;
      padding: 14px 16px;
      margin-top: 12px;
    }
    code {
      background: #0d1727;
      border-radius: 4px;
      padding: 2px 6px;
    }
  </style>
</head>
<body>
  <h1>${str('qrTitle')}</h1>

  <table>
    <tr><th>#</th><th>${str('qrPrinciple')}</th><th>${str('qrKeyAction')}</th></tr>
    ${tableRows}
  </table>

  <div class="card">
    <strong>Cross-tool</strong>
    <p>${str('qrCrossToolStrategy')}</p>
  </div>
  <div class="card">
    <strong>Main commands</strong>
    <p>${str('qrMainCommands')}</p>
  </div>
</body>
</html>`;
}

let installDialogPanel: vscode.WebviewPanel | undefined;
let discoveredSkillsCache: InstructionSkill[] | undefined;

function getInstallableToolIds(installType: InstallType, tools: ToolConfig[], rootPath: string): string[] {
  if (installType === 'global') {
    return tools.filter((tool) => Boolean(tool.globalPaths?.length)).map((tool) => tool.id);
  }

  return rootPath ? tools.map((tool) => tool.id) : [];
}

async function getDiscoveredSkills(forceRefresh: boolean = false): Promise<InstructionSkill[]> {
  if (forceRefresh) {
    discoveredSkillsCache = undefined;
  }
  if (!discoveredSkillsCache) {
    discoveredSkillsCache = await discoverPopularSkills();
  }
  return discoveredSkillsCache;
}

function getInstallPanelTitle(skill: InstructionSkill, lang: Language): string {
  const skillName = getSkillDisplayName(skill, lang);
  return lang === 'zh-CN' ? `安装 ${skillName}` : `Install ${skillName}`;
}

function getPopularityLevel(skill: InstructionSkill, skills: InstructionSkill[]): number | undefined {
  if (skill.source !== 'github') {
    return undefined;
  }

  const rankedSkills = skills
    .filter((candidate) => candidate.source === 'github')
    .sort((left, right) => (right.stars || 0) - (left.stars || 0));
  const rank = rankedSkills.findIndex((candidate) => candidate.id === skill.id);

  if (rank === -1 || rankedSkills.length === 0) {
    return 1;
  }

  return Math.max(1, 5 - Math.floor((rank * 5) / rankedSkills.length));
}

function buildPopularityBadge(level: number | undefined): string {
  if (!level) {
    return '';
  }
  return `${'★'.repeat(level)}${'☆'.repeat(5 - level)}`;
}

function buildInstallDialogHtml(
  langOpt: LanguageOption,
  tools: ToolConfig[],
  skills: InstructionSkill[],
  rootPath: string,
  state: InstallDialogState = { installType: 'global', selectedToolIds: [], selectedSkillId: KARPATHY_SKILL.id }
): string {
  const lang = resolveLanguage(langOpt);
  const selectedSkill = getSkillById(skills, state.selectedSkillId);
  const selectedSkillName = getSkillDisplayName(selectedSkill, lang);
  const selectedSkillDescription = getSkillDescription(selectedSkill, lang);
  const title = lang === 'zh-CN' ? `安装 ${selectedSkillName}` : `Install ${selectedSkillName}`;
  const subtitle = lang === 'zh-CN'
    ? selectedSkillDescription
    : selectedSkillDescription;
  const skillLabel = lang === 'zh-CN' ? '选择 Skill' : 'Select Skill';
  const skillSource = lang === 'zh-CN' ? '来源' : 'Source';
  const builtinSource = lang === 'zh-CN' ? '内置默认' : 'Built-in default';
  const githubSource = lang === 'zh-CN' ? 'GitHub 热门' : 'Popular on GitHub';
  const refreshSkills = lang === 'zh-CN' ? '刷新热门 Skill' : 'Refresh Popular Skills';
  const refreshingSkills = lang === 'zh-CN' ? '刷新中...' : 'Refreshing...';
  const popularityLabel = lang === 'zh-CN' ? '热度' : 'Popularity';
  const starsLabel = lang === 'zh-CN' ? 'stars' : 'stars';
  const selectAll = lang === 'zh-CN' ? '全选' : 'Select All';
  const install = lang === 'zh-CN' ? '安装' : 'Install';
  const cancel = lang === 'zh-CN' ? '取消' : 'Cancel';
  const installGlobal = lang === 'zh-CN' ? '安装全局配置' : 'Install Global';
  const installWorkspace = lang === 'zh-CN' ? '安装到工作区' : 'Install to Workspace';
  const workspaceMissing = lang === 'zh-CN' ? '请先打开工作区文件夹' : 'Open a workspace folder first';
  const unavailableGlobal = lang === 'zh-CN' ? '该工具没有全局配置路径' : 'No global install path for this tool';
  const skillDetails = lang === 'zh-CN' ? 'Skill 详情' : 'Skill Details';
  const skillDetailsClose = lang === 'zh-CN' ? '关闭' : 'Close';
  const toolData = tools.map((tool) => ({
    id: tool.id,
    displayName: tool.displayName,
    globalPath: getGlobalSkillPathForTool(tool, selectedSkill) || '',
    workspacePath: getWorkspaceSkillRelativePath(selectedSkill),
  }));
  const skillData = skills.map((skill) => {
    const popularityLevel = getPopularityLevel(skill, skills);
    return {
      id: skill.id,
      slug: skill.slug,
      displayName: getSkillDisplayName(skill, lang),
      description: getSkillDescription(skill, lang),
      source: skill.source,
      sourceLabel: skill.source === 'builtin' ? builtinSource : githubSource,
      stars: skill.stars,
      popularityLevel,
      popularityBadge: buildPopularityBadge(popularityLevel),
      repositoryUrl: skill.repositoryUrl,
    };
  });
  const skillRows = skillData.map((skill) => {
    const selectedClass = skill.id === selectedSkill.id ? ' selected' : '';
    const stars = skill.popularityBadge || '';
    const starCount = skill.stars ? String(skill.stars) : '';
    return `<button class="skill-row${selectedClass}" type="button" data-id="${escapeHtml(skill.id)}">
      <span class="skill-row-name">${escapeHtml(skill.displayName)}</span>
      <span class="skill-row-source">${escapeHtml(skill.sourceLabel)}</span>
      <span class="skill-row-stars">${escapeHtml(stars)}</span>
      <span class="skill-row-count">${escapeHtml(starCount)}</span>
    </button>`;
  }).join('');
  const selectedSkillPopularityLevel = getPopularityLevel(selectedSkill, skills);
  const selectedSkillPopularityBadge = buildPopularityBadge(selectedSkillPopularityLevel);
  const selectedSkillSource = selectedSkill.source === 'builtin' ? builtinSource : githubSource;
  const selectedSkillDetails = [
    `${skillSource}: ${selectedSkillSource}`,
    selectedSkillPopularityBadge ? `${popularityLabel}: ${selectedSkillPopularityBadge}` : '',
    selectedSkill.stars ? `${selectedSkill.stars} ${starsLabel}` : '',
    selectedSkill.repositoryUrl || '',
  ].filter(Boolean).join(' · ');
  const selectedSkillBody = getSkillBody(selectedSkill, lang);

  return `<!DOCTYPE html>
<html>
<head>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
      color: #e4e4e7;
      min-height: 100vh;
      display: flex;
      justify-content: center;
      align-items: center;
      padding: 20px;
    }
    .dialog {
      background: #1e1e2e;
      border-radius: 16px;
      box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
      max-width: 560px;
      width: 100%;
      overflow: hidden;
      border: 1px solid #2d2d44;
    }
    .dialog-header {
      background: linear-gradient(90deg, #6366f1, #8b5cf6);
      padding: 24px 28px;
      position: relative;
      text-align: center;
    }
    .dialog-header h1 {
      color: #fff;
      font-size: 22px;
      font-weight: 600;
      margin-bottom: 6px;
    }
    .dialog-header p {
      color: rgba(255,255,255,0.8);
      font-size: 14px;
    }
    .lang-toggle {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 4px;
      margin-top: 12px;
      background: rgba(255,255,255,0.1);
      padding: 4px;
      border-radius: 8px;
      width: fit-content;
      margin-left: auto;
      margin-right: auto;
    }
    .lang-toggle button {
      padding: 6px 14px;
      border: none;
      background: transparent;
      color: rgba(255,255,255,0.6);
      border-radius: 6px;
      cursor: pointer;
      font-size: 13px;
      font-weight: 500;
      transition: all 0.2s;
    }
    .lang-toggle button.active {
      background: #fff;
      color: #6366f1;
    }
    .header-actions {
      position: absolute;
      top: 18px;
      right: 18px;
      display: flex;
      gap: 8px;
    }
    .icon-btn {
      width: 36px;
      height: 36px;
      border: none;
      border-radius: 10px;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      background: rgba(255,255,255,0.12);
      color: #fff;
      transition: background 0.2s;
    }
    .icon-btn:hover { background: rgba(255,255,255,0.2); }
    .dialog-body {
      padding: 24px 28px;
    }
    .skill-picker {
      display: flex;
      flex-direction: column;
      gap: 8px;
      padding: 12px 14px;
      background: #252536;
      border: 1px solid #34344f;
      border-radius: 10px;
      margin-bottom: 16px;
    }
    .skill-picker-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
    }
    .skill-picker label {
      color: #c7c7d8;
      font-size: 12px;
      font-weight: 600;
      text-transform: uppercase;
    }
    .skill-list {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }
    .skill-row {
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto 6.5em 7ch;
      align-items: center;
      gap: 10px;
      width: 100%;
      border: 1px solid #3a3a50;
      border-radius: 8px;
      background: #171725;
      color: #fff;
      cursor: pointer;
      font-size: 13px;
      padding: 8px 10px;
      text-align: left;
    }
    .skill-row:hover { background: #202036; }
    .skill-row.selected {
      border-color: #6366f1;
      background: rgba(99, 102, 241, 0.12);
    }
    .skill-row-name {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .skill-row-source {
      color: #a0a0b0;
      font-size: 12px;
      text-align: right;
      white-space: nowrap;
    }
    .skill-row-stars {
      color: #facc15;
      font-family: 'SF Mono', Monaco, monospace;
      letter-spacing: 1px;
      min-height: 1em;
      text-align: left;
      white-space: nowrap;
    }
    .skill-row-count {
      color: #888;
      font-family: 'SF Mono', Monaco, monospace;
      font-size: 12px;
      text-align: right;
      white-space: nowrap;
    }
    .skill-refresh-btn {
      border: 1px solid #3a3a50;
      border-radius: 8px;
      background: #202036;
      color: #d8d8ea;
      cursor: pointer;
      font-size: 12px;
      padding: 6px 10px;
      white-space: nowrap;
    }
    .skill-refresh-btn:hover { background: #2d2d42; }
    .skill-refresh-btn:disabled {
      cursor: wait;
      opacity: 0.65;
    }
    .skill-meta {
      color: #a0a0b0;
      font-size: 12px;
      line-height: 1.45;
    }
    .select-all {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 12px 16px;
      background: #2a2a3e;
      border-radius: 10px;
      margin-bottom: 16px;
      cursor: pointer;
    }
    .select-all:hover { background: #323248; }
    .select-all input { width: 18px; height: 18px; accent-color: #6366f1; }
    .select-all span { font-weight: 500; }
    .tools-list {
      display: flex;
      flex-direction: column;
      gap: 8px;
      max-height: 300px;
      overflow-y: auto;
    }
    .tool-item {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 14px 16px;
      background: #252536;
      border-radius: 10px;
      cursor: pointer;
      transition: all 0.2s;
      border: 2px solid transparent;
    }
    .tool-item.checked {
      background: #2b2b45;
      border-color: #6366f1;
    }
    .tool-item.disabled {
      opacity: 0.45;
      cursor: not-allowed;
      border-color: transparent;
    }
    .tool-item:hover {
      background: #2d2d42;
      border-color: #3d3d5c;
    }
    .tool-item.disabled:hover {
      background: #252536;
      border-color: transparent;
    }
    .tool-item input {
      width: 18px;
      height: 18px;
      accent-color: #6366f1;
    }
    .tool-name {
      font-weight: 500;
      color: #fff;
      flex: 1;
    }
    .tool-path {
      font-size: 12px;
      color: #888;
      font-family: 'SF Mono', Monaco, monospace;
    }
    .dialog-footer {
      display: flex;
      gap: 12px;
      padding: 20px 28px 24px;
    }
    .btn {
      flex: 1;
      padding: 14px 20px;
      border-radius: 10px;
      font-size: 15px;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.2s;
      border: none;
    }
    .btn-cancel {
      background: #3a3a50;
      color: #a0a0b0;
    }
    .btn-cancel:hover { background: #4a4a60; }
    .btn-install {
      background: linear-gradient(90deg, #6366f1, #8b5cf6);
      color: #fff;
    }
    .btn-install:hover {
      transform: translateY(-1px);
      box-shadow: 0 4px 12px rgba(99, 102, 241, 0.4);
    }
    .btn-install:disabled {
      opacity: 0.5;
      cursor: not-allowed;
      transform: none;
      box-shadow: none;
    }
    .install-type {
      display: flex;
      gap: 8px;
      margin-bottom: 16px;
    }
    .install-type button {
      flex: 1;
      padding: 10px;
      border: 2px solid #3a3a50;
      background: transparent;
      color: #a0a0b0;
      border-radius: 8px;
      cursor: pointer;
      font-size: 13px;
      transition: all 0.2s;
    }
    .install-type button.active {
      border-color: #6366f1;
      background: rgba(99, 102, 241, 0.1);
      color: #fff;
    }
    .result-message {
      text-align: center;
      padding: 40px 20px;
    }
    .result-message.success { color: #4ade80; }
    .result-message.error { color: #f87171; }
    .result-message h2 { font-size: 24px; margin-bottom: 12px; }
    .result-message p { color: #888; margin-bottom: 20px; }
    .modal-backdrop {
      position: absolute;
      inset: 0;
      background: rgba(10, 15, 29, 0.8);
      display: none;
      align-items: center;
      justify-content: center;
      padding: 24px;
    }
    .modal-backdrop.visible { display: flex; }
    .modal {
      width: 100%;
      max-width: 520px;
      max-height: min(720px, calc(100vh - 48px));
      border-radius: 14px;
      border: 1px solid #2d2d44;
      background: #171725;
      overflow: hidden;
      box-shadow: 0 24px 64px rgba(0, 0, 0, 0.45);
    }
    .modal-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 18px 20px 14px;
      border-bottom: 1px solid #2d2d44;
    }
    .modal-header h2 {
      font-size: 16px;
      color: #fff;
    }
    .modal-body {
      padding: 18px 20px 20px;
      max-height: calc(100vh - 140px);
      overflow-y: auto;
    }
    .modal-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 16px;
    }
    .modal-table th, .modal-table td {
      border: 1px solid #2d2d44;
      padding: 10px 12px;
      text-align: left;
      vertical-align: top;
    }
    .modal-table th {
      background: #202036;
      color: #a5b4fc;
      font-size: 12px;
      font-weight: 600;
    }
    .modal-card {
      background: #202036;
      border-radius: 10px;
      padding: 12px 14px;
      color: #c9d1eb;
      margin-top: 10px;
      font-size: 13px;
      line-height: 1.45;
    }
    .modal-skill-body {
      margin-top: 12px;
      padding: 14px;
      border: 1px solid #2d2d44;
      border-radius: 10px;
      background: #10101a;
      color: #d8d8ea;
      font-family: 'SF Mono', Monaco, monospace;
      font-size: 12px;
      line-height: 1.5;
      overflow-x: auto;
      white-space: pre-wrap;
    }
	  </style>
</head>
<body>
  <div class="dialog">
    <div class="dialog-header">
      <div class="header-actions">
        <button id="quickRefBtn" class="icon-btn" title="${skillDetails}" aria-label="${skillDetails}">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path>
            <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2Z"></path>
          </svg>
        </button>
      </div>
      <h1>${title}</h1>
      <p>${subtitle}</p>
      <div class="lang-toggle">
        <button data-lang="auto" class="${langOpt === 'auto' ? 'active' : ''}">Auto</button>
        <button data-lang="en" class="${langOpt === 'en' ? 'active' : ''}">EN</button>
        <button data-lang="zh-CN" class="${langOpt === 'zh-CN' ? 'active' : ''}">中文</button>
      </div>
    </div>
    <div class="dialog-body">
      <div class="skill-picker">
        <div class="skill-picker-header">
          <label>${skillLabel}</label>
          <button id="refreshSkillsBtn" class="skill-refresh-btn" type="button">${refreshSkills}</button>
        </div>
        <div id="skillList" class="skill-list">${skillRows}</div>
        <div class="skill-meta">
          <strong id="skillSource">${skillSource}: ${escapeHtml(selectedSkill.source === 'builtin' ? builtinSource : githubSource)}</strong>
          <span id="skillDescription">${escapeHtml(selectedSkillDescription)}</span>
        </div>
      </div>
      <div class="install-type">
        <button class="${state.installType === 'global' ? 'active' : ''}" data-type="global">${installGlobal}</button>
        <button class="${state.installType === 'workspace' ? 'active' : ''}" data-type="workspace">${installWorkspace}</button>
      </div>
      <label class="select-all">
        <input type="checkbox" id="selectAll" />
        <span>${selectAll}</span>
      </label>
      <div class="tools-list" id="toolsList"></div>
    </div>
    <div class="dialog-footer">
      <button class="btn btn-cancel" id="cancelBtn">${cancel}</button>
      <button class="btn btn-install" id="installBtn" disabled>${install}</button>
    </div>
    <div class="modal-backdrop" id="quickRefModal">
      <div class="modal">
        <div class="modal-header">
          <h2>${escapeHtml(selectedSkillName)}</h2>
          <button id="closeQuickRefBtn" class="icon-btn" aria-label="${skillDetailsClose}">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M18 6 6 18"></path>
              <path d="m6 6 12 12"></path>
            </svg>
          </button>
        </div>
        <div class="modal-body">
          <div class="modal-card">
            <strong>${escapeHtml(selectedSkillDetails)}</strong><br>
            ${escapeHtml(selectedSkillDescription)}
          </div>
          <pre class="modal-skill-body">${escapeHtml(selectedSkillBody)}</pre>
        </div>
      </div>
    </div>
  </div>
  <script>
    window.onload = function() {
      var vscode = acquireVsCodeApi();
      var tools = ${jsonForScript(toolData)};
      var skills = ${jsonForScript(skillData)};
      var selectedTools = {};
      var installType = ${jsonForScript(state.installType)};
      var selectedSkillId = ${jsonForScript(selectedSkill.id)};
      var hasWorkspace = ${jsonForScript(Boolean(rootPath))};
      var initialSelectedToolIds = ${jsonForScript(state.selectedToolIds)};
      var toolsList = document.getElementById('toolsList');
      var selectAllEl = document.getElementById('selectAll');
      var installBtn = document.getElementById('installBtn');
      var quickRefModal = document.getElementById('quickRefModal');
      var skillList = document.getElementById('skillList');
      var refreshSkillsBtn = document.getElementById('refreshSkillsBtn');
      var skillSourceEl = document.getElementById('skillSource');
      var skillDescriptionEl = document.getElementById('skillDescription');

      function getAvailableTools() {
        return tools.filter(function(tool) {
          if (installType === 'global') {
            return Boolean(tool.globalPath);
          }
          return hasWorkspace;
        });
      }

      function getInstallPath(tool) {
        if (installType === 'global') {
          return tool.globalPath || ${jsonForScript(unavailableGlobal)};
        }
        return hasWorkspace ? tool.workspacePath : ${jsonForScript(workspaceMissing)};
      }

      function isSelectable(tool) {
        if (installType === 'global') {
          return Boolean(tool.globalPath);
        }
        return hasWorkspace;
      }

      function pruneSelectedTools() {
        var availableIds = {};
        getAvailableTools().forEach(function(tool) {
          availableIds[tool.id] = true;
        });
        Object.keys(selectedTools).forEach(function(toolId) {
          if (!availableIds[toolId]) {
            delete selectedTools[toolId];
          }
        });
      }

      function renderTools() {
        if (!toolsList) {
          return;
        }
        toolsList.innerHTML = tools.map(function(tool) {
          var checked = Boolean(selectedTools[tool.id]);
          var selectable = isSelectable(tool);
          var classes = 'tool-item' + (checked ? ' checked' : '') + (selectable ? '' : ' disabled');
          return '<div class="' + classes + '" data-id="' + tool.id + '">' +
            '<input type="checkbox" value="' + tool.id + '"' + (checked ? ' checked' : '') + (selectable ? '' : ' disabled') + ' />' +
            '<span class="tool-name">' + tool.displayName + '</span>' +
            '<span class="tool-path">' + getInstallPath(tool) + '</span>' +
          '</div>';
        }).join('');

        var rows = toolsList.querySelectorAll('.tool-item');
        for (var rowIndex = 0; rowIndex < rows.length; rowIndex++) {
          rows[rowIndex].addEventListener('click', function(event) {
            var checkbox = this.querySelector('input');
            if (!checkbox || checkbox.disabled) {
              return;
            }
            if (event.target !== checkbox) {
              checkbox.checked = !checkbox.checked;
              checkbox.dispatchEvent(new Event('change', { bubbles: true }));
            }
          });
        }

        var checkboxes = toolsList.querySelectorAll('.tool-item input');
        for (var checkboxIndex = 0; checkboxIndex < checkboxes.length; checkboxIndex++) {
          checkboxes[checkboxIndex].addEventListener('change', function() {
            var row = this.closest('.tool-item');
            if (this.checked) {
              selectedTools[this.value] = true;
              if (row) {
                row.classList.add('checked');
              }
            } else {
              delete selectedTools[this.value];
              if (row) {
                row.classList.remove('checked');
              }
            }
            updateSelectAll();
            updateInstallBtn();
          });
        }
      }

      function updateInstallBtn() {
        if (installBtn) {
          installBtn.disabled = Object.keys(selectedTools).length === 0;
        }
      }

      function updateSelectAll() {
        if (selectAllEl) {
          var available = getAvailableTools();
          var selectedCount = available.filter(function(tool) { return Boolean(selectedTools[tool.id]); }).length;
          selectAllEl.checked = available.length > 0 && selectedCount === available.length;
          selectAllEl.indeterminate = selectedCount > 0 && selectedCount < available.length;
        }
      }

      function getSelectedSkill() {
        return skills.filter(function(skill) { return skill.id === selectedSkillId; })[0] || skills[0];
      }

      function updateSkillMeta() {
        var skill = getSelectedSkill();
        if (skillSourceEl && skill) {
          var popularity = skill.popularityBadge
            ? ' · ' + ${jsonForScript(popularityLabel + ': ')} + skill.popularityBadge + (skill.stars ? ' · ' + skill.stars + ' ${starsLabel}' : '')
            : '';
          skillSourceEl.textContent = ${jsonForScript(skillSource + ': ')} + skill.sourceLabel + popularity;
        }
        if (skillDescriptionEl && skill) {
          skillDescriptionEl.textContent = skill.description || '';
        }
      }

      function updateSkillRows() {
        if (!skillList) {
          return;
        }
        var rows = skillList.querySelectorAll('.skill-row');
        for (var rowIndex = 0; rowIndex < rows.length; rowIndex++) {
          var row = rows[rowIndex];
          row.classList.toggle('selected', row.getAttribute('data-id') === selectedSkillId);
        }
      }

      function setInstallType(nextType) {
        installType = nextType;
        pruneSelectedTools();
        var typeBtns = document.querySelectorAll('.install-type button');
        for (var btnIndex = 0; btnIndex < typeBtns.length; btnIndex++) {
          var btn = typeBtns[btnIndex];
          btn.classList.toggle('active', btn.getAttribute('data-type') === installType);
        }
        renderTools();
        updateSelectAll();
        updateInstallBtn();
      }

      initialSelectedToolIds.forEach(function(toolId) {
        selectedTools[toolId] = true;
      });
      pruneSelectedTools();
      updateSkillMeta();
      renderTools();
      updateSelectAll();
      updateInstallBtn();

      if (skillList) {
        var skillRows = skillList.querySelectorAll('.skill-row');
        for (var skillRowIndex = 0; skillRowIndex < skillRows.length; skillRowIndex++) {
          skillRows[skillRowIndex].addEventListener('click', function() {
            var nextSkillId = this.getAttribute('data-id');
            if (!nextSkillId || nextSkillId === selectedSkillId) {
              return;
            }
            selectedSkillId = nextSkillId;
            updateSkillRows();
            updateSkillMeta();
            vscode.postMessage({
              command: 'setSkill',
              skillId: selectedSkillId,
              installType: installType,
              selectedToolIds: Object.keys(selectedTools)
            });
          });
        }
        updateSkillRows();
      }

      if (refreshSkillsBtn) {
        refreshSkillsBtn.addEventListener('click', function() {
          refreshSkillsBtn.disabled = true;
          refreshSkillsBtn.textContent = ${jsonForScript(refreshingSkills)};
          vscode.postMessage({
            command: 'refreshSkills',
            skillId: selectedSkillId,
            installType: installType,
            selectedToolIds: Object.keys(selectedTools)
          });
        });
      }

      if (selectAllEl) {
        selectAllEl.addEventListener('change', function() {
          var available = getAvailableTools();
          if (this.checked) {
            available.forEach(function(tool) {
              selectedTools[tool.id] = true;
            });
          } else {
            available.forEach(function(tool) {
              delete selectedTools[tool.id];
            });
          }
          renderTools();
          updateSelectAll();
          updateInstallBtn();
        });
      }

      var typeBtns = document.querySelectorAll('.install-type button');
      for (var typeIndex = 0; typeIndex < typeBtns.length; typeIndex++) {
        typeBtns[typeIndex].addEventListener('click', function() {
          setInstallType(this.getAttribute('data-type'));
        });
      }

      var langBtns = document.querySelectorAll('.lang-toggle button');
      for (var langIndex = 0; langIndex < langBtns.length; langIndex++) {
        langBtns[langIndex].addEventListener('click', function() {
          vscode.postMessage({
            command: 'setLanguage',
            lang: this.getAttribute('data-lang'),
            installType: installType,
            selectedToolIds: Object.keys(selectedTools),
            selectedSkillId: selectedSkillId
          });
        });
      }

      if (installBtn) {
        installBtn.addEventListener('click', function() {
          vscode.postMessage({
            command: 'install',
            toolIds: Object.keys(selectedTools),
            installType: installType,
            skillId: selectedSkillId
          });
        });
      }

      var cancelBtn = document.getElementById('cancelBtn');
      if (cancelBtn) {
        cancelBtn.addEventListener('click', function() {
          vscode.postMessage({ command: 'cancel' });
        });
      }

      var quickRefBtn = document.getElementById('quickRefBtn');
      if (quickRefBtn && quickRefModal) {
        quickRefBtn.addEventListener('click', function() {
          quickRefModal.classList.add('visible');
        });
      }

      var closeQuickRefBtn = document.getElementById('closeQuickRefBtn');
      if (closeQuickRefBtn && quickRefModal) {
        closeQuickRefBtn.addEventListener('click', function() {
          quickRefModal.classList.remove('visible');
        });
        quickRefModal.addEventListener('click', function(event) {
          if (event.target === quickRefModal) {
            quickRefModal.classList.remove('visible');
          }
        });
      }

      // Handle messages from extension
      window.addEventListener('message', function(event) {
        if (event.data.command === 'showResult') {
          var body = document.querySelector('.dialog-body');
          if (event.data.success) {
            body.innerHTML = '<div class="result-message success"><h2>' + event.data.title + '</h2><p>' + event.data.message + '</p></div>';
          } else {
            body.innerHTML = '<div class="result-message error"><h2>' + event.data.title + '</h2><p>' + event.data.message + '</p></div>';
          }
          document.querySelector('.dialog-footer').innerHTML = '<button class="btn btn-install" style="flex:1" id="closeBtn">OK</button>';
          document.getElementById('closeBtn').onclick = function() {
            vscode.postMessage({ command: 'close' });
          };
        }
      });
    };
  </script>
</body>
</html>`;
}

async function showInstallDialog(initialType: InstallType = 'global', selectedToolIds: string[] = []): Promise<void> {
  const config = vscode.workspace.getConfiguration('karpathyGuidelines');
  let langOpt = config.get('language', 'auto') as LanguageOption;
  const allTools = getAllTools();
  let skills = await getDiscoveredSkills();
  const rootPath = getWorkspaceRoot();
  const configuredSkill = getSkillById(skills, config.get('defaultSkill', KARPATHY_SKILL.id) as string);
  const initialState: InstallDialogState = {
    installType: initialType,
    selectedToolIds,
    selectedSkillId: configuredSkill.id,
  };
  let selectedSkillId = initialState.selectedSkillId || KARPATHY_SKILL.id;
  let selectedSkill = getSkillById(skills, selectedSkillId);

  if (installDialogPanel) {
    installDialogPanel.reveal();
    installDialogPanel.title = getInstallPanelTitle(selectedSkill, resolveLanguage(langOpt));
    installDialogPanel.webview.html = buildInstallDialogHtml(langOpt, allTools, skills, rootPath, initialState);
    return;
  }

  const resolvedLang = resolveLanguage(langOpt);
  const panel = vscode.window.createWebviewPanel(
    'karpathyInstall',
    getInstallPanelTitle(selectedSkill, resolvedLang),
    vscode.ViewColumn.One,
    { enableScripts: true, retainContextWhenHidden: true }
  );
  installDialogPanel = panel;

  panel.webview.html = buildInstallDialogHtml(langOpt, allTools, skills, rootPath, initialState);

  panel.webview.onDidReceiveMessage(async (message) => {
    if (message.command === 'cancel' || message.command === 'close') {
      panel.dispose();
      installDialogPanel = undefined;
      return;
    }

    if (message.command === 'setLanguage') {
      langOpt = message.lang as LanguageOption;
      await config.update('language', langOpt, vscode.ConfigurationTarget.Global);
      selectedSkillId = typeof message.selectedSkillId === 'string' ? message.selectedSkillId : selectedSkillId;
      selectedSkill = getSkillById(skills, selectedSkillId);
      panel.title = getInstallPanelTitle(selectedSkill, resolveLanguage(langOpt));
      panel.webview.html = buildInstallDialogHtml(langOpt, allTools, skills, rootPath, {
        installType: (message.installType as InstallType) || initialType,
        selectedToolIds: Array.isArray(message.selectedToolIds) ? message.selectedToolIds : [],
        selectedSkillId,
      });
      return;
    }

    if (message.command === 'setSkill') {
      selectedSkillId = typeof message.skillId === 'string' ? message.skillId : KARPATHY_SKILL.id;
      selectedSkill = getSkillById(skills, selectedSkillId);
      await config.update('defaultSkill', selectedSkill.id, vscode.ConfigurationTarget.Global);
      panel.title = getInstallPanelTitle(selectedSkill, resolveLanguage(langOpt));
      panel.webview.html = buildInstallDialogHtml(langOpt, allTools, skills, rootPath, {
        installType: (message.installType as InstallType) || initialType,
        selectedToolIds: Array.isArray(message.selectedToolIds) ? message.selectedToolIds : [],
        selectedSkillId,
      });
      return;
    }

    if (message.command === 'refreshSkills') {
      skills = await getDiscoveredSkills(true);
      selectedSkillId = typeof message.skillId === 'string' ? message.skillId : selectedSkillId;
      selectedSkill = getSkillById(skills, selectedSkillId);
      panel.title = getInstallPanelTitle(selectedSkill, resolveLanguage(langOpt));
      panel.webview.html = buildInstallDialogHtml(langOpt, allTools, skills, rootPath, {
        installType: (message.installType as InstallType) || initialType,
        selectedToolIds: Array.isArray(message.selectedToolIds) ? message.selectedToolIds : [],
        selectedSkillId: selectedSkill.id,
      });
      return;
    }

    if (message.command === 'install') {
      const cfg = vscode.workspace.getConfiguration('karpathyGuidelines');
      const overwriteExisting = cfg.get('overwriteExisting', true) as boolean;
      const installLang = resolveLanguage(langOpt);
      const toolIds = Array.isArray(message.toolIds) ? message.toolIds as string[] : [];
      const installType = (message.installType as InstallType) || 'global';
      selectedSkill = getSkillById(skills, typeof message.skillId === 'string' ? message.skillId : selectedSkillId);

      if (installType === 'workspace') {
        const workspaceRoot = getWorkspaceRoot();
        if (!workspaceRoot) {
          panel.webview.postMessage({
            command: 'showResult',
            success: false,
            title: installLang === 'zh-CN' ? '未打开工作区' : 'No Workspace Open',
            message: installLang === 'zh-CN' ? '请先打开工作区文件夹，然后再安装到工作区。' : 'Open a workspace folder before installing workspace configs.'
          });
          return;
        }

        const result = await installWorkspaceSkill(workspaceRoot, selectedSkill, { overwriteExisting }, installLang);
        const created = result.status === 'created' || result.status === 'updated' ? 1 : 0;
        const skipped = result.status === 'skipped' ? 1 : 0;
        const unchanged = result.status === 'unchanged' ? 1 : 0;
        const errors = result.status === 'error' ? 1 : 0;

        let title;
        let msg;
        if (errors > 0) {
          title = installLang === 'zh-CN' ? '安装失败' : 'Install Failed';
          msg = installLang === 'zh-CN' ? `${errors} 个 Skill 文件写入失败` : `${errors} skill file(s) failed to write`;
        } else if (created === 0 && skipped === 0 && unchanged > 0) {
          title = installLang === 'zh-CN' ? '已是最新' : 'Up to Date';
          msg = installLang === 'zh-CN' ? `工作区中的 Skill 已是最新：${result.relativePath}` : `Workspace skill is already up to date: ${result.relativePath}`;
        } else {
          title = installLang === 'zh-CN' ? '安装成功' : 'Install Success';
          msg = installLang === 'zh-CN'
            ? `工作区中已写入 ${created} 个 Skill 文件，${skipped} 个跳过，${unchanged} 个已是最新：${result.relativePath}`
            : `Wrote ${created} workspace skill file(s), skipped ${skipped}, ${unchanged} up to date: ${result.relativePath}`;
        }

        panel.webview.postMessage({
          command: 'showResult',
          success: errors === 0,
          title,
          message: msg
        });
        return;
      }

      const results = await installGlobalSkills(toolIds, { overwriteExisting }, installLang, selectedSkill);

      const created = results.filter(r => r.status === 'created' || r.status === 'updated').length;
      const skipped = results.filter(r => r.status === 'skipped').length;
      const unchanged = results.filter(r => r.status === 'unchanged').length;
      const errors = results.filter(r => r.status === 'error').length;

      let title, msg;
      if (errors > 0) {
        title = installLang === 'zh-CN' ? '安装失败' : 'Install Failed';
        msg = installLang === 'zh-CN' ? `${errors} 个错误` : `${errors} error(s)`;
      } else if (created === 0 && skipped === 0 && unchanged > 0) {
        title = installLang === 'zh-CN' ? '已是最新' : 'Up to Date';
        msg = installLang === 'zh-CN' ? `所有 ${unchanged} 个 Skill 文件已是最新` : `All ${unchanged} skill file(s) are up to date`;
      } else {
        title = installLang === 'zh-CN' ? '安装成功' : 'Install Success';
        msg = installLang === 'zh-CN'
          ? `已安装 ${created} 个 Skill 文件，${skipped} 个跳过，${unchanged} 个已是最新`
          : `Installed ${created} skill file(s), skipped ${skipped}, ${unchanged} up to date`;
      }

      panel.webview.postMessage({
        command: 'showResult',
        success: errors === 0,
        title,
        message: msg
      });
    }
  });

  panel.onDidDispose(() => {
    installDialogPanel = undefined;
  });
}

async function maybeShowInstallDialogAfterInstall(context: vscode.ExtensionContext): Promise<void> {
  const version = String(context.extension.packageJSON.version || 'unknown');
  let installId = `${version}:${context.extensionPath}`;

  try {
    const stat = await fs.promises.stat(context.extensionPath);
    installId = `${installId}:${Math.round(stat.mtimeMs)}`;
  } catch {
    // Fall back to version + path if the extension directory cannot be stat'ed.
  }

  const shownInstallId = context.globalState.get<string>(INSTALL_DIALOG_SHOWN_INSTALL_ID_KEY);
  if (shownInstallId === installId) {
    return;
  }

  await context.globalState.update(INSTALL_DIALOG_SHOWN_INSTALL_ID_KEY, installId);
  setTimeout(() => {
    if (!installDialogPanel) {
      void showInstallDialog('global');
    }
  }, 500);
}

async function showGenerationReport(
  rootPath: string,
  toolIds: string[],
  note?: string
): Promise<void> {
  const lang = getCurrentLanguage();
  const config = vscode.workspace.getConfiguration('karpathyGuidelines');
  const overwriteExisting = config.get('overwriteExisting', false) as boolean;
  const skill = await getSelectedSkillFromConfig();
  const report = await generateConfigsForTools(rootPath, toolIds, { overwriteExisting }, lang, skill);

  const createdOrUpdated = report.allFiles.filter((file) => file.status === 'created' || file.status === 'updated');
  const skipped = report.allFiles.filter((file) => file.status === 'skipped');
  const errored = report.allFiles.filter((file) => file.status === 'error');

  const markdown = buildGenerationMarkdown(rootPath, toolIds, report, note, lang, skill);
  const document = await vscode.workspace.openTextDocument({
    content: markdown,
    language: 'markdown',
  });
  await vscode.window.showTextDocument(document, { preview: false });

  if (createdOrUpdated.length > 0) {
    const firstFile = await vscode.workspace.openTextDocument(
      vscode.Uri.file(`${rootPath}/${createdOrUpdated[0].relativePath}`)
    );
    await vscode.window.showTextDocument(firstFile, { preview: false, viewColumn: vscode.ViewColumn.Beside });
  }

  if (errored.length > 0) {
    vscode.window.showErrorMessage(`Karpathy config generation finished with ${errored.length} error(s).`);
    return;
  }

  if (skipped.length > 0) {
    vscode.window.showWarningMessage(
      `Karpathy config generation created or updated ${createdOrUpdated.length} file(s) and skipped ${skipped.length} existing file(s).`
    );
    return;
  }

  vscode.window.showInformationMessage(`Karpathy config generation created or updated ${createdOrUpdated.length} file(s).`);
}

async function selectTools(defaultToolId: string): Promise<ToolConfig[] | undefined> {
  const items: ToolQuickPickItem[] = getAllTools().map((tool) => ({
      label: tool.displayName,
      description: tool.primaryPaths.join(', '),
      detail: tool.description,
      picked: tool.id === defaultToolId,
      tool,
    }));
  const selections = await vscode.window.showQuickPick(items, {
      canPickMany: true,
      title: 'Select target AI tools',
      placeHolder: 'Choose one or more tools to generate compatible config files',
    });

  return selections?.map((selection: ToolQuickPickItem) => selection.tool);
}

export function activate(context: vscode.ExtensionContext): void {
  const showCommand = vscode.commands.registerCommand('karpathy-guidelines.show', async () => {
    const skill = await getSelectedSkillFromConfig();
    const lang = getCurrentLanguage();
    const document = await vscode.workspace.openTextDocument({
      content: buildGuidelinesContent(lang, true, skill),
      language: 'markdown',
    });
    await vscode.window.showTextDocument(document, { preview: false });
  });

  const quickRefCommand = vscode.commands.registerCommand('karpathy-guidelines.quickRef', async () => {
    const panel = vscode.window.createWebviewPanel(
      'karpathyQuickRef',
      'Karpathy Guidelines',
      vscode.ViewColumn.Beside,
      { retainContextWhenHidden: true }
    );
    panel.webview.html = buildQuickRefHtml(getCurrentLanguage());
  });

  const insertCommand = vscode.commands.registerCommand('karpathy-guidelines.insertRules', async () => {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      vscode.window.showInformationMessage('No active editor');
      return;
    }

    const config = vscode.workspace.getConfiguration('karpathyGuidelines');
    const insertAs = config.get('insertAs', 'markdown') as string;
    const commentPrefix = insertAs === 'comments' ? getCommentPrefix(editor.document.languageId) : '';
    const skill = await getSelectedSkillFromConfig();
    const guidelinesContent = buildGuidelinesContent(getCurrentLanguage(), true, skill);

    const content =
      insertAs === 'markdown'
        ? guidelinesContent
        : insertAs === 'comments'
          ? commentPrefix + guidelinesContent.split('\n').join(`\n${commentPrefix}`)
          : guidelinesContent;

    await editor.edit((editBuilder: any) => {
      editBuilder.insert(editor.selection.start, content);
    });
  });

  const createConfigCommand = vscode.commands.registerCommand('karpathy-guidelines.createConfig', async (uri?: vscode.Uri) => {
    const rootPath = getWorkspaceRoot(uri);
    if (!rootPath) {
      vscode.window.showInformationMessage('No workspace folder open');
      return;
    }

    const config = vscode.workspace.getConfiguration('karpathyGuidelines');
    const defaultTool = config.get('defaultTool', 'cursor') as string;
    const tools = await selectTools(defaultTool);

    if (!tools || tools.length === 0) {
      return;
    }

    await showGenerationReport(rootPath, tools.map((tool) => tool.id));
  });

  const createDetectedConfigsCommand = vscode.commands.registerCommand(
    'karpathy-guidelines.createDetectedConfigs',
    async (uri?: vscode.Uri) => {
      const rootPath = getWorkspaceRoot(uri);
      if (!rootPath) {
        vscode.window.showInformationMessage('No workspace folder open');
        return;
      }

      const detected = await detectTools(rootPath);
      if (detected.length > 0) {
        await showGenerationReport(
          rootPath,
          detected.map((tool) => tool.id),
          'Detected existing tool markers in the workspace and generated compatible configs for them.'
        );
        return;
      }

      await showGenerationReport(
        rootPath,
        getRecommendedToolIds(),
        'No existing tool markers were detected. Generated the recommended cross-tool compatibility bundle instead.'
      );
    }
  );

  const createAllConfigsCommand = vscode.commands.registerCommand('karpathy-guidelines.createAllConfigs', async (uri?: vscode.Uri) => {
    const rootPath = getWorkspaceRoot(uri);
    if (!rootPath) {
      vscode.window.showInformationMessage('No workspace folder open');
      return;
    }

    await showGenerationReport(
      rootPath,
      getAllTools().map((tool) => tool.id),
      'Generated the full set of supported tool configs.'
    );
  });

  const listToolsCommand = vscode.commands.registerCommand('karpathy-guidelines.listTools', async () => {
    const lang = getCurrentLanguage();
    const markdown = buildSupportedToolsMarkdown(getAllTools(), lang);
    await openMarkdownDocument(markdown);
  });

  const checkConfigsCommand = vscode.commands.registerCommand('karpathy-guidelines.checkConfigs', async (uri?: vscode.Uri) => {
    const rootPath = getWorkspaceRoot(uri);
    if (!rootPath) {
      vscode.window.showInformationMessage('No workspace folder open');
      return;
    }

    const lang = getCurrentLanguage();
    const statuses = await inspectWorkspace(rootPath);
    await openMarkdownDocument(buildWorkspaceStatusMarkdown(rootPath, statuses, lang));
  });

  const installGlobalCommand = vscode.commands.registerCommand('karpathy-guidelines.installGlobal', async () => {
    await showInstallDialog('global');
  });

  const installWorkspaceCommand = vscode.commands.registerCommand('karpathy-guidelines.installWorkspace', async () => {
    await showInstallDialog('workspace');
  });

  const installLocalCommand = vscode.commands.registerCommand('karpathy-guidelines.installLocal', async () => {
    await showInstallDialog('workspace');
  });

  const installGlobalAllCommand = vscode.commands.registerCommand('karpathy-guidelines.installGlobalAll', async () => {
    const allTools = getAllTools();
    await showInstallDialog('global', getInstallableToolIds('global', allTools, getWorkspaceRoot()));
  });

  const openSettingsCommand = vscode.commands.registerCommand('karpathy-guidelines.openSettings', async () => {
    await showInstallDialog('global');
  });

  const refreshSkillsCommand = vscode.commands.registerCommand('karpathy-guidelines.refreshSkills', async () => {
    const lang = getCurrentLanguage();
    const skills = await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: lang === 'zh-CN' ? '正在刷新热门 AI Skill...' : 'Refreshing popular AI skills...',
        cancellable: false,
      },
      () => getDiscoveredSkills(true)
    );
    const remoteCount = skills.filter((skill) => skill.source === 'github').length;
    const message = lang === 'zh-CN'
      ? `已刷新 ${remoteCount} 个 GitHub Skill，Karpathy 仍作为默认 fallback。`
      : `Refreshed ${remoteCount} GitHub skill(s). Karpathy remains the fallback.`;
    vscode.window.showInformationMessage(message);
    await showInstallDialog('global');
  });

  const autoActivateListener = vscode.workspace.onDidOpenTextDocument(async (document: any) => {
    const config = vscode.workspace.getConfiguration('karpathyGuidelines');
    if (!(config.get('autoActivate', false) as boolean)) {
      return;
    }

    if (document.languageId === 'markdown') {
      await vscode.commands.executeCommand('karpathy-guidelines.quickRef');
    }
  });

  context.subscriptions.push(
    showCommand,
    quickRefCommand,
    insertCommand,
    createConfigCommand,
    createDetectedConfigsCommand,
    createAllConfigsCommand,
    listToolsCommand,
    checkConfigsCommand,
    installGlobalCommand,
    installWorkspaceCommand,
    installLocalCommand,
    installGlobalAllCommand,
    openSettingsCommand,
    refreshSkillsCommand,
    autoActivateListener
  );

  void maybeShowInstallDialogAfterInstall(context);
}

export function deactivate(): void {}
