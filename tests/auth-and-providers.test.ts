import assert from 'node:assert/strict';
import test from 'node:test';
import { DefaultAiProviderRegistry } from '../backend/src/modules/ai-providers/index.ts';
import { FirebaseAdminTokenVerifier } from '../backend/src/modules/auth/index.ts';
import { parseServerConfig } from '../backend/src/modules/config/index.ts';
import { calculateGenerationCost } from '../backend/src/modules/cost-estimation/index.ts';
import { FilesystemPromptRepository } from '../backend/src/modules/prompts/index.ts';
import { PROJECTED_BOOK_PAGES } from '../shared/config/index.ts';

test('parseServerConfig validates defaults, --port CLI override, and fails fast on invalid env', () => {
  const defaults = parseServerConfig({}, []);
  assert.equal(defaults.port, 3000);
  assert.equal(defaults.defaultProvider, 'gemini');
  assert.equal(defaults.geminiModel, 'gemini-nano-banana-2.1');
  assert.deepEqual(defaults.adminEmails, []);

  const cliOverride = parseServerConfig({ PORT: '8080' }, ['node', 'server.ts', '--port', '3000']);
  assert.equal(cliOverride.port, 3000);

  assert.throws(
    () => parseServerConfig({ PORT: 'not-a-number' }, []),
    /Invalid server environment configuration/
  );

  assert.throws(
    () => parseServerConfig({ AI_PROVIDER: 'invalid-provider' }),
    /Invalid server environment configuration/
  );

  assert.throws(
    () => parseServerConfig({ BOT_PROTECTION_REQUIRED: 'true' }),
    /BOT_PROTECTION_REQUIRED=true requires/
  );

  assert.throws(
    () => parseServerConfig({ ADMIN_EMAILS: 'not-an-email' }),
    /ADMIN_EMAILS contains invalid email/
  );
});

test('FirebaseAdminTokenVerifier enforces email_verified and custom claim / allowlist', async () => {
  const config = parseServerConfig({
    ADMIN_EMAILS: 'ops@example.com',
  });
  const verifier = new FirebaseAdminTokenVerifier(config);

  const anonymous = await verifier.verifyOptionalRequest({ headers: {} });
  assert.deepEqual(anonymous, {
    authenticated: false,
    isAdmin: false,
    hasAdminClaim: false,
  });

  const claimAdmin = verifier.evaluateDecodedToken({
    uid: 'u1',
    email: 'owner@example.com',
    email_verified: true,
    admin: true,
  });
  assert.equal(claimAdmin.authenticated, true);
  assert.equal(claimAdmin.isAdmin, true);
  assert.equal(claimAdmin.hasAdminClaim, true);

  const unverifiedClaim = verifier.evaluateDecodedToken({
    uid: 'u2',
    email: 'owner@example.com',
    email_verified: false,
    admin: true,
  });
  assert.equal(unverifiedClaim.isAdmin, false);
  assert.equal(unverifiedClaim.hasAdminClaim, false);

  const allowlistAdmin = verifier.evaluateDecodedToken({
    uid: 'u3',
    email: 'OPS@example.com',
    email_verified: true,
  });
  assert.equal(allowlistAdmin.isAdmin, true);
  assert.equal(allowlistAdmin.hasAdminClaim, false);

  const regularUser = verifier.evaluateDecodedToken({
    uid: 'u4',
    email: 'visitor@example.com',
    email_verified: true,
  });
  assert.equal(regularUser.authenticated, true);
  assert.equal(regularUser.isAdmin, false);
  assert.equal(regularUser.hasAdminClaim, false);
});

test('DefaultAiProviderRegistry selects default, override, and fallback provider', () => {
  const config = parseServerConfig({
    AI_PROVIDER: 'gemini',
    GEMINI_API_KEY: 'test-gemini-key',
    OPENAI_API_KEY: '',
  });
  const prompts = new FilesystemPromptRepository();
  const registry = new DefaultAiProviderRegistry({
    config,
    promptRepository: prompts,
  });

  assert.equal(registry.getProvider().id, 'gemini');
  assert.equal(registry.getProvider('openai').id, 'openai');
  assert.equal(registry.getProvider('unknown-vendor').id, 'gemini');

  const statuses = registry.listStatuses();
  const geminiStatus = statuses.find((s) => s.id === 'gemini');
  const openaiStatus = statuses.find((s) => s.id === 'openai');
  assert.equal(geminiStatus?.isDefault, true);
  assert.equal(geminiStatus?.configured, true);
  assert.equal(geminiStatus?.model, 'gemini-nano-banana-2.1');
  assert.equal(openaiStatus?.isDefault, false);
  assert.equal(openaiStatus?.configured, false);
});

test('calculateGenerationCost calculates known rates and warns on unknown models', () => {
  const warnings: string[] = [];
  const unknown = calculateGenerationCost(
    {
      model: 'future-unmapped-model',
      inputTokens: 1000,
      cachedInputTokens: 0,
      textOutputTokens: 200,
      imageOutputTokens: 0,
    },
    (msg) => warnings.push(msg)
  );
  assert.equal(unknown.estimatedCostUsd, 0);
  assert.equal(unknown.isFreeTier, true);
  assert.equal(warnings.length, 1);
  assert.match(warnings[0], /Unknown model "future-unmapped-model"/);

  const paid = calculateGenerationCost(
    {
      model: 'gemini-nano-banana-2.1',
      inputTokens: 1_000_000,
      cachedInputTokens: 0,
      textOutputTokens: 0,
      imageOutputTokens: 1_000_000,
    },
    (msg) => warnings.push(msg)
  );
  assert.equal(paid.isFreeTier, false);
  assert.equal(paid.estimatedCostUsd, 31.5);
  assert.equal(
    paid.projectedBook16CostUsd,
    Number((31.5 * PROJECTED_BOOK_PAGES).toFixed(4))
  );
});
