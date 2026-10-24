/** MIZIZI Headquarters owns its product shell, inside the existing Admin auth gate. */
export const MIZIZI_HEADQUARTERS_PATH = "/admin/review/mizizi";

export function isMiziziProductRoute(pathname: string): boolean {
  return pathname === MIZIZI_HEADQUARTERS_PATH ||
    pathname.startsWith(MIZIZI_HEADQUARTERS_PATH + "/");
}
