export interface ValidatedPhoto {
  id: string;
  file: File;
  name: string;
  sizeBytes: number;
  width: number;
  height: number;
  previewUrl: string;
}

export interface RejectedPhoto {
  fileName: string;
  reason: string;
}

export interface PhotoValidationResult {
  accepted?: ValidatedPhoto;
  rejected?: RejectedPhoto;
}

export interface MediaValidator {
  validateSinglePhoto(file: File): Promise<PhotoValidationResult>;
}
