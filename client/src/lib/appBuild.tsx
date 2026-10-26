import { useSyncExternalStore } from "react";
import { APP_BUILD_HEADER, APP_BUILD_META, isStaleBuild } from "@shared/appBuild";
import { Button } from "@/components/ui/button";

// Un onglet resté ouvert pendant un déploiement garde l'ancien JS : la session est valide, seul le code
// est périmé. Un bandeau en haut de page annonce la mise à jour et recharge après un compte à rebours
// visible, suspendu tant que l'utilisateur travaille. Aucun rechargement à son insu.
const loadedBuild = document.querySelector<HTMLMetaElement>(`meta[name="${APP_BUILD_META}"]`)?.content || null;
const RELOAD_GUARD_KEY = "app-build-reloaded-for";
const PROBE_MIN_INTERVAL_MS = 30_000;
const PROBE_EVERY_MS = 5 * 60_000;
const COUNTDOWN_S = 30;
const DEFER_MS = 10 * 60_000;

export type AppUpdateState = {
  visible: boolean;
  secondsLeft: number;
  paused: boolean;
  // Faux quand le rechargement automatique a déjà eu lieu pour ce build : seul le bouton reste.
  autoReload: boolean;
  canDefer: boolean;
};

const HIDDEN: AppUpdateState = { visible: false, secondsLeft: COUNTDOWN_S, paused: false, autoReload: true, canDefer: true };

let staleFor: string | null = null;
let state = HIDDEN;
let secondsLeft = COUNTDOWN_S;
let autoReload = true;
let deferUsed = false;
let deferredUntil = 0;
let lastProbe = 0;
let isMutating: () => number = () => 0;
const listeners = new Set<() => void>();

function sessionGet(key: string): string | null {
  try { return sessionStorage.getItem(key); } catch { return null; }
}

function sessionSet(key: string, value: string) {
  try { sessionStorage.setItem(key, value); } catch { /* stockage indisponible : le bouton reste disponible */ }
}

function setState(next: AppUpdateState) {
  if (
    next.visible === state.visible && next.secondsLeft === state.secondsLeft && next.paused === state.paused &&
    next.autoReload === state.autoReload && next.canDefer === state.canDefer
  ) return;
  state = next;
  listeners.forEach((l) => l());
}

// Saisie ou envoi en cours : un rechargement ferait perdre le travail de l'utilisateur.
function hasWorkInProgress(): boolean {
  if (isMutating() > 0) return true;
  if (document.querySelector('[role="dialog"], [role="alertdialog"]')) return true;
  for (const el of Array.from(document.querySelectorAll("textarea"))) if (el.value.trim()) return true;
  for (const el of Array.from(document.querySelectorAll<HTMLInputElement>('input[type="file"]'))) if (el.files?.length) return true;
  return false;
}

// Un seul rechargement automatique par build cible : si la page revient périmée (cache), seul le bouton reste.
function reloadOnce(target: string): boolean {
  if (sessionGet(RELOAD_GUARD_KEY) === target) return false;
  sessionSet(RELOAD_GUARD_KEY, target);
  window.location.reload();
  return true;
}

function tick() {
  if (!staleFor) return;
  if (Date.now() < deferredUntil) return setState(HIDDEN);
  // Le compte à rebours n'avance que sous les yeux de l'utilisateur, et jamais pendant une saisie.
  const paused = document.visibilityState !== "visible" || hasWorkInProgress();
  if (autoReload && !paused && secondsLeft > 0) secondsLeft -= 1;
  if (autoReload && secondsLeft === 0 && !reloadOnce(staleFor)) autoReload = false;
  setState({ visible: true, secondsLeft, paused, autoReload, canDefer: !deferUsed });
}

function markStale(target: string) {
  if (staleFor) return;
  staleFor = target;
  autoReload = sessionGet(RELOAD_GUARD_KEY) !== target;
  window.setInterval(tick, 1000);
  tick();
}

export function noteServerBuild(res: Response) {
  const served = res.headers.get(APP_BUILD_HEADER);
  if (isStaleBuild(loadedBuild, served)) markStale(served!);
}

async function probe() {
  if (staleFor || !loadedBuild || Date.now() - lastProbe < PROBE_MIN_INTERVAL_MS) return;
  lastProbe = Date.now();
  try {
    noteServerBuild(await fetch("/api/app-build", { cache: "no-store" }));
  } catch {
    // hors ligne : on revérifiera au prochain retour
  }
}

export function reloadNow() {
  window.location.reload();
}

// « Plus tard » : le bandeau revient une seule fois, 10 min après, avec un compte à rebours complet.
export function deferUpdate() {
  if (deferUsed) return;
  deferUsed = true;
  deferredUntil = Date.now() + DEFER_MS;
  secondsLeft = COUNTDOWN_S;
  setState(HIDDEN);
}

export function startAppBuildWatcher(countMutations: () => number) {
  isMutating = countMutations;

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") void probe();
  });
  window.setInterval(() => {
    if (document.visibilityState === "visible") void probe();
  }, PROBE_EVERY_MS);

  // Après un déploiement, les anciens morceaux de JS chargés à la demande n'existent plus : la page est
  // déjà cassée, on recharge tout de suite (une fois), sinon le bandeau propose de le faire.
  window.addEventListener("vite:preloadError", (event) => {
    event.preventDefault();
    const target = `preload:${loadedBuild ?? "dev"}`;
    if (reloadOnce(target)) return;
    markStale(target);
    autoReload = false;
    tick();
  });
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function AppUpdateBanner() {
  const s = useSyncExternalStore(subscribe, () => state);
  if (!s.visible) return null;
  return (
    <div
      role="status"
      aria-live="polite"
      data-testid="banner-new-version"
      className="fixed inset-x-0 top-0 z-[100] flex flex-wrap items-center justify-center gap-x-4 gap-y-2 bg-primary px-4 py-2 text-sm text-primary-foreground shadow-md"
      style={{ paddingTop: "max(0.5rem, env(safe-area-inset-top))" }}
    >
      <p data-testid="text-new-version-countdown">
        Une mise à jour est disponible.
        {s.autoReload && (s.paused ? " Rechargement en pause pendant votre travail." : ` Rechargement dans ${s.secondsLeft} s`)}
      </p>
      <div className="flex gap-2">
        <Button size="sm" variant="secondary" onClick={reloadNow} data-testid="button-reload-new-version">
          Mettre à jour maintenant
        </Button>
        {s.canDefer && (
          <Button
            size="sm"
            variant="ghost"
            className="text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground"
            onClick={deferUpdate}
            data-testid="button-defer-new-version"
          >
            Plus tard
          </Button>
        )}
      </div>
    </div>
  );
}
