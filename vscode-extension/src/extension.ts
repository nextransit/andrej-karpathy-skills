import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { GUIDELINES_CONTENT, QUICK_REFERENCE, CONFIG_TEMPLATES } from './guidelines';

export function activate(context: vscode.ExtensionContext) {
    const rootPath = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || '';

    // Command 1: Show full guidelines in a new document
    const showCommand = vscode.commands.registerCommand('karpathy-guidelines.show', async () => {
        const doc = await vscode.workspace.openTextDocument({
            content: GUIDELINES_CONTENT,
            language: 'markdown'
        });
        await vscode.window.showTextDocument(doc, { preview: false });
    });

    // Command 2: Insert guidelines as comments at cursor
    const insertCommand = vscode.commands.registerCommand('karpathy-guidelines.insertRules', async () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showInformationMessage('No active editor');
            return;
        }

        const config = vscode.workspace.getConfiguration('karpathyGuidelines');
        const insertAs = config.get<string>('insertAs', 'markdown');
        const commentPrefix = insertAs === 'comments' ? getCommentPrefix(editor.document.languageId) : '';

        const content = insertAs === 'markdown'
            ? GUIDELINES_CONTENT
            : insertAs === 'comments'
                ? commentPrefix + GUIDELINES_CONTENT.split('\n').join('\n' + commentPrefix)
                : GUIDELINES_CONTENT;

        const selection = editor.selection;
        await editor.edit(editBuilder => {
            editBuilder.insert(selection.start, content);
        });
    });

    // Command 3: Create config files for various AI tools
    const createConfigCommand = vscode.commands.registerCommand('karpathy-guidelines.createConfig', async (uri?: vscode.Uri) => {
        const targetPath = uri?.fsPath || rootPath;
        if (!targetPath) {
            vscode.window.showInformationMessage('No workspace folder open');
            return;
        }

        const config = vscode.workspace.getConfiguration('karpathyGuidelines');
        const defaultTool = config.get<string>('defaultTool', 'cursor');

        const tool = await vscode.window.showQuickPick(
            ['cursor', 'windsurf', 'cline', 'continue', 'copilot'],
            { placeHolder: `Select target tool (default: ${defaultTool})` }
        );

        if (!tool) { return; }

        const fullContent = GUIDELINES_CONTENT;
        let filePath = '';
        let created = false;

        try {
            switch (tool) {
                case 'cursor':
                    filePath = path.join(targetPath, '.cursor', 'rules', 'karpathy-guidelines.mdc');
                    await fs.promises.mkdir(path.dirname(filePath), { recursive: true });
                    await fs.promises.writeFile(filePath, `---\ndescription: Behavioral guidelines\nalwaysApply: true\n---\n\n${fullContent}`, 'utf-8');
                    created = true;
                    break;

                case 'windsurf':
                    filePath = path.join(targetPath, '.windsurf', 'rules', 'karpathy-guidelines.md');
                    await fs.promises.mkdir(path.dirname(filePath), { recursive: true });
                    await fs.promises.writeFile(filePath, `---\nname: karpathy-guidelines\ndescription: Behavioral guidelines\nalwaysApply: true\n---\n\n${fullContent}`, 'utf-8');
                    created = true;
                    break;

                case 'cline':
                    filePath = path.join(targetPath, '.clinerules');
                    await fs.promises.writeFile(filePath, fullContent, 'utf-8');
                    created = true;
                    break;

                case 'continue':
                    filePath = path.join(targetPath, '.continue', 'checks', 'karpathy-guidelines.md');
                    await fs.promises.mkdir(path.dirname(filePath), { recursive: true });
                    await fs.promises.writeFile(filePath, `---\nname: karpathy-guidelines\ndescription: Behavioral guidelines check\n---\n\n${fullContent}`, 'utf-8');
                    created = true;
                    break;

                case 'copilot':
                    filePath = path.join(targetPath, '.github', 'copilot-instructions.md');
                    await fs.promises.mkdir(path.dirname(filePath), { recursive: true });
                    await fs.promises.writeFile(filePath, CONFIG_TEMPLATES.copilot + '\n\n' + fullContent, 'utf-8');
                    created = true;
                    break;
            }

            if (created) {
                const doc = await vscode.workspace.openTextDocument(filePath);
                await vscode.window.showTextDocument(doc);
                vscode.window.showInformationMessage(`Created ${path.basename(filePath)} for ${tool}`);
            }
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to create config: ${error}`);
        }
    });

    // Command 4: Quick reference in a webview panel
    const quickRefCommand = vscode.commands.registerCommand('karpathy-guidelines.quickRef', async () => {
        const panel = vscode.window.createWebviewPanel(
            'karpathyQuickRef',
            'Karpathy Guidelines',
            vscode.ViewColumn.Beside,
            { retainContextWhenHidden: true }
        );

        panel.webview.html = `
<!DOCTYPE html>
<html>
<head>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            padding: 20px;
            background: #1e1e1e;
            color: #d4d4d4;
        }
        h1 { color: #569cd6; border-bottom: 1px solid #333; padding-bottom: 10px; }
        h2 { color: #4ec9b0; margin-top: 20px; }
        table { border-collapse: collapse; width: 100%; margin: 15px 0; }
        th, td { border: 1px solid #333; padding: 8px 12px; text-align: left; }
        th { background: #2d2d2d; color: #569cd6; }
        code { background: #2d2d2d; padding: 2px 6px; border-radius: 3px; }
        .principle { background: #2d2d2d; padding: 15px; margin: 10px 0; border-radius: 5px; }
        .key { color: #ce9178; }
    </style>
</head>
<body>
    <h1>Karpathy Guidelines - Quick Reference</h1>

    <table>
        <tr><th>#</th><th>Principle</th><th>Key Action</th></tr>
        <tr><td>1</td><td><strong>Think Before Coding</strong></td><td>State assumptions, ask if unclear</td></tr>
        <tr><td>2</td><td><strong>Simplicity First</strong></td><td>Minimum code, no speculative features</td></tr>
        <tr><td>3</td><td><strong>Surgical Changes</strong></td><td>Only touch what you must</td></tr>
        <tr><td>4</td><td><strong>Goal-Driven</strong></td><td>Define success criteria, verify each step</td></tr>
    </table>

    <h2>Details</h2>

    <div class="principle">
        <h3>1. Think Before Coding</h3>
        <ul>
            <li>State your assumptions explicitly. If uncertain, ask.</li>
            <li>If multiple interpretations exist, present them - don't pick silently.</li>
            <li>If something is unclear, stop. Name what's confusing. Ask.</li>
        </ul>
    </div>

    <div class="principle">
        <h3>2. Simplicity First</h3>
        <ul>
            <li>No features beyond what was asked.</li>
            <li>No abstractions for single-use code.</li>
            <li>If you write 200 lines and it could be 50, rewrite it.</li>
        </ul>
    </div>

    <div class="principle">
        <h3>3. Surgical Changes</h3>
        <ul>
            <li>Don't "improve" adjacent code, comments, or formatting.</li>
            <li>Match existing style, even if you'd do it differently.</li>
            <li>Every changed line should trace directly to the user's request.</li>
        </ul>
    </div>

    <div class="principle">
        <h3>4. Goal-Driven Execution</h3>
        <ul>
            <li>Transform tasks into verifiable goals.</li>
            <li>"Fix the bug" → "Write a test that reproduces it, then make it pass"</li>
            <li>State a brief plan with verification steps.</li>
        </ul>
    </div>

    <p style="margin-top: 30px; color: #808080;">
        Press <code>Ctrl+Shift+P</code> and search "Karpathy" for more commands.
    </p>
</body>
</html>`;
    });

    context.subscriptions.push(showCommand, insertCommand, createConfigCommand, quickRefCommand);
}

function getCommentPrefix(languageId: string): string {
    const prefixes: Record<string, string> = {
        'typescript': '// ',
        'javascript': '// ',
        'python': '# ',
        'java': '// ',
        'csharp': '// ',
        'cpp': '// ',
        'c': '// ',
        'go': '// ',
        'rust': '// ',
        'ruby': '# ',
        'php': '// ',
        'swift': '// ',
        'kotlin': '// ',
        'scala': '// ',
        'shell': '# ',
        'bash': '# ',
        'powershell': '# ',
        'sql': '-- ',
        'html': '<!-- ',
        'css': '/* ',
        'json': '// ',
        'yaml': '# ',
        'markdown': '> ',
    };
    return prefixes[languageId] || '# ';
}

export function deactivate() {}
