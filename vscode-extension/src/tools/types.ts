export type Language = 'en' | 'zh-CN';
export type LanguageOption = 'auto' | 'en' | 'zh-CN';
export type ToolType = 'cli' | 'ide' | 'vscode-ext';

export interface InstructionSkill {
  id: string;
  slug: string;
  displayName: string;
  description: string;
  source: 'builtin' | 'github';
  content?: string;
  localizedContent?: Partial<Record<Language, string>>;
  localizedDisplayName?: Partial<Record<Language, string>>;
  localizedDescription?: Partial<Record<Language, string>>;
  repositoryFullName?: string;
  repositoryUrl?: string;
  defaultBranch?: string;
  stars?: number;
  pushedAt?: string;
}

export interface GeneratedFileSpec {
  relativePath: string;
  description: string;
  content: string;
  writeMode?: 'replace' | 'append-managed-block';
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
  buildFiles: (lang: Language, skill?: InstructionSkill) => GeneratedFileSpec[];
}

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
