import { BufferImageValidator } from './implementations/bufferImageValidator.ts';
import type { ServerMediaValidator } from './mediaValidation.interface.ts';

export {
  ImageValidationError,
  type ServerMediaValidator,
  type ValidatedImageResult,
  type VerifiedImageMime,
} from './mediaValidation.interface.ts';
export { BufferImageValidator } from './implementations/bufferImageValidator.ts';

export const serverMediaValidator: ServerMediaValidator =
  new BufferImageValidator();
