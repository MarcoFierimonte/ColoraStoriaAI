import { BrowserPhotoValidator } from './implementations/browserPhotoValidator';
import type {
  MediaValidator,
  PhotoValidationResult,
} from './mediaValidation.interface';

export type {
  MediaValidator,
  PhotoValidationResult,
  RejectedPhoto,
  ValidatedPhoto,
} from './mediaValidation.interface';
export { BrowserPhotoValidator } from './implementations/browserPhotoValidator';

export const mediaValidator: MediaValidator = new BrowserPhotoValidator();

export function validateSinglePhotoFile(
  file: File
): Promise<PhotoValidationResult> {
  return mediaValidator.validateSinglePhoto(file);
}
