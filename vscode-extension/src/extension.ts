import * as vscode from 'vscode';
import { GUIDELINES_CONTENT } from './guidelines';
import { Language, LanguageOption, resolveLanguage } from './i18n';
import { t } from './i18n';
import {
  detectTools,
  generateConfigsForTools,
  getAllTools,
  getRecommendedToolIds,
  installGlobal,
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
}

const CONFIG_BASE = 'karpathyGuidelines';
const INSTALL_DIALOG_SHOWN_VERSION_KEY = 'karpathyGuidelines.installDialogShownVersion';

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

function buildGenerationMarkdown(rootPath: string, toolIds: string[], report: Awaited<ReturnType<typeof generateConfigsForTools>>, note?: string, lang: Language = 'en'): string {
  const str = (key: string) => {
    const translations: Record<string, Record<Language, string>> = {
      'title': { en: 'Karpathy Config Generation', 'zh-CN': 'Karpathy 配置生成' },
      'targetPath': { en: 'Target path', 'zh-CN': '目标路径' },
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

  return `# ${str('title')}

${str('targetPath')}: \`${rootPath}\`

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

function getInstallableToolIds(installType: InstallType, tools: ToolConfig[], rootPath: string): string[] {
  if (installType === 'global') {
    return tools.filter((tool) => Boolean(tool.globalPaths?.length)).map((tool) => tool.id);
  }

  return rootPath ? tools.map((tool) => tool.id) : [];
}

function buildInstallDialogHtml(
  langOpt: LanguageOption,
  tools: ToolConfig[],
  rootPath: string,
  state: InstallDialogState = { installType: 'global', selectedToolIds: [] }
): string {
  const lang = resolveLanguage(langOpt);
  const title = lang === 'zh-CN' ? '安装 Karpathy 行为准则' : 'Install Karpathy Guidelines';
  const subtitle = lang === 'zh-CN'
    ? '为 AI 编码工具安装全局配置或工作区配置'
    : 'Install global or workspace configs for AI coding tools';
  const selectAll = lang === 'zh-CN' ? '全选' : 'Select All';
  const install = lang === 'zh-CN' ? '安装' : 'Install';
  const cancel = lang === 'zh-CN' ? '取消' : 'Cancel';
  const installGlobal = lang === 'zh-CN' ? '安装全局配置' : 'Install Global';
  const installWorkspace = lang === 'zh-CN' ? '安装到工作区' : 'Install to Workspace';
  const workspaceMissing = lang === 'zh-CN' ? '请先打开工作区文件夹' : 'Open a workspace folder first';
  const unavailableGlobal = lang === 'zh-CN' ? '该工具没有全局配置路径' : 'No global install path for this tool';
  const quickReference = lang === 'zh-CN' ? '快速参考' : 'Quick Reference';
  const quickReferenceTitle = t(lang, 'qrTitle');
  const quickReferenceClose = lang === 'zh-CN' ? '关闭' : 'Close';
  const crossTool = lang === 'zh-CN' ? '跨工具策略' : 'Cross-tool';
  const mainCommands = lang === 'zh-CN' ? '主要命令' : 'Main commands';
  const toolData = tools.map((tool) => ({
    id: tool.id,
    displayName: tool.displayName,
    globalPath: tool.globalPaths?.[0] || '',
    workspacePath: tool.primaryPaths[0] || '',
  }));
  const quickReferenceRows = [
    { num: 1, name: t(lang, 'qrPrinciple1Title'), action: t(lang, 'qrPrinciple1Desc') },
    { num: 2, name: t(lang, 'qrPrinciple2Title'), action: t(lang, 'qrPrinciple2Desc') },
    { num: 3, name: t(lang, 'qrPrinciple3Title'), action: t(lang, 'qrPrinciple3Desc') },
    { num: 4, name: t(lang, 'qrPrinciple4Title'), action: t(lang, 'qrPrinciple4Desc') },
  ];

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
	  </style>
</head>
<body>
  <div class="dialog">
    <div class="dialog-header">
      <div class="header-actions">
        <button id="quickRefBtn" class="icon-btn" title="${quickReference}" aria-label="${quickReference}">
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
          <h2>${quickReferenceTitle}</h2>
          <button id="closeQuickRefBtn" class="icon-btn" aria-label="${quickReferenceClose}">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M18 6 6 18"></path>
              <path d="m6 6 12 12"></path>
            </svg>
          </button>
        </div>
        <div class="modal-body">
          <table class="modal-table">
            <tr><th>#</th><th>${t(lang, 'qrPrinciple')}</th><th>${t(lang, 'qrKeyAction')}</th></tr>
            ${quickReferenceRows.map((item) => `<tr><td>${item.num}</td><td><strong>${item.name}</strong></td><td>${item.action}</td></tr>`).join('')}
          </table>
          <div class="modal-card"><strong>${crossTool}</strong><br>${t(lang, 'qrCrossToolStrategy')}</div>
          <div class="modal-card"><strong>${mainCommands}</strong><br>${t(lang, 'qrMainCommands')}</div>
        </div>
      </div>
    </div>
  </div>
  <script>
    window.onload = function() {
      var vscode = acquireVsCodeApi();
      var tools = ${JSON.stringify(toolData)};
      var selectedTools = {};
      var installType = ${JSON.stringify(state.installType)};
      var hasWorkspace = ${JSON.stringify(Boolean(rootPath))};
      var initialSelectedToolIds = ${JSON.stringify(state.selectedToolIds)};
      var toolsList = document.getElementById('toolsList');
      var selectAllEl = document.getElementById('selectAll');
      var installBtn = document.getElementById('installBtn');
      var quickRefModal = document.getElementById('quickRefModal');

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
          return tool.globalPath || ${JSON.stringify(unavailableGlobal)};
        }
        return hasWorkspace ? tool.workspacePath : ${JSON.stringify(workspaceMissing)};
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
      renderTools();
      updateSelectAll();
      updateInstallBtn();

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
            selectedToolIds: Object.keys(selectedTools)
          });
        });
      }

      if (installBtn) {
        installBtn.addEventListener('click', function() {
          vscode.postMessage({
            command: 'install',
            toolIds: Object.keys(selectedTools),
            installType: installType
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
  const rootPath = getWorkspaceRoot();
  const initialState: InstallDialogState = { installType: initialType, selectedToolIds };

  if (installDialogPanel) {
    installDialogPanel.reveal();
    installDialogPanel.title = resolveLanguage(langOpt) === 'zh-CN' ? '安装 Karpathy 行为准则' : 'Install Karpathy Guidelines';
    installDialogPanel.webview.html = buildInstallDialogHtml(langOpt, allTools, rootPath, initialState);
    return;
  }

  const resolvedLang = resolveLanguage(langOpt);
  const panel = vscode.window.createWebviewPanel(
    'karpathyInstall',
    resolvedLang === 'zh-CN' ? '安装 Karpathy 行为准则' : 'Install Karpathy Guidelines',
    vscode.ViewColumn.One,
    { enableScripts: true, retainContextWhenHidden: true }
  );
  installDialogPanel = panel;

  panel.webview.html = buildInstallDialogHtml(langOpt, allTools, rootPath, initialState);

  panel.webview.onDidReceiveMessage(async (message) => {
    if (message.command === 'cancel' || message.command === 'close') {
      panel.dispose();
      installDialogPanel = undefined;
      return;
    }

    if (message.command === 'setLanguage') {
      langOpt = message.lang as LanguageOption;
      await config.update('language', langOpt, vscode.ConfigurationTarget.Global);
      panel.title = resolveLanguage(langOpt) === 'zh-CN' ? '安装 Karpathy 行为准则' : 'Install Karpathy Guidelines';
      panel.webview.html = buildInstallDialogHtml(langOpt, allTools, rootPath, {
        installType: (message.installType as InstallType) || initialType,
        selectedToolIds: Array.isArray(message.selectedToolIds) ? message.selectedToolIds : [],
      });
      return;
    }

    if (message.command === 'install') {
      const cfg = vscode.workspace.getConfiguration('karpathyGuidelines');
      const overwriteExisting = cfg.get('overwriteExisting', true) as boolean;
      const installLang = resolveLanguage(langOpt);
      const toolIds = Array.isArray(message.toolIds) ? message.toolIds as string[] : [];
      const installType = (message.installType as InstallType) || 'global';

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

        const report = await generateConfigsForTools(workspaceRoot, toolIds, { overwriteExisting }, installLang);
        const created = report.allFiles.filter((file) => file.status === 'created' || file.status === 'updated').length;
        const skipped = report.allFiles.filter((file) => file.status === 'skipped').length;
        const unchanged = report.allFiles.filter((file) => file.status === 'unchanged').length;
        const errors = report.allFiles.filter((file) => file.status === 'error').length;

        let title;
        let msg;
        if (errors > 0) {
          title = installLang === 'zh-CN' ? '安装失败' : 'Install Failed';
          msg = installLang === 'zh-CN' ? `${errors} 个文件写入失败` : `${errors} file(s) failed to write`;
        } else if (created === 0 && skipped === 0 && unchanged > 0) {
          title = installLang === 'zh-CN' ? '已是最新' : 'Up to Date';
          msg = installLang === 'zh-CN' ? `工作区中的 ${unchanged} 个配置已是最新` : `${unchanged} workspace config(s) are already up to date`;
        } else {
          title = installLang === 'zh-CN' ? '安装成功' : 'Install Success';
          msg = installLang === 'zh-CN'
            ? `工作区中已写入 ${created} 个配置，${skipped} 个跳过，${unchanged} 个已是最新`
            : `Wrote ${created} workspace config(s), skipped ${skipped}, ${unchanged} up to date`;
        }

        panel.webview.postMessage({
          command: 'showResult',
          success: errors === 0,
          title,
          message: msg
        });
        return;
      }

      const results = await installGlobal(toolIds, { overwriteExisting }, installLang);

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
        msg = installLang === 'zh-CN' ? `所有 ${unchanged} 个配置已是最新` : `All ${unchanged} configs are up to date`;
      } else {
        title = installLang === 'zh-CN' ? '安装成功' : 'Install Success';
        msg = installLang === 'zh-CN'
          ? `已安装 ${created} 个配置，${skipped} 个跳过，${unchanged} 个已是最新`
          : `Installed ${created}, skipped ${skipped}, ${unchanged} up to date`;
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
  const shownVersion = context.globalState.get<string>(INSTALL_DIALOG_SHOWN_VERSION_KEY);
  if (shownVersion === version) {
    return;
  }

  await context.globalState.update(INSTALL_DIALOG_SHOWN_VERSION_KEY, version);
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
  const report = await generateConfigsForTools(rootPath, toolIds, { overwriteExisting }, lang);

  const createdOrUpdated = report.allFiles.filter((file) => file.status === 'created' || file.status === 'updated');
  const skipped = report.allFiles.filter((file) => file.status === 'skipped');
  const errored = report.allFiles.filter((file) => file.status === 'error');

  const markdown = buildGenerationMarkdown(rootPath, toolIds, report, note, lang);
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
    const document = await vscode.workspace.openTextDocument({
      content: GUIDELINES_CONTENT,
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

    const content =
      insertAs === 'markdown'
        ? GUIDELINES_CONTENT
        : insertAs === 'comments'
          ? commentPrefix + GUIDELINES_CONTENT.split('\n').join(`\n${commentPrefix}`)
          : GUIDELINES_CONTENT;

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
    autoActivateListener
  );

  void maybeShowInstallDialogAfterInstall(context);
}

export function deactivate(): void {}
