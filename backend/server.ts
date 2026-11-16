import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
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

  app.use(express.json({ limit: '2mb' }));
  app.use('/api', createColoringRouter());

  if (process.env.NODE_ENV !== 'production') {
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
    app.use(vite.middlewares);
  } else {
    app.use(express.static(DIST_DIR));
    app.use((_req, res) => {
      res.sendFile(path.resolve(DIST_DIR, 'index.html'));
    });
  }

  app.listen(config.port, '0.0.0.0', () => {
    console.log(
      `ColoraStoria server listening on http://0.0.0.0:${config.port} (default provider: ${config.defaultProvider})`
    );
  });
}

const isDirectExecution =
  process.argv[1] !== undefined &&
  path.resolve(process.argv[1]) === __filename;

if (isDirectExecution) {
  void startServer();
}
