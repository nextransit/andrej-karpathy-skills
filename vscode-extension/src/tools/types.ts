export type ToolType = 'cli' | 'ide' | 'vscode-ext';

export interface GeneratedFileSpec {
  relativePath: string;
  description: string;
  content: string;
}

export interface GeneratedFileResult extends GeneratedFileSpec {
  absolutePath: string;
  status: 'created' | 'updated' | 'unchanged' | 'skipped' | 'error';
  error?: string;
}

export interface ToolConfig {
  id: string;
  displayName: string;
  type: ToolType;
  description: string;
  website: string;
  primaryPaths: string[];
  globalPaths?: string[];
  detectMarkers: string[];
  buildFiles: (lang: Language) => GeneratedFileSpec[];
}

export type Language = 'en' | 'zh-CN';
export type LanguageOption = 'auto' | 'en' | 'zh-CN';

export interface ConfigGenerationOptions {
  overwriteExisting: boolean;
}

export interface ToolGenerationResult {
  tool: ToolConfig;
  files: GeneratedFileResult[];
  success: boolean;
}

export interface GenerationReport {
  tools: ToolGenerationResult[];
  allFiles: GeneratedFileResult[];
}

export interface WorkspaceToolStatus {
  tool: ToolConfig;
  detected: boolean;
  configured: boolean;
  existingPrimaryPaths: string[];
}
