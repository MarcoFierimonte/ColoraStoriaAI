import crypto from 'node:crypto';
import {
  Router,
  type NextFunction,
  type Request,
  type RequestHandler,
  type Response,
} from 'express';
import rateLimit from 'express-rate-limit';
import multer from 'multer';
import type {
  NotifyRunEmailRequest,
  PromptEvalModality,
  PromptExecutionMode,
  ResolvePromptRequest,
  UpdateItemEvaluationRequest,
  UpdateRunEvaluationRequest,
} from '../../prompt-eval-core/src/index.ts';
import {
  PromptEvalError,
  type PromptEvalService,
} from './promptEval.interface.ts';

export interface PromptEvalAdminActor {
  isAdmin: boolean;
  uid?: string;
  email?: string;
}

export interface PromptEvalRouterDeps {
  service: PromptEvalService;
  authorizeAdmin: (req: Request) => Promise<PromptEvalAdminActor>;
  cronSecret?: string;
  pollRateLimiter?: RequestHandler;
}

interface RequestWithActor extends Request {
  promptEvalActor?: PromptEvalAdminActor;
}

function safeCompareSecret(provided: string, expected: string): boolean {
  const a = Buffer.from(provided, 'utf8');
  const b = Buffer.from(expected, 'utf8');
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

function parseJsonRecord(raw: unknown): Record<string, string> {
  if (!raw) return {};
  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    if (!trimmed) return {};
    try {
      const parsed = JSON.parse(trimmed) as unknown;
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        const out: Record<string, string> = {};
        for (const [k, v] of Object.entries(
          parsed as Record<string, unknown>
        )) {
          out[k] = String(v ?? '');
        }
        return out;
      }
    } catch {
      throw new PromptEvalError(
        'Parametri prompt JSON non validi.',
        400,
        'invalid_json'
      );
    }
    return {};
  }
  if (typeof raw === 'object' && !Array.isArray(raw)) {
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
      out[k] = String(v ?? '');
    }
    return out;
  }
  return {};
}

function parseTextInputs(
  raw: unknown
): Array<{ name?: string; text: string }> | undefined {
  if (!raw) return undefined;
  let parsed: unknown = raw;
  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    if (!trimmed) return undefined;
    try {
      parsed = JSON.parse(trimmed);
    } catch {
      throw new PromptEvalError(
        'Lista textInputs JSON non valida.',
        400,
        'invalid_json'
      );
    }
  }
  if (!Array.isArray(parsed)) return undefined;
  return parsed
    .map((entry) => {
      if (typeof entry === 'string') {
        return { text: entry };
      }
      if (entry && typeof entry === 'object') {
        const obj = entry as { name?: unknown; text?: unknown };
        return {
          name: typeof obj.name === 'string' ? obj.name : undefined,
          text: typeof obj.text === 'string' ? obj.text : '',
        };
      }
      return { text: '' };
    })
    .filter((item) => item.text.trim().length > 0);
}

function handleError(res: Response, error: unknown, fallbackMessage: string) {
  if (error instanceof PromptEvalError) {
    res.status(error.statusCode).json({
      error: error.message,
      code: error.code,
      ...(error.rawDetails ? { details: error.rawDetails } : {}),
    });
    return;
  }
  console.error('[PROMPT_EVAL_ROUTER] Unexpected error:', error);
  res.status(500).json({ error: fallbackMessage });
}

function readParam(value: string | string[] | undefined): string {
  return Array.isArray(value) ? (value[0] ?? '') : (value ?? '');
}

export function createPromptEvalRouter(deps: PromptEvalRouterDeps): Router {
  const router = Router();
  const limits = deps.service.getLimits();
  const allowedMimes = new Set(limits.acceptedMimeTypes);

  const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
      fileSize: limits.maxFileSizeMb * 1024 * 1024,
      files: limits.maxImagesPerRun,
    },
    fileFilter: (_req, file, cb) => {
      if (!allowedMimes.has(file.mimetype)) {
        cb(
          new PromptEvalError(
            `Formato file "${file.originalname}" non supportato (${file.mimetype}). Formati ammessi: ${limits.acceptedExtensionsLabel}.`,
            400,
            'unsupported_mime_type'
          )
        );
        return;
      }
      cb(null, true);
    },
  });

  const requireAdmin = async (
    req: RequestWithActor,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const actor = await deps.authorizeAdmin(req);
      if (!actor.isAdmin) {
        res
          .status(403)
          .json({ error: 'Accesso riservato agli amministratori.' });
        return;
      }
      req.promptEvalActor = actor;
      next();
    } catch (error) {
      handleError(res, error, 'Errore durante la verifica amministratore.');
    }
  };

  router.get('/config', requireAdmin, (_req: Request, res: Response) => {
    res.setHeader('Cache-Control', 'no-store');
    res.json(deps.service.getConfig());
  });

  router.post(
    '/catalog/resolve',
    requireAdmin,
    (req: Request, res: Response) => {
      try {
        const body = (req.body ?? {}) as Partial<ResolvePromptRequest>;
        const catalogId =
          typeof body.catalogId === 'string' ? body.catalogId.trim() : '';
        const params = parseJsonRecord(body.params);
        const preview = deps.service.resolveCatalogPrompt(catalogId, params);
        res.setHeader('Cache-Control', 'no-store');
        res.json(preview);
      } catch (error) {
        handleError(res, error, 'Impossibile risolvere il prompt selezionato.');
      }
    }
  );

  router.get('/runs', requireAdmin, async (req: Request, res: Response) => {
    try {
      const rawLimit = Number(req.query.limit ?? 50);
      const limit = Number.isFinite(rawLimit) ? rawLimit : 50;
      const runs = await deps.service.listRuns(limit);
      res.setHeader('Cache-Control', 'no-store');
      res.json({ runs });
    } catch (error) {
      handleError(res, error, 'Impossibile caricare lo storico valutazioni.');
    }
  });

  router.get(
    '/runs/:runId',
    requireAdmin,
    async (req: Request, res: Response) => {
      try {
        const run = await deps.service.getRun(readParam(req.params.runId));
        res.setHeader('Cache-Control', 'no-store');
        res.json({ run });
      } catch (error) {
        handleError(res, error, 'Impossibile caricare i dettagli del test.');
      }
    }
  );

  router.post(
    '/runs',
    requireAdmin,
    (req: Request, res: Response, next: NextFunction) => {
      const contentType = (req.headers['content-type'] ?? '').toLowerCase();
      if (!contentType.includes('multipart/form-data')) {
        next();
        return;
      }
      upload.array('files', limits.maxImagesPerRun)(req, res, (err: unknown) => {
        if (!err) {
          next();
          return;
        }
        if (err instanceof multer.MulterError) {
          if (err.code === 'LIMIT_FILE_SIZE') {
            res.status(400).json({
              error: `Uno o più file superano il limite di ${limits.maxFileSizeMb} MB.`,
            });
            return;
          }
          if (err.code === 'LIMIT_FILE_COUNT' || err.code === 'LIMIT_UNEXPECTED_FILE') {
            res.status(400).json({
              error: `Puoi caricare al massimo ${limits.maxImagesPerRun} immagini per esecuzione.`,
            });
            return;
          }
        }
        handleError(res, err, 'Errore durante il caricamento delle immagini.');
      });
    },
    async (req: RequestWithActor, res: Response) => {
      try {
        const actor = req.promptEvalActor ?? { isAdmin: false };
        const body = (req.body ?? {}) as Record<string, unknown>;
        const uploadedFiles = Array.isArray(req.files)
          ? (req.files as Express.Multer.File[])
          : [];

        const modality = String(body.modality ?? 'image').trim() as PromptEvalModality;
        const executionMode = String(
          body.executionMode ?? 'standard'
        ).trim() as PromptExecutionMode;
        const promptSource =
          String(body.promptSource ?? 'catalog').trim() === 'custom'
            ? 'custom'
            : 'catalog';

        const run = await deps.service.createRun({
          actorUid: actor.uid ?? 'admin',
          actorEmail: actor.email ?? 'admin',
          title: typeof body.title === 'string' ? body.title : undefined,
          modality,
          executionMode,
          providerId:
            typeof body.providerId === 'string' ? body.providerId : undefined,
          model: typeof body.model === 'string' ? body.model : undefined,
          promptSource,
          catalogId:
            typeof body.catalogId === 'string' ? body.catalogId : undefined,
          promptParams: parseJsonRecord(body.promptParams),
          customPromptText:
            typeof body.customPromptText === 'string'
              ? body.customPromptText
              : undefined,
          notifyEmail:
            typeof body.notifyEmail === 'string' ? body.notifyEmail : undefined,
          files: uploadedFiles.map((file) => ({
            originalName: file.originalname,
            mimeType: file.mimetype,
            bytes: file.buffer,
          })),
          textInputs: parseTextInputs(body.textInputs),
        });

        res.status(executionMode === 'batch' ? 202 : 201).json({ run });
      } catch (error) {
        handleError(
          res,
          error,
          'Errore durante la creazione della valutazione prompt.'
        );
      }
    }
  );

  router.post(
    '/runs/:runId/refresh',
    requireAdmin,
    async (req: Request, res: Response) => {
      try {
        const run = await deps.service.refreshBatchRun(
          readParam(req.params.runId)
        );
        res.setHeader('Cache-Control', 'no-store');
        res.json({ run });
      } catch (error) {
        handleError(res, error, 'Impossibile aggiornare lo stato del batch.');
      }
    }
  );

  router.post(
    '/runs/:runId/cancel',
    requireAdmin,
    async (req: Request, res: Response) => {
      try {
        const run = await deps.service.cancelBatchRun(
          readParam(req.params.runId)
        );
        res.json({ run });
      } catch (error) {
        handleError(res, error, 'Impossibile annullare il job batch.');
      }
    }
  );

  router.post(
    '/runs/:runId/notify',
    requireAdmin,
    async (req: Request, res: Response) => {
      try {
        const body = (req.body ?? {}) as NotifyRunEmailRequest;
        const run = await deps.service.notifyRunByEmail(
          readParam(req.params.runId),
          typeof body.email === 'string' ? body.email : undefined
        );
        res.json({ run });
      } catch (error) {
        handleError(
          res,
          error,
          'Impossibile inviare l’email con i risultati.'
        );
      }
    }
  );

  router.patch(
    '/runs/:runId/evaluation',
    requireAdmin,
    async (req: Request, res: Response) => {
      try {
        const body = (req.body ?? {}) as UpdateRunEvaluationRequest;
        const run = await deps.service.updateRunEvaluation(
          readParam(req.params.runId),
          body
        );
        res.json({ run });
      } catch (error) {
        handleError(
          res,
          error,
          'Impossibile salvare le note dell’esecuzione.'
        );
      }
    }
  );

  router.patch(
    '/runs/:runId/items/:itemId/evaluation',
    requireAdmin,
    async (req: Request, res: Response) => {
      try {
        const body = (req.body ?? {}) as UpdateItemEvaluationRequest;
        const run = await deps.service.updateItemEvaluation(
          readParam(req.params.runId),
          readParam(req.params.itemId),
          body
        );
        res.json({ run });
      } catch (error) {
        handleError(
          res,
          error,
          'Impossibile salvare la valutazione dell’elemento.'
        );
      }
    }
  );

  router.delete(
    '/runs/:runId',
    requireAdmin,
    async (req: Request, res: Response) => {
      try {
        await deps.service.deleteRun(readParam(req.params.runId));
        res.json({ ok: true });
      } catch (error) {
        handleError(res, error, 'Impossibile eliminare l’esecuzione.');
      }
    }
  );

  const pollRateLimiter =
    deps.pollRateLimiter ??
    rateLimit({
      windowMs: 15 * 60 * 1000,
      limit: 60,
      standardHeaders: 'draft-8',
      legacyHeaders: false,
      handler: (_req, res) => {
        res.status(429).json({
          error: 'Troppi tentativi di polling batch. Attendi qualche minuto.',
        });
      },
    });

  // Supports both authenticated Admin AND free-tier Cloud Scheduler (via X-Cron-Secret)
  router.post(
    '/poll-pending',
    pollRateLimiter,
    async (req: Request, res: Response) => {
    try {
      const configuredSecret = deps.cronSecret?.trim() ?? '';
      const rawCronHeader = req.headers['x-cron-secret'];
      const providedSecret = Array.isArray(rawCronHeader)
        ? (rawCronHeader[0] ?? '')
        : (rawCronHeader ?? '');

      let authorized =
        configuredSecret.length >= 16 &&
        providedSecret.length > 0 &&
        safeCompareSecret(providedSecret, configuredSecret);

      if (!authorized) {
        const actor = await deps.authorizeAdmin(req);
        authorized = actor.isAdmin;
      }

      if (!authorized) {
        res
          .status(403)
          .json({ error: 'Accesso riservato agli amministratori o cron autorizzato.' });
        return;
      }

      const summary = await deps.service.pollPendingBatchRuns();
      res.setHeader('Cache-Control', 'no-store');
      res.json(summary);
    } catch (error) {
      handleError(
        res,
        error,
        'Errore durante il controllo dei job batch attivi.'
      );
    }
  });

  return router;
}
