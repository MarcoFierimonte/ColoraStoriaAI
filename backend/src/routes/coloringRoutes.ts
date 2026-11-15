import { Router, type NextFunction, type Request, type Response } from 'express';
import multer from 'multer';
import { getColoringProvider, listProviderStatuses } from '../providers/index.ts';
import {
  ALLOWED_THEME_IDS,
  ProviderConfigurationError,
  ProviderExecutionError,
  type ThemeId,
} from '../providers/types.ts';

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

function isAllowedThemeId(value: string): value is ThemeId {
  return (ALLOWED_THEME_IDS as readonly string[]).includes(value);
}

export function createColoringRouter(): Router {
  const router = Router();

  router.get('/health', (_req: Request, res: Response) => {
    res.json({ ok: true });
  });

  router.get('/providers', (_req: Request, res: Response) => {
    res.json({
      providers: listProviderStatuses(),
    });
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
      try {
        const file = req.file;
        if (!file) {
          res.status(400).json({
            error: 'Seleziona una foto prima di avviare la generazione.',
          });
          return;
        }

        const rawTheme = typeof req.body?.theme === 'string' ? req.body.theme.trim() : '';
        if (!isAllowedThemeId(rawTheme)) {
          res.status(400).json({
            error: 'Seleziona uno dei sei mondi illustrati disponibili.',
          });
          return;
        }

        const requestedProvider =
          typeof req.body?.provider === 'string' ? req.body.provider.trim() : undefined;
        const provider = getColoringProvider(requestedProvider);

        const result = await provider.generateColoringPage({
          imageBuffer: file.buffer,
          mimeType: file.mimetype,
          themeId: rawTheme,
        });

        res.json({
          ok: true,
          ...result,
        });
      } catch (error) {
        if (
          error instanceof ProviderConfigurationError ||
          error instanceof ProviderExecutionError
        ) {
          res.status(error.statusCode).json({ error: error.message });
          return;
        }

        console.error('Unexpected coloring generation error:', error);
        res.status(500).json({
          error:
            'Errore imprevisto sul server durante la creazione della pagina. Riprova tra poco.',
        });
      }
    }
  );

  return router;
}
