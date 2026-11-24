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
  DEFAULT_AGE_GROUP,
  isAllowedThemeId,
  isColoringAgeGroup,
  isColoringStyleMode,
  isPrintPdfLayout,
  type AccessSessionResponse,
  type AdminInviteMutationResponse,
  type AdminInvitesListResponse,
  type AdminSessionResponse,
  type AdminTelemetryLogsResponse,
  type ColoringAgeGroup,
  type ColoringGenerationResponse,
  type ColoringStyleMode,
  type CreateInviteRequest,
  type HealthResponse,
  type ThemeId,
  type UpdateInviteRequest,
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
  BetaAccessError,
  betaAccessService,
  type BetaAccessService,
  type InviteReservation,
} from '../modules/beta-access/index.ts';
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
  PrintPdfError,
  printPdfGenerator,
  type PrintPdfGenerator,
} from '../modules/print-pdf/index.ts';
import {
  generationTelemetryService,
  type AdminGenerationTelemetryService,
} from '../modules/prompt-eval/index.ts';
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

const exportPdfRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  handler: (_req, res) => {
    res.status(429).json({
      error:
        'Hai raggiunto il limite temporaneo di esportazioni PDF. Attendi qualche minuto e riprova.',
    });
  },
});

const redeemInviteRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  handler: (_req, res) => {
    res.status(429).json({
      error:
        'Troppi tentativi di verifica codice. Attendi qualche minuto e riprova.',
    });
  },
});

export interface ColoringRouterDeps {
  providers: AiProviderRegistry;
  auth: AuthTokenVerifier;
  prompts: PromptRepository;
  botProtection: BotProtectionVerifier;
  mediaValidator: ServerMediaValidator;
  printPdf?: PrintPdfGenerator;
  betaAccess?: BetaAccessService;
  telemetryService?: AdminGenerationTelemetryService;
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
    printPdf: printPdfGenerator,
    betaAccess: betaAccessService,
    telemetryService: generationTelemetryService,
  }
): Router {
  const router = Router();
  const betaAccess = deps.betaAccess ?? betaAccessService;
  const telemetryService = deps.telemetryService;

  router.get('/health', (_req: Request, res: Response) => {
    const payload: HealthResponse = {
      ok: true,
    };
    res.json(payload);
  });

  router.get('/access/session', async (req: Request, res: Response) => {
    try {
      const adminCtx = await deps.auth.verifyOptionalRequest(req);
      const session: AccessSessionResponse = await betaAccess.getSession(
        req,
        adminCtx.isAdmin
      );
      res.setHeader('Cache-Control', 'no-store');
      res.json(session);
    } catch (error) {
      console.error('Failed to read access session:', error);
      res.status(500).json({
        error: 'Impossibile verificare lo stato dell’accesso in questo momento.',
      });
    }
  });

  router.post(
    '/access/redeem',
    redeemInviteRateLimiter,
    async (req: Request, res: Response) => {
      try {
        const rawCode =
          typeof req.body?.code === 'string' ? req.body.code : '';
        const { session, setCookieHeader } =
          await betaAccess.redeemCode(rawCode);
        if (setCookieHeader) {
          res.setHeader('Set-Cookie', setCookieHeader);
        }
        res.setHeader('Cache-Control', 'no-store');
        res.json(session);
      } catch (error) {
        if (error instanceof BetaAccessError) {
          res.status(error.statusCode).json({ error: error.message });
          return;
        }
        console.error('Unexpected invite redeem error:', error);
        res.status(500).json({
          error: 'Errore durante la verifica dell’invito. Riprova.',
        });
      }
    }
  );

  router.post('/access/logout', (_req: Request, res: Response) => {
    res.setHeader('Set-Cookie', betaAccess.buildClearCookieHeader());
    res.setHeader('Cache-Control', 'no-store');
    res.json({ ok: true });
  });

  router.get('/admin/invites', async (req: Request, res: Response) => {
    try {
      const adminCtx = await deps.auth.verifyOptionalRequest(req);
      if (!adminCtx.isAdmin) {
        res.status(403).json({ error: 'Accesso riservato agli amministratori.' });
        return;
      }
      const invites = await betaAccess.listInvites();
      const payload: AdminInvitesListResponse = { invites };
      res.setHeader('Cache-Control', 'no-store');
      res.json(payload);
    } catch (error) {
      console.error('Failed to list admin invites:', error);
      res.status(500).json({ error: 'Impossibile caricare gli inviti.' });
    }
  });

  router.post('/admin/invites', async (req: Request, res: Response) => {
    try {
      const adminCtx = await deps.auth.verifyOptionalRequest(req);
      if (!adminCtx.isAdmin) {
        res.status(403).json({ error: 'Accesso riservato agli amministratori.' });
        return;
      }
      const body = (req.body ?? {}) as Partial<CreateInviteRequest>;
      const invite = await betaAccess.createInvite(
        {
          label: String(body.label ?? ''),
          code: typeof body.code === 'string' ? body.code : undefined,
          maxGenerations: Number(body.maxGenerations ?? 0),
          expiresInDays:
            body.expiresInDays === undefined ? undefined : body.expiresInDays,
          expiresAtMs:
            body.expiresAtMs === undefined ? undefined : body.expiresAtMs,
        },
        adminCtx.email ?? 'admin'
      );
      const payload: AdminInviteMutationResponse = { invite };
      res.status(201).json(payload);
    } catch (error) {
      if (error instanceof BetaAccessError) {
        res.status(error.statusCode).json({ error: error.message });
        return;
      }
      console.error('Failed to create admin invite:', error);
      res.status(500).json({ error: 'Impossibile creare l’invito.' });
    }
  });

  router.patch('/admin/invites/:code', async (req: Request, res: Response) => {
    try {
      const adminCtx = await deps.auth.verifyOptionalRequest(req);
      if (!adminCtx.isAdmin) {
        res.status(403).json({ error: 'Accesso riservato agli amministratori.' });
        return;
      }
      const rawCode = Array.isArray(req.params.code)
        ? req.params.code[0]
        : req.params.code;
      const body = (req.body ?? {}) as Partial<UpdateInviteRequest>;
      const invite = await betaAccess.updateInvite(rawCode ?? '', body);
      const payload: AdminInviteMutationResponse = { invite };
      res.json(payload);
    } catch (error) {
      if (error instanceof BetaAccessError) {
        res.status(error.statusCode).json({ error: error.message });
        return;
      }
      console.error('Failed to update admin invite:', error);
      res.status(500).json({ error: 'Impossibile aggiornare l’invito.' });
    }
  });

  router.delete('/admin/invites/:code', async (req: Request, res: Response) => {
    try {
      const adminCtx = await deps.auth.verifyOptionalRequest(req);
      if (!adminCtx.isAdmin) {
        res.status(403).json({ error: 'Accesso riservato agli amministratori.' });
        return;
      }
      const rawCode = Array.isArray(req.params.code)
        ? req.params.code[0]
        : req.params.code;
      await betaAccess.deleteInvite(rawCode ?? '');
      res.json({ ok: true });
    } catch (error) {
      if (error instanceof BetaAccessError) {
        res.status(error.statusCode).json({ error: error.message });
        return;
      }
      console.error('Failed to delete admin invite:', error);
      res.status(500).json({ error: 'Impossibile eliminare l’invito.' });
    }
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

  router.get('/admin/telemetry/logs', async (req: Request, res: Response) => {
    try {
      const adminCtx = await deps.auth.verifyOptionalRequest(req);
      if (!adminCtx.isAdmin) {
        res
          .status(403)
          .json({ error: 'Accesso riservato agli amministratori.' });
        return;
      }
      if (!telemetryService) {
        const empty: AdminTelemetryLogsResponse = { logs: [] };
        res.setHeader('Cache-Control', 'no-store');
        res.json(empty);
        return;
      }
      const rawLimit = Number(req.query.limit ?? 100);
      const limit = Number.isFinite(rawLimit) ? rawLimit : 100;
      const logs = await telemetryService.listLogsForAdmin(
        adminCtx.uid ?? 'admin',
        limit
      );
      const payload: AdminTelemetryLogsResponse = { logs };
      res.setHeader('Cache-Control', 'no-store');
      res.json(payload);
    } catch (error) {
      console.error('Failed to list admin telemetry logs:', error);
      res
        .status(500)
        .json({ error: 'Impossibile caricare i log di telemetria.' });
    }
  });

  router.delete(
    '/admin/telemetry/logs/:logId',
    async (req: Request, res: Response) => {
      try {
        const adminCtx = await deps.auth.verifyOptionalRequest(req);
        if (!adminCtx.isAdmin) {
          res
            .status(403)
            .json({ error: 'Accesso riservato agli amministratori.' });
          return;
        }
        const rawLogId = Array.isArray(req.params.logId)
          ? req.params.logId[0]
          : req.params.logId;
        if (telemetryService && rawLogId) {
          await telemetryService.deleteLogForAdmin(
            rawLogId,
            adminCtx.uid ?? 'admin'
          );
        }
        res.json({ ok: true });
      } catch (error) {
        console.error('Failed to delete admin telemetry log:', error);
        res
          .status(500)
          .json({ error: 'Impossibile eliminare il log di telemetria.' });
      }
    }
  );

  router.post(
    '/coloring/generate',
    generateRateLimiter,
    async (req: RequestWithAdmin, res: Response, next: NextFunction) => {
      try {
        const adminCtx = await deps.auth.verifyOptionalRequest(req);
        req.adminCtx = adminCtx;
        await betaAccess.assertCanGenerate(req, adminCtx.isAdmin);
        await deps.botProtection.verifyRequest({
          headers: req.headers,
          clientIp: req.ip,
          isAdmin: adminCtx.isAdmin,
        });
        next();
      } catch (err) {
        const isAdminUser = req.adminCtx?.isAdmin === true;
        if (err instanceof BetaAccessError) {
          res.status(err.statusCode).json({ error: err.message });
          return;
        }
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
      let reservation: InviteReservation | null = null;

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

        const rawMode =
          typeof req.body?.mode === 'string' ? req.body.mode.trim() : '';
        const rawTheme =
          typeof req.body?.theme === 'string' ? req.body.theme.trim() : '';
        const rawAgeGroup =
          typeof req.body?.ageGroup === 'string' ? req.body.ageGroup.trim() : '';

        let mode: ColoringStyleMode;
        if (rawMode !== '') {
          if (!isColoringStyleMode(rawMode)) {
            res.status(400).json({
              error: 'Modalità di stile non valida.',
              ...(isAdminUser
                ? {
                    adminErrorDetails: {
                      statusCode: 400,
                      errorName: 'ValidationError',
                      rawMessage: `Invalid mode received: "${rawMode}"`,
                      timestamp: new Date().toISOString(),
                    },
                  }
                : {}),
            });
            return;
          }
          mode = rawMode;
        } else {
          mode = rawTheme !== '' ? 'creativa' : 'fedele';
        }

        let themeId: ThemeId | undefined;
        let ageGroup: ColoringAgeGroup | undefined;
        if (mode === 'creativa') {
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
          themeId = rawTheme;

          if (rawAgeGroup !== '') {
            if (!isColoringAgeGroup(rawAgeGroup)) {
              res.status(400).json({
                error: 'Fascia d’età selezionata non valida.',
                ...(isAdminUser
                  ? {
                      adminErrorDetails: {
                        statusCode: 400,
                        errorName: 'ValidationError',
                        rawMessage: `Invalid ageGroup received: "${rawAgeGroup}"`,
                        timestamp: new Date().toISOString(),
                      },
                    }
                  : {}),
              });
              return;
            }
            ageGroup = rawAgeGroup;
          } else {
            ageGroup = DEFAULT_AGE_GROUP;
          }
        } else {
          // Faithful mode never forwards any theme or creative-only fields to providers.
          themeId = undefined;
          ageGroup = undefined;
        }

        const verifiedImage = deps.mediaValidator.validate(
          file.buffer,
          file.mimetype
        );
        const preparedImage = await deps.mediaValidator.prepareForAi(
          file.buffer,
          verifiedImage.mimeType
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
        reservation = await betaAccess.reserveGeneration(req, adminCtx.isAdmin);

        const result = await provider.generateColoringPage({
          imageBuffer: preparedImage.buffer,
          mimeType: preparedImage.mimeType,
          mode,
          themeId,
          ageGroup,
          promptVersionOverride: requestedPromptVersion || undefined,
        });

        console.info(
          `[COST] provider=${result.provider} model=${result.model} prompt=${result.promptVersion} mode=${mode} theme=${themeId ?? 'none'} age=${ageGroup ?? 'none'} format=${result.outputFormat} orig=${verifiedImage.width}x${verifiedImage.height} aiIn=${preparedImage.width}x${preparedImage.height} in=${result.usage.inputTokens} cached=${result.usage.cachedInputTokens} textOut=${result.usage.textOutputTokens} imgOut=${result.usage.imageOutputTokens} cost=$${result.usage.estimatedCostUsd.toFixed(6)} latency=${result.latencyMs}ms admin=${adminCtx.isAdmin}`
        );

        const adminTelemetryPayload = adminCtx.isAdmin
          ? {
              provider: result.provider,
              model: result.model,
              promptVersion: result.promptVersion,
              outputFormat: result.outputFormat,
              latencyMs: result.latencyMs,
              ...result.usage,
            }
          : undefined;

        // When an Admin is authenticated via ADMIN_EMAILS without custom claim,
        // client-side Firestore writes are blocked by rules, so persist server-side.
        if (
          adminTelemetryPayload &&
          telemetryService &&
          !adminCtx.hasAdminClaim &&
          adminCtx.uid
        ) {
          void telemetryService
            .recordCreatorGeneration({
              adminUid: adminCtx.uid,
              themeId: mode === 'creativa' && themeId ? themeId : 'fedele',
              telemetry: adminTelemetryPayload,
            })
            .catch((telemetryErr) => {
              console.warn(
                '[TELEMETRY] Failed recording server-side creator log:',
                telemetryErr
              );
            });
        }

        const responsePayload: ColoringGenerationResponse = {
          ok: true,
          provider: result.provider,
          model: result.model,
          outputFormat: result.outputFormat,
          imageDataUrl: result.imageDataUrl,
          svgMarkup: result.svgMarkup,
          sceneSummary: result.sceneSummary,
          ...(reservation ? { inviteQuota: reservation.inviteQuota } : {}),
          ...(adminTelemetryPayload
            ? { adminTelemetry: adminTelemetryPayload }
            : {}),
        };

        res.json(responsePayload);
      } catch (error) {
        await betaAccess.refundGeneration(reservation).catch((refundErr) => {
          console.error('[BETA_ACCESS] Failed to refund generation quota:', refundErr);
        });

        if (error instanceof BetaAccessError) {
          res.status(error.statusCode).json({ error: error.message });
          return;
        }
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

  router.post(
    '/coloring/export-pdf',
    exportPdfRateLimiter,
    async (req: Request, res: Response) => {
      try {
        const adminCtx = await deps.auth.verifyOptionalRequest(req);
        await betaAccess.assertCanExportPdf(req, adminCtx.isAdmin);

        const rawDataUrl =
          typeof req.body?.imageDataUrl === 'string' ? req.body.imageDataUrl : '';
        const rawLayout =
          typeof req.body?.layout === 'string' ? req.body.layout.trim() : '';

        if (!rawDataUrl) {
          res.status(400).json({
            error: 'Immagine mancante per la generazione del PDF.',
          });
          return;
        }

        if (!isPrintPdfLayout(rawLayout)) {
          res.status(400).json({
            error: 'Formato di impaginazione PDF non valido.',
          });
          return;
        }

        const pdfService = deps.printPdf ?? printPdfGenerator;
        const pdfResult = await pdfService.generatePdf({
          imageDataUrl: rawDataUrl,
          layout: rawLayout,
        });

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader(
          'Content-Disposition',
          `attachment; filename="${pdfResult.filename}"`
        );
        res.setHeader('Cache-Control', 'no-store');
        res.send(pdfResult.pdfBuffer);
      } catch (error) {
        if (error instanceof BetaAccessError) {
          res.status(error.statusCode).json({ error: error.message });
          return;
        }
        if (error instanceof PrintPdfError) {
          console.error(
            `[PrintPdfError] status=${error.statusCode} message="${error.message}" raw="${error.rawDetails ?? ''}"`
          );
          res.status(error.statusCode).json({ error: error.message });
          return;
        }

        console.error('Unexpected print PDF error:', error);
        res.status(500).json({
          error:
            'Errore durante la creazione del PDF da stampa. Riprova tra poco.',
        });
      }
    }
  );

  return router;
}
