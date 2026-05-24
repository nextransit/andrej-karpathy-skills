# Karpathy Guidelines VSCode Extension

VSCode 插件，用于将 Karpathy 行为准则应用到 AI 编码工作流中。

## 功能特性

### 命令面板 (Ctrl+Shift+P)

| 命令 | 功能 |
|------|------|
| `Karpathy Guidelines: Show Rules` | 在新标签页显示完整的行为准则 |
| `Karpathy Guidelines: Quick Reference` | 打开快速参考面板 |
| `Karpathy Guidelines: Insert into Current File` | 在光标位置插入准则（支持注释格式） |
| `Karpathy Guidelines: Create Config Files` | 为目标 AI 工具创建配置文件 |

### 右键菜单

- **编辑器上下文菜单**: 插入准则 / 显示规则
- **文件夹资源管理器**: 创建配置文件

### 支持的 AI 工具配置

| 工具 | 配置文件路径 |
|------|-------------|
| Cursor | `.cursor/rules/karpathy-guidelines.mdc` |
| Windsurf | `.windsurf/rules/karpathy-guidelines.md` |
| Cline | `.clinerules` |
| Continue | `.continue/checks/karpathy-guidelines.md` |
| Copilot | `.github/copilot-instructions.md` |

## 安装

### 开发模式安装

```bash
cd vscode-extension
npm install
npm run compile
code --extensionDevelopmentPath=$(pwd)
```

### 打包安装

```bash
npm install
npm run package
# 生成 .vsix 文件
code --install-extension karpathy-guidelines-1.0.0.vsix
```

## 发布到 Marketplace

```bash
# 登录
npx vsce login decard

# 发布
npx vsce publish
```

## 配置项

| 配置项 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| `karpathyGuidelines.insertAs` | `markdown \| comments \| plaintext` | `markdown` | 插入时的格式 |
| `karpathyGuidelines.autoActivate` | `boolean` | `false` | 编辑 Markdown 时自动显示快速参考 |
| `karpathyGuidelines.defaultTool` | `cursor \| windsurf \| cline \| continue \| copilot` | `cursor` | 创建配置文件的默认工具 |

## 四项准则

1. **Think Before Coding** - 编码前先思考，陈述假设，不清晰时提问
2. **Simplicity First** - 简洁优先，最小代码，不做假设性工作
3. **Surgical Changes** - 精准修改，只触碰必须修改的地方
4. **Goal-Driven Execution** - 目标驱动，定义成功标准并验证

## License

MIT
