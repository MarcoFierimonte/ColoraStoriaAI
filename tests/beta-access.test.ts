import assert from 'node:assert/strict';
import test from 'node:test';
import {
  BetaAccessError,
  DefaultBetaAccessService,
  InMemoryBetaInviteStore,
} from '../backend/src/modules/beta-access/index.ts';
import { parseServerConfig } from '../backend/src/modules/config/index.ts';

function extractCookieHeader(setCookieHeader: string): string {
  return setCookieHeader.split(';')[0] ?? '';
}

test('DefaultBetaAccessService creates invites, prevents duplicate codes, and sets signed HttpOnly cookies', async () => {
  const nowMs = 1_700_000_000_000;
  const store = new InMemoryBetaInviteStore();
  const config = parseServerConfig({
    NODE_ENV: 'production',
    BETA_INVITE_REQUIRED: 'true',
    BETA_SESSION_SECRET: 'super-secret-beta-signing-key-2026',
  });
  const service = new DefaultBetaAccessService(store, config, () => nowMs);

  const created = await service.createInvite(
    {
      label: 'Luca Tester',
      code: 'luca-2026',
      maxGenerations: 3,
      expiresInDays: 7,
    },
    'admin@example.com'
  );
  assert.equal(created.code, 'LUCA-2026');
  assert.equal(created.remainingGenerations, 3);
  assert.equal(created.active, true);

  await assert.rejects(
    () =>
      service.createInvite(
        { label: 'Duplicate', code: 'LUCA-2026', maxGenerations: 2 },
        'admin@example.com'
      ),
    (err: unknown) =>
      err instanceof BetaAccessError &&
      err.statusCode === 409 &&
      err.reason === 'conflict'
  );

  const autoCreated = await service.createInvite(
    { label: 'Auto Code', maxGenerations: 2 },
    'admin@example.com'
  );
  assert.match(autoCreated.code, /^BETA-[A-Z0-9]{6}$/);

  const redeemed = await service.redeemCode('luca-2026');
  assert.equal(redeemed.session.hasAccess, true);
  assert.equal(redeemed.session.accessSource, 'invite');
  assert.match(redeemed.setCookieHeader, /^cs_invite=/);
  assert.match(redeemed.setCookieHeader, /HttpOnly/);
  assert.match(redeemed.setCookieHeader, /Secure/);

  const cookie = extractCookieHeader(redeemed.setCookieHeader);
  const validSession = await service.getSession(
    { headers: { cookie } },
    false
  );
  assert.equal(validSession.hasAccess, true);
  assert.equal(validSession.invite?.remainingGenerations, 3);

  const tamperedSession = await service.getSession(
    { headers: { cookie: `${cookie}tampered` } },
    false
  );
  assert.equal(tamperedSession.hasAccess, false);
  assert.equal(tamperedSession.accessSource, 'none');
});

test('DefaultBetaAccessService enforces atomic per-invite quota, refunds on error, and allows PDF export on 0 remaining', async () => {
  const nowMs = 1_700_000_000_000;
  const store = new InMemoryBetaInviteStore();
  const config = parseServerConfig({
    NODE_ENV: 'development',
    BETA_INVITE_REQUIRED: 'true',
  });
  const service = new DefaultBetaAccessService(store, config, () => nowMs);

  await service.createInvite(
    { label: 'Anna', code: 'ANNA-2', maxGenerations: 2 },
    'admin@example.com'
  );
  const { setCookieHeader } = await service.redeemCode('ANNA-2');
  const req = { headers: { cookie: extractCookieHeader(setCookieHeader) } };

  const first = await service.reserveGeneration(req, false);
  assert.equal(first?.inviteQuota.remainingGenerations, 1);

  // Refund simulates an upstream AI provider error
  await service.refundGeneration(first);
  const sessionAfterRefund = await service.getSession(req, false);
  assert.equal(sessionAfterRefund.invite?.remainingGenerations, 2);

  await service.reserveGeneration(req, false);
  const last = await service.reserveGeneration(req, false);
  assert.equal(last?.inviteQuota.remainingGenerations, 0);

  await assert.rejects(
    () => service.assertCanGenerate(req, false),
    (err: unknown) =>
      err instanceof BetaAccessError &&
      err.statusCode === 403 &&
      err.reason === 'exhausted'
  );

  // User who just spent their final credit can still export A4 PDF
  await service.assertCanExportPdf(req, false);

  const zeroQuotaSession = await service.getSession(req, false);
  assert.equal(zeroQuotaSession.hasAccess, false);
  assert.equal(zeroQuotaSession.invite?.remainingGenerations, 0);
});

test('DefaultBetaAccessService enforces immediate revocation, expiration, and admin bypass', async () => {
  let currentNowMs = 1_700_000_000_000;
  const store = new InMemoryBetaInviteStore();
  const config = parseServerConfig({
    NODE_ENV: 'production',
    BETA_INVITE_REQUIRED: 'true',
    BETA_SESSION_SECRET: 'another-long-secret-signing-key-for-tests',
  });
  const service = new DefaultBetaAccessService(
    store,
    config,
    () => currentNowMs
  );

  // Admin bypass requires no invite cookie
  const adminSession = await service.getSession({ headers: {} }, true);
  assert.equal(adminSession.hasAccess, true);
  assert.equal(adminSession.accessSource, 'admin');
  await service.assertCanGenerate({ headers: {} }, true);
  assert.equal(await service.reserveGeneration({ headers: {} }, true), null);

  await service.createInvite(
    { label: 'Paolo', code: 'PAOLO-1', maxGenerations: 5, expiresInDays: 1 },
    'admin@example.com'
  );
  const { setCookieHeader } = await service.redeemCode('PAOLO-1');
  const req = { headers: { cookie: extractCookieHeader(setCookieHeader) } };

  // Revoke while cookie is already in browser
  await service.updateInvite('PAOLO-1', { active: false });
  await assert.rejects(
    () => service.assertCanGenerate(req, false),
    (err: unknown) =>
      err instanceof BetaAccessError && err.reason === 'revoked'
  );

  // Re-activate and advance clock past 1-day expiration
  await service.updateInvite('PAOLO-1', { active: true });
  currentNowMs += 2 * 24 * 60 * 60 * 1000;
  await assert.rejects(
    () => service.assertCanGenerate(req, false),
    (err: unknown) =>
      err instanceof BetaAccessError &&
      (err.reason === 'expired' || err.reason === 'missing')
  );
});
