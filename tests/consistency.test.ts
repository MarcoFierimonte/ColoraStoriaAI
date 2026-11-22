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

  const expectedThemes = [...ALLOWED_THEME_IDS].sort();

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
    [...SUPPORTED_PROVIDER_IDS].sort(),
    'firestore.rules provider whitelist is out of sync with shared/config'
  );
});

test('prompts/v2 modes.json and ages.json match shared/config constants', () => {
  const modesPath = path.join(ROOT_DIR, 'prompts', 'v2', 'modes.json');
  const modesObj = JSON.parse(fs.readFileSync(modesPath, 'utf8')) as Record<
    string,
    string
  >;
  assert.deepEqual(
    Object.keys(modesObj).sort(),
    [...ALLOWED_COLORING_MODES].sort(),
    'prompts/v2/modes.json keys must match ALLOWED_COLORING_MODES'
  );

  const agesPath = path.join(ROOT_DIR, 'prompts', 'v2', 'ages.json');
  const agesObj = JSON.parse(fs.readFileSync(agesPath, 'utf8')) as Record<
    string,
    string
  >;
  assert.deepEqual(
    Object.keys(agesObj).sort(),
    [...ALLOWED_AGE_GROUPS].sort(),
    'prompts/v2/ages.json keys must match ALLOWED_AGE_GROUPS'
  );
});
