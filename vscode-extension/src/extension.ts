import * as vscode from 'vscode';
import { GUIDELINES_CONTENT, QUICK_REFERENCE } from './guidelines';
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

function getWorkspaceRoot(uri?: vscode.Uri): string {
  if (uri?.fsPath) {
    return uri.fsPath;
  }

  return vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || '';
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

function buildGenerationMarkdown(rootPath: string, toolIds: string[], report: Awaited<ReturnType<typeof generateConfigsForTools>>, note?: string): string {
  const fileRows = report.allFiles
    .map((file) => `| ${file.status} | \`${file.relativePath}\` | ${file.description} |`)
    .join('\n');
  const toolRows = report.tools
    .map((result) => `| ${result.tool.displayName} | ${result.tool.type} | ${result.files.map((file) => `\`${file.relativePath}\``).join('<br>')} |`)
    .join('\n');

  return `# Karpathy Config Generation

Target path: \`${rootPath}\`

Generated for: ${toolIds.join(', ')}
${note ? `\n${note}\n` : ''}

## File Results

| Status | File | Description |
|---|---|---|
${fileRows || '| - | - | No files generated |'}

## Tool Coverage

| Tool | Type | Files |
|---|---|---|
${toolRows || '| - | - | - |'}
`;
}

function buildSupportedToolsMarkdown(tools: ToolConfig[]): string {
  const rows = tools
    .map(
      (tool) =>
        `| ${tool.displayName} | ${tool.type} | ${tool.primaryPaths.map((relativePath) => `\`${relativePath}\``).join('<br>')} | ${tool.description} |`
    )
    .join('\n');

  return `# Supported AI Tools

This extension generates a shared \`AGENTS.md\` source of truth where possible, then adds tool-specific entrypoints only when a tool needs them.

| Tool | Type | Primary Files | Notes |
|---|---|---|---|
${rows}
`;
}

function buildWorkspaceStatusMarkdown(rootPath: string, statuses: WorkspaceToolStatus[]): string {
  const rows = statuses
    .map((status) => {
      const configuredPaths = status.existingPrimaryPaths.length
        ? status.existingPrimaryPaths.map((relativePath) => `\`${relativePath}\``).join('<br>')
        : '-';
      return `| ${status.tool.displayName} | ${status.detected ? 'yes' : 'no'} | ${status.configured ? 'yes' : 'no'} | ${configuredPaths} |`;
    })
    .join('\n');

  return `# Workspace AI Tool Status

Workspace: \`${rootPath}\`

| Tool | Detected | Fully Configured | Existing Primary Files |
|---|---|---|---|
${rows}
`;
}

function buildQuickRefHtml(): string {
  const principles = [
    { num: 1, name: 'Think Before Coding', action: 'State assumptions, ask if unclear' },
    { num: 2, name: 'Simplicity First', action: 'Minimum code, no speculative features' },
    { num: 3, name: 'Surgical Changes', action: 'Only touch what you must' },
    { num: 4, name: 'Goal-Driven', action: 'Define success criteria, verify each step' },
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
  <h1>Karpathy Guidelines - Quick Reference</h1>

  <table>
    <tr><th>#</th><th>Principle</th><th>Key Action</th></tr>
    ${tableRows}
  </table>

  <div class="card">
    <strong>Cross-tool strategy</strong>
    <p>Use <code>AGENTS.md</code> as the shared source of truth, then generate tool-specific entrypoints only for tools that need them.</p>
  </div>
  <div class="card">
    <strong>Main commands</strong>
    <p><code>Create Configs for Selected Tools</code>, <code>Create Detected Tool Configs</code>, <code>Create All Configs</code>, and <code>Check Workspace Configs</code>.</p>
  </div>
</body>
</html>`;
}

async function showGenerationReport(
  rootPath: string,
  toolIds: string[],
  note?: string
): Promise<void> {
  const config = vscode.workspace.getConfiguration('karpathyGuidelines');
  const overwriteExisting = config.get('overwriteExisting', false) as boolean;
  const report = await generateConfigsForTools(rootPath, toolIds, { overwriteExisting });

  const createdOrUpdated = report.allFiles.filter((file) => file.status === 'created' || file.status === 'updated');
  const skipped = report.allFiles.filter((file) => file.status === 'skipped');
  const errored = report.allFiles.filter((file) => file.status === 'error');

  const markdown = buildGenerationMarkdown(rootPath, toolIds, report, note);
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
    panel.webview.html = buildQuickRefHtml();
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
    const markdown = buildSupportedToolsMarkdown(getAllTools());
    await openMarkdownDocument(markdown);
  });

  const checkConfigsCommand = vscode.commands.registerCommand('karpathy-guidelines.checkConfigs', async (uri?: vscode.Uri) => {
    const rootPath = getWorkspaceRoot(uri);
    if (!rootPath) {
      vscode.window.showInformationMessage('No workspace folder open');
      return;
    }

    const statuses = await inspectWorkspace(rootPath);
    await openMarkdownDocument(buildWorkspaceStatusMarkdown(rootPath, statuses));
  });

  const installGlobalCommand = vscode.commands.registerCommand('karpathy-guidelines.installGlobal', async () => {
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

    const results = await installGlobal(selected.map(s => s.tool.id), { overwriteExisting: overwrite });

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
    const allTools = getAllTools();
    const cliTools = allTools.filter(t => t.type === 'cli' && t.id !== 'copilot-cli');

    const config = vscode.workspace.getConfiguration('karpathyGuidelines');
    const overwrite = config.get('overwriteExisting', false) as boolean;

    await vscode.window.withProgress(
      { location: vscode.ProgressLocation.Notification, title: 'Installing global configs...', cancellable: false },
      async () => {
        const results = await installGlobal(cliTools.map(t => t.id), { overwriteExisting: overwrite });

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
