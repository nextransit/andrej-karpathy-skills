import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import {
  ConfigGenerationOptions,
  GeneratedFileResult,
  GeneratedFileSpec,
  GenerationReport,
  Language,
  LanguageOption,
  ToolConfig,
  ToolGenerationResult,
  WorkspaceToolStatus,
} from './types';
import { RECOMMENDED_TOOL_IDS, TOOL_DISPLAY_ORDER, TOOL_LIST, TOOLS } from './registry';

function expandHome(filepath: string): string {
  if (filepath.startsWith('~/') || filepath === '~') {
    return path.join(os.homedir(), filepath.slice(1));
  }
  return filepath;
}

async function pathExists(targetPath: string): Promise<boolean> {
  try {
    await fs.promises.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

function dedupeFiles(toolIds: string[], lang: Language): Map<string, GeneratedFileSpec> {
  const files = new Map<string, GeneratedFileSpec>();

  for (const toolId of toolIds) {
    const tool = TOOLS[toolId];
    if (!tool) {
      continue;
    }

    for (const file of tool.buildFiles(lang)) {
      const existing = files.get(file.relativePath);
      if (existing && existing.content !== file.content) {
        throw new Error(`Conflicting generated content for ${file.relativePath}`);
      }
      files.set(file.relativePath, file);
    }
  }

  return files;
}

async function writeFileResult(
  rootPath: string,
  spec: GeneratedFileSpec,
  options: ConfigGenerationOptions
): Promise<GeneratedFileResult> {
  const absolutePath = path.join(rootPath, spec.relativePath);

  try {
    const exists = await pathExists(absolutePath);
    if (exists) {
      const currentContent = await fs.promises.readFile(absolutePath, 'utf-8');
      if (currentContent === spec.content) {
        return { ...spec, absolutePath, status: 'unchanged' };
      }

      if (!options.overwriteExisting) {
        return {
          ...spec,
          absolutePath,
          status: 'skipped',
          error: 'File already exists and overwrite is disabled.',
        };
      }
    }

    await fs.promises.mkdir(path.dirname(absolutePath), { recursive: true });
    await fs.promises.writeFile(absolutePath, spec.content, 'utf-8');

    return {
      ...spec,
      absolutePath,
      status: exists ? 'updated' : 'created',
    };
  } catch (error) {
    return {
      ...spec,
      absolutePath,
      status: 'error',
      error: String(error),
    };
  }
}

function buildToolResults(toolIds: string[], fileResults: Map<string, GeneratedFileResult>): ToolGenerationResult[] {
  return toolIds
    .map((toolId) => TOOLS[toolId])
    .filter((tool): tool is ToolConfig => Boolean(tool))
    .map((tool) => {
      const files = tool.buildFiles().map((file) => fileResults.get(file.relativePath)).filter(
        (file): file is GeneratedFileResult => Boolean(file)
      );
      return {
        tool,
        files,
        success: files.every((file) => file.status !== 'error'),
      };
    });
}

export async function generateConfigsForTools(
  rootPath: string,
  toolIds: string[],
  options: ConfigGenerationOptions
): Promise<GenerationReport> {
  const uniqueToolIds = Array.from(new Set(toolIds.filter((toolId) => Boolean(TOOLS[toolId]))));
  const dedupedFiles = dedupeFiles(uniqueToolIds);
  const fileResults = new Map<string, GeneratedFileResult>();

  for (const spec of dedupedFiles.values()) {
    const result = await writeFileResult(rootPath, spec, options);
    fileResults.set(spec.relativePath, result);
  }

  const allFiles = Array.from(fileResults.values()).sort((left, right) =>
    left.relativePath.localeCompare(right.relativePath)
  );

  return {
    tools: buildToolResults(uniqueToolIds, fileResults),
    allFiles,
  };
}

export async function detectTools(rootPath: string): Promise<ToolConfig[]> {
  const detected: ToolConfig[] = [];

  for (const toolId of TOOL_DISPLAY_ORDER) {
    const tool = TOOLS[toolId];
    let found = false;

    for (const marker of tool.detectMarkers) {
      if (await pathExists(path.join(rootPath, marker))) {
        found = true;
        break;
      }
    }

    if (found) {
      detected.push(tool);
    }
  }

  return detected;
}

export async function inspectWorkspace(rootPath: string): Promise<WorkspaceToolStatus[]> {
  const detectedIds = new Set((await detectTools(rootPath)).map((tool) => tool.id));
  const statuses: WorkspaceToolStatus[] = [];

  for (const tool of TOOL_LIST) {
    const existingPrimaryPaths: string[] = [];
    for (const relativePath of tool.primaryPaths) {
      if (await pathExists(path.join(rootPath, relativePath))) {
        existingPrimaryPaths.push(relativePath);
      }
    }

    statuses.push({
      tool,
      detected: detectedIds.has(tool.id),
      configured: existingPrimaryPaths.length === tool.primaryPaths.length,
      existingPrimaryPaths,
    });
  }

  return statuses;
}

export function getToolById(toolId: string): ToolConfig | undefined {
  return TOOLS[toolId];
}

export function getAllTools(): ToolConfig[] {
  return TOOL_LIST;
}

export function getRecommendedToolIds(): string[] {
  return [...RECOMMENDED_TOOL_IDS];
}

export interface GlobalInstallResult {
  tool: ToolConfig;
  path: string;
  status: 'created' | 'updated' | 'unchanged' | 'skipped' | 'error';
  error?: string;
}

export async function installGlobal(toolIds: string[], options: ConfigGenerationOptions, lang: Language = 'en'): Promise<GlobalInstallResult[]> {
  const results: GlobalInstallResult[] = [];

  for (const toolId of toolIds) {
    const tool = TOOLS[toolId];
    if (!tool) { continue; }

    const globalPaths = tool.globalPaths || [];
    if (globalPaths.length === 0) {
      results.push({
        tool,
        path: '',
        status: 'skipped',
        error: 'No global path defined for this tool'
      });
      continue;
    }

    // Use the first global path
    const globalPath = expandHome(globalPaths[0]);
    const content = tool.buildFiles(lang)[0]?.content || '';

    try {
      const exists = await pathExists(globalPath);
      if (exists && !options.overwriteExisting) {
        const currentContent = await fs.promises.readFile(globalPath, 'utf-8');
        if (currentContent === content) {
          results.push({ tool, path: globalPath, status: 'unchanged' });
        } else {
          results.push({ tool, path: globalPath, status: 'skipped', error: 'File exists, overwrite disabled' });
        }
        continue;
      }

      await fs.promises.mkdir(path.dirname(globalPath), { recursive: true });
      await fs.promises.writeFile(globalPath, content, 'utf-8');
      results.push({ tool, path: globalPath, status: exists ? 'updated' : 'created' });
    } catch (error) {
      results.push({ tool, path: globalPath, status: 'error', error: String(error) });
    }
  }

  return results;
}

export function getGlobalPaths(toolId: string): string[] {
  const tool = TOOLS[toolId];
  return tool?.globalPaths || [];
}
