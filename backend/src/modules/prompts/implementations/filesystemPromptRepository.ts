import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { ThemeId } from '../../ai-providers/aiProvider.interface.ts';
import type { ConfigService } from '../../config/config.interface.ts';
import type {
  BuiltPrompt,
  PromptBundle,
  PromptRepository,
} from '../promptRepository.interface.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DEFAULT_PROMPTS_ROOT = path.resolve(__dirname, '../../../../../prompts');

interface PromptsConfigFile {
  activeVersion?: string;
  versions?: string[];
}

function extractVersionNumber(version: string): number {
  const match = /^v(\d+)$/i.exec(version.trim());
  return match ? Number(match[1]) : -1;
}

export class FilesystemPromptRepository implements PromptRepository {
  private readonly configService: ConfigService;
  private readonly promptsRoot: string;

  constructor(configService: ConfigService, promptsRoot = DEFAULT_PROMPTS_ROOT) {
    this.configService = configService;
    this.promptsRoot = promptsRoot;
  }

  private readPromptsConfig(): {
    activeVersion: string;
    availableVersions: string[];
  } {
    const configPath = path.join(this.promptsRoot, 'config.json');
    const rawConfig = fs.readFileSync(configPath, 'utf8');
    const parsed = JSON.parse(rawConfig) as PromptsConfigFile;

    const availableVersions = (parsed.versions ?? [])
      .map((v) => v.trim())
      .filter(Boolean);

    if (availableVersions.length === 0) {
      throw new Error('Nessuna versione prompt trovata in prompts/config.json');
    }

    return {
      activeVersion: parsed.activeVersion || 'latest',
      availableVersions,
    };
  }

  listVersions(): string[] {
    const { availableVersions } = this.readPromptsConfig();
    return [...availableVersions].sort(
      (a, b) => extractVersionNumber(a) - extractVersionNumber(b)
    );
  }

  getActiveVersion(): string {
    const { activeVersion, availableVersions } = this.readPromptsConfig();
    const envOverride = this.configService.getConfig().promptVersion;
    const requested = envOverride || activeVersion || 'latest';

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

  private loadBundle(versionOverride?: string): PromptBundle {
    const { availableVersions } = this.readPromptsConfig();
    const requested = versionOverride?.trim();
    const version = requested || this.getActiveVersion();

    if (!availableVersions.includes(version)) {
      throw new Error(
        `Versione prompt "${version}" non trovata tra quelle configurate (${availableVersions.join(', ')})`
      );
    }

    const versionDir = path.join(this.promptsRoot, version);

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

  buildRasterPrompt(themeId: ThemeId, versionOverride?: string): BuiltPrompt {
    const bundle = this.loadBundle(versionOverride);
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

  buildSvgPrompt(themeId: ThemeId, versionOverride?: string): BuiltPrompt {
    const { prompt, version } = this.buildRasterPrompt(themeId, versionOverride);
    const bundle = this.loadBundle(version);
    const combined = bundle.svgAdapter
      ? `${prompt}\n\n${bundle.svgAdapter}`
      : prompt;
    return {
      version,
      prompt: combined,
    };
  }
}
