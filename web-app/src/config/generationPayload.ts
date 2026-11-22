import type {
  ColoringAgeGroup,
  ColoringStyleMode,
  GenerationLogThemeId,
  ProviderId,
  ThemeId,
} from '../../../shared/types/index.ts';
import type { GenerateColoringPageRequest } from '../modules/coloring-api/coloringApi.interface.ts';

export interface CreatorGenerationSelection {
  file: File;
  mode: ColoringStyleMode;
  themeId: ThemeId;
  ageGroup: ColoringAgeGroup;
  isAdmin?: boolean;
  selectedProviderId?: ProviderId | '';
  selectedPromptVersion?: string;
  idToken?: string | null;
  turnstileToken?: string | null;
}

export function buildGenerateColoringRequest(
  selection: CreatorGenerationSelection
): GenerateColoringPageRequest {
  const isCreative = selection.mode === 'creativa';

  return {
    file: selection.file,
    mode: selection.mode,
    themeId: isCreative ? selection.themeId : undefined,
    ageGroup: isCreative ? selection.ageGroup : undefined,
    providerId:
      selection.isAdmin && selection.selectedProviderId
        ? selection.selectedProviderId
        : undefined,
    promptVersion:
      selection.isAdmin && selection.selectedPromptVersion
        ? selection.selectedPromptVersion
        : undefined,
    idToken: selection.idToken,
    turnstileToken: selection.turnstileToken,
  };
}

export function getGenerationLogThemeId(
  mode: ColoringStyleMode,
  themeId: ThemeId
): GenerationLogThemeId {
  return mode === 'creativa' ? themeId : 'fedele';
}
