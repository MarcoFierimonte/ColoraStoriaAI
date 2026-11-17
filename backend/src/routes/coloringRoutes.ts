import { Router, type NextFunction, type Request, type Response } from 'express';
import rateLimit from 'express-rate-limit';
import multer from 'multer';
import {
  ACCEPTED_IMAGE_EXTENSIONS_LABEL,
  ACCEPTED_IMAGE_MIME_TYPES,
  MAX_UPLOAD_FILE_BYTES,
  MAX_UPLOAD_FILE_SIZE_MB,
} from '../../../shared/config/index.ts';
import {
  isAllowedThemeId,
  type AdminSessionResponse,
  type ColoringGenerationResponse,
  type HealthResponse,
} from '../../../shared/types/index.ts';
import {
  ProviderConfigurationError,
  ProviderExecutionError,
  aiProviderRegistry,
  type AiProviderRegistry,
} from '../modules/ai-providers/index.ts';
import {
  authTokenVerifier,
  type AdminAuthContext,
  type AuthTokenVerifier,
} from '../modules/auth/index.ts';
import {
  BotProtectionError,
  botProtectionVerifier,
  type BotProtectionVerifier,
} from '../modules/bot-protection/index.ts';
import {
  ImageValidationError,
  serverMediaValidator,
  type ServerMediaValidator,
} from '../modules/media-validation/index.ts';
import {
  promptRepository,
  type PromptRepository,
} from '../modules/prompts/index.ts';

const ALLOWED_MIME_TYPES = new Set<string>(ACCEPTED_IMAGE_MIME_TYPES);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_UPLOAD_FILE_BYTES,
    files: 1,
  },
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
      cb(
        new Error(
          `Formato non supportato. Carica un file ${ACCEPTED_IMAGE_EXTENSIONS_LABEL}.`
        )
      );
      return;
    }
    cb(null, true);
  },
});

const generateRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 15,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  handler: (_req, res) => {
    res.status(429).json({
      error:
        'Hai raggiunto il limite temporaneo di richieste. Attendi qualche minuto e riprova.',
    });
  },
});

export interface ColoringRouterDeps {
  providers: AiProviderRegistry;
  auth: AuthTokenVerifier;
  prompts: PromptRepository;
  botProtection: BotProtectionVerifier;
  mediaValidator: ServerMediaValidator;
}

interface RequestWithAdmin extends Request {
  adminCtx?: AdminAuthContext;
}

export function createColoringRouter(
  deps: ColoringRouterDeps = {
    providers: aiProviderRegistry,
    auth: authTokenVerifier,
    prompts: promptRepository,
    botProtection: botProtectionVerifier,
    mediaValidator: serverMediaValidator,
  }
): Router {
  const router = Router();

  router.get('/health', (_req: Request, res: Response) => {
    const payload: HealthResponse = {
      ok: true,
    };
    res.json(payload);
  });

  router.get('/admin/session', async (req: Request, res: Response) => {
    const adminCtx = await deps.auth.verifyOptionalRequest(req);
    const payload: AdminSessionResponse = {
      authenticated: adminCtx.authenticated,
      isAdmin: adminCtx.isAdmin,
      hasAdminClaim: Boolean(adminCtx.hasAdminClaim),
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
    generateRateLimiter,
    async (req: RequestWithAdmin, res: Response, next: NextFunction) => {
      try {
        const adminCtx = await deps.auth.verifyOptionalRequest(req);
        req.adminCtx = adminCtx;
        await deps.botProtection.verifyRequest({
          headers: req.headers,
          clientIp: req.ip,
          isAdmin: adminCtx.isAdmin,
        });
        next();
      } catch (err) {
        const isAdminUser = req.adminCtx?.isAdmin === true;
        if (err instanceof BotProtectionError) {
          console.warn(
            `[BOT_PROTECTION] status=${err.statusCode} details="${err.rawDetails ?? err.message}"`
          );
          const wireStatus =
            process.env.NODE_ENV === 'development' &&
            (err.statusCode === 403 ||
              err.statusCode === 502 ||
              err.statusCode === 503)
              ? err.statusCode === 403
                ? 400
                : 500
              : err.statusCode;
          res.status(wireStatus).json({
            error: err.message,
            ...(isAdminUser
              ? {
                  adminErrorDetails: {
                    statusCode: err.statusCode,
                    errorName: err.name,
                    rawMessage: err.rawDetails || err.message,
                    timestamp: new Date().toISOString(),
                  },
                }
              : {}),
          });
          return;
        }
        next(err);
      }
    },
    (req: Request, res: Response, next: NextFunction) => {
      upload.single('photo')(req, res, (err: unknown) => {
        if (!err) {
          next();
          return;
        }
        if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
          res.status(400).json({
            error: `La foto supera il limite massimo di ${MAX_UPLOAD_FILE_SIZE_MB} MB.`,
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
    async (req: RequestWithAdmin, res: Response) => {
      const adminCtx = req.adminCtx ?? { authenticated: false, isAdmin: false };
      const isAdminUser = adminCtx.isAdmin;
      let requestedProviderName: string | undefined;

      try {
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

        const verifiedImage = deps.mediaValidator.validate(
          file.buffer,
          file.mimetype
        );

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
          mimeType: verifiedImage.mimeType,
          themeId: rawTheme,
          promptVersionOverride: requestedPromptVersion || undefined,
        });

        console.info(
          `[COST] provider=${result.provider} model=${result.model} prompt=${result.promptVersion} theme=${rawTheme} format=${result.outputFormat} dims=${verifiedImage.width}x${verifiedImage.height} in=${result.usage.inputTokens} cached=${result.usage.cachedInputTokens} textOut=${result.usage.textOutputTokens} imgOut=${result.usage.imageOutputTokens} cost=$${result.usage.estimatedCostUsd.toFixed(6)} latency=${result.latencyMs}ms admin=${adminCtx.isAdmin}`
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
          error instanceof ImageValidationError ||
          error instanceof ProviderConfigurationError ||
          error instanceof ProviderExecutionError
        ) {
          console.error(
            `[${error.name}] status=${error.statusCode} message="${error.message}" raw="${error.rawDetails ?? ''}"`
          );
          const wireStatus =
            process.env.NODE_ENV === 'development' &&
            (error.statusCode === 403 ||
              error.statusCode === 502 ||
              error.statusCode === 503)
              ? error.statusCode === 403
                ? 400
                : 500
              : error.statusCode;
          res.status(wireStatus).json({
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
