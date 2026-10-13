# Walkthrough — Aperçu PDF via proxy serveur et rendu pdf.js

> Travail réalisé par l'IA intervenante à la demande explicite de l'utilisateur (« tu peux contourner ce pb de CORS ? »).

## Ce qui a été trouvé
- Le navigateur téléchargeait lui-même le PDF externe. La plupart des hébergeurs n'envoient pas d'en-tête CORS : l'aperçu échouait donc presque toujours.
- L'`iframe` avait un attribut `sandbox`. Chromium refuse d'afficher un PDF dans un cadre sandboxé : c'est l'icône 🚫 de la capture.
- Même sans `sandbox`, le lecteur PDF natif reste gris dans la modale Radix. Test fait dans Edge avec la même origine et les mêmes en-têtes : le PDF s'affiche hors modale et reste gris dès que la modale est ouverte. Chrome Android et iOS n'affichent pas non plus de PDF dans une `iframe`.

## Ce qui a été modifié
- `server/services/pdfProxy.ts` (nouveau), récupération côté serveur protégée contre la SSRF :
  - HTTPS sur le port 443 uniquement, sans identifiants dans l'URL ;
  - toutes les adresses résolues doivent être publiques. Le contrôle se fait dans le `lookup` utilisé à la connexion, ce qui ne laisse aucune fenêtre de DNS rebinding. Plages refusées : loopback, privées, link-local et métadonnées cloud 169.254.169.254, CGNAT, ULA, IPv4-mapped (forme décimale et hexadécimale) ;
  - au plus 3 redirections, chacune revalidée ;
  - plafond de 16 Mo, inactivité limitée à 15 s, durée totale limitée à 30 s, signature `%PDF-` vérifiée.
- `GET /api/resources/:id/pdf` (`server/routes/content.ts`) :
  - authentifié et soumis au contrôle d'accès de la semaine (`getResourceAccess`) ;
  - ne récupère que l'URL déjà enregistrée sur la ressource : le client ne fournit jamais d'URL ;
  - limiteur `pdfPreview` (60 requêtes par 15 min et par utilisateur, réglable par `RATE_LIMIT_PDFPREVIEW_*`) ;
  - réponse 502 avec un message français si le document est inaccessible.
- `client/src/components/PdfResourceViewer.tsx` :
  - lit le PDF via le proxy, avec le jeton en en-tête (jamais dans l'URL) ;
  - dessine les pages sur des `canvas` avec `pdfjs-dist` 6.3.289, chargé à la demande pour rester hors du bundle principal ;
  - limite l'aperçu aux 30 premières pages ;
  - garde le lien vers le document original en secours.
- `test/pdf-proxy.test.ts` (nouveau), tests unitaires de la protection SSRF.
- `test/e2e/learner.e2e.py` :
  - simule la réponse du proxy avec un vrai PDF d'une page ;
  - vérifie qu'un `canvas` s'affiche. L'ancien `data-testid` `iframe-resource-pdf` est remplacé par `pdf-preview-pages`.

## Statut
Opérationnel en local, en build de production (CSP active).

## Comment cela a été testé
- `npm test` : 144 tests réussis, 0 échec. `tsc --noEmit` : OK.
- Récupération réelle d'un PDF du W3C. La limite de 30 s se déclenche bien sur un hôte lent.
- Route HTTP :
  - 200 `application/pdf` pour l'apprenant ;
  - 401 sans jeton ;
  - 404 pour une ressource qui n'est pas un PDF ;
  - 502 pour `https://127.0.0.1`, `https://localhost` et `https://169.254.169.254`.
- Playwright sur Edge, build de production : modale ouverte et page PDF dessinée.

## Idées d'innovation
- Cache serveur court par ressource (ETag) pour éviter de retélécharger un document consulté souvent.
- Chargement progressif des pages au défilement, au-delà de 30 pages.
