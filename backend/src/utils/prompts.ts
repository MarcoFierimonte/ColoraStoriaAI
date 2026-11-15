import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getServerConfig } from '../config/env.ts';
import type { ThemeId } from '../providers/types.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROMPTS_ROOT = path.resolve(__dirname, '../../../prompts');

interface PromptsConfigFile {
  activeVersion?: string;
  versions?: string[];
}

interface PromptBundle {
  version: string;
  basePrompt: string;
  themes: Record<ThemeId, string>;
  svgAdapter: string;
}

function extractVersionNumber(version: string): number {
  const match = /^v(\d+)$/i.exec(version.trim());
  return match ? Number(match[1]) : -1;
}

function resolveActivePromptVersion(): string {
  const configPath = path.join(PROMPTS_ROOT, 'config.json');
  const rawConfig = fs.readFileSync(configPath, 'utf8');
  const parsed = JSON.parse(rawConfig) as PromptsConfigFile;

  const envOverride = getServerConfig().promptVersion;
  const requested = envOverride || parsed.activeVersion || 'latest';

  const availableVersions = (parsed.versions ?? [])
    .map((v) => v.trim())
    .filter(Boolean);

  if (availableVersions.length === 0) {
    throw new Error('Nessuna versione prompt trovata in prompts/config.json');
  }

  if (requested !== 'latest') {
    if (!availableVersions.includes(requested)) {
      throw new Error(
        `Versione prompt "${requested}" non trovata tra quelle configurate (${availableVersions.join(', ')})`
      );
    }
    return requested;
  }

  const sorted = [...availableVersions].sort(
    (a, b) => extractVersionNumber(a) - extractVersionNumber(b)
  );
  return sorted[sorted.length - 1];
}

function loadPromptBundle(versionOverride?: string): PromptBundle {
  const version = versionOverride || resolveActivePromptVersion();
  const versionDir = path.join(PROMPTS_ROOT, version);

  const basePrompt = fs
    .readFileSync(path.join(versionDir, 'base.txt'), 'utf8')
    .trim();
  const themes = JSON.parse(
    fs.readFileSync(path.join(versionDir, 'themes.json'), 'utf8')
  ) as Record<ThemeId, string>;
  const svgAdapterPath = path.join(versionDir, 'svg-adapter.txt');
  const svgAdapter = fs.existsSync(svgAdapterPath)
    ? fs.readFileSync(svgAdapterPath, 'utf8').trim()
    : '';

  return {
    version,
    basePrompt,
    themes,
    svgAdapter,
  };
}

export function getActivePromptVersion(): string {
  return resolveActivePromptVersion();
}

export function buildRasterColoringPrompt(
  themeId: ThemeId,
  versionOverride?: string
): { prompt: string; version: string } {
  const bundle = loadPromptBundle(versionOverride);
  const themeBlock = bundle.themes[themeId];
  if (!themeBlock) {
    throw new Error(
      `Blocco tema "${themeId}" mancante nella versione prompt ${bundle.version}`
    );
  }
  return {
    version: bundle.version,
    prompt: `${bundle.basePrompt}\n${themeBlock}`,
  };
}

export function buildSvgColoringPrompt(
  themeId: ThemeId,
  versionOverride?: string
): { prompt: string; version: string } {
  const { prompt, version } = buildRasterColoringPrompt(themeId, versionOverride);
  const bundle = loadPromptBundle(version);
  const combined = bundle.svgAdapter
    ? `${prompt}\n\n${bundle.svgAdapter}`
    : prompt;
  return {
    version,
    prompt: combined,
  };
}
