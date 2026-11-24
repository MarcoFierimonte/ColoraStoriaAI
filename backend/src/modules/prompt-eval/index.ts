import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Router } from 'express';
import {
  BrevoEmailSender,
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
  ResendEmailSender,
  type EmailNotificationSender,
  type PromptEvalDatasetRepository,
  type PromptEvalDatasetStore,
  type PromptEvalService,
  type PromptEvalStore,
} from '../../../../packages/prompt-eval-backend/src/index.ts';
import {
  ACCEPTED_IMAGE_EXTENSIONS_LABEL,
  ACCEPTED_IMAGE_MIME_TYPES,
  MAX_UPLOAD_FILE_SIZE_MB,
} from '../../../../shared/config/index.ts';
import { authTokenVerifier, type AuthTokenVerifier } from '../auth/index.ts';
import { getServerConfig, type ServerConfig } from '../config/index.ts';
import {
  serverMediaValidator,
  type ServerMediaValidator,
} from '../media-validation/index.ts';
import { promptRepository, type PromptRepository } from '../prompts/index.ts';
import {
  COLORASTORIA_CATALOG_ID,
  ColoraStoriaPromptCatalogResolver,
} from './implementations/coloraStoriaPromptCatalog.ts';
import { SharpPromptEvalMediaPreparer } from './implementations/sharpMediaPreparer.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DEFAULT_FIREBASE_CONFIG_PATH = path.resolve(
  __dirname,
  '../../../../firebase-applet-config.json'
);
const DEFAULT_REPO_DATASETS_DIR = path.resolve(
  __dirname,
  '../../../../dataset'
);

export {
  COLORASTORIA_CATALOG_ID,
  ColoraStoriaPromptCatalogResolver,
  SharpPromptEvalMediaPreparer,
};

export function createEmailSenderFromConfig(
  config: ServerConfig
): EmailNotificationSender {
  if (config.emailProvider === 'resend' && config.resendApiKey) {
    return new ResendEmailSender({
      apiKey: config.resendApiKey,
      fromAddress: config.emailFrom,
    });
  }
  if (config.emailProvider === 'brevo' && config.brevoApiKey) {
    return new BrevoEmailSender({
      apiKey: config.brevoApiKey,
      fromAddress: config.emailFrom,
    });
  }
  return new NoopEmailSender();
}

export function createColoraStoriaPromptEvalService(params?: {
  config?: ServerConfig;
  prompts?: PromptRepository;
  mediaValidator?: ServerMediaValidator;
  store?: PromptEvalStore;
  datasetRepository?: PromptEvalDatasetRepository;
  datasetStore?: PromptEvalDatasetStore;
  datasetsRootDir?: string;
  emailSender?: EmailNotificationSender;
}): DefaultPromptEvalService {
  const config = params?.config ?? getServerConfig();
  const prompts = params?.prompts ?? promptRepository;
  const mediaValidator = params?.mediaValidator ?? serverMediaValidator;
  const mediaPreparer = new SharpPromptEvalMediaPreparer(mediaValidator);

  const store: PromptEvalStore =
    params?.store ??
    (config.promptEvalStoreMode === 'memory'
      ? new InMemoryPromptEvalStore()
      : new FirestorePromptEvalStore({
          firebaseConfigPath: DEFAULT_FIREBASE_CONFIG_PATH,
        }));

  const datasetStore: PromptEvalDatasetStore =
    params?.datasetStore ??
    (config.promptEvalStoreMode === 'memory'
      ? new InMemoryPromptEvalDatasetStore()
      : new FirestorePromptEvalDatasetStore({
          firebaseConfigPath: DEFAULT_FIREBASE_CONFIG_PATH,
        }));

  const datasetRepository: PromptEvalDatasetRepository =
    params?.datasetRepository ??
    new FilesystemPromptEvalDatasetRepository({
      rootDir: params?.datasetsRootDir ?? DEFAULT_REPO_DATASETS_DIR,
      mediaPreparer,
    });

  const emailSender =
    params?.emailSender ?? createEmailSenderFromConfig(config);

  const providerRegistry = new DefaultPromptProviderRegistry({
    defaultProviderId: config.defaultProvider,
    providers: [
      new GeminiPromptEvalProvider({
        apiKey: config.geminiApiKey,
        defaultModel: config.geminiModel,
        includeSvgModels: false,
      }),
      new OpenAIPromptEvalProvider({
        apiKey: config.openaiApiKey,
        defaultModel: config.openaiModel,
      }),
    ],
  });

  return new DefaultPromptEvalService({
    providers: providerRegistry,
    store,
    datasetRepository,
    datasetStore,
    catalogResolver: new ColoraStoriaPromptCatalogResolver(prompts),
    mediaPreparer,
    emailSender,
    appBaseUrl: config.appBaseUrl || undefined,
    limits: {
      maxImagesPerRun: 20,
      maxTextInputsPerRun: 50,
      maxFileSizeMb: MAX_UPLOAD_FILE_SIZE_MB,
      acceptedMimeTypes: [...ACCEPTED_IMAGE_MIME_TYPES],
      acceptedExtensionsLabel: ACCEPTED_IMAGE_EXTENSIONS_LABEL,
    },
  });
}

export const promptEvalService: DefaultPromptEvalService =
  createColoraStoriaPromptEvalService();

export function createColoraStoriaPromptEvalRouter(params?: {
  service?: PromptEvalService;
  auth?: AuthTokenVerifier;
  cronSecret?: string;
}): Router {
  const service = params?.service ?? promptEvalService;
  const auth = params?.auth ?? authTokenVerifier;
  const cronSecret =
    params?.cronSecret ?? getServerConfig().promptEvalCronSecret;

  return createPromptEvalRouter({
    service,
    cronSecret,
    authorizeAdmin: async (req) => {
      const ctx = await auth.verifyOptionalRequest(req);
      return {
        isAdmin: ctx.isAdmin,
        uid: ctx.uid,
        email: ctx.email,
      };
    },
  });
}
