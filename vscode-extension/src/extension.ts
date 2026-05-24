import * as vscode from 'vscode';
import { GUIDELINES_CONTENT } from './guidelines';
import { Language, LanguageOption, resolveLanguage } from './i18n';
import { t } from './i18n';
import {
  detectTools,
  generateConfigsForTools,
  getAllTools,
  getGlobalPaths,
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

interface GlobalToolQuickPickItem {
  label: string;
  description: string;
  tool: ToolConfig;
}

const CONFIG_BASE = 'karpathyGuidelines';

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
    const lang = getCurrentLanguage();
    const allTools = getAllTools();
    const cliTools = allTools.filter(t => t.type === 'cli');

    const selected = await vscode.window.showQuickPick(
      cliTools.map(tool => ({
        label: tool.displayName,
        description: getGlobalPaths(tool.id)[0] || '',
        tool
      })),
      { canPickMany: true, placeHolder: 'Select tools to install globally' }
    );

    if (!selected || selected.length === 0) { return; }

    const config = vscode.workspace.getConfiguration('karpathyGuidelines');
    const overwrite = config.get('overwriteExisting', false) as boolean;

    const results = await installGlobal(
      selected.map((item: GlobalToolQuickPickItem) => item.tool.id),
      { overwriteExisting: overwrite },
      lang
    );

    const created = results.filter(r => r.status === 'created' || r.status === 'updated');
    const skipped = results.filter(r => r.status === 'skipped');
    const errors = results.filter(r => r.status === 'error');

    if (errors.length > 0) {
      vscode.window.showErrorMessage(`Failed to install ${errors.length} global configs`);
    }

    const message = errors.length > 0
      ? `Installed ${created.length}, skipped ${skipped.length}, ${errors.length} failed`
      : `Installed ${created.length} global config(s)`;

    vscode.window.showInformationMessage(message);
  });

  const installGlobalAllCommand = vscode.commands.registerCommand('karpathy-guidelines.installGlobalAll', async () => {
    const lang = getCurrentLanguage();
    const allTools = getAllTools();
    const cliTools = allTools.filter(t => t.type === 'cli' && t.id !== 'copilot-cli');

    const config = vscode.workspace.getConfiguration('karpathyGuidelines');
    const overwrite = config.get('overwriteExisting', false) as boolean;

    await vscode.window.withProgress(
      { location: vscode.ProgressLocation.Notification, title: 'Installing global configs...', cancellable: false },
      async () => {
        const results = await installGlobal(cliTools.map(t => t.id), { overwriteExisting: overwrite }, lang);

        const created = results.filter(r => r.status === 'created' || r.status === 'updated').length;
        const skipped = results.filter(r => r.status === 'skipped').length;
        const errors = results.filter(r => r.status === 'error').length;

        vscode.window.showInformationMessage(`Installed ${created} global configs, ${skipped} skipped, ${errors} errors`);
      }
    );
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
    installGlobalAllCommand,
    autoActivateListener
  );
}

export function deactivate(): void {}
