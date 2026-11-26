export const DESIGN_V2_PATH = '/v2';

export function isDesignV2Path(pathname: string): boolean {
  const normalized = pathname.replace(/\/+$/, '').toLowerCase();
  return normalized === DESIGN_V2_PATH;
}
