import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import {
  ConfigGenerationOptions,
  GeneratedFileResult,
  GeneratedFileSpec,
  GenerationReport,
  InstructionSkill,
  Language,
  LanguageOption,
  ToolConfig,
  ToolGenerationResult,
  WorkspaceToolStatus,
} from './types';
import { RECOMMENDED_TOOL_IDS, TOOL_DISPLAY_ORDER, TOOL_LIST, TOOLS } from './registry';
import { buildSkillMarkdown } from '../skills';

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

const MANAGED_BLOCK_START = '<!-- KARPATHY_GUIDELINES_START -->';
const MANAGED_BLOCK_END = '<!-- KARPATHY_GUIDELINES_END -->';
function buildManagedBlock(content: string): string {
  return `${MANAGED_BLOCK_START}\n${content.trimEnd()}\n${MANAGED_BLOCK_END}\n`;
}

function mergeManagedBlock(currentContent: string, generatedContent: string): string {
  const block = buildManagedBlock(generatedContent);
  const normalizedCurrent = currentContent.trim();
  const normalizedGenerated = generatedContent.trim();

  if (normalizedCurrent === normalizedGenerated) {
    return block;
  }

  const startIndex = currentContent.indexOf(MANAGED_BLOCK_START);
  const endIndex = currentContent.indexOf(MANAGED_BLOCK_END, startIndex);

  if (startIndex >= 0 && endIndex >= 0) {
    const blockEndIndex = endIndex + MANAGED_BLOCK_END.length;
    const before = currentContent.slice(0, startIndex).trimEnd();
    const after = currentContent.slice(blockEndIndex).trimStart();
    const parts = [before, block.trimEnd(), after].filter((part) => part.length > 0);
    return `${parts.join('\n\n')}\n`;
  }

  const separator = currentContent.trimEnd().length > 0 ? '\n\n' : '';
  return `${currentContent.trimEnd()}${separator}${block}`;
}

export function getWorkspaceSkillRelativePath(skill: InstructionSkill): string {
  return path.posix.join('skills', skill.slug, 'SKILL.md');
}

export function getGlobalSkillPathForTool(tool: ToolConfig, skill: InstructionSkill): string | undefined {
  const globalPath = tool.globalPaths?.[0];
  if (!globalPath) {
    return undefined;
  }

  return path.posix.join(path.posix.dirname(globalPath), 'skills', skill.slug, 'SKILL.md');
}

function buildSkillFileSpec(skill: InstructionSkill, lang: Language): GeneratedFileSpec {
  return {
    relativePath: getWorkspaceSkillRelativePath(skill),
    description: lang === 'zh-CN' ? 'Skill 定义文件' : 'Skill definition file',
    content: buildSkillMarkdown(skill, lang),
  };
}

function dedupeFiles(toolIds: string[], lang: Language, skill?: InstructionSkill): Map<string, GeneratedFileSpec> {
  const files = new Map<string, GeneratedFileSpec>();

  for (const toolId of toolIds) {
    const tool = TOOLS[toolId];
    if (!tool) {
      continue;
    }

    for (const file of tool.buildFiles(lang, skill)) {
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
    const currentContent = exists ? await fs.promises.readFile(absolutePath, 'utf-8') : '';
    const nextContent = spec.writeMode === 'append-managed-block'
      ? mergeManagedBlock(currentContent, spec.content)
      : spec.content;

    if (exists) {
      if (currentContent === nextContent) {
        return { ...spec, absolutePath, status: 'unchanged' };
      }

      if (!options.overwriteExisting && spec.writeMode !== 'append-managed-block') {
        return {
          ...spec,
          absolutePath,
          status: 'skipped',
          error: 'File already exists and overwrite is disabled.',
        };
      }
    }

    await fs.promises.mkdir(path.dirname(absolutePath), { recursive: true });
    await fs.promises.writeFile(absolutePath, nextContent, 'utf-8');

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

function buildToolResults(
  toolIds: string[],
  fileResults: Map<string, GeneratedFileResult>,
  lang: Language,
  skill?: InstructionSkill
): ToolGenerationResult[] {
  return toolIds
    .map((toolId) => TOOLS[toolId])
    .filter((tool): tool is ToolConfig => Boolean(tool))
    .map((tool) => {
      const files = tool.buildFiles(lang, skill).map((file) => fileResults.get(file.relativePath)).filter(
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
  options: ConfigGenerationOptions,
  lang: Language = 'en',
  skill?: InstructionSkill
): Promise<GenerationReport> {
  const uniqueToolIds = Array.from(new Set(toolIds.filter((toolId) => Boolean(TOOLS[toolId]))));
  const dedupedFiles = dedupeFiles(uniqueToolIds, lang, skill);
  const fileResults = new Map<string, GeneratedFileResult>();

  for (const spec of dedupedFiles.values()) {
    const result = await writeFileResult(rootPath, spec, options);
    fileResults.set(spec.relativePath, result);
  }

  const allFiles = Array.from(fileResults.values()).sort((left, right) =>
    left.relativePath.localeCompare(right.relativePath)
  );

  return {
    tools: buildToolResults(uniqueToolIds, fileResults, lang, skill),
    allFiles,
  };
}

export async function installWorkspaceSkill(
  rootPath: string,
  skill: InstructionSkill,
  options: ConfigGenerationOptions,
  lang: Language = 'en'
): Promise<GeneratedFileResult> {
  return writeFileResult(rootPath, buildSkillFileSpec(skill, lang), options);
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

export async function installGlobal(toolIds: string[], options: ConfigGenerationOptions, lang: Language = 'en', skill?: InstructionSkill): Promise<GlobalInstallResult[]> {
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
    const globalBasename = path.basename(globalPath);
    const generatedFiles = tool.buildFiles(lang, skill);

    // Find matching file:
    // 1) Exact relativePath match (e.g., "CLAUDE.md" === "CLAUDE.md")
    // 2) Basename match (e.g., basename of "path/to/CLAUDE.md" === "CLAUDE.md")
    // Falls back to first generated file (should be the main config like AGENTS.md)
    const matchingFile =
      generatedFiles.find((file) => file.relativePath === globalBasename) ||
      generatedFiles.find((file) => path.basename(file.relativePath) === globalBasename) ||
      generatedFiles[0];
    const spec = matchingFile;

    try {
      const exists = await pathExists(globalPath);
      const currentContent = exists ? await fs.promises.readFile(globalPath, 'utf-8') : '';
      const nextContent = spec?.writeMode === 'append-managed-block'
        ? mergeManagedBlock(currentContent, spec.content)
        : spec?.content || '';

      if (exists) {
        if (currentContent === nextContent) {
          results.push({ tool, path: globalPath, status: 'unchanged' });
          continue;
        }

        if (!options.overwriteExisting && spec?.writeMode !== 'append-managed-block') {
          results.push({ tool, path: globalPath, status: 'skipped', error: 'File exists, overwrite disabled' });
          continue;
        }
      }

      await fs.promises.mkdir(path.dirname(globalPath), { recursive: true });
      await fs.promises.writeFile(globalPath, nextContent, 'utf-8');
      results.push({ tool, path: globalPath, status: exists ? 'updated' : 'created' });
    } catch (error) {
      results.push({ tool, path: globalPath, status: 'error', error: String(error) });
    }
  }

  return results;
}

export async function installGlobalSkills(toolIds: string[], options: ConfigGenerationOptions, lang: Language = 'en', skill: InstructionSkill): Promise<GlobalInstallResult[]> {
  const results: GlobalInstallResult[] = [];

  for (const toolId of toolIds) {
    const tool = TOOLS[toolId];
    if (!tool) { continue; }

    const displayPath = getGlobalSkillPathForTool(tool, skill);
    if (!displayPath) {
      results.push({
        tool,
        path: '',
        status: 'skipped',
        error: 'No global skill path defined for this tool'
      });
      continue;
    }

    const absolutePath = expandHome(displayPath);
    const spec = {
      ...buildSkillFileSpec(skill, lang),
      relativePath: path.basename(absolutePath),
    };
    const result = await writeFileResult(path.dirname(absolutePath), spec, options);

    results.push({
      tool,
      path: absolutePath,
      status: result.status,
      error: result.error,
    });
  }

  return results;
}

export function getGlobalPaths(toolId: string): string[] {
  const tool = TOOLS[toolId];
  return tool?.globalPaths || [];
}
