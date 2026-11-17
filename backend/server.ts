import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express, {
  type NextFunction,
  type Request,
  type Response,
} from 'express';
import helmet from 'helmet';
import { botProtectionVerifier } from './src/modules/bot-protection/index.ts';
import { getServerConfig } from './src/modules/config/index.ts';
import { createColoringRouter } from './src/routes/coloringRoutes.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');
const WEB_APP_DIR = path.resolve(ROOT_DIR, 'web-app');
const DIST_DIR = path.resolve(ROOT_DIR, 'dist');

export async function startServer() {
  const config = getServerConfig();
  const app = express();

  app.disable('x-powered-by');
  app.set('trust proxy', 1);

  app.use(
    helmet({
      crossOriginOpenerPolicy: { policy: 'same-origin-allow-popups' },
      crossOriginEmbedderPolicy: false,
      xFrameOptions: false,
      contentSecurityPolicy: {
        useDefaults: true,
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: config.isDevelopment
            ? ["'self'", "'unsafe-inline'", 'https://challenges.cloudflare.com']
            : ["'self'", 'https://challenges.cloudflare.com'],
          styleSrc: ["'self'", "'unsafe-inline'"],
          fontSrc: ["'self'", 'data:'],
          imgSrc: [
            "'self'",
            'data:',
            'blob:',
            'https://*.googleusercontent.com',
          ],
          connectSrc: [
            "'self'",
            'https://identitytoolkit.googleapis.com',
            'https://securetoken.googleapis.com',
            'https://firestore.googleapis.com',
            'https://*.googleapis.com',
            'https://challenges.cloudflare.com',
          ],
          frameSrc: [
            "'self'",
            'https://*.firebaseapp.com',
            'https://*.web.app',
            'https://accounts.google.com',
            'https://challenges.cloudflare.com',
          ],
          frameAncestors: [
            "'self'",
            'https://aistudio.google.com',
            'https://*.aistudio.google.com',
            'https://*.google.com',
          ],
          objectSrc: ["'none'"],
          baseUri: ["'self'"],
          formAction: ["'self'"],
          ...(config.isDevelopment ? { upgradeInsecureRequests: null } : {}),
        },
      },
    })
  );

  app.use(express.json({ limit: '2mb' }));
  app.use('/api', createColoringRouter());
  app.use('/api', (_req: Request, res: Response) => {
    res.status(404).json({ error: 'Endpoint non trovato.' });
  });

  let viteServer: { close: () => Promise<void> } | null = null;
  if (config.isDevelopment) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      configFile: path.resolve(WEB_APP_DIR, 'vite.config.ts'),
      root: WEB_APP_DIR,
      server: {
        middlewareMode: true,
        hmr: false,
      },
      appType: 'spa',
    });
    viteServer = vite;
    app.use(vite.middlewares);
  } else {
    app.use(express.static(DIST_DIR));
    app.use((_req: Request, res: Response) => {
      res.sendFile(path.resolve(DIST_DIR, 'index.html'));
    });
  }

  // Global Express 5 error handler: never leak stack traces or internal details
  app.use(
    (err: unknown, _req: Request, res: Response, _next: NextFunction) => {
      console.error('[EXPRESS ERROR]', err);
      if (res.headersSent) return;

      if (err instanceof SyntaxError && 'body' in err) {
        res.status(400).json({ error: 'Richiesta JSON non valida.' });
        return;
      }

      res.status(500).json({
        error: 'Errore interno del server. Riprova tra poco.',
      });
    }
  );

  if (!config.isDevelopment && !botProtectionVerifier.isEnforced()) {
    console.warn(
      '[SECURITY WARNING] Running outside development without TURNSTILE_SECRET_KEY or APP_CHECK_ENABLED=true.'
    );
  }

  const server = app.listen(config.port, '0.0.0.0', () => {
    console.log(
      `ColoraStoria server listening on http://0.0.0.0:${config.port} (mode: ${config.isDevelopment ? 'development' : 'production'}, default provider: ${config.defaultProvider})`
    );
  });

  server.on('error', (error: NodeJS.ErrnoException) => {
    console.error('[SERVER LISTEN ERROR]', error);
    process.exit(1);
  });

  let isShuttingDown = false;
  const shutdown = (signal: NodeJS.Signals) => {
    if (isShuttingDown) return;
    isShuttingDown = true;
    console.log(`[SERVER] Received ${signal}, shutting down gracefully...`);

    const forceTimer = setTimeout(() => {
      console.error('[SERVER] Forced shutdown after 10s timeout.');
      process.exit(1);
    }, 10_000);
    forceTimer.unref();

    server.close(async (closeErr) => {
      if (closeErr) {
        console.error('[SERVER] Error closing HTTP server:', closeErr);
        process.exit(1);
      }
      if (viteServer) {
        await viteServer.close().catch(() => undefined);
      }
      clearTimeout(forceTimer);
      console.log('[SERVER] Shutdown complete.');
      process.exit(0);
    });
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  return server;
}

const isDirectExecution =
  process.argv[1] !== undefined &&
  path.resolve(process.argv[1]) === __filename;

if (isDirectExecution) {
  void startServer();
}
