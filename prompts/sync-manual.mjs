import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const entries = fs.readdirSync(__dirname, { withFileTypes: true });
const versionDirs = entries
  .filter((entry) => entry.isDirectory() && /^v\d+$/i.test(entry.name))
  .map((entry) => entry.name)
  .sort();

for (const version of versionDirs) {
  const versionPath = path.join(__dirname, version);
  const basePath = path.join(versionPath, 'base.txt');
  const themesPath = path.join(versionPath, 'themes.json');

  if (!fs.existsSync(basePath) || !fs.existsSync(themesPath)) {
    continue;
  }

  const basePrompt = fs.readFileSync(basePath, 'utf8').trim();
  const themes = JSON.parse(fs.readFileSync(themesPath, 'utf8'));

  const manualPrompts = {};
  for (const [styleKey, themeBlock] of Object.entries(themes)) {
    manualPrompts[styleKey] = `${basePrompt}\n${String(themeBlock).trim()}`;
  }

  const outputPath = path.join(versionPath, 'manual-test.json');
  fs.writeFileSync(
    outputPath,
    `${JSON.stringify(manualPrompts, null, 2)}\n`,
    'utf8'
  );
  console.log(`Generated ${path.relative(process.cwd(), outputPath)}`);
}
