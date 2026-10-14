// Identifiant du build client : injecté dans index.html au build, relu par le serveur au démarrage
// et renvoyé dans l'en-tête de chaque réponse /api. Un onglet ouvert avant un déploiement le compare
// à celui avec lequel il a été chargé pour savoir qu'il exécute un JS périmé.
export const APP_BUILD_META = "app-build";
export const APP_BUILD_HEADER = "X-App-Build";
export const APP_BUILD_ID_PATTERN = /^[A-Za-z0-9._-]{1,64}$/;

export function readAppBuildId(html: string): string | null {
  const match = new RegExp(`<meta\\s+name="${APP_BUILD_META}"\\s+content="([^"]*)"`, "i").exec(html);
  const id = match?.[1] ?? "";
  return APP_BUILD_ID_PATTERN.test(id) ? id : null;
}

// Pas de décision sans les deux côtés : en dev (aucun build) ou face à un serveur ancien, on ne recharge rien.
export function isStaleBuild(loaded: string | null, served: string | null): boolean {
  return !!loaded && !!served && APP_BUILD_ID_PATTERN.test(served) && loaded !== served;
}
