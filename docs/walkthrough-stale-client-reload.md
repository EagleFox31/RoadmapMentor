# Walkthrough — Rechargement des onglets périmés après un déploiement

> Travail effectué par Claude (Claude Code) à la demande explicite de l'utilisateur, le 2026-10-14.

## Ce qui a été trouvé

- Symptôme : connecté en apprenant (Darren), l'utilisateur ouvre une ressource, qui n'est pas marquée « Consultée ».
- Le code du marquage automatique était correct (`client/src/components/resources-list.tsx`, `markOpened`) et présent dans le bundle servi par le conteneur.
- Les journaux d'accès ne montraient **aucune** requête du navigateur après le chargement initial. Une actualisation a suffi : le `PUT /api/resources/:id/consultation` est arrivé (200).
- Cause : l'onglet avait été chargé avant la reconstruction du conteneur et exécutait l'ancien JS. La session restait valide, et rien ne signalait le changement de version. Avec `staleTime: Infinity` et sans rafraîchissement au retour sur l'onglet, celui-ci ne contactait jamais le nouveau serveur.
- En production, ce cas se reproduira à chaque déploiement Render tant que l'apprenant garde l'onglet ouvert.

## Ce qui a été modifié

| Fichier | Changement |
| --- | --- |
| `shared/appBuild.ts` | Constantes (`app-build`, `X-App-Build`), `readAppBuildId(html)`, `isStaleBuild(loaded, served)`. Sans identifiant d'un côté ou de l'autre (mode dev, serveur ancien), aucune décision n'est prise. |
| `vite.config.ts` | Plugin `app-build-id` (au build seulement) : injecte `<meta name="app-build">` dans `index.html`. La valeur vient de `APP_BUILD_ID` si elle est fournie, sinon elle est aléatoire. Une valeur invalide fait échouer le build. |
| `server/http/appBuild.ts` | `registerServedBuild(indexHtml)`, en-tête `X-App-Build` sur toutes les réponses `/api`, sonde publique `GET /api/app-build` (204, `no-store`). |
| `server/app.ts` | Branche l'en-tête et la sonde avant les routes. |
| `server/index-prod.ts` | Lit l'identifiant dans `dist/public/index.html` au démarrage. |
| `client/src/lib/appBuild.tsx` | Surveillance côté client : compare la `meta` chargée à l'en-tête reçu (voir le comportement ci-dessous). |
| `client/src/lib/queryClient.ts` | `noteServerBuild(res)` sur chaque réponse d'API. |
| `client/src/main.tsx` | `startAppBuildWatcher(() => queryClient.isMutating())`. |
| `Dockerfile` | `ARG APP_BUILD_ID=` optionnel (par exemple le SHA du commit). Sans valeur, l'identifiant est aléatoire et suit le cache Docker : il ne change pas tant que le code ne change pas. |
| `test/app-build.test.ts` | Lecture de l'identifiant, décision « périmé », en-tête sur `/api`, sonde sans session. |

### Comportement côté client

- **Détection** : en-tête `X-App-Build` de chaque réponse d'API, sonde `/api/app-build` au retour sur l'onglet et toutes les 5 min quand l'onglet est visible (au plus une fois toutes les 30 s).
- **Bandeau fixe en haut** (`AppUpdateBanner`, monté dans `main.tsx`) : « Une mise à jour est disponible. Rechargement dans 30 s », boutons « Mettre à jour maintenant » et « Plus tard ».
- **Compte à rebours** : il n'avance que si l'onglet est visible. Il est mis en pause pendant un travail en cours : dialogue ouvert, `textarea` non vide, fichier sélectionné ou mutation en cours.
- **« Plus tard »** : le bandeau disparaît 10 min, puis revient une seule fois avec un compte à rebours complet et sans bouton « Plus tard ».
- **Aucun rechargement à l'insu de l'utilisateur** : le rechargement silencieux de l'onglet masqué et le toast en bas ont été supprimés.
- **Garde-fous** :
  - un seul rechargement automatique par build cible (`sessionStorage`). Si la page revient encore périmée, le bandeau reste affiché sans compte à rebours ;
  - `vite:preloadError` (morceau de JS supprimé par le nouveau build) recharge tout de suite, une seule fois, car la page est déjà cassée.
- `data-testid` : `banner-new-version`, `text-new-version-countdown`, `button-reload-new-version`, `button-defer-new-version`.

Choix écarté : déconnecter l'apprenant. La session est valide, le problème vient uniquement du code. Une déconnexion ferait perdre le travail en cours, imposerait de refaire un code de connexion, et ne couvrirait pas un onglet qui reste au premier plan.

## Statut de fonctionnement

Fonctionnel dans le conteneur Docker (build de production).

## Comment cela a été testé

- `npx tsx --test test/app-build.test.ts` : 3/3.
- `npm test` : 156 réussis, 0 échec (3 ignorés).
- `npx tsc` : OK.
- `npm run build` et `npm run check:bundle` : OK, la `meta app-build` est présente dans `dist/public/index.html`.
- `docker compose build app` et `docker compose up -d app` : `X-App-Build` est présent sur `/api/app-build`.
- Scénario Playwright (Chromium, 390 px, horloge simulée `page.clock`) : page chargée sur le build A, puis conteneur reconstruit en build B (`--build-arg APP_BUILD_ID=...`) :
  1. Retour sur l'onglet : le bandeau s'affiche et le compte à rebours avance (« Rechargement dans 26 s »).
  2. Brouillon dans un `textarea` : pause pendant 40 s, pas de rechargement.
  3. Onglet masqué pendant 40 s : pas de rechargement.
  4. « Plus tard » : bandeau masqué pendant 9 min, de retour après 10 min, sans bouton « Plus tard ».
  5. Fin du compte à rebours : rechargement, la page porte le build B et le bandeau n'apparaît plus.

## Idées d'innovation

- Render : transmettre `APP_BUILD_ID=$RENDER_GIT_COMMIT` pour relier chaque onglet à un commit dans les journaux.
- Journaliser côté serveur le build client annoncé (en-tête de requête) pour mesurer combien d'onglets périmés subsistent après un déploiement.
- Sauvegarder les brouillons (`textarea`) dans `sessionStorage` pour autoriser le rechargement même en pleine saisie.
