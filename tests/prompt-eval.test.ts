import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import http from 'node:http';
import path from 'node:path';
import test from 'node:test';
import express from 'express';
import type { Firestore } from 'firebase-admin/firestore';
import sharp from 'sharp';
import {
  computePromptEvalUsage,
  createZipArchive,
  type PromptEvalRunDetail,
} from '../packages/prompt-eval-core/src/index.ts';
import {
  BrevoEmailSender,
  buildRunResultEmailMessage,
  createPromptEvalRouter,
  DefaultPromptEvalService,
  DefaultPromptProviderRegistry,
  FilesystemPromptEvalDatasetRepository,
  FirestorePromptEvalDatasetStore,
  FirestorePromptEvalStore,
  GeminiPromptEvalProvider,
  InMemoryPromptEvalDatasetStore,
  InMemoryPromptEvalStore,
  NoopEmailSender,
  OpenAIPromptEvalProvider,
  PromptEvalError,
  ResendEmailSender,
  type EmailMessage,
  type EmailNotificationSender,
  type GeminiClientLike,
  type PromptExecutionProvider,
} from '../packages/prompt-eval-backend/src/index.ts';
import {
  FetchPromptEvalClient,
  PromptEvalClientError,
} from '../packages/prompt-eval-frontend/src/client.ts';
import { parseServerConfig } from '../backend/src/modules/config/index.ts';
import { serverMediaValidator } from '../backend/src/modules/media-validation/index.ts';
import {
  COLORASTORIA_CATALOG_ID,
  ColoraStoriaPromptCatalogResolver,
  createColoraStoriaPromptEvalService,
  SharpPromptEvalMediaPreparer,
} from '../backend/src/modules/prompt-eval/index.ts';
import { FilesystemPromptRepository } from '../backend/src/modules/prompts/index.ts';

async function makeValidPngBuffer(
  width = 420,
  height = 420,
  color = { r: 240, g: 200, b: 120 }
): Promise<Buffer> {
  return sharp({
    create: {
      width,
      height,
      channels: 3,
      background: color,
    },
  })
    .png()
    .toBuffer();
}

test('computePromptEvalUsage applies -50% batch discount only on supported models and handles free tier', () => {
  const std = computePromptEvalUsage({
    model: 'gemini-nano-banana-2.1',
    executionMode: 'standard',
    inputTokens: 1_000_000,
    cachedInputTokens: 0,
    textOutputTokens: 0,
    imageOutputTokens: 1_000_000,
  });
  assert.equal(std.estimatedCostUsd, 31.5);
  assert.equal(std.batchDiscountApplied, false);

  const batch = computePromptEvalUsage({
    model: 'gemini-nano-banana-2.1',
    executionMode: 'batch',
    inputTokens: 1_000_000,
    cachedInputTokens: 0,
    textOutputTokens: 0,
    imageOutputTokens: 1_000_000,
  });
  assert.equal(batch.estimatedCostUsd, 15.75);
  assert.equal(batch.batchDiscountApplied, true);

  // OpenAI 2.6 models do not receive batch discount
  const noBatchModel = computePromptEvalUsage({
    model: 'gpt-image-2.6-sunburst',
    executionMode: 'batch',
    inputTokens: 1_000_000,
    cachedInputTokens: 0,
    textOutputTokens: 0,
    imageOutputTokens: 1_000_000,
  });
  assert.equal(noBatchModel.batchDiscountApplied, false);
  assert.equal(noBatchModel.estimatedCostUsd, 38);

  const freeModel = computePromptEvalUsage({
    model: 'gemini-4-hydrogen',
    executionMode: 'batch',
    inputTokens: 5000,
    cachedInputTokens: 1000,
    textOutputTokens: 3000,
    imageOutputTokens: 0,
  });
  assert.equal(freeModel.estimatedCostUsd, 0);
});

test('createZipArchive produces valid ZIP headers, valid DOS dates, sanitizes paths, and deduplicates names safely', () => {
  const encoder = new TextEncoder();
  const fixedDate = new Date(Date.UTC(2026, 10, 24, 12, 30, 0));
  const zip = createZipArchive(
    [
      { name: '../../evil.txt', data: encoder.encode('hello world') },
      { name: 'outputs/img.png', data: new Uint8Array([1, 2, 3, 4]) },
      { name: 'outputs/img.png', data: new Uint8Array([5, 6, 7, 8]) },
      { name: 'dir.with.dot/noext', data: encoder.encode('a') },
      { name: 'dir.with.dot/noext', data: encoder.encode('b') },
    ],
    fixedDate
  );

  const view = new DataView(zip.buffer, zip.byteOffset, zip.byteLength);
  // Local file header signature PK\x03\x04
  assert.equal(view.getUint32(0, true), 0x04034b50);
  // Valid DOS date (non-zero month and day)
  const dosDate = view.getUint16(12, true);
  const month = (dosDate >> 5) & 0x0f;
  const day = dosDate & 0x1f;
  assert.equal(month, 11);
  assert.equal(day, 24);
  // End of central directory signature PK\x05\x06 at tail - 22
  assert.equal(view.getUint32(zip.byteLength - 22, true), 0x06054b50);
  // Total entries count == 5
  assert.equal(view.getUint16(zip.byteLength - 12, true), 5);

  const asLatin1 = Buffer.from(zip).toString('latin1');
  assert.ok(!asLatin1.includes('../'), 'path traversal must be stripped');
  assert.ok(!asLatin1.includes('_/_/'), 'traversal segments should be removed cleanly');
  assert.ok(asLatin1.includes('evil.txt'));
  assert.ok(asLatin1.includes('outputs/img.png'));
  assert.ok(asLatin1.includes('outputs/img-2.png'));
  assert.ok(asLatin1.includes('dir.with.dot/noext-2'));
  assert.ok(!asLatin1.includes('dir.with-2.dot'));
  assert.ok(asLatin1.includes('hello world'));
});

test('ColoraStoriaPromptCatalogResolver resolves fedele/creativa combinations, isolates fedele from themes, and omits SVG vector options', () => {
  const repo = new FilesystemPromptRepository();
  const resolver = new ColoraStoriaPromptCatalogResolver(repo);

  const catalogs = resolver.listCatalogs();
  assert.equal(catalogs.length, 1);
  assert.equal(catalogs[0].id, COLORASTORIA_CATALOG_ID);
  const versionField = catalogs[0].fields.find((f) => f.id === 'version');
  assert.equal(versionField?.defaultValue, 'v3');
  assert.ok(versionField?.options?.some((opt) => opt.value === 'v3'));
  assert.ok(versionField?.options?.some((opt) => opt.value === 'v2'));
  assert.equal(
    catalogs[0].fields.find((f) => f.id === 'outputFormat'),
    undefined,
    'Admin Prompt Lab must not expose vector SVG adapter selector'
  );

  const themeField = catalogs[0].fields.find((f) => f.id === 'themeId');
  const ageField = catalogs[0].fields.find((f) => f.id === 'ageGroup');
  assert.deepEqual(themeField?.visibleWhen, {
    fieldId: 'mode',
    values: ['creativa'],
  });
  assert.deepEqual(ageField?.visibleWhen, {
    fieldId: 'mode',
    values: ['creativa'],
  });

  // Even if stray themeId/ageGroup/outputFormat are passed in fedele mode, they must be stripped/ignored
  const faithful = resolver.resolvePrompt(COLORASTORIA_CATALOG_ID, {
    version: 'v2',
    mode: 'fedele',
    themeId: 'pirati',
    ageGroup: '8+',
    outputFormat: 'svg',
  });
  assert.equal(faithful.params.mode, 'fedele');
  assert.equal(faithful.params.themeId, undefined);
  assert.equal(faithful.params.ageGroup, undefined);
  assert.equal(faithful.params.outputFormat, undefined);
  assert.equal(faithful.metadata.outputFormat, 'raster');
  assert.ok(!faithful.promptText.includes('VECTOR SVG OUTPUT FORMAT'));
  assert.ok(faithful.promptText.length > 50);
  assert.ok(faithful.estimatedTokens > 10);

  const creative = resolver.resolvePrompt(COLORASTORIA_CATALOG_ID, {
    version: 'v2',
    mode: 'creativa',
    themeId: 'dinosauri',
    ageGroup: '5-7',
    outputFormat: 'raster',
  });
  assert.equal(creative.params.mode, 'creativa');
  assert.equal(creative.params.themeId, 'dinosauri');
  assert.equal(creative.params.ageGroup, '5-7');
  assert.equal(creative.params.outputFormat, undefined);
  assert.match(creative.label, /Dinosauri/);
  assert.match(creative.label, /5-7/);

  const hostService = createColoraStoriaPromptEvalService({
    config: parseServerConfig(
      { AI_PROVIDER: 'gemini', GEMINI_API_KEY: 'test-key' },
      []
    ),
    store: new InMemoryPromptEvalStore(),
  });
  const hostProviders = hostService.getConfig().providers;
  for (const provider of hostProviders) {
    assert.deepEqual(
      provider.models.filter((m) => m.outputFormat === 'svg'),
      [],
      `Host provider ${provider.id} must not expose SVG vector models`
    );
  }

  assert.throws(
    () => resolver.resolvePrompt('unknown-catalog', {}),
    (err: unknown) => err instanceof PromptEvalError && err.statusCode === 404
  );
  assert.throws(
    () =>
      resolver.resolvePrompt(COLORASTORIA_CATALOG_ID, {
        mode: 'creativa',
        themeId: 'invalid-theme',
      }),
    (err: unknown) => err instanceof PromptEvalError && err.statusCode === 400
  );
});

test('GeminiPromptEvalProvider executes standard & async batch (inlined and JSONL snake_case file) with -50% cost', async () => {
  const sampleOutBase64 = Buffer.from('fake-png-bytes').toString('base64');
  let capturedBatchCreate: unknown = null;
  let pollMode: 'queued' | 'inlined' | 'file' = 'queued';
  let cancelledName: string | null = null;

  const mockClient: GeminiClientLike = {
    models: {
      generateContent: (async () => ({
        candidates: [
          {
            content: {
              parts: [
                {
                  inlineData: {
                    mimeType: 'image/png',
                    data: sampleOutBase64,
                  },
                },
              ],
            },
          },
        ],
        usageMetadata: {
          promptTokenCount: 1000,
          candidatesTokenCount: 1120,
          candidatesTokensDetails: [{ modality: 'IMAGE', tokenCount: 1120 }],
        },
      })) as unknown as GeminiClientLike['models']['generateContent'],
    },
    batches: {
      create: (async (params: unknown) => {
        capturedBatchCreate = params;
        return {
          name: 'batches/test-job-123',
          state: 'JOB_STATE_PENDING',
        };
      }) as unknown as GeminiClientLike['batches']['create'],
      get: (async () => {
        if (pollMode === 'queued') {
          return { name: 'batches/test-job-123', state: 'JOB_STATE_RUNNING' };
        }
        if (pollMode === 'inlined') {
          return {
            name: 'batches/test-job-123',
            state: 'JOB_STATE_SUCCEEDED',
            dest: {
              inlinedResponses: [
                {
                  metadata: { itemId: 'item-1', index: '0' },
                  response: {
                    candidates: [
                      {
                        content: {
                          parts: [
                            {
                              inlineData: {
                                mimeType: 'image/png',
                                data: sampleOutBase64,
                              },
                            },
                          ],
                        },
                      },
                    ],
                    usageMetadata: {
                      promptTokenCount: 1000,
                      candidatesTokenCount: 1120,
                      candidatesTokensDetails: [
                        { modality: 'IMAGE', tokenCount: 1120 },
                      ],
                    },
                  },
                },
              ],
            },
          };
        }
        return {
          name: 'batches/test-job-123',
          state: 'JOB_STATE_SUCCEEDED',
          dest: { fileName: 'files/batch-output-999' },
        };
      }) as unknown as GeminiClientLike['batches']['get'],
      cancel: (async (params: { name?: string }) => {
        cancelledName = params.name ?? null;
      }) as unknown as GeminiClientLike['batches']['cancel'],
    },
    files: {
      upload: (async () => ({
        name: 'files/uploaded-input',
      })) as unknown as GeminiClientLike['files']['upload'],
    },
  };

  const mockFetch = (async () => {
    const jsonlLine = JSON.stringify({
      key: 'item-1',
      response: {
        candidates: [
          {
            content: {
              parts: [
                {
                  inline_data: {
                    mime_type: 'image/png',
                    data: sampleOutBase64,
                  },
                },
              ],
            },
          },
        ],
        usage_metadata: {
          prompt_token_count: 1000,
          candidates_token_count: 1120,
          candidates_tokens_details: [
            { modality: 'IMAGE', token_count: 1120 },
          ],
        },
      },
    });
    return new Response(jsonlLine, { status: 200 });
  }) as typeof fetch;

  const provider = new GeminiPromptEvalProvider({
    apiKey: 'fake-gemini-key',
    defaultModel: 'gemini-nano-banana-2.1',
    clientFactory: () => mockClient,
    fetchImpl: mockFetch,
  });

  const stdResult = await provider.executeStandardItem({
    modality: 'image',
    model: 'gemini-nano-banana-2.1',
    promptText: 'Draw black outlines',
    image: {
      id: 'item-1',
      index: 0,
      name: 'cat.jpg',
      bytes: new Uint8Array([1, 2, 3]),
      mimeType: 'image/jpeg',
    },
  });
  assert.equal(stdResult.status, 'completed');
  assert.equal(stdResult.outputFormat, 'raster');
  assert.equal(stdResult.outputImageDataUrl, `data:image/png;base64,${sampleOutBase64}`);
  assert.equal(stdResult.usage?.batchDiscountApplied, false);

  const submitted = await provider.submitBatchJob({
    runId: 'run-1',
    displayName: 'Test batch',
    modality: 'image',
    model: 'gemini-nano-banana-2.1',
    promptText: 'Draw black outlines',
    images: [
      {
        id: 'item-1',
        index: 0,
        name: 'cat.jpg',
        bytes: new Uint8Array([1, 2, 3]),
        mimeType: 'image/jpeg',
      },
    ],
  });
  assert.equal(submitted.externalBatchJobId, 'batches/test-job-123');
  assert.ok(capturedBatchCreate !== null);

  const running = await provider.pollBatchJob({
    externalBatchJobId: 'batches/test-job-123',
    model: 'gemini-nano-banana-2.1',
    modality: 'image',
    expectedItemIds: ['item-1'],
  });
  assert.equal(running.status, 'running');

  pollMode = 'inlined';
  const doneInline = await provider.pollBatchJob({
    externalBatchJobId: 'batches/test-job-123',
    model: 'gemini-nano-banana-2.1',
    modality: 'image',
    expectedItemIds: ['item-1'],
  });
  assert.equal(doneInline.status, 'completed');
  assert.equal(doneInline.items?.length, 1);
  assert.equal(doneInline.items?.[0].usage?.batchDiscountApplied, true);
  assert.equal(
    doneInline.items?.[0].usage?.estimatedCostUsd,
    Number(((stdResult.usage?.estimatedCostUsd ?? 0) * 0.5).toFixed(6))
  );

  pollMode = 'file';
  const doneFile = await provider.pollBatchJob({
    externalBatchJobId: 'batches/test-job-123',
    model: 'gemini-nano-banana-2.1',
    modality: 'image',
    expectedItemIds: ['item-1'],
  });
  assert.equal(doneFile.status, 'completed');
  assert.equal(doneFile.items?.[0].status, 'completed');
  assert.equal(
    doneFile.items?.[0].outputImageDataUrl,
    `data:image/png;base64,${sampleOutBase64}`
  );

  await provider.cancelBatchJob('batches/test-job-123');
  assert.equal(cancelledName, 'batches/test-job-123');
});

test('OpenAIPromptEvalProvider rejects batch on non-batch model and supports batch JSONL lifecycle', async () => {
  const fakeOutB64 = Buffer.from('openai-img').toString('base64');
  const calls: string[] = [];

  const mockFetch = (async (input: string | URL | Request) => {
    const url = String(input);
    calls.push(url);
    if (url.endsWith('/files')) {
      return new Response(JSON.stringify({ id: 'file-batch-in' }), {
        status: 200,
      });
    }
    if (url.endsWith('/batches')) {
      return new Response(
        JSON.stringify({ id: 'batch_abc', status: 'validating' }),
        { status: 200 }
      );
    }
    if (url.endsWith('/batches/batch_abc')) {
      return new Response(
        JSON.stringify({
          id: 'batch_abc',
          status: 'completed',
          output_file_id: 'file-batch-out',
        }),
        { status: 200 }
      );
    }
    if (url.endsWith('/files/file-batch-out/content')) {
      const line = JSON.stringify({
        custom_id: 'item-1',
        response: {
          status_code: 200,
          body: {
            output: [{ type: 'image_generation_call', result: fakeOutB64 }],
            usage: { input_tokens: 800, output_tokens: 1500 },
          },
        },
      });
      return new Response(line, { status: 200 });
    }
    return new Response('not found', { status: 404 });
  }) as typeof fetch;

  const provider = new OpenAIPromptEvalProvider({
    apiKey: 'sk-test-key',
    fetchImpl: mockFetch,
  });

  await assert.rejects(
    () =>
      provider.submitBatchJob({
        runId: 'run-fail',
        displayName: 'Unsupported',
        modality: 'image',
        model: 'gpt-image-2.6-sunburst',
        promptText: 'test',
        images: [
          {
            id: 'item-1',
            index: 0,
            name: 'img.jpg',
            bytes: new Uint8Array([1, 2, 3]),
            mimeType: 'image/jpeg',
          },
        ],
      }),
    (err: unknown) =>
      err instanceof PromptEvalError &&
      err.statusCode === 400 &&
      err.code === 'batch_not_supported_for_model'
  );

  const submitted = await provider.submitBatchJob({
    runId: 'run-ok',
    displayName: 'Supported',
    modality: 'image',
    model: 'gpt-image-1',
    promptText: 'test',
    images: [
      {
        id: 'item-1',
        index: 0,
        name: 'img.jpg',
        bytes: new Uint8Array([1, 2, 3]),
        mimeType: 'image/jpeg',
      },
    ],
  });
  assert.equal(submitted.externalBatchJobId, 'batch_abc');

  const polled = await provider.pollBatchJob({
    externalBatchJobId: 'batch_abc',
    model: 'gpt-image-1',
    modality: 'image',
    expectedItemIds: ['item-1'],
  });
  assert.equal(polled.status, 'completed');
  assert.equal(
    polled.items?.[0].outputImageDataUrl,
    `data:image/png;base64,${fakeOutB64}`
  );
  assert.equal(polled.items?.[0].usage?.batchDiscountApplied, true);
  assert.equal(calls.length, 4);
});

test('Free-tier email senders (Resend, Brevo, Noop) format requests and attach ZIP archive safely', async () => {
  const sampleRun: PromptEvalRunDetail = {
    id: 'eval_12345678',
    title: 'Test <script>alert(1)</script>',
    createdByUid: 'u-admin',
    createdByEmail: 'admin@example.com',
    modality: 'image',
    executionMode: 'batch',
    providerId: 'gemini',
    model: 'gemini-nano-banana-2.1',
    promptSource: 'catalog',
    catalogId: COLORASTORIA_CATALOG_ID,
    promptLabel: 'v2 · Fedele',
    promptText: 'Prompt text with <tags>',
    promptParams: { mode: 'fedele' },
    promptMetadata: { promptVersion: 'v2' },
    status: 'completed',
    totalItems: 1,
    completedItems: 1,
    failedItems: 0,
    totalEstimatedCostUsd: 0.018,
    totalInputTokens: 900,
    totalOutputTokens: 1120,
    notifyEmail: 'admin@example.com',
    notificationStatus: 'pending',
    createdAtMs: Date.now(),
    updatedAtMs: Date.now(),
    completedAtMs: Date.now(),
    items: [
      {
        id: 'item-1',
        index: 0,
        inputName: 'gatto.png',
        status: 'completed',
        outputFormat: 'raster',
        outputImageDataUrl: `data:image/png;base64,${Buffer.from('pngdata').toString('base64')}`,
      },
    ],
  };

  const msg = buildRunResultEmailMessage({
    run: sampleRun,
    to: 'admin@example.com',
    appBaseUrl: 'https://colorastoria.example',
  });
  assert.ok(!msg.html.includes('<script>alert(1)</script>'));
  assert.ok(msg.html.includes('&lt;script&gt;'));
  assert.ok(
    msg.html.includes(
      'https://colorastoria.example/admin?tab=prompt-lab&amp;run=eval_12345678'
    )
  );
  assert.equal(msg.attachments?.length, 1);
  assert.match(msg.attachments?.[0].filename ?? '', /\.zip$/);

  let resendPayload: Record<string, unknown> | null = null;
  const resend = new ResendEmailSender({
    apiKey: 're_test_key',
    fromAddress: 'Prompt Lab <onboarding@resend.dev>',
    fetchImpl: (async (_url, init) => {
      resendPayload = JSON.parse(String(init?.body ?? '{}')) as Record<
        string,
        unknown
      >;
      return new Response(JSON.stringify({ id: 'em_1' }), { status: 200 });
    }) as typeof fetch,
  });
  await resend.send(msg);
  assert.equal(resend.isConfigured(), true);
  assert.deepEqual(resendPayload?.['to'], ['admin@example.com']);
  assert.ok(Array.isArray(resendPayload?.['attachments']));

  let brevoPayload: Record<string, unknown> | null = null;
  const brevo = new BrevoEmailSender({
    apiKey: 'xkeysib-test',
    fromAddress: 'ColoraStoria <noreply@colorastoria.it>',
    fetchImpl: (async (_url, init) => {
      brevoPayload = JSON.parse(String(init?.body ?? '{}')) as Record<
        string,
        unknown
      >;
      return new Response(JSON.stringify({ messageId: 'm1' }), { status: 201 });
    }) as typeof fetch,
  });
  await brevo.send(msg);
  assert.deepEqual(brevoPayload?.['sender'], {
    name: 'ColoraStoria',
    email: 'noreply@colorastoria.it',
  });
  assert.ok(Array.isArray(brevoPayload?.['attachment']));

  const noop = new NoopEmailSender();
  assert.equal(noop.isConfigured(), false);
  await assert.rejects(
    () => noop.send(msg),
    (err: unknown) => err instanceof PromptEvalError && err.statusCode === 503
  );
});

test('PromptEval HTTP router + FetchPromptEvalClient enforce Admin-Only auth, run Standard & Batch flows, save evaluations/notes, and deliver idempotent batch emails', async () => {
  const pngA = await makeValidPngBuffer(420, 420, { r: 220, g: 120, b: 80 });
  const pngB = await makeValidPngBuffer(480, 460, { r: 80, g: 160, b: 220 });
  const outPng = await makeValidPngBuffer(400, 400, { r: 255, g: 255, b: 255 });
  const outPngBase64 = outPng.toString('base64');

  const sentEmails: EmailMessage[] = [];
  const fakeEmailSender: EmailNotificationSender = {
    providerName: 'resend',
    isConfigured: () => true,
    getStatus: () => ({
      configured: true,
      provider: 'resend',
      fromAddress: 'Prompt Lab <onboarding@resend.dev>',
      freeTierSummary: 'Resend Free Tier',
    }),
    send: async (message) => {
      sentEmails.push(message);
    },
  };

  let batchReady = false;
  const capturedBatchItemIds: string[] = [];

  const mockGeminiClient: GeminiClientLike = {
    models: {
      generateContent: (async () => ({
        candidates: [
          {
            content: {
              parts: [
                {
                  inlineData: {
                    mimeType: 'image/png',
                    data: outPngBase64,
                  },
                },
              ],
            },
          },
        ],
        usageMetadata: {
          promptTokenCount: 500,
          candidatesTokenCount: 1120,
          candidatesTokensDetails: [{ modality: 'IMAGE', tokenCount: 1120 }],
        },
      })) as unknown as GeminiClientLike['models']['generateContent'],
    },
    batches: {
      create: (async (params: {
        src?: Array<{ metadata?: { itemId?: string; index?: string } }>;
      }) => {
        capturedBatchItemIds.length = 0;
        for (const req of params.src ?? []) {
          if (req.metadata?.itemId) capturedBatchItemIds.push(req.metadata.itemId);
        }
        return {
          name: 'batches/e2e-job-1',
          state: 'JOB_STATE_QUEUED',
        };
      }) as unknown as GeminiClientLike['batches']['create'],
      get: (async () => {
        if (!batchReady) {
          return {
            name: 'batches/e2e-job-1',
            state: 'JOB_STATE_RUNNING',
          };
        }
        return {
          name: 'batches/e2e-job-1',
          state: 'JOB_STATE_SUCCEEDED',
          dest: {
            inlinedResponses: capturedBatchItemIds.map((itemId, idx) => ({
              metadata: { itemId, index: String(idx) },
              response: {
                candidates: [
                  {
                    content: {
                      parts: [
                        {
                          inlineData: {
                            mimeType: 'image/png',
                            data: outPngBase64,
                          },
                        },
                      ],
                    },
                  },
                ],
                usageMetadata: {
                  promptTokenCount: 500,
                  candidatesTokenCount: 1120,
                  candidatesTokensDetails: [
                    { modality: 'IMAGE', tokenCount: 1120 },
                  ],
                },
              },
            })),
          },
        };
      }) as unknown as GeminiClientLike['batches']['get'],
      cancel: (async () => undefined) as unknown as GeminiClientLike['batches']['cancel'],
    },
    files: {
      upload: (async () => ({
        name: 'files/mock',
      })) as unknown as GeminiClientLike['files']['upload'],
    },
  };

  const store = new InMemoryPromptEvalStore();
  const geminiProvider = new GeminiPromptEvalProvider({
    apiKey: 'fake-key',
    defaultModel: 'gemini-nano-banana-2.1',
    clientFactory: () => mockGeminiClient,
  });
  const service = new DefaultPromptEvalService({
    providers: new DefaultPromptProviderRegistry({
      providers: [geminiProvider],
      defaultProviderId: 'gemini',
    }),
    store,
    catalogResolver: new ColoraStoriaPromptCatalogResolver(
      new FilesystemPromptRepository()
    ),
    mediaPreparer: new SharpPromptEvalMediaPreparer(serverMediaValidator),
    emailSender: fakeEmailSender,
    appBaseUrl: 'https://app.example.com',
  });

  const app = express();
  app.use(express.json({ limit: '12mb' }));
  app.use(
    '/api/admin/prompt-eval',
    createPromptEvalRouter({
      service,
      cronSecret: 'super-secret-cron-token-1234',
      authorizeAdmin: async (req) => {
        if (req.headers.authorization === 'Bearer admin-valid-token') {
          return { isAdmin: true, uid: 'admin-1', email: 'admin@example.com' };
        }
        return { isAdmin: false };
      },
    })
  );

  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  assert.ok(address && typeof address === 'object');
  const baseUrl = `http://127.0.0.1:${address.port}/api/admin/prompt-eval`;
  const client = new FetchPromptEvalClient(baseUrl);

  try {
    // 1. Non-admin MUST receive 403
    await assert.rejects(
      () => client.fetchConfig(null),
      (err: unknown) => (err as { statusCode?: number }).statusCode === 403
    );

    const invalidCronResp = await fetch(`${baseUrl}/poll-pending`, {
      method: 'POST',
      headers: { 'X-Cron-Secret': 'wrong-secret' },
    });
    assert.equal(invalidCronResp.status, 403);

    // 2. Admin config & catalog preview
    const cfg = await client.fetchConfig('admin-valid-token');
    assert.equal(cfg.providers[0].id, 'gemini');
    assert.equal(cfg.catalogs[0].id, COLORASTORIA_CATALOG_ID);
    assert.equal(cfg.emailNotification.configured, true);

    const resolved = await client.resolveCatalogPrompt(
      COLORASTORIA_CATALOG_ID,
      { version: 'v2', mode: 'creativa', themeId: 'draghi', ageGroup: '3-4' },
      'admin-valid-token'
    );
    assert.ok(resolved.promptText.length > 100);
    assert.match(resolved.label, /Draghi/);

    // 3. Standard multi-image run processes each image individually and persists thumbnails & outputs
    const fileA = new File([new Uint8Array(pngA)], 'foto-a.png', {
      type: 'image/png',
    });
    const fileB = new File([new Uint8Array(pngB)], 'foto-b.png', {
      type: 'image/png',
    });

    const stdRun = await client.createRun(
      {
        title: 'Test Standard 2 foto',
        modality: 'image',
        executionMode: 'standard',
        providerId: 'gemini',
        model: 'gemini-nano-banana-2.1',
        promptSource: 'catalog',
        catalogId: COLORASTORIA_CATALOG_ID,
        promptParams: {
          version: 'v2',
          mode: 'creativa',
          themeId: 'draghi',
          ageGroup: '3-4',
        },
        files: [fileA, fileB],
      },
      'admin-valid-token'
    );
    assert.equal(stdRun.status, 'completed');
    assert.equal(stdRun.totalItems, 2);
    assert.equal(stdRun.completedItems, 2);
    assert.equal(stdRun.items.length, 2);
    assert.ok(stdRun.items[0].inputThumbnailDataUrl?.startsWith('data:image/jpeg;base64,'));
    assert.ok(stdRun.items[0].outputImageDataUrl?.startsWith('data:image/png;base64,'));

    // 4. Save run-level & item-level evaluations/notes
    const evaluatedRun = await client.updateRunEvaluation(
      stdRun.id,
      {
        overallRating: 5,
        notes: 'Ottima fedeltà su entrambe le foto',
        tags: ['draghi', 'v2'],
      },
      'admin-valid-token'
    );
    assert.equal(evaluatedRun.evaluation?.overallRating, 5);
    assert.equal(
      evaluatedRun.evaluation?.notes,
      'Ottima fedeltà su entrambe le foto'
    );
    assert.deepEqual(evaluatedRun.evaluation?.tags, ['draghi', 'v2']);

    const evaluatedItemRun = await client.updateItemEvaluation(
      stdRun.id,
      stdRun.items[0].id,
      {
        rating: 4,
        verdict: 'pass',
        notes: 'Contorni puliti',
      },
      'admin-valid-token'
    );
    assert.equal(evaluatedItemRun.items[0].evaluation?.rating, 4);
    assert.equal(evaluatedItemRun.items[0].evaluation?.verdict, 'pass');
    assert.equal(evaluatedItemRun.items[0].evaluation?.notes, 'Contorni puliti');

    // Invalid rating rejected with 400
    await assert.rejects(
      () =>
        client.updateItemEvaluation(
          stdRun.id,
          stdRun.items[0].id,
          { rating: 9 },
          'admin-valid-token'
        ),
      (err: unknown) => (err as { statusCode?: number }).statusCode === 400
    );

    // 5. Async Batch run -> cron poll while running -> cron poll when succeeded -> single email sent!
    const batchRun = await client.createRun(
      {
        title: 'Test Batch 2 foto',
        modality: 'image',
        executionMode: 'batch',
        providerId: 'gemini',
        model: 'gemini-nano-banana-2.1',
        promptSource: 'catalog',
        catalogId: COLORASTORIA_CATALOG_ID,
        promptParams: { version: 'v2', mode: 'fedele' },
        notifyEmail: 'owner@example.com',
        files: [fileA, fileB],
      },
      'admin-valid-token'
    );
    assert.equal(batchRun.status, 'queued');
    assert.equal(batchRun.externalBatchJobId, 'batches/e2e-job-1');
    assert.equal(batchRun.notificationStatus, 'pending');
    assert.equal(sentEmails.length, 0);

    // Poll via Cloud Scheduler X-Cron-Secret while still running
    const pollRunningResp = await fetch(`${baseUrl}/poll-pending`, {
      method: 'POST',
      headers: { 'X-Cron-Secret': 'super-secret-cron-token-1234' },
    });
    assert.equal(pollRunningResp.status, 200);
    const pollRunning = (await pollRunningResp.json()) as {
      checkedCount: number;
      notifiedRunIds: string[];
    };
    assert.equal(pollRunning.checkedCount, 1);
    assert.deepEqual(pollRunning.notifiedRunIds, []);
    assert.equal(sentEmails.length, 0);

    // Complete batch on provider side and poll again
    batchReady = true;
    const pollDoneResp = await fetch(`${baseUrl}/poll-pending`, {
      method: 'POST',
      headers: { 'X-Cron-Secret': 'super-secret-cron-token-1234' },
    });
    assert.equal(pollDoneResp.status, 200);
    const pollDone = (await pollDoneResp.json()) as {
      checkedCount: number;
      notifiedRunIds: string[];
    };
    assert.deepEqual(pollDone.notifiedRunIds, [batchRun.id]);
    assert.equal(sentEmails.length, 1);
    assert.equal(sentEmails[0].to, 'owner@example.com');
    assert.equal(sentEmails[0].attachments?.length, 1);

    const fetchedBatch = await client.getRun(batchRun.id, 'admin-valid-token');
    assert.equal(fetchedBatch.status, 'completed');
    assert.equal(fetchedBatch.completedItems, 2);
    assert.equal(fetchedBatch.notificationStatus, 'sent');
    assert.equal(
      fetchedBatch.totalEstimatedCostUsd,
      Number((stdRun.totalEstimatedCostUsd * 0.5).toFixed(6))
    );

    // Second poll must NOT send duplicate email
    const pollAgainResp = await fetch(`${baseUrl}/poll-pending`, {
      method: 'POST',
      headers: { 'X-Cron-Secret': 'super-secret-cron-token-1234' },
    });
    assert.equal(pollAgainResp.status, 200);
    assert.equal(sentEmails.length, 1);

    // 6. Invalid image (<400px) rejected with 400
    const tinyPng = await makeValidPngBuffer(100, 100);
    const tinyFile = new File([new Uint8Array(tinyPng)], 'tiny.png', {
      type: 'image/png',
    });
    await assert.rejects(
      () =>
        client.createRun(
          {
            modality: 'image',
            executionMode: 'standard',
            promptSource: 'custom',
            customPromptText: 'Test',
            files: [tinyFile],
          },
          'admin-valid-token'
        ),
      (err: unknown) => (err as { statusCode?: number }).statusCode === 400
    );

    // 7. Delete run works and subsequent GET returns 404
    await client.deleteRun(stdRun.id, 'admin-valid-token');
    await assert.rejects(
      () => client.getRun(stdRun.id, 'admin-valid-token'),
      (err: unknown) => (err as { statusCode?: number }).statusCode === 404
    );
  } finally {
    await new Promise<void>((resolve, reject) =>
      server.close((err) => (err ? reject(err) : resolve()))
    );
  }
});

test('parseServerConfig auto-detects free-tier email providers and prompt-eval env options', () => {
  const defaultCfg = parseServerConfig({}, []);
  assert.equal(defaultCfg.emailProvider, 'none');
  assert.equal(defaultCfg.promptEvalStoreMode, 'firestore');

  const resendCfg = parseServerConfig(
    {
      RESEND_API_KEY: 're_live_123',
      EMAIL_FROM: 'Lab <onboarding@resend.dev>',
      PROMPT_EVAL_STORE: 'memory',
      PROMPT_EVAL_CRON_SECRET: 'cron-secret-16-chars',
    },
    []
  );
  assert.equal(resendCfg.emailProvider, 'resend');
  assert.equal(resendCfg.promptEvalStoreMode, 'memory');
  assert.equal(resendCfg.promptEvalCronSecret, 'cron-secret-16-chars');

  const brevoCfg = parseServerConfig(
    {
      BREVO_API_KEY: 'xkeysib-123',
    },
    []
  );
  assert.equal(brevoCfg.emailProvider, 'brevo');
});

test('OpenAI & Gemini providers handle error_file_id, download failures, unknown states, network throws, URL persistence, and raw SVG', async () => {
  const pngOut = await makeValidPngBuffer(400, 400, { r: 255, g: 255, b: 255 });
  let capturedJsonl = '';
  let failOutputDownload = false;

  const mockOpenAiFetch = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input);
    if (url.endsWith('/images/edits')) {
      return new Response(
        JSON.stringify({
          data: [{ url: 'https://oai.cdn.example/temp-image.png' }],
          usage: { input_tokens: 500, output_tokens: 1000 },
        }),
        { status: 200 }
      );
    }
    if (url === 'https://oai.cdn.example/temp-image.png') {
      return new Response(new Uint8Array(pngOut), {
        status: 200,
        headers: { 'content-type': 'image/png' },
      });
    }
    if (url.endsWith('/files')) {
      const form = init?.body as FormData;
      const uploadedFile = form.get('file') as Blob;
      capturedJsonl = await uploadedFile.text();
      return new Response(JSON.stringify({ id: 'file-in-1' }), { status: 200 });
    }
    if (url.endsWith('/batches')) {
      return new Response(JSON.stringify({ id: 'batch_err_test', status: 'validating' }), {
        status: 200,
      });
    }
    if (url.endsWith('/batches/batch_unknown')) {
      return new Response(JSON.stringify({ id: 'batch_unknown', status: 'mystery_state' }), {
        status: 200,
      });
    }
    if (url.endsWith('/batches/batch_err_test')) {
      return new Response(
        JSON.stringify({
          id: 'batch_err_test',
          status: 'completed',
          output_file_id: 'file-out-1',
          error_file_id: 'file-err-1',
        }),
        { status: 200 }
      );
    }
    if (url.endsWith('/files/file-out-1/content')) {
      if (failOutputDownload) {
        return new Response('transient upstream error', { status: 503 });
      }
      return new Response(
        JSON.stringify({
          custom_id: 'item-1',
          response: {
            status_code: 200,
            body: {
              output: [{ type: 'image_generation_call', result: pngOut.toString('base64') }],
              usage: {
                input_tokens: 400,
                output_tokens: 1200,
                output_tokens_details: { image_tokens: 1100, text_tokens: 100 },
              },
            },
          },
        }),
        { status: 200 }
      );
    }
    if (url.endsWith('/files/file-err-1/content')) {
      return new Response(
        JSON.stringify({
          custom_id: 'item-2',
          response: {
            status_code: 400,
            body: { error: { message: 'Safety system rejected image' } },
          },
        }),
        { status: 200 }
      );
    }
    throw new TypeError('Simulated network outage');
  }) as typeof fetch;

  const openai = new OpenAIPromptEvalProvider({
    apiKey: 'sk-test',
    fetchImpl: mockOpenAiFetch,
  });

  // gpt-image-2.6-flare must also be rejected in Batch mode
  await assert.rejects(
    () =>
      openai.submitBatchJob({
        runId: 'run-flare',
        displayName: 'Flare',
        modality: 'image',
        model: 'gpt-image-2.6-flare',
        promptText: 'test',
        images: [
          {
            id: 'item-1',
            index: 0,
            name: 'a.jpg',
            bytes: new Uint8Array([1, 2]),
            mimeType: 'image/jpeg',
          },
        ],
      }),
    (err: unknown) =>
      err instanceof PromptEvalError && err.code === 'batch_not_supported_for_model'
  );

  // Standard mode converts temporary OpenAI URL into persistent data URL
  const stdUrlResult = await openai.executeStandardItem({
    modality: 'image',
    model: 'gpt-image-1',
    promptText: 'draw',
    image: {
      id: 'item-1',
      index: 0,
      name: 'a.png',
      bytes: new Uint8Array(pngOut),
      mimeType: 'image/png',
    },
  });
  assert.equal(stdUrlResult.status, 'completed');
  assert.ok(stdUrlResult.outputImageDataUrl?.startsWith('data:image/png;base64,'));

  // Standard mode network failure returns failed item instead of throwing
  const failingNetOpenai = new OpenAIPromptEvalProvider({
    apiKey: 'sk-test',
    fetchImpl: (async () => {
      throw new TypeError('socket hang up');
    }) as typeof fetch,
  });
  const netFail = await failingNetOpenai.executeStandardItem({
    modality: 'image',
    model: 'gpt-image-1',
    promptText: 'draw',
    image: {
      id: 'item-1',
      index: 0,
      name: 'a.png',
      bytes: new Uint8Array(pngOut),
      mimeType: 'image/png',
    },
  });
  assert.equal(netFail.status, 'failed');
  assert.match(netFail.errorMessage ?? '', /socket hang up/);

  // Batch submit includes tool_choice: { type: 'image_generation' }
  await openai.submitBatchJob({
    runId: 'run-oai-1',
    displayName: 'OAI',
    modality: 'image',
    model: 'gpt-image-1',
    promptText: 'draw outlines',
    images: [
      { id: 'item-1', index: 0, name: 'a.png', bytes: new Uint8Array([1]), mimeType: 'image/png' },
      { id: 'item-2', index: 1, name: 'b.png', bytes: new Uint8Array([2]), mimeType: 'image/png' },
    ],
  });
  const firstJsonlObj = JSON.parse(capturedJsonl.split('\n')[0]) as {
    body?: { tool_choice?: { type?: string } };
  };
  assert.deepEqual(firstJsonlObj.body?.tool_choice, { type: 'image_generation' });

  // Unknown batch status does NOT fall through to completed
  const unknownState = await openai.pollBatchJob({
    externalBatchJobId: 'batch_unknown',
    model: 'gpt-image-1',
    modality: 'image',
    expectedItemIds: ['item-1'],
  });
  assert.equal(unknownState.status, 'running');

  // Output file download failure throws retryable batch_download_failed instead of failing run
  failOutputDownload = true;
  await assert.rejects(
    () =>
      openai.pollBatchJob({
        externalBatchJobId: 'batch_err_test',
        model: 'gpt-image-1',
        modality: 'image',
        expectedItemIds: ['item-1', 'item-2'],
      }),
    (err: unknown) => err instanceof PromptEvalError && err.code === 'batch_download_failed'
  );

  // Successful poll parses BOTH output_file_id AND error_file_id
  failOutputDownload = false;
  const mixedBatch = await openai.pollBatchJob({
    externalBatchJobId: 'batch_err_test',
    model: 'gpt-image-1',
    modality: 'image',
    expectedItemIds: ['item-1', 'item-2'],
  });
  assert.equal(mixedBatch.status, 'completed');
  assert.equal(mixedBatch.items?.length, 2);
  assert.equal(mixedBatch.items?.[0].status, 'completed');
  assert.equal(mixedBatch.items?.[0].usage?.imageOutputTokens, 1100);
  assert.equal(mixedBatch.items?.[1].status, 'failed');
  assert.match(mixedBatch.items?.[1].errorMessage ?? '', /Safety system rejected image/);

  // Gemini: unknown state returns running & raw/fenced SVG parses cleanly
  const mockGemini: GeminiClientLike = {
    models: {
      generateContent: (async () => ({
        text: '```svg\n<svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="40"/></svg>\n```',
        usageMetadata: { promptTokenCount: 100, candidatesTokenCount: 50 },
      })) as unknown as GeminiClientLike['models']['generateContent'],
    },
    batches: {
      create: (async () => ({ name: 'batches/1', state: 'JOB_STATE_PENDING' })) as unknown as GeminiClientLike['batches']['create'],
      get: (async () => ({ name: 'batches/1', state: 'JOB_STATE_FUTURE_UNKNOWN' })) as unknown as GeminiClientLike['batches']['get'],
      cancel: (async () => undefined) as unknown as GeminiClientLike['batches']['cancel'],
    },
    files: {
      upload: (async () => ({ name: 'files/1' })) as unknown as GeminiClientLike['files']['upload'],
    },
  };
  const gemini = new GeminiPromptEvalProvider({
    apiKey: 'test-key',
    clientFactory: () => mockGemini,
  });
  const svgRes = await gemini.executeStandardItem({
    modality: 'image',
    model: 'gemini-4-hydrogen',
    promptText: 'Draw SVG',
    image: {
      id: 'item-svg',
      index: 0,
      name: 'cat.png',
      bytes: new Uint8Array([1, 2]),
      mimeType: 'image/png',
    },
  });
  assert.equal(svgRes.status, 'completed');
  assert.equal(svgRes.outputFormat, 'svg');
  assert.ok(svgRes.outputImageDataUrl?.startsWith('data:image/svg+xml;base64,'));

  const geminiUnknown = await gemini.pollBatchJob({
    externalBatchJobId: 'batches/1',
    model: 'gemini-nano-banana-2.1',
    modality: 'image',
    expectedItemIds: ['item-1'],
  });
  assert.equal(geminiUnknown.status, 'running');
});

test('DefaultPromptEvalService handles concurrent batch refreshes without duplicate emails, rejects early notify, cleans items on cancel, guards throwing providers, and validates runtime payloads', async () => {
  const store = new InMemoryPromptEvalStore();
  let pollCalls = 0;
  let batchDone = false;
  let throwOnSecond = true;

  const sentEmails: EmailMessage[] = [];
  const emailSender: EmailNotificationSender = {
    providerName: 'resend',
    isConfigured: () => true,
    getStatus: () => ({
      configured: true,
      provider: 'resend',
      fromAddress: 'Lab <onboarding@resend.dev>',
      freeTierSummary: 'Resend Free',
    }),
    send: async (msg) => {
      await new Promise((r) => setTimeout(r, 15));
      sentEmails.push(msg);
    },
  };

  const provider: PromptExecutionProvider = {
    id: 'mock',
    label: 'Mock',
    isConfigured: () => true,
    getInfo: (isDefault) => ({
      id: 'mock',
      label: 'Mock',
      configured: true,
      isDefault,
      supportedModalities: ['image', 'text'],
      supportsBatch: true,
      defaultModel: 'mock-text',
      models: [
        {
          id: 'mock-text',
          label: 'Mock Text',
          modality: 'text',
          outputFormat: 'text',
          supportsStandard: true,
          supportsBatch: true,
          batchDiscountRatio: 0.5,
          estimatedStandardCostPerItemUsd: 0,
          estimatedBatchCostPerItemUsd: 0,
          isFreeTier: true,
          standardTurnaroundLabel: '1s',
          batchTurnaroundLabel: '24h',
        },
        {
          id: 'mock-image',
          label: 'Mock Image',
          modality: 'image',
          outputFormat: 'raster',
          supportsStandard: true,
          supportsBatch: true,
          batchDiscountRatio: 0.5,
          estimatedStandardCostPerItemUsd: 0,
          estimatedBatchCostPerItemUsd: 0,
          isFreeTier: true,
          standardTurnaroundLabel: '1s',
          batchTurnaroundLabel: '24h',
        },
      ],
    }),
    getModelInfo(modelId) {
      return this.getInfo(true).models.find((m) => m.id === modelId);
    },
    async executeStandardItem(req) {
      if (throwOnSecond && req.textInput?.index === 1) {
        throw new Error('Unexpected provider crash');
      }
      return {
        itemId: req.textInput?.id ?? 'item-0',
        index: req.textInput?.index ?? 0,
        status: 'completed',
        outputFormat: 'text',
        outputText: `OK: ${req.textInput?.text ?? ''}`,
      };
    },
    async submitBatchJob() {
      return { externalBatchJobId: 'batch-race-1', externalBatchState: 'QUEUED' };
    },
    async pollBatchJob({ expectedItemIds }) {
      pollCalls++;
      await new Promise((r) => setTimeout(r, 20));
      if (!batchDone) {
        return { status: 'running', externalBatchState: 'RUNNING' };
      }
      return {
        status: 'completed',
        externalBatchState: 'SUCCEEDED',
        items: expectedItemIds.map((itemId, index) => ({
          itemId,
          index,
          status: 'completed' as const,
          outputFormat: 'text' as const,
          outputText: `Batch output ${index}`,
        })),
      };
    },
    async cancelBatchJob() {
      // no-op
    },
  };

  const registry = new DefaultPromptProviderRegistry({
    providers: [provider],
    defaultProviderId: 'mock',
  });

  // Two separate service instances simulating 2 Cloud Run replicas sharing the same store
  const serviceA = new DefaultPromptEvalService({
    providers: registry,
    store,
    emailSender,
  });
  const serviceB = new DefaultPromptEvalService({
    providers: registry,
    store,
    emailSender,
  });

  // 1. Modality/model mismatch rejected with 400
  await assert.rejects(
    () =>
      serviceA.createRun({
        actorUid: 'u1',
        actorEmail: 'admin@example.com',
        modality: 'text',
        executionMode: 'standard',
        providerId: 'mock',
        model: 'mock-image',
        promptSource: 'custom',
        customPromptText: 'Say hi',
        textInputs: [{ text: 'hello' }],
      }),
    (err: unknown) => err instanceof PromptEvalError && err.code === 'model_modality_mismatch'
  );

  // 2. Throwing provider on item 2 of 2 produces partial run (NOT stuck in 'running')
  const partialRun = await serviceA.createRun({
    actorUid: 'u1',
    actorEmail: 'admin@example.com',
    modality: 'text',
    executionMode: 'standard',
    providerId: 'mock',
    model: 'mock-text',
    promptSource: 'custom',
    customPromptText: 'Say hi',
    textInputs: [{ text: 'one' }, { text: 'two' }],
  });
  assert.equal(partialRun.status, 'partial');
  assert.equal(partialRun.completedItems, 1);
  assert.equal(partialRun.failedItems, 1);
  assert.match(partialRun.items[1].errorMessage ?? '', /Unexpected provider crash/);

  // 3. Invalid runtime evaluation types & malformed IDs return 400 (never 500)
  await assert.rejects(
    () =>
      serviceA.updateRunEvaluation(partialRun.id, {
        notes: 123 as unknown as string,
      }),
    (err: unknown) => err instanceof PromptEvalError && err.statusCode === 400
  );
  await assert.rejects(
    () =>
      serviceA.updateRunEvaluation(partialRun.id, {
        tags: 'not-array' as unknown as string[],
      }),
    (err: unknown) => err instanceof PromptEvalError && err.statusCode === 400
  );
  await assert.rejects(
    () =>
      serviceA.updateItemEvaluation(partialRun.id, partialRun.items[0].id, {
        notes: { bad: true } as unknown as string,
      }),
    (err: unknown) => err instanceof PromptEvalError && err.statusCode === 400
  );
  await assert.rejects(
    () => serviceA.getRun('../escape/path'),
    (err: unknown) => err instanceof PromptEvalError && err.statusCode === 400
  );

  // 4. Batch run: early notifyRunByEmail rejected; concurrent refreshes across 2 instances send EXACTLY 1 email
  const batchRun = await serviceA.createRun({
    actorUid: 'u1',
    actorEmail: 'admin@example.com',
    modality: 'text',
    executionMode: 'batch',
    providerId: 'mock',
    model: 'mock-text',
    promptSource: 'custom',
    customPromptText: 'Summarize',
    notifyEmail: 'owner@example.com',
    textInputs: [{ text: 'alpha' }, { text: 'beta' }],
  });

  await assert.rejects(
    () => serviceA.notifyRunByEmail(batchRun.id),
    (err: unknown) => err instanceof PromptEvalError && err.code === 'run_not_finished'
  );

  batchDone = true;
  // Fire 3 concurrent calls on serviceA (in-flight dedup) AND 2 concurrent calls on serviceB (distributed claim)
  await Promise.all([
    serviceA.refreshBatchRun(batchRun.id),
    serviceA.refreshBatchRun(batchRun.id),
    serviceA.refreshBatchRun(batchRun.id),
    serviceB.refreshBatchRun(batchRun.id),
    serviceB.refreshBatchRun(batchRun.id),
  ]);
  // In-flight dedup on each instance means at most 2 provider polls total (1 per instance), NOT 5
  assert.ok(pollCalls <= 2, `Expected <=2 provider polls, got ${pollCalls}`);
  // Atomic claimEmailNotification guarantees EXACTLY 1 email across both concurrent instances!
  assert.equal(sentEmails.length, 1);

  // 5. Cancel batch run marks pending items as failed instead of leaving them 'pending'
  batchDone = false;
  const cancelRun = await serviceA.createRun({
    actorUid: 'u1',
    actorEmail: 'admin@example.com',
    modality: 'text',
    executionMode: 'batch',
    providerId: 'mock',
    model: 'mock-text',
    promptSource: 'custom',
    customPromptText: 'Cancel me',
    textInputs: [{ text: 'one' }],
  });
  const cancelled = await serviceA.cancelBatchRun(cancelRun.id);
  assert.equal(cancelled.status, 'cancelled');
  assert.equal(cancelled.items[0].status, 'failed');
  assert.match(cancelled.items[0].errorMessage ?? '', /annullato/i);

  // 6. Unconfigured email sender records 'failed' notification status instead of staying 'pending' forever
  throwOnSecond = false;
  const noEmailService = new DefaultPromptEvalService({
    providers: registry,
    store,
    emailSender: new NoopEmailSender(),
  });
  const completedNoEmail = await noEmailService.createRun({
    actorUid: 'u1',
    actorEmail: 'admin@example.com',
    modality: 'text',
    executionMode: 'standard',
    providerId: 'mock',
    model: 'mock-text',
    promptSource: 'custom',
    customPromptText: 'Hi',
    notifyEmail: 'owner@example.com',
    textInputs: [{ text: 'hello' }],
  });
  assert.equal(completedNoEmail.status, 'completed');
  assert.equal(completedNoEmail.notificationStatus, 'failed');
  assert.match(completedNoEmail.notificationError ?? '', /non configurato/i);
});

test('FirestorePromptEvalStore chunks >500 ops, queries active statuses efficiently, and atomically claims email notifications', async () => {
  type DocMap = Map<string, Record<string, unknown>>;
  const docs: DocMap = new Map();
  let maxBatchOpsSeen = 0;
  const observedWhereClauses: Array<{ field: string; op: string; value: unknown }> = [];

  const makeDocRef = (docPath: string) => ({
    id: docPath.split('/').pop() ?? '',
    path: docPath,
    async get() {
      const data = docs.get(docPath);
      return {
        id: docPath.split('/').pop() ?? '',
        exists: data !== undefined,
        data: () => (data ? structuredClone(data) : undefined),
        ref: makeDocRef(docPath),
      };
    },
    async set(data: Record<string, unknown>, opts?: { merge?: boolean }) {
      const prev = opts?.merge ? (docs.get(docPath) ?? {}) : {};
      docs.set(docPath, { ...prev, ...structuredClone(data) });
    },
    async delete() {
      docs.delete(docPath);
    },
    collection(sub: string) {
      return makeCollectionRef(`${docPath}/${sub}`);
    },
  });

  const makeQuery = (
    colPath: string,
    filters: Array<{ field: string; op: string; value: unknown }> = [],
    orderField?: string,
    orderDir: 'asc' | 'desc' = 'asc',
    limitCount?: number
  ) => ({
    where(field: string, op: string, value: unknown) {
      observedWhereClauses.push({ field, op, value });
      return makeQuery(colPath, [...filters, { field, op, value }], orderField, orderDir, limitCount);
    },
    orderBy(field: string, dir: 'asc' | 'desc' = 'asc') {
      return makeQuery(colPath, filters, field, dir, limitCount);
    },
    limit(n: number) {
      return makeQuery(colPath, filters, orderField, orderDir, n);
    },
    async get() {
      const prefix = `${colPath}/`;
      let matched = [...docs.entries()]
        .filter(([p]) => p.startsWith(prefix) && !p.slice(prefix.length).includes('/'))
        .map(([p, data]) => ({ path: p, id: p.slice(prefix.length), data }));

      for (const f of filters) {
        matched = matched.filter((entry) => {
          const val = entry.data[f.field];
          if (f.op === '==') return val === f.value;
          if (f.op === 'in' && Array.isArray(f.value)) return f.value.includes(val);
          return true;
        });
      }

      if (orderField) {
        matched.sort((a, b) => {
          const av = Number(a.data[orderField] ?? 0);
          const bv = Number(b.data[orderField] ?? 0);
          return orderDir === 'desc' ? bv - av : av - bv;
        });
      }

      if (limitCount !== undefined) {
        matched = matched.slice(0, limitCount);
      }

      return {
        docs: matched.map((m) => ({
          id: m.id,
          ref: makeDocRef(m.path),
          data: () => structuredClone(m.data),
        })),
      };
    },
  });

  const makeCollectionRef = (colPath: string) => ({
    doc(id: string) {
      return makeDocRef(`${colPath}/${id}`);
    },
    ...makeQuery(colPath),
  });

  const mockFirestore = {
    collection: (name: string) => makeCollectionRef(name),
    batch() {
      const ops: Array<() => void> = [];
      return {
        set(ref: { path: string }, data: Record<string, unknown>, opts?: { merge?: boolean }) {
          ops.push(() => {
            const prev = opts?.merge ? (docs.get(ref.path) ?? {}) : {};
            docs.set(ref.path, { ...prev, ...structuredClone(data) });
          });
        },
        delete(ref: { path: string }) {
          ops.push(() => {
            docs.delete(ref.path);
          });
        },
        async commit() {
          maxBatchOpsSeen = Math.max(maxBatchOpsSeen, ops.length);
          assert.ok(ops.length <= 500, `Firestore batch limit exceeded: ${ops.length}`);
          for (const op of ops) op();
        },
      };
    },
    async runTransaction<T>(fn: (tx: { get: (r: ReturnType<typeof makeDocRef>) => ReturnType<ReturnType<typeof makeDocRef>['get']>; set: (r: ReturnType<typeof makeDocRef>, d: Record<string, unknown>, o?: { merge?: boolean }) => void }) => Promise<T>) {
      const writes: Array<() => void> = [];
      const result = await fn({
        get: (ref) => ref.get(),
        set: (ref, data, opts) => {
          writes.push(() => {
            const prev = opts?.merge ? (docs.get(ref.path) ?? {}) : {};
            docs.set(ref.path, { ...prev, ...structuredClone(data) });
          });
        },
      });
      for (const w of writes) w();
      return result;
    },
  } as unknown as Firestore;

  const store = new FirestorePromptEvalStore({ db: mockFirestore });

  // Create a run with 510 items (exceeds single 500-op Firestore batch)
  const items = Array.from({ length: 510 }, (_, idx) => ({
    id: `item_${idx}`,
    index: idx,
    inputName: `input-${idx}.txt`,
    status: 'pending' as const,
  }));

  const bigRun: PromptEvalRunDetail = {
    id: 'eval_big_510',
    title: 'Big Batch 510',
    createdByUid: 'admin-1',
    createdByEmail: 'admin@example.com',
    modality: 'text',
    executionMode: 'batch',
    providerId: 'gemini',
    model: 'gemini-3.1-flash-lite',
    promptSource: 'custom',
    catalogId: null,
    promptLabel: 'Custom',
    promptText: 'Test',
    promptParams: {},
    promptMetadata: {},
    status: 'queued',
    totalItems: 510,
    completedItems: 0,
    failedItems: 0,
    totalEstimatedCostUsd: 0,
    totalInputTokens: 0,
    totalOutputTokens: 0,
    externalBatchJobId: 'batches/big-1',
    externalBatchState: 'JOB_STATE_QUEUED',
    notifyEmail: 'admin@example.com',
    notificationStatus: 'pending',
    createdAtMs: 1000,
    updatedAtMs: 1000,
    items,
  };

  await store.createRun(bigRun);
  assert.ok(maxBatchOpsSeen <= 450);

  const loaded = await store.getRun('eval_big_510');
  assert.equal(loaded?.items.length, 510);
  assert.equal(loaded?.items[509].index, 509);

  // listActiveBatchRuns queries status IN ['queued', 'running'] (not full batch scan)
  const active = await store.listActiveBatchRuns();
  assert.equal(active.length, 1);
  assert.ok(
    observedWhereClauses.some(
      (w) => w.field === 'status' && w.op === 'in'
    )
  );

  // Atomic email notification claim prevents duplicate send within lease window
  const claim1 = await store.claimEmailNotification('eval_big_510', 'admin@example.com', 5000);
  const claim2 = await store.claimEmailNotification('eval_big_510', 'admin@example.com', 5010);
  assert.equal(claim1, true);
  assert.equal(claim2, false);

  // After marking sent, claim returns false even after lease expires
  await store.updateRunSummary('eval_big_510', { notificationStatus: 'sent' });
  const claimAfterSent = await store.claimEmailNotification(
    'eval_big_510',
    'admin@example.com',
    999_999
  );
  assert.equal(claimAfterSent, false);

  // Evaluations persist cleanly
  const evalUpdated = await store.updateItemEvaluation('eval_big_510', 'item_0', {
    rating: 5,
    verdict: 'pass',
    notes: 'Perfetto',
    updatedAtMs: 6000,
  });
  assert.equal(evalUpdated?.items[0].evaluation?.rating, 5);

  // Delete chunks >500 item deletes safely
  const deleted = await store.deleteRun('eval_big_510');
  assert.equal(deleted, true);
  assert.equal(await store.getRun('eval_big_510'), null);

  // FirestorePromptEvalDatasetStore persists, lists, loads bytes, and deletes app datasets cleanly
  const datasetStore = new FirestorePromptEvalDatasetStore({ db: mockFirestore });
  const sampleBytes = await makeValidPngBuffer(420, 420, { r: 90, g: 180, b: 120 });
  const createdDs = await datasetStore.createDataset(
    {
      id: 'ds_firestore_1',
      slug: 'animali-casa',
      name: 'Animali Casa',
      description: 'Test dataset su Firestore',
      source: 'app',
      readOnly: false,
      itemCount: 1,
      previewThumbnails: ['data:image/jpeg;base64,dGh1bWI='],
      createdAtMs: 2000,
      updatedAtMs: 2000,
      createdByEmail: 'admin@example.com',
      items: [
        {
          id: 'item_01_cane',
          index: 0,
          name: 'cane.png',
          mimeType: 'image/png',
          sizeBytes: sampleBytes.byteLength,
          width: 420,
          height: 420,
          thumbnailDataUrl: 'data:image/jpeg;base64,dGh1bWI=',
        },
      ],
    },
    [
      {
        id: 'item_01_cane',
        index: 0,
        name: 'cane.png',
        mimeType: 'image/png',
        sizeBytes: sampleBytes.byteLength,
        width: 420,
        height: 420,
        thumbnailDataUrl: 'data:image/jpeg;base64,dGh1bWI=',
        bytes: new Uint8Array(sampleBytes),
      },
    ]
  );
  assert.equal(createdDs.id, 'ds_firestore_1');
  const dsSummaries = await datasetStore.listDatasets();
  assert.equal(dsSummaries.length, 1);
  assert.equal(dsSummaries[0].name, 'Animali Casa');
  const dsLoadedBytes = await datasetStore.loadDatasetItemBytes(
    'ds_firestore_1',
    'item_01_cane'
  );
  assert.equal(dsLoadedBytes?.bytes.byteLength, sampleBytes.byteLength);
  assert.equal(await datasetStore.deleteDataset('ds_firestore_1'), true);
  assert.equal(await datasetStore.getDataset('ds_firestore_1'), null);
});

test('SharpPromptEvalMediaPreparer compresses high-entropy >700KB outputs below Firestore 650KB safety threshold', async () => {
  const noisePixels = crypto.randomBytes(900 * 900 * 3);
  const hugePng = await sharp(noisePixels, {
    raw: { width: 900, height: 900, channels: 3 },
  })
    .png()
    .toBuffer();
  const hugeDataUrl = `data:image/png;base64,${hugePng.toString('base64')}`;
  assert.ok(hugeDataUrl.length > 700_000, `Expected >700KB input, got ${hugeDataUrl.length}`);

  const preparer = new SharpPromptEvalMediaPreparer(serverMediaValidator);
  const stored = await preparer.prepareOutputForStorage(hugeDataUrl);
  assert.ok(stored.startsWith('data:image/webp;base64,'));
  assert.ok(
    stored.length <= 650_000,
    `Expected compressed dataUrl <= 650000 chars, got ${stored.length}`
  );
});

test('DefaultPromptEvalService.createRun cleans up items, counts, and notificationStatus when submitBatchJob throws', async () => {
  const store = new InMemoryPromptEvalStore();
  let shouldThrowOnSubmit = true;

  const provider: PromptExecutionProvider = {
    id: 'mock',
    label: 'Mock Provider',
    isConfigured: () => true,
    getInfo: (isDefault) => ({
      id: 'mock',
      label: 'Mock Provider',
      configured: true,
      isDefault,
      supportedModalities: ['text'],
      supportsBatch: true,
      defaultModel: 'mock-text',
      models: [
        {
          id: 'mock-text',
          label: 'Mock Text',
          modality: 'text',
          outputFormat: 'text',
          supportsStandard: true,
          supportsBatch: true,
          batchDiscountRatio: 0.5,
          estimatedStandardCostPerItemUsd: 0,
          estimatedBatchCostPerItemUsd: 0,
          isFreeTier: true,
          standardTurnaroundLabel: '1s',
          batchTurnaroundLabel: '24h',
        },
      ],
    }),
    getModelInfo(modelId) {
      return this.getInfo(true).models.find((m) => m.id === modelId);
    },
    async executeStandardItem(req) {
      return {
        itemId: req.textInput?.id ?? 'item-0',
        index: req.textInput?.index ?? 0,
        status: 'completed',
        outputFormat: 'text',
        outputText: 'ok',
      };
    },
    async submitBatchJob() {
      if (shouldThrowOnSubmit) {
        throw new Error('Upstream Batch API quota exceeded');
      }
      return { externalBatchJobId: 'batch-ok-1', externalBatchState: 'QUEUED' };
    },
    async pollBatchJob() {
      return { status: 'running', externalBatchState: 'RUNNING' };
    },
    async cancelBatchJob() {
      // no-op
    },
  };

  const service = new DefaultPromptEvalService({
    providers: new DefaultPromptProviderRegistry({
      providers: [provider],
      defaultProviderId: 'mock',
    }),
    store,
    emailSender: new NoopEmailSender(),
  });

  // Case 1: submitBatchJob throws when notifyEmail is requested
  await assert.rejects(
    () =>
      service.createRun({
        actorUid: 'u1',
        actorEmail: 'admin@example.com',
        modality: 'text',
        executionMode: 'batch',
        providerId: 'mock',
        model: 'mock-text',
        promptSource: 'custom',
        customPromptText: 'Evaluate me',
        notifyEmail: 'admin@example.com',
        textInputs: [{ text: 'first' }, { text: 'second' }, { text: 'third' }],
      }),
    (err: unknown) =>
      err instanceof PromptEvalError &&
      err.statusCode === 502 &&
      err.code === 'batch_submit_failed'
  );

  const runsAfterFailWithEmail = await store.listRuns(10);
  assert.equal(runsAfterFailWithEmail.length, 1);
  const failedWithEmail = await store.getRun(runsAfterFailWithEmail[0].id);
  assert.ok(failedWithEmail);
  assert.equal(failedWithEmail.status, 'failed');
  assert.equal(failedWithEmail.totalItems, 3);
  assert.equal(failedWithEmail.completedItems, 0);
  assert.equal(failedWithEmail.failedItems, 3);
  assert.equal(
    failedWithEmail.items.filter((i) => i.status === 'pending').length,
    0,
    'No item may remain stuck in pending after submitBatchJob failure'
  );
  assert.ok(
    failedWithEmail.items.every(
      (i) =>
        i.status === 'failed' &&
        typeof i.completedAtMs === 'number' &&
        (i.errorMessage ?? '').includes('Upstream Batch API quota exceeded')
    )
  );
  assert.notEqual(failedWithEmail.notificationStatus, 'pending');
  assert.equal(failedWithEmail.notificationStatus, 'failed');
  assert.ok(failedWithEmail.notificationError);
  assert.equal((await store.listActiveBatchRuns()).length, 0);

  // Case 2: submitBatchJob throws without notifyEmail (notificationStatus stays 'not_requested')
  await assert.rejects(
    () =>
      service.createRun({
        actorUid: 'u1',
        actorEmail: 'admin@example.com',
        modality: 'text',
        executionMode: 'batch',
        providerId: 'mock',
        model: 'mock-text',
        promptSource: 'custom',
        customPromptText: 'Evaluate me 2',
        textInputs: [{ text: 'only-one' }],
      }),
    (err: unknown) => err instanceof PromptEvalError && err.code === 'batch_submit_failed'
  );

  const runsAfterSecond = await store.listRuns(10);
  assert.equal(runsAfterSecond.length, 2);
  const failedNoEmailSummary = runsAfterSecond.find(
    (r) => r.id !== failedWithEmail.id
  );
  assert.ok(failedNoEmailSummary);
  const failedNoEmail = await store.getRun(failedNoEmailSummary.id);
  assert.ok(failedNoEmail);
  assert.equal(failedNoEmail.status, 'failed');
  assert.equal(failedNoEmail.failedItems, 1);
  assert.equal(failedNoEmail.items[0].status, 'failed');
  assert.equal(failedNoEmail.notificationStatus, 'not_requested');

  // Case 3: cancelling a queued batch run with notifyEmail clears pending notificationStatus
  shouldThrowOnSubmit = false;
  const queuedRun = await service.createRun({
    actorUid: 'u1',
    actorEmail: 'admin@example.com',
    modality: 'text',
    executionMode: 'batch',
    providerId: 'mock',
    model: 'mock-text',
    promptSource: 'custom',
    customPromptText: 'Cancel with email',
    notifyEmail: 'admin@example.com',
    textInputs: [{ text: 'one' }],
  });
  assert.equal(queuedRun.notificationStatus, 'pending');
  const cancelled = await service.cancelBatchRun(queuedRun.id);
  assert.equal(cancelled.status, 'cancelled');
  assert.equal(cancelled.failedItems, 1);
  assert.equal(cancelled.items[0].status, 'failed');
  assert.notEqual(cancelled.notificationStatus, 'pending');
  assert.equal(cancelled.notificationStatus, 'not_requested');
});

test('DefaultPromptEvalService isolates cleanup store errors, cleans unfinished standard items, handles non-email createdByEmail, and formats text-mode emails generically', async () => {
  // 1. Batch submit failure + transient store.upsertRunItem failure on item #1:
  //    must preserve original submitBatchJob error AND still mark remaining items & run summary failed.
  const baseStore = new InMemoryPromptEvalStore();
  let failNextUpsert = true;
  const flakyStore: typeof baseStore = Object.assign(
    Object.create(Object.getPrototypeOf(baseStore)),
    baseStore,
    {
      async upsertRunItem(runId: string, item: PromptEvalRunDetail['items'][number]) {
        if (failNextUpsert) {
          failNextUpsert = false;
          throw new Error('Transient Firestore write error');
        }
        return baseStore.upsertRunItem(runId, item);
      },
    }
  );

  const mockProvider: PromptExecutionProvider = {
    id: 'mock',
    label: 'Mock Provider',
    isConfigured: () => true,
    getInfo: (isDefault) => ({
      id: 'mock',
      label: 'Mock Provider',
      configured: true,
      isDefault,
      supportedModalities: ['text'],
      supportsBatch: true,
      defaultModel: 'mock-text',
      models: [
        {
          id: 'mock-text',
          label: 'Mock Text',
          modality: 'text',
          outputFormat: 'text',
          supportsStandard: true,
          supportsBatch: true,
          batchDiscountRatio: 0.5,
          estimatedStandardCostPerItemUsd: 0,
          estimatedBatchCostPerItemUsd: 0,
          isFreeTier: true,
          standardTurnaroundLabel: '1s',
          batchTurnaroundLabel: '24h',
        },
      ],
    }),
    getModelInfo(modelId) {
      return this.getInfo(true).models.find((m) => m.id === modelId);
    },
    async executeStandardItem(req) {
      return {
        itemId: req.textInput?.id ?? 'item-0',
        index: req.textInput?.index ?? 0,
        status: 'completed',
        outputFormat: 'text',
        outputText: `echo:${req.textInput?.text ?? ''}`,
      };
    },
    async submitBatchJob() {
      throw new Error('Upstream Batch API timeout');
    },
    async pollBatchJob() {
      return { status: 'running', externalBatchState: 'RUNNING' };
    },
    async cancelBatchJob() {
      // no-op
    },
  };

  const flakyService = new DefaultPromptEvalService({
    providers: new DefaultPromptProviderRegistry({
      providers: [mockProvider],
      defaultProviderId: 'mock',
    }),
    store: flakyStore,
    emailSender: new NoopEmailSender(),
    standardConcurrency: 1,
  });

  await assert.rejects(
    () =>
      flakyService.createRun({
        actorUid: 'u1',
        actorEmail: 'admin',
        modality: 'text',
        executionMode: 'batch',
        providerId: 'mock',
        model: 'mock-text',
        promptSource: 'custom',
        customPromptText: 'Evaluate',
        notifyEmail: 'admin@example.com',
        textInputs: [{ text: 'a' }, { text: 'b' }],
      }),
    (err: unknown) =>
      err instanceof PromptEvalError &&
      err.code === 'batch_submit_failed' &&
      err.message.includes('Upstream Batch API timeout')
  );

  const runsAfterFlakyBatch = await baseStore.listRuns(10);
  assert.equal(runsAfterFlakyBatch.length, 1);
  const flakyBatchRun = await baseStore.getRun(runsAfterFlakyBatch[0].id);
  assert.ok(flakyBatchRun);
  assert.equal(flakyBatchRun.status, 'failed');
  assert.equal(flakyBatchRun.failedItems, 2);
  assert.equal(flakyBatchRun.notificationStatus, 'failed');
  assert.equal(flakyBatchRun.items[1].status, 'failed');

  // 2. Standard mode unexpected store failure transitions remaining 'running' items to 'failed'
  failNextUpsert = true;
  await assert.rejects(
    () =>
      flakyService.createRun({
        actorUid: 'u1',
        actorEmail: 'admin',
        modality: 'text',
        executionMode: 'standard',
        providerId: 'mock',
        model: 'mock-text',
        promptSource: 'custom',
        customPromptText: 'Evaluate std',
        notifyEmail: 'admin@example.com',
        textInputs: [{ text: 'first' }, { text: 'second' }],
      }),
    /Transient Firestore write error/
  );

  const runsAfterStdFail = await baseStore.listRuns(10);
  const stdFailedSummary = runsAfterStdFail.find(
    (r) => r.id !== flakyBatchRun.id
  );
  assert.ok(stdFailedSummary);
  const stdFailedRun = await baseStore.getRun(stdFailedSummary.id);
  assert.ok(stdFailedRun);
  assert.equal(stdFailedRun.status, 'failed');
  assert.equal(stdFailedRun.failedItems, 2);
  assert.equal(stdFailedRun.notificationStatus, 'failed');
  assert.equal(
    stdFailedRun.items.filter((i) => i.status === 'running').length,
    0,
    'No item may remain stuck in running after standard worker error'
  );

  // 3. notifyRunByEmail handles non-email createdByEmail ('admin') cleanly -> missing_email (not invalid_email)
  const cleanStore = new InMemoryPromptEvalStore();
  const cleanService = new DefaultPromptEvalService({
    providers: new DefaultPromptProviderRegistry({
      providers: [mockProvider],
      defaultProviderId: 'mock',
    }),
    store: cleanStore,
    emailSender: new NoopEmailSender(),
  });
  const textRunNoEmail = await cleanService.createRun({
    actorUid: 'u1',
    actorEmail: 'admin',
    modality: 'text',
    executionMode: 'standard',
    providerId: 'mock',
    model: 'mock-text',
    promptSource: 'custom',
    customPromptText: 'Summarize',
    textInputs: [{ name: 'doc1', text: 'hello world' }],
  });
  assert.equal(textRunNoEmail.status, 'completed');
  await assert.rejects(
    () => cleanService.notifyRunByEmail(textRunNoEmail.id),
    (err: unknown) =>
      err instanceof PromptEvalError &&
      err.statusCode === 400 &&
      err.code === 'missing_email'
  );
  await assert.rejects(
    () => cleanService.notifyRunByEmail(textRunNoEmail.id, 'not-an-email'),
    (err: unknown) =>
      err instanceof PromptEvalError &&
      err.statusCode === 400 &&
      err.code === 'invalid_email'
  );

  // 4. Text-modality email message uses generic output wording (not image-only) and ZIP includes outputText
  const textEmail = buildRunResultEmailMessage({
    run: textRunNoEmail,
    to: 'admin@example.com',
    appBaseUrl: 'https://example.test',
  });
  assert.ok(
    !textEmail.text.toLowerCase().includes('immagini'),
    `Text-mode email must not mention images: ${textEmail.text}`
  );
  assert.equal(textEmail.attachments?.length, 1);
  const zipRaw = Buffer.from(
    textEmail.attachments![0].contentBase64,
    'base64'
  ).toString('utf8');
  assert.ok(zipRaw.includes('echo:hello world'));

  // 5. FetchPromptEvalClient wraps browser TypeError (e.g. ERR_UPLOAD_FILE_CHANGED / Failed to fetch) into actionable Italian PromptEvalClientError
  const failingUploadClient = new FetchPromptEvalClient(
    '/api/admin/prompt-eval',
    (async () => {
      throw new TypeError('Failed to fetch');
    }) as typeof fetch
  );
  await assert.rejects(
    () =>
      failingUploadClient.createRun(
        {
          modality: 'image',
          executionMode: 'batch',
          promptSource: 'catalog',
          catalogId: COLORASTORIA_CATALOG_ID,
          promptParams: { version: 'v3', mode: 'fedele' },
          files: [
            new File([new Uint8Array([1, 2, 3])], 'test.jpg', {
              type: 'image/jpeg',
            }),
          ],
        },
        'token'
      ),
    (err: unknown) =>
      err instanceof PromptEvalClientError &&
      err.statusCode === 0 &&
      err.code === 'network_error' &&
      err.message.includes('spostati/rinominati')
  );
});

test('Datasets end-to-end: repo dataset discovery (including WebP) + app dataset creation/export/deletion + running evaluations from repo & app datasets', async () => {
  const pngNew = await makeValidPngBuffer(440, 440, { r: 230, g: 150, b: 90 });
  const outPng = await makeValidPngBuffer(400, 400, { r: 255, g: 255, b: 255 });
  const outPngBase64 = outPng.toString('base64');

  const receivedImageNames: string[] = [];
  const mockGeminiClient: GeminiClientLike = {
    models: {
      generateContent: (async () => ({
        candidates: [
          {
            content: {
              parts: [
                {
                  inlineData: {
                    mimeType: 'image/png',
                    data: outPngBase64,
                  },
                },
              ],
            },
          },
        ],
        usageMetadata: {
          promptTokenCount: 400,
          candidatesTokenCount: 1120,
          candidatesTokensDetails: [{ modality: 'IMAGE', tokenCount: 1120 }],
        },
      })) as unknown as GeminiClientLike['models']['generateContent'],
    },
    batches: {
      create: (async () => ({
        name: 'batches/ds-batch-1',
        state: 'JOB_STATE_QUEUED',
      })) as unknown as GeminiClientLike['batches']['create'],
      get: (async () => ({
        name: 'batches/ds-batch-1',
        state: 'JOB_STATE_RUNNING',
      })) as unknown as GeminiClientLike['batches']['get'],
      cancel: (async () => undefined) as unknown as GeminiClientLike['batches']['cancel'],
    },
    files: {
      upload: (async () => ({
        name: 'files/mock',
      })) as unknown as GeminiClientLike['files']['upload'],
    },
  };

  const mediaPreparer = new SharpPromptEvalMediaPreparer(serverMediaValidator);
  const datasetRepository = new FilesystemPromptEvalDatasetRepository({
    rootDir: path.resolve(import.meta.dirname, '..', 'dataset'),
    mediaPreparer,
  });
  const datasetStore = new InMemoryPromptEvalDatasetStore();

  const service = new DefaultPromptEvalService({
    providers: new DefaultPromptProviderRegistry({
      providers: [
        new GeminiPromptEvalProvider({
          apiKey: 'fake-key',
          defaultModel: 'gemini-nano-banana-2.1',
          clientFactory: () => mockGeminiClient,
        }),
      ],
      defaultProviderId: 'gemini',
    }),
    store: new InMemoryPromptEvalStore(),
    datasetRepository,
    datasetStore,
    catalogResolver: new ColoraStoriaPromptCatalogResolver(
      new FilesystemPromptRepository()
    ),
    mediaPreparer,
    emailSender: new NoopEmailSender(),
  });

  const app = express();
  app.use(express.json({ limit: '12mb' }));
  app.use(
    '/api/admin/prompt-eval',
    createPromptEvalRouter({
      service,
      authorizeAdmin: async (req) => ({
        isAdmin: req.headers.authorization === 'Bearer admin-ok',
        uid: 'admin-1',
        email: 'admin@example.com',
      }),
    })
  );

  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  assert.ok(address && typeof address === 'object');
  const client = new FetchPromptEvalClient(
    `http://127.0.0.1:${address.port}/api/admin/prompt-eval`
  );

  try {
    // 1. Lists repository dataset v1 (9 real photos, readOnly=true, source='repo')
    const initialList = await client.listDatasets('admin-ok');
    const repoV1 = initialList.find((d) => d.id === 'repo_v1');
    assert.ok(repoV1, 'Expected repository dataset repo_v1 to be discovered');
    assert.equal(repoV1.source, 'repo');
    assert.equal(repoV1.readOnly, true);
    assert.equal(repoV1.itemCount, 9);
    assert.ok(repoV1.previewThumbnails.length > 0);

    // 2. Repo datasets cannot be deleted via app API
    await assert.rejects(
      () => client.deleteDataset('repo_v1', 'admin-ok'),
      (err: unknown) =>
        err instanceof PromptEvalClientError &&
        err.statusCode === 400 &&
        err.code === 'dataset_read_only'
    );

    // 3. Load repo_v1 details and verify fish1.webp + bambola.jpg can run directly without re-uploading files
    const repoV1Detail = await client.getDataset('repo_v1', 'admin-ok');
    const webpItem = repoV1Detail.items.find((i) => i.name === 'fish1.webp');
    const jpgItem = repoV1Detail.items.find((i) => i.name === 'bambola.jpg');
    assert.ok(webpItem, 'Expected fish1.webp in repo_v1');
    assert.ok(jpgItem, 'Expected bambola.jpg in repo_v1');

    const runFromRepo = await client.createRun(
      {
        title: 'Run da repo dataset v1',
        modality: 'image',
        executionMode: 'standard',
        promptSource: 'catalog',
        catalogId: COLORASTORIA_CATALOG_ID,
        promptParams: { version: 'v3', mode: 'fedele' },
        datasetItems: [
          { datasetId: 'repo_v1', itemId: webpItem.id },
          { datasetId: 'repo_v1', itemId: jpgItem.id },
        ],
      },
      'admin-ok'
    );
    assert.equal(runFromRepo.status, 'completed');
    assert.equal(runFromRepo.completedItems, 2);
    receivedImageNames.push(...runFromRepo.items.map((i) => i.inputName));
    assert.deepEqual(receivedImageNames, ['fish1.webp', 'bambola.jpg']);

    // 4. Create a new dataset from the app combining 1 repo item + 1 newly uploaded photo
    const createdAppDataset = await client.createDataset(
      {
        name: 'Nuovo Set App',
        description: 'Creato dalla console admin',
        sourceItems: [{ datasetId: 'repo_v1', itemId: webpItem.id }],
        files: [
          new File([new Uint8Array(pngNew)], 'nuova-foto.png', {
            type: 'image/png',
          }),
        ],
      },
      'admin-ok'
    );
    assert.equal(createdAppDataset.source, 'app');
    assert.equal(createdAppDataset.readOnly, false);
    assert.equal(createdAppDataset.itemCount, 2);
    assert.equal(createdAppDataset.slug, 'nuovo-set-app');

    // 5. Export app dataset as .zip ready for dataset/<slug>/input/
    const exported = await client.exportDatasetArchive(
      createdAppDataset.id,
      'admin-ok'
    );
    assert.equal(exported.filename, 'nuovo-set-app.zip');
    const zipBytes = new Uint8Array(await exported.blob.arrayBuffer());
    const zipLatin1 = Buffer.from(zipBytes).toString('latin1');
    assert.ok(zipLatin1.includes('nuovo-set-app/dataset.json'));
    assert.ok(zipLatin1.includes('nuovo-set-app/input/'));

    // 6. Run evaluation using the newly created app dataset
    const runFromAppDataset = await client.createRun(
      {
        title: 'Batch da App Dataset',
        modality: 'image',
        executionMode: 'batch',
        promptSource: 'catalog',
        catalogId: COLORASTORIA_CATALOG_ID,
        promptParams: {
          version: 'v3',
          mode: 'creativa',
          themeId: 'dinosauri',
          ageGroup: '3-4',
        },
        datasetItems: createdAppDataset.items.map((item) => ({
          datasetId: createdAppDataset.id,
          itemId: item.id,
        })),
      },
      'admin-ok'
    );
    assert.equal(runFromAppDataset.status, 'queued');
    assert.equal(runFromAppDataset.totalItems, 2);

    // 7. Delete the app dataset cleanly
    await client.deleteDataset(createdAppDataset.id, 'admin-ok');
    await assert.rejects(
      () => client.getDataset(createdAppDataset.id, 'admin-ok'),
      (err: unknown) =>
        err instanceof PromptEvalClientError && err.statusCode === 404
    );
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});
