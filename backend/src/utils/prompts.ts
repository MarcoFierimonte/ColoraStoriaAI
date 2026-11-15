import type { ThemeId } from '../providers/types.ts';

interface ThemePromptMeta {
  labelIt: string;
  worldElementsEn: string;
}

export const THEME_PROMPT_META: Record<ThemeId, ThemePromptMeta> = {
  pirati: {
    labelIt: 'Pirati',
    worldElementsEn:
      'a friendly wooden pirate ship, gentle ocean waves, a compass or spyglass, a treasure map, and a palm-tree island',
  },
  unicorni: {
    labelIt: 'Unicorni',
    worldElementsEn:
      'a gentle smiling unicorn, a sweeping rainbow, fluffy clouds, twinkling stars, and meadow flowers',
  },
  draghi: {
    labelIt: 'Draghi',
    worldElementsEn:
      'a cheerful friendly baby dragon with rounded wings, rolling hills, distant storybook castle towers, and puffy clouds',
  },
  spazio: {
    labelIt: 'Spazio',
    worldElementsEn:
      'a playful space rocket, ringed planets, a smiling crescent moon, floating stars, and a gentle astronaut helmet or suit',
  },
  dinosauri: {
    labelIt: 'Dinosauri',
    worldElementsEn:
      'a friendly long-necked dinosaur, giant fern leaves, rounded prehistoric hills, and a calm volcano in the background',
  },
  principessa: {
    labelIt: 'Principessa',
    worldElementsEn:
      'a fairytale storybook castle, blooming garden arches, butterflies, stars, and a small crown or royal cape',
  },
};

export function buildRasterColoringPrompt(themeId: ThemeId): string {
  const meta = THEME_PROMPT_META[themeId];
  return [
    'Transform the subject from the provided photograph into a clean black-and-white children coloring book page.',
    'Preserve the subject facial expression, hairstyle, pose, and distinctive features in a warm, recognizable storybook line-art style.',
    `Place the subject inside a themed scene featuring ${meta.worldElementsEn}.`,
    'Output strictly pure black ink outlines on a pure white background (#FFFFFF).',
    'No gray shading, no gradients, no crosshatching, no color fills, and no text or watermarks.',
    'Keep shapes large, open, and crisp so children can easily color them with crayons or markers.',
  ].join(' ');
}

export function buildSvgColoringPrompt(themeId: ThemeId): string {
  const meta = THEME_PROMPT_META[themeId];
  return [
    'You are an expert children coloring-book illustrator creating crisp black-and-white vector line art.',
    'Analyze the uploaded photograph carefully: observe the main person or subject (hairstyle, glasses or hat if any, facial expression, clothing silhouette, and pose).',
    `Redraw that recognizable subject as the central hero of a storybook coloring page themed around "${meta.labelIt}" featuring ${meta.worldElementsEn}.`,
    'Rules for the SVG output:',
    '1. Output valid standalone SVG with viewBox="0 0 800 1000" and xmlns="http://www.w3.org/2000/svg".',
    '2. Start with a pure white background <rect width="800" height="1000" fill="#FFFFFF" /> and include a neat rounded outer frame.',
    '3. Draw ONLY crisp black outlines (stroke="#111111", stroke-width between 3 and 5, stroke-linecap="round", stroke-linejoin="round") and white/none fills (fill="#FFFFFF" or fill="none") so overlapping shapes stay clean.',
    '4. Use NO gray shading, NO gradients, NO colored fills, NO <image>, NO <script>, and NO text labels.',
    '5. Build rich, expressive, child-friendly vector paths (25 to 60 well-crafted paths/shapes) with large open areas easy to color with crayons.',
    '6. Also write a brief warm description in Italian (1-2 sentences, field "sceneSummary") describing the generated coloring page.',
  ].join('\n');
}
