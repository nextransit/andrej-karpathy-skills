import * as https from 'https';
import { Language } from './i18n';
import { buildGuidelinesContent, getGuidelinesBody } from './guidelines';
import { InstructionSkill } from './tools/types';

const GITHUB_SEARCH_TIMEOUT_MS = 3000;
const GITHUB_RAW_TIMEOUT_MS = 1500;
const GITHUB_DISCOVERY_TIMEOUT_MS = 3500;
const MAX_REMOTE_SKILLS = 8;
const KARPATHY_SKILL_ID = 'karpathy-guidelines';

interface GitHubSearchItem {
  full_name: string;
  html_url: string;
  description?: string;
  stargazers_count: number;
  pushed_at: string;
  default_branch: string;
}

interface GitHubSearchResponse {
  items?: GitHubSearchItem[];
}

export const KARPATHY_SKILL: InstructionSkill = {
  id: KARPATHY_SKILL_ID,
  slug: KARPATHY_SKILL_ID,
  displayName: 'Karpathy Guidelines',
  description: 'Behavioral guidelines to reduce common LLM coding mistakes.',
  source: 'builtin',
  localizedDisplayName: {
    en: 'Karpathy Guidelines',
    'zh-CN': 'Karpathy 行为准则',
  },
  localizedDescription: {
    en: 'Behavioral guidelines to reduce common LLM coding mistakes.',
    'zh-CN': '减少常见 LLM 编码错误的行为准则。',
  },
  localizedContent: {
    en: buildGuidelinesContent('en', true),
    'zh-CN': buildGuidelinesContent('zh-CN', true),
  },
};

function formatDateForGitHub(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'skill';
}

function yamlString(value: string): string {
  return JSON.stringify(value);
}

function requestText(url: string, timeoutMs: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const request = https.get(
      url,
      {
        headers: {
          'Accept': 'application/vnd.github+json,text/plain',
          'User-Agent': 'karpathy-guidelines-vscode-extension',
        },
        timeout: timeoutMs,
      },
      (response) => {
        const statusCode = response.statusCode || 0;
        if (statusCode >= 300 && statusCode < 400 && response.headers.location) {
          response.resume();
          requestText(response.headers.location, timeoutMs).then(resolve, reject);
          return;
        }

        if (statusCode < 200 || statusCode >= 300) {
          response.resume();
          reject(new Error(`GitHub request failed with ${statusCode}`));
          return;
        }

        const chunks: Buffer[] = [];
        response.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
        response.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')));
      }
    );

    request.on('timeout', () => {
      request.destroy(new Error('GitHub request timed out'));
    });
    request.on('error', reject);
  });
}

function parseFrontmatter(content: string): { metadata: Record<string, string>; body: string } {
  if (!content.startsWith('---\n')) {
    return { metadata: {}, body: content.trim() };
  }

  const endIndex = content.indexOf('\n---', 4);
  if (endIndex === -1) {
    return { metadata: {}, body: content.trim() };
  }

  const metadata: Record<string, string> = {};
  const frontmatter = content.slice(4, endIndex).split('\n');
  for (const line of frontmatter) {
    const separator = line.indexOf(':');
    if (separator === -1) {
      continue;
    }
    const key = line.slice(0, separator).trim();
    const value = line.slice(separator + 1).trim().replace(/^['"]|['"]$/g, '');
    if (key) {
      metadata[key] = value;
    }
  }

  return {
    metadata,
    body: content.slice(endIndex + 4).trim(),
  };
}

function titleFromMarkdown(body: string): string | undefined {
  const heading = body.split('\n').find((line) => line.startsWith('# '));
  return heading?.replace(/^#\s+/, '').trim();
}

function buildSearchUrl(): string {
  const since = new Date();
  since.setUTCDate(since.getUTCDate() - 30);
  const query = [
    'ai skill',
    'SKILL.md',
    `pushed:>${formatDateForGitHub(since)}`,
  ].join(' ');
  const params = new URLSearchParams({
    q: query,
    sort: 'stars',
    order: 'desc',
    per_page: String(MAX_REMOTE_SKILLS),
  });
  return `https://api.github.com/search/repositories?${params.toString()}`;
}

async function fetchSkillFile(repo: GitHubSearchItem): Promise<string | undefined> {
  const encodedFullName = repo.full_name
    .split('/')
    .map((part) => encodeURIComponent(part))
    .join('/');
  const branch = encodeURIComponent(repo.default_branch || 'main');
  const rawUrl = `https://raw.githubusercontent.com/${encodedFullName}/${branch}/SKILL.md`;

  try {
    return await requestText(rawUrl, GITHUB_RAW_TIMEOUT_MS);
  } catch {
    return undefined;
  }
}

function remoteSkillFromRepo(repo: GitHubSearchItem, skillContent?: string): InstructionSkill {
  const parsed = skillContent ? parseFrontmatter(skillContent) : { metadata: {}, body: '' };
  const metadataName = parsed.metadata.name;
  const displayName = titleFromMarkdown(parsed.body) || metadataName || repo.full_name.split('/').pop() || repo.full_name;
  const description = parsed.metadata.description || repo.description || 'GitHub AI skill repository';

  return {
    id: `github:${repo.full_name}`,
    slug: slugify(metadataName || repo.full_name),
    displayName,
    description,
    source: 'github',
    content: parsed.body || `# ${displayName}\n\n${description}\n\nSource: ${repo.html_url}`,
    repositoryFullName: repo.full_name,
    repositoryUrl: repo.html_url,
    defaultBranch: repo.default_branch,
    stars: repo.stargazers_count,
    pushedAt: repo.pushed_at,
  };
}

export function getSkillDisplayName(skill: InstructionSkill, lang: Language): string {
  return skill.localizedDisplayName?.[lang] || skill.displayName;
}

export function getSkillDescription(skill: InstructionSkill, lang: Language): string {
  return skill.localizedDescription?.[lang] || skill.description;
}

export function getSkillContent(skill: InstructionSkill, lang: Language): string {
  if (skill.localizedContent?.[lang]) {
    return skill.localizedContent[lang]!;
  }
  if (skill.content) {
    return skill.content;
  }
  return buildGuidelinesContent(lang, true);
}

export function getSkillBody(skill: InstructionSkill, lang: Language): string {
  if (skill.id === KARPATHY_SKILL_ID) {
    return getGuidelinesBody(lang);
  }
  return getSkillContent(skill, lang);
}

export function buildSkillMarkdown(skill: InstructionSkill, lang: Language): string {
  const displayName = getSkillDisplayName(skill, lang);
  const description = getSkillDescription(skill, lang);
  const source = skill.repositoryUrl ? `\nsource: ${yamlString(skill.repositoryUrl)}` : '';

  return `---
name: ${yamlString(skill.slug)}
description: ${yamlString(description)}${source}
---

# ${displayName}

${getSkillBody(skill, lang)}
`;
}

async function fetchRemoteSkills(): Promise<InstructionSkill[]> {
  const response = await requestText(buildSearchUrl(), GITHUB_SEARCH_TIMEOUT_MS);
  const data = JSON.parse(response) as GitHubSearchResponse;
  const repos = data.items || [];
  return await Promise.all(
    repos
      .filter((repo) => Boolean(repo.full_name))
      .map(async (repo) => remoteSkillFromRepo(repo, await fetchSkillFile(repo)))
  );
}

export async function discoverPopularSkills(): Promise<InstructionSkill[]> {
  try {
    const skills = await Promise.race([
      fetchRemoteSkills(),
      new Promise<InstructionSkill[]>((resolve) => setTimeout(() => resolve([]), GITHUB_DISCOVERY_TIMEOUT_MS)),
    ]);
    const seenIds = new Set<string>([KARPATHY_SKILL.id]);
    return [
      KARPATHY_SKILL,
      ...skills.filter((skill) => {
        if (seenIds.has(skill.id)) {
          return false;
        }
        seenIds.add(skill.id);
        return true;
      }),
    ];
  } catch {
    return [KARPATHY_SKILL];
  }
}

export function getSkillById(skills: InstructionSkill[], skillId?: string): InstructionSkill {
  return skills.find((skill) => skill.id === skillId) || KARPATHY_SKILL;
}
