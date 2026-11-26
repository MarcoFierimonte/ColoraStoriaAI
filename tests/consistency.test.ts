import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import {
  ALLOWED_AGE_GROUPS,
  ALLOWED_COLORING_MODES,
  ALLOWED_THEME_IDS,
  SUPPORTED_PROVIDER_IDS,
} from '../shared/config/index.ts';

const ROOT_DIR = path.resolve(import.meta.dirname, '..');

test('ALLOWED_THEME_IDS matches every prompts/v*/themes.json', () => {
  const promptConfigRaw = fs.readFileSync(
    path.join(ROOT_DIR, 'prompts', 'config.json'),
    'utf8'
  );
  const promptConfig = JSON.parse(promptConfigRaw) as {
    activeVersion: string;
    versions: string[];
  };

  assert.ok(
    Array.isArray(promptConfig.versions) && promptConfig.versions.length > 0,
    'prompts/config.json must list at least one version'
  );

  const expectedThemes = ALLOWED_THEME_IDS.toSorted();

  for (const version of promptConfig.versions) {
    const themesPath = path.join(ROOT_DIR, 'prompts', version, 'themes.json');
    assert.ok(fs.existsSync(themesPath), `Missing ${themesPath}`);
    const themesObj = JSON.parse(fs.readFileSync(themesPath, 'utf8')) as Record<
      string,
      string
    >;
    const promptThemes = Object.keys(themesObj).sort();
    assert.deepEqual(
      promptThemes,
      expectedThemes,
      `Theme keys mismatch in prompts/${version}/themes.json`
    );
  }
});

test('ALLOWED_THEME_IDS and SUPPORTED_PROVIDER_IDS match firestore.rules', () => {
  const rules = fs.readFileSync(path.join(ROOT_DIR, 'firestore.rules'), 'utf8');

  const themeMatch = rules.match(/data\.themeId\s+in\s+\[([^\]]+)\]/);
  assert.ok(themeMatch, 'firestore.rules must validate data.themeId in [...]');
  const ruleThemes = themeMatch[1]
    .split(',')
    .map((s) => s.trim().replace(/^['"]|['"]$/g, ''))
    .filter(Boolean)
    .sort();

  assert.deepEqual(
    ruleThemes,
    ['fedele', ...ALLOWED_THEME_IDS].sort(),
    'firestore.rules themeId whitelist is out of sync with shared/config'
  );

  const providerMatch = rules.match(/data\.provider\s+in\s+\[([^\]]+)\]/);
  assert.ok(
    providerMatch,
    'firestore.rules must validate data.provider in [...]'
  );
  const ruleProviders = providerMatch[1]
    .split(',')
    .map((s) => s.trim().replace(/^['"]|['"]$/g, ''))
    .filter(Boolean)
    .sort();

  assert.deepEqual(
    ruleProviders,
    SUPPORTED_PROVIDER_IDS.toSorted(),
    'firestore.rules provider whitelist is out of sync with shared/config'
  );
});

test('prompts/v2 and prompts/v3 modes.json and ages.json match shared/config constants', () => {
  for (const version of ['v2', 'v3'] as const) {
    const modesPath = path.join(ROOT_DIR, 'prompts', version, 'modes.json');
    const modesObj = JSON.parse(fs.readFileSync(modesPath, 'utf8')) as Record<
      string,
      string
    >;
    assert.deepEqual(
      Object.keys(modesObj).sort(),
      ALLOWED_COLORING_MODES.toSorted(),
      `prompts/${version}/modes.json keys must match ALLOWED_COLORING_MODES`
    );

    const agesPath = path.join(ROOT_DIR, 'prompts', version, 'ages.json');
    const agesObj = JSON.parse(fs.readFileSync(agesPath, 'utf8')) as Record<
      string,
      string
    >;
    assert.deepEqual(
      Object.keys(agesObj).sort(),
      ALLOWED_AGE_GROUPS.toSorted(),
      `prompts/${version}/ages.json keys must match ALLOWED_AGE_GROUPS`
    );
  }
});

const EXAMPLE_GALLERY_SLUGS = [
  'toy-boy',
  'doll-girl',
  'cute-dog',
  'cute-cat',
  'mountain-landscape',
  'toddler-playing',
] as const;

test('all 6 real example trios exist with valid magic bytes and cover all ALLOWED_THEME_IDS', () => {
  const examplesDir = path.join(
    ROOT_DIR,
    'web-app',
    'src',
    'assets',
    'images',
    'examples'
  );

  for (const slug of EXAMPLE_GALLERY_SLUGS) {
    const photoPath = path.join(examplesDir, `${slug}-photo.jpg`);
    assert.ok(fs.existsSync(photoPath), `Missing ${photoPath}`);
    const photoBuf = fs.readFileSync(photoPath);
    assert.ok(photoBuf.length > 0, `${photoPath} must be non-empty`);
    assert.equal(
      photoBuf[0] === 0xff && photoBuf[1] === 0xd8 && photoBuf[2] === 0xff,
      true,
      `${photoPath} must have JPEG magic bytes`
    );

    for (const suffix of ['faithful', 'creative'] as const) {
      const webpPath = path.join(examplesDir, `${slug}-${suffix}.webp`);
      assert.ok(fs.existsSync(webpPath), `Missing ${webpPath}`);
      const webpBuf = fs.readFileSync(webpPath);
      assert.ok(webpBuf.length >= 12, `${webpPath} must be non-empty`);
      assert.equal(
        webpBuf.subarray(0, 4).toString('ascii') === 'RIFF' &&
          webpBuf.subarray(8, 12).toString('ascii') === 'WEBP',
        true,
        `${webpPath} must have WebP magic bytes`
      );
    }
  }

  const templateSource = fs.readFileSync(
    path.join(ROOT_DIR, 'web-app', 'src', 'config', 'siteTemplate.ts'),
    'utf8'
  );
  const galleryStart = templateSource.indexOf('examplesGallery:');
  assert.ok(galleryStart !== -1, 'siteTemplate.ts must define examplesGallery');
  const gallerySection = templateSource.slice(galleryStart).toLowerCase();

  for (const slug of EXAMPLE_GALLERY_SLUGS) {
    assert.ok(
      gallerySection.includes(`'${slug}'`),
      `examplesGallery must reference example id "${slug}"`
    );
  }

  for (const themeId of ALLOWED_THEME_IDS) {
    assert.ok(
      gallerySection.includes(`'${themeId}'`),
      `examplesGallery must showcase creative theme "${themeId}"`
    );
  }
});

function extractMatchBlockBody(source: string, headerPattern: RegExp): string {
  const withoutComments = source.replace(/\/\/[^\n]*/g, '');
  const match = headerPattern.exec(withoutComments);
  assert.ok(match, `Missing expected rules block matching ${headerPattern}`);
  const openBraceIndex = match.index + match[0].length - 1;
  assert.equal(withoutComments[openBraceIndex], '{');

  let depth = 0;
  for (let i = openBraceIndex; i < withoutComments.length; i++) {
    const ch = withoutComments[i];
    if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (depth === 0) {
        return withoutComments.slice(openBraceIndex + 1, i);
      }
    }
  }
  assert.fail(`Unbalanced braces for rules block matching ${headerPattern}`);
}

function extractDirectAllowStatements(blockBody: string): string[] {
  let topLevel = '';
  let depth = 0;
  for (const ch of blockBody) {
    if (ch === '{') {
      depth++;
      continue;
    }
    if (ch === '}') {
      depth--;
      continue;
    }
    if (depth === 0) {
      topLevel += ch;
    }
  }
  return (topLevel.match(/allow\b[^;]*;/g) ?? []).map((stmt) =>
    stmt.replace(/\s+/g, ' ').trim()
  );
}

test('firestore.rules explicitly keeps beta_invites, prompt_eval_runs, and prompt_eval_datasets (+ items subcollections) server-only', () => {
  const rules = fs.readFileSync(path.join(ROOT_DIR, 'firestore.rules'), 'utf8');

  const betaInvitesBody = extractMatchBlockBody(
    rules,
    /match\s+\/beta_invites\/\{[^}]+\}\s*\{/
  );
  assert.deepEqual(
    extractDirectAllowStatements(betaInvitesBody),
    ['allow read, write: if false;'],
    'beta_invites must deny all client read/write access'
  );

  const promptEvalRunsBody = extractMatchBlockBody(
    rules,
    /match\s+\/prompt_eval_runs\/\{[^}]+\}\s*\{/
  );
  assert.deepEqual(
    extractDirectAllowStatements(promptEvalRunsBody),
    ['allow read, write: if false;'],
    'prompt_eval_runs must deny all client read/write access'
  );

  const promptEvalItemsBody = extractMatchBlockBody(
    promptEvalRunsBody,
    /match\s+\/items\/\{[^}]+\}\s*\{/
  );
  assert.deepEqual(
    extractDirectAllowStatements(promptEvalItemsBody),
    ['allow read, write: if false;'],
    'prompt_eval_runs/{runId}/items must deny all client read/write access'
  );

  const promptEvalDatasetsBody = extractMatchBlockBody(
    rules,
    /match\s+\/prompt_eval_datasets\/\{[^}]+\}\s*\{/
  );
  assert.deepEqual(
    extractDirectAllowStatements(promptEvalDatasetsBody),
    ['allow read, write: if false;'],
    'prompt_eval_datasets must deny all client read/write access'
  );

  const promptEvalDatasetItemsBody = extractMatchBlockBody(
    promptEvalDatasetsBody,
    /match\s+\/items\/\{[^}]+\}\s*\{/
  );
  assert.deepEqual(
    extractDirectAllowStatements(promptEvalDatasetItemsBody),
    ['allow read, write: if false;'],
    'prompt_eval_datasets/{datasetId}/items must deny all client read/write access'
  );
});

test('modernized assets and ES2023 TypeScript baseline stay intact', () => {
  const tsconfig = JSON.parse(
    fs.readFileSync(path.join(ROOT_DIR, 'tsconfig.json'), 'utf8')
  ) as { compilerOptions?: { target?: string; lib?: string[] } };
  assert.equal(tsconfig.compilerOptions?.target, 'ES2023');
  assert.ok(
    tsconfig.compilerOptions?.lib?.includes('ES2023'),
    'tsconfig.json lib must include ES2023'
  );

  assert.equal(
    fs.existsSync(
      path.join(ROOT_DIR, 'web-app', 'public', 'assets', 'fonts', 'DMMono-Regular.ttf')
    ),
    false,
    'Legacy DMMono-Regular.ttf must stay removed in favor of @fontsource/dm-mono'
  );

  const orderConfigSrc = fs.readFileSync(
    path.join(ROOT_DIR, 'web-app', 'src', 'config', 'orderConfig.ts'),
    'utf8'
  );
  assert.equal(
    orderConfigSrc.includes('VISUAL_PLACEHOLDERS'),
    false,
    'Unused VISUAL_PLACEHOLDERS must stay removed from orderConfig.ts'
  );
});

test('promoted V2 UX removes parallel /v2 files and preserves existing SITE_TEMPLATE copy', () => {
  assert.equal(
    fs.existsSync(path.join(ROOT_DIR, 'web-app', 'src', 'components', 'v2')),
    false,
    'Parallel web-app/src/components/v2 directory must stay removed after promotion'
  );
  assert.equal(
    fs.existsSync(
      path.join(ROOT_DIR, 'web-app', 'src', 'config', 'designRoutes.ts')
    ),
    false,
    'Parallel web-app/src/config/designRoutes.ts must stay removed after promotion'
  );

  const templateSrc = fs.readFileSync(
    path.join(ROOT_DIR, 'web-app', 'src', 'config', 'siteTemplate.ts'),
    'utf8'
  );
  for (const preservedCopy of [
    "'Una foto, una pagina '",
    "'da colorare'",
    "'Inizia ora'",
    "'Se lo vedi, lo puoi colorare.'",
    "'Come funziona'",
    "'Pronto a provare?'",
  ]) {
    assert.ok(
      templateSrc.includes(preservedCopy),
      `siteTemplate.ts must preserve existing copy ${preservedCopy}`
    );
  }
});
