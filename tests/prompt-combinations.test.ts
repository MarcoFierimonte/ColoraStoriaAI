import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import test from 'node:test';
import express from 'express';
import sharp from 'sharp';
import type {
  AiProviderRegistry,
  ColoringGenerationInput,
  ColoringGenerationOutput,
  ColoringProvider,
} from '../backend/src/modules/ai-providers/index.ts';
import type { AuthTokenVerifier } from '../backend/src/modules/auth/index.ts';
import type { BetaAccessService } from '../backend/src/modules/beta-access/index.ts';
import type { BotProtectionVerifier } from '../backend/src/modules/bot-protection/index.ts';
import { parseServerConfig } from '../backend/src/modules/config/index.ts';
import { BufferImageValidator } from '../backend/src/modules/media-validation/index.ts';
import { FilesystemPromptRepository } from '../backend/src/modules/prompts/index.ts';
import { createColoringRouter } from '../backend/src/routes/coloringRoutes.ts';
import {
  ALLOWED_AGE_GROUPS,
  ALLOWED_THEME_IDS,
  type ThemeId,
} from '../shared/config/index.ts';
import {
  buildGenerateColoringRequest,
  getGenerationLogThemeId,
} from '../web-app/src/config/generationPayload.ts';
import { FetchColoringApiClient } from '../web-app/src/modules/coloring-api/index.ts';

const THEME_FORBIDDEN_TERMS_IN_FAITHFUL: Record<ThemeId, RegExp> = {
  pirati: /Original pirate adventure/,
  unicorni: /Enchanted unicorn meadow/,
  draghi: /Original dragon kingdom/,
  spazio: /Space adventure/,
  dinosauri: /Prehistoric (jungle|dinosaur world)/,
  principessa: /Fairytale kingdom/,
};

test('UI payload builder & FetchColoringApiClient strip theme and ageGroup in fedele mode and preserve all creativa selections', async () => {
  const sampleFile = new File([new Uint8Array([1, 2, 3])], 'gatto.png', {
    type: 'image/png',
  });

  // Simulate user toggling from Creativa (with Pirati + 8+ set) back to Fedele
  const faithfulRequest = buildGenerateColoringRequest({
    file: sampleFile,
    mode: 'fedele',
    themeId: 'pirati',
    ageGroup: '8+',
  });
  assert.equal(faithfulRequest.mode, 'fedele');
  assert.equal(faithfulRequest.themeId, undefined);
  assert.equal(faithfulRequest.ageGroup, undefined);
  assert.equal(getGenerationLogThemeId('fedele', 'pirati'), 'fedele');

  const creativeRequest = buildGenerateColoringRequest({
    file: sampleFile,
    mode: 'creativa',
    themeId: 'unicorni',
    ageGroup: '1-2',
  });
  assert.equal(creativeRequest.mode, 'creativa');
  assert.equal(creativeRequest.themeId, 'unicorni');
  assert.equal(creativeRequest.ageGroup, '1-2');
  assert.equal(getGenerationLogThemeId('creativa', 'unicorni'), 'unicorni');

  const capturedForms: FormData[] = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async (_input, init) => {
    if (init?.body instanceof FormData) {
      capturedForms.push(init.body);
      return new Response(
        JSON.stringify({
          ok: true,
          provider: 'gemini',
          model: 'gemini-nano-banana-2.1',
          outputFormat: 'raster',
          imageDataUrl: 'data:image/png;base64,iVBORw0KGgo=',
          sceneSummary: 'ok',
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }) as typeof fetch;

  try {
    const client = new FetchColoringApiClient('/api');

    // Also verify FetchColoringApiClient guards even if someone passes a leftover themeId with mode='fedele'
    await client.generateColoringPage({
      file: sampleFile,
      mode: 'fedele',
      themeId: 'pirati',
      ageGroup: '5-7',
    });
    const sentFaithful = capturedForms[0];
    assert.equal(sentFaithful.get('mode'), 'fedele');
    assert.equal(sentFaithful.get('theme'), null);
    assert.equal(sentFaithful.get('ageGroup'), null);

    await client.generateColoringPage({
      file: sampleFile,
      mode: 'creativa',
      themeId: 'spazio',
      ageGroup: '8+',
    });
    const sentCreative = capturedForms[1];
    assert.equal(sentCreative.get('mode'), 'creativa');
    assert.equal(sentCreative.get('theme'), 'spazio');
    assert.equal(sentCreative.get('ageGroup'), '8+');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('FilesystemPromptRepository isolates fedele from fantasy themes and builds all creativa theme/age combinations', () => {
  const repo = new FilesystemPromptRepository(parseServerConfig({}, []));
  assert.equal(repo.getActiveVersion(), 'v4');
  assert.deepEqual(repo.listVersions(), ['v1', 'v2', 'v3', 'v4']);

  // Even if caller passes a leftover themeId, mode='fedele' must NOT include any fantasy theme
  for (const versionOverride of ['v4', 'v3', 'v2', 'v1']) {
    const faithful = repo.buildRasterPrompt({
      mode: 'fedele',
      themeId: 'pirati',
      ageGroup: '5-7',
      versionOverride,
    });
    assert.equal(faithful.version, versionOverride);
    assert.match(faithful.prompt, /FAITHFUL PHOTO MODE/i);
    assert.doesNotMatch(faithful.prompt, /Original pirate adventure/i);
    assert.doesNotMatch(faithful.prompt, /Apply the theme ONLY/i);
    assert.doesNotMatch(faithful.prompt, /AGE COMPLEXITY/i);
  }

  // Verify v4 packaging/logo cleanup & pure solid black ink rules in fedele mode
  const faithfulV4 = repo.buildRasterPrompt({ mode: 'fedele' });
  assert.equal(faithfulV4.version, 'v4');
  assert.match(faithfulV4.prompt, /retail cardboard boxes/i);
  assert.match(faithfulV4.prompt, /hangtags/i);
  assert.match(faithfulV4.prompt, /ZERO grey lines/i);

  for (const themeId of ALLOWED_THEME_IDS) {
    const built = repo.buildRasterPrompt({
      mode: 'creativa',
      themeId,
      ageGroup: '3-4',
    });
    assert.equal(built.version, 'v4');
    assert.match(built.prompt, /CREATIVE FANTASY MODE/i);
    assert.match(built.prompt, /Preserve any real glasses, baseball caps/i);
    assert.doesNotMatch(built.prompt, /FAITHFUL PHOTO MODE/i);

    for (const [otherTheme, regex] of Object.entries(
      THEME_FORBIDDEN_TERMS_IN_FAITHFUL
    )) {
      if (otherTheme === themeId) {
        assert.match(built.prompt, regex);
      } else {
        assert.doesNotMatch(built.prompt, regex);
      }
    }
  }

  const agePrompts = ALLOWED_AGE_GROUPS.map((ageGroup) =>
    repo.buildRasterPrompt({
      mode: 'creativa',
      themeId: 'unicorni',
      ageGroup,
    }).prompt
  );
  assert.equal(new Set(agePrompts).size, ALLOWED_AGE_GROUPS.length);

  const svgPrompt = repo.buildSvgPrompt({
    mode: 'fedele',
  });
  assert.match(svgPrompt.prompt, /VECTOR SVG OUTPUT FORMAT/);
  assert.match(svgPrompt.prompt, /FAITHFUL PHOTO MODE/);
});

test('POST /api/coloring/generate strips stray theme in fedele mode and forwards mode/theme/ageGroup in creativa mode', async () => {
  const receivedInputs: ColoringGenerationInput[] = [];
  const samplePng = await sharp({
    create: {
      width: 400,
      height: 400,
      channels: 3,
      background: { r: 240, g: 200, b: 150 },
    },
  })
    .png()
    .toBuffer();

  const stubProvider: ColoringProvider = {
    id: 'gemini',
    label: 'Stub Gemini',
    isConfigured: () => true,
    getStatus: (isDefault) => ({
      id: 'gemini',
      label: 'Stub Gemini',
      model: 'gemini-nano-banana-2.1',
      configured: true,
      isDefault,
      tierLabel: 'Test',
    }),
    async generateColoringPage(
      input: ColoringGenerationInput
    ): Promise<ColoringGenerationOutput> {
      receivedInputs.push(input);
      return {
        provider: 'gemini',
        model: 'gemini-nano-banana-2.1',
        promptVersion: 'v2',
        outputFormat: 'raster',
        imageDataUrl: 'data:image/png;base64,iVBORw0KGgo=',
        sceneSummary: input.mode === 'fedele' ? 'Fedele' : 'Creativa',
        latencyMs: 12,
        usage: {
          inputTokens: 10,
          cachedInputTokens: 0,
          textOutputTokens: 0,
          imageOutputTokens: 100,
          estimatedCostUsd: 0,
          projectedBook16CostUsd: 0,
          isFreeTier: true,
        },
      };
    },
  };

  const providers: AiProviderRegistry = {
    getProvider: () => stubProvider,
    listStatuses: () => [stubProvider.getStatus(true)],
  };
  const auth: AuthTokenVerifier = {
    verifyOptionalRequest: async () => ({
      authenticated: false,
      isAdmin: false,
      hasAdminClaim: false,
    }),
  };
  const botProtection: BotProtectionVerifier = {
    isEnforced: () => false,
    verifyRequest: async () => ({ verified: true, provider: 'disabled' }),
  };
  const betaAccess: BetaAccessService = {
    isInviteRequired: () => false,
    getSession: async () => ({
      inviteRequired: false,
      hasAccess: true,
      accessSource: 'open',
      invite: null,
    }),
    redeemCode: async () => {
      throw new Error('Unused in test');
    },
    buildClearCookieHeader: () => '',
    assertCanGenerate: async () => {},
    assertCanExportPdf: async () => {},
    reserveGeneration: async () => null,
    refundGeneration: async () => {},
    listInvites: async () => [],
    createInvite: async () => {
      throw new Error('Unused in test');
    },
    updateInvite: async () => {
      throw new Error('Unused in test');
    },
    deleteInvite: async () => {},
  };

  const app = express();
  app.use(
    '/api',
    createColoringRouter({
      providers,
      auth,
      prompts: new FilesystemPromptRepository(parseServerConfig({}, [])),
      botProtection,
      mediaValidator: new BufferImageValidator(),
      betaAccess,
    })
  );

  const server = await new Promise<ReturnType<typeof app.listen>>((resolve) => {
    const s = app.listen(0, '127.0.0.1', () => resolve(s));
  });

  try {
    const port = (server.address() as AddressInfo).port;
    const endpoint = `http://127.0.0.1:${port}/api/coloring/generate`;

    // 1. Faithful mode must strip any stray theme/ageGroup sent by misbehaving callers
    const faithfulForm = new FormData();
    faithfulForm.append(
      'photo',
      new Blob([new Uint8Array(samplePng)], { type: 'image/png' }),
      'photo.png'
    );
    faithfulForm.append('mode', 'fedele');
    faithfulForm.append('theme', 'pirati');
    faithfulForm.append('ageGroup', '8+');

    const resFaithful = await fetch(endpoint, {
      method: 'POST',
      body: faithfulForm,
    });
    assert.equal(resFaithful.status, 200);
    assert.equal(receivedInputs[0]?.mode, 'fedele');
    assert.equal(receivedInputs[0]?.themeId, undefined);
    assert.equal(receivedInputs[0]?.ageGroup, undefined);

    // 2. Creative mode without theme is rejected with 400
    const missingThemeForm = new FormData();
    missingThemeForm.append(
      'photo',
      new Blob([new Uint8Array(samplePng)], { type: 'image/png' }),
      'photo.png'
    );
    missingThemeForm.append('mode', 'creativa');
    const resMissingTheme = await fetch(endpoint, {
      method: 'POST',
      body: missingThemeForm,
    });
    assert.equal(resMissingTheme.status, 400);

    // 3. Creative mode with dinosauros + age 1-2 forwards exact params
    const creativeForm = new FormData();
    creativeForm.append(
      'photo',
      new Blob([new Uint8Array(samplePng)], { type: 'image/png' }),
      'photo.png'
    );
    creativeForm.append('mode', 'creativa');
    creativeForm.append('theme', 'dinosauri');
    creativeForm.append('ageGroup', '1-2');

    const resCreative = await fetch(endpoint, {
      method: 'POST',
      body: creativeForm,
    });
    assert.equal(resCreative.status, 200);
    assert.equal(receivedInputs[1]?.mode, 'creativa');
    assert.equal(receivedInputs[1]?.themeId, 'dinosauri');
    assert.equal(receivedInputs[1]?.ageGroup, '1-2');
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});
