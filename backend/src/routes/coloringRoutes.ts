import { Router, type NextFunction, type Request, type Response } from 'express';
import multer from 'multer';
import {
  isAllowedThemeId,
  type AdminSessionResponse,
  type ColoringGenerationResponse,
  type HealthResponse,
  type ProvidersListResponse,
} from '../../../shared/types/index.ts';
import {
  ProviderConfigurationError,
  ProviderExecutionError,
  aiProviderRegistry,
  type AiProviderRegistry,
} from '../modules/ai-providers/index.ts';
import {
  authTokenVerifier,
  type AuthTokenVerifier,
} from '../modules/auth/index.ts';
import {
  promptRepository,
  type PromptRepository,
} from '../modules/prompts/index.ts';

const MAX_UPLOAD_BYTES = 12 * 1024 * 1024;
const ALLOWED_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_UPLOAD_BYTES,
    files: 1,
  },
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
      cb(new Error('Formato non supportato. Carica un file JPG, PNG o WebP.'));
      return;
    }
    cb(null, true);
  },
});

export interface ColoringRouterDeps {
  providers: AiProviderRegistry;
  auth: AuthTokenVerifier;
  prompts: PromptRepository;
}

export function createColoringRouter(
  deps: ColoringRouterDeps = {
    providers: aiProviderRegistry,
    auth: authTokenVerifier,
    prompts: promptRepository,
  }
): Router {
  const router = Router();

  router.get('/health', (_req: Request, res: Response) => {
    const payload: HealthResponse = {
      ok: true,
      promptVersion: deps.prompts.getActiveVersion(),
    };
    res.json(payload);
  });

  router.get('/providers', (_req: Request, res: Response) => {
    const payload: ProvidersListResponse = {
      providers: deps.providers.listStatuses(),
    };
    res.json(payload);
  });

  router.get('/admin/session', async (req: Request, res: Response) => {
    const adminCtx = await deps.auth.verifyOptionalRequest(req);
    const payload: AdminSessionResponse = {
      authenticated: adminCtx.authenticated,
      isAdmin: adminCtx.isAdmin,
      email: adminCtx.email ?? null,
      uid: adminCtx.uid ?? null,
      promptVersions: adminCtx.isAdmin ? deps.prompts.listVersions() : [],
      activePromptVersion: adminCtx.isAdmin
        ? deps.prompts.getActiveVersion()
        : null,
      providers: adminCtx.isAdmin ? deps.providers.listStatuses() : [],
    };
    res.json(payload);
  });

  router.post(
    '/coloring/generate',
    (req: Request, res: Response, next: NextFunction) => {
      upload.single('photo')(req, res, (err: unknown) => {
        if (!err) {
          next();
          return;
        }
        if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
          res.status(400).json({
            error: 'La foto supera il limite massimo di 12 MB.',
          });
          return;
        }
        const message =
          err instanceof Error
            ? err.message
            : 'Impossibile leggere il file caricato.';
        res.status(400).json({ error: message });
      });
    },
    async (req: Request, res: Response) => {
      let isAdminUser = false;
      let requestedProviderName: string | undefined;
      try {
        const adminCtx = await deps.auth.verifyOptionalRequest(req);
        isAdminUser = adminCtx.isAdmin;
        const file = req.file;
        if (!file) {
          res.status(400).json({
            error: 'Seleziona una foto prima di avviare la generazione.',
            ...(isAdminUser
              ? {
                  adminErrorDetails: {
                    statusCode: 400,
                    errorName: 'ValidationError',
                    rawMessage: 'req.file is missing in multipart/form-data request',
                    timestamp: new Date().toISOString(),
                  },
                }
              : {}),
          });
          return;
        }

        const rawTheme =
          typeof req.body?.theme === 'string' ? req.body.theme.trim() : '';
        if (!isAllowedThemeId(rawTheme)) {
          res.status(400).json({
            error: 'Seleziona uno dei sei mondi illustrati disponibili.',
            ...(isAdminUser
              ? {
                  adminErrorDetails: {
                    statusCode: 400,
                    errorName: 'ValidationError',
                    rawMessage: `Invalid themeId received: "${rawTheme}"`,
                    timestamp: new Date().toISOString(),
                  },
                }
              : {}),
          });
          return;
        }

        const requestedProvider =
          adminCtx.isAdmin && typeof req.body?.provider === 'string'
            ? req.body.provider.trim()
            : undefined;
        requestedProviderName = requestedProvider;
        const requestedPromptVersion =
          adminCtx.isAdmin && typeof req.body?.promptVersion === 'string'
            ? req.body.promptVersion.trim()
            : undefined;

        const provider = deps.providers.getProvider(requestedProvider);

        const result = await provider.generateColoringPage({
          imageBuffer: file.buffer,
          mimeType: file.mimetype,
          themeId: rawTheme,
          promptVersionOverride: requestedPromptVersion || undefined,
        });

        console.info(
          `[COST] provider=${result.provider} model=${result.model} prompt=${result.promptVersion} theme=${rawTheme} format=${result.outputFormat} in=${result.usage.inputTokens} cached=${result.usage.cachedInputTokens} textOut=${result.usage.textOutputTokens} imgOut=${result.usage.imageOutputTokens} cost=$${result.usage.estimatedCostUsd.toFixed(6)} latency=${result.latencyMs}ms admin=${adminCtx.isAdmin}`
        );

        const responsePayload: ColoringGenerationResponse = {
          ok: true,
          provider: result.provider,
          model: result.model,
          outputFormat: result.outputFormat,
          imageDataUrl: result.imageDataUrl,
          svgMarkup: result.svgMarkup,
          sceneSummary: result.sceneSummary,
          ...(adminCtx.isAdmin
            ? {
                adminTelemetry: {
                  provider: result.provider,
                  model: result.model,
                  promptVersion: result.promptVersion,
                  outputFormat: result.outputFormat,
                  latencyMs: result.latencyMs,
                  ...result.usage,
                },
              }
            : {}),
        };

        res.json(responsePayload);
      } catch (error) {
        if (
          error instanceof ProviderConfigurationError ||
          error instanceof ProviderExecutionError
        ) {
          console.error(
            `[${error.name}] status=${error.statusCode} message="${error.message}" raw="${error.rawDetails ?? ''}"`
          );
          res.status(error.statusCode).json({
            error: error.message,
            ...(isAdminUser
              ? {
                  adminErrorDetails: {
                    statusCode: error.statusCode,
                    errorName: error.name,
                    provider: requestedProviderName ?? 'default',
                    rawMessage: error.rawDetails || error.message,
                    timestamp: new Date().toISOString(),
                  },
                }
              : {}),
          });
          return;
        }

        console.error('Unexpected coloring generation error:', error);
        const rawUnexpected =
          error instanceof Error
            ? `${error.name}: ${error.message}\n${error.stack ?? ''}`
            : String(error);
        res.status(500).json({
          error:
            'Errore imprevisto sul server durante la creazione della pagina. Riprova tra poco.',
          ...(isAdminUser
            ? {
                adminErrorDetails: {
                  statusCode: 500,
                  errorName:
                    error instanceof Error ? error.name : 'UnexpectedError',
                  provider: requestedProviderName ?? 'default',
                  rawMessage: rawUnexpected.slice(0, 1500),
                  timestamp: new Date().toISOString(),
                },
              }
            : {}),
        });
      }
    }
  );

  return router;
}
