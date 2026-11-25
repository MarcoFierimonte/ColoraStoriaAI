import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type {
  ColoringAgeGroup,
  ColoringStyleMode,
  ThemeId,
} from '../../ai-providers/aiProvider.interface.ts';
import { getServerConfig, type ServerConfig } from '../../config/index.ts';
import type {
  BuiltPrompt,
  PromptBuildOptions,
  PromptBundle,
  PromptRepository,
} from '../promptRepository.interface.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DEFAULT_PROMPTS_ROOT = path.resolve(__dirname, '../../../../../prompts');

const LEGACY_FAITHFUL_INSTRUCTION =
  'FAITHFUL PHOTO MODE (NO FANTASY THEME): Strictly reproduce ONLY the real subject(s), clothing and real setting/background actually visible in the attached photo as crisp black outlines on white. Do NOT add or invent any fantasy theme, costumes, crowns, hats or imaginary props.';

interface PromptsConfigFile {
  activeVersion?: string;
  versions?: string[];
}

function extractVersionNumber(version: string): number {
  const match = /^v(\d+)$/i.exec(version.trim());
  return match ? Number(match[1]) : -1;
}

export class FilesystemPromptRepository implements PromptRepository {
  private readonly config: ServerConfig;
  private readonly promptsRoot: string;

  constructor(
    config: ServerConfig = getServerConfig(),
    promptsRoot = DEFAULT_PROMPTS_ROOT
  ) {
    this.config = config;
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
    return availableVersions.toSorted(
      (a, b) => extractVersionNumber(a) - extractVersionNumber(b)
    );
  }

  getActiveVersion(): string {
    const { activeVersion, availableVersions } = this.readPromptsConfig();
    const envOverride = this.config.promptVersion;
    const requested = envOverride || activeVersion || 'latest';

    if (requested !== 'latest') {
      if (!availableVersions.includes(requested)) {
        throw new Error(
          `Versione prompt "${requested}" non trovata tra quelle configurate (${availableVersions.join(', ')})`
        );
      }
      return requested;
    }

    const sorted = availableVersions.toSorted(
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

    const modesPath = path.join(versionDir, 'modes.json');
    const modes = fs.existsSync(modesPath)
      ? (JSON.parse(fs.readFileSync(modesPath, 'utf8')) as Record<
          ColoringStyleMode,
          string
        >)
      : undefined;

    const agesPath = path.join(versionDir, 'ages.json');
    const ages = fs.existsSync(agesPath)
      ? (JSON.parse(fs.readFileSync(agesPath, 'utf8')) as Record<
          ColoringAgeGroup,
          string
        >)
      : undefined;

    const svgAdapterPath = path.join(versionDir, 'svg-adapter.txt');
    const svgAdapter = fs.existsSync(svgAdapterPath)
      ? fs.readFileSync(svgAdapterPath, 'utf8').trim()
      : '';

    return {
      version,
      basePrompt,
      themes,
      modes,
      ages,
      svgAdapter,
    };
  }

  buildRasterPrompt(options: PromptBuildOptions): BuiltPrompt {
    const bundle = this.loadBundle(options.versionOverride);
    const parts: string[] = [];

    if (options.mode === 'fedele') {
      if (bundle.modes?.fedele) {
        parts.push(bundle.basePrompt, bundle.modes.fedele.trim());
      } else {
        const sanitizedLegacyBase = bundle.basePrompt
          .replace(/^Apply the theme ONLY[^\n]*$/im, '')
          .trim();
        parts.push(sanitizedLegacyBase, LEGACY_FAITHFUL_INSTRUCTION);
      }
    } else {
      if (!options.themeId) {
        throw new Error('Tema mancante per la modalità creativa.');
      }
      const themeBlock = bundle.themes[options.themeId];
      if (!themeBlock) {
        throw new Error(
          `Blocco tema "${options.themeId}" mancante nella versione prompt ${bundle.version}`
        );
      }

      if (bundle.modes?.creativa) {
        parts.push(
          bundle.basePrompt,
          `${bundle.modes.creativa.trim()} ${themeBlock.trim()}`
        );
      } else {
        parts.push(`${bundle.basePrompt}\n${themeBlock.trim()}`);
      }
      if (options.ageGroup && bundle.ages?.[options.ageGroup]) {
        parts.push(bundle.ages[options.ageGroup].trim());
      }
    }

    return {
      version: bundle.version,
      prompt: parts.join('\n\n'),
    };
  }

  buildSvgPrompt(options: PromptBuildOptions): BuiltPrompt {
    const { prompt, version } = this.buildRasterPrompt(options);
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
