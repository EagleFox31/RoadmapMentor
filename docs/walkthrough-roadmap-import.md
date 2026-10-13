# Walkthrough — Import de roadmap (`npm run roadmap:import`)

Travail effectué par Claude (Claude Code), à la demande explicite de l'utilisateur : précharger en production la roadmap de l'apprenant Pavel pour la mentore Jennifer Aka'a.

## Ce qui a été trouvé
- Aucun moyen d'alimenter une roadmap en prod hors de l'interface. `storage.createRoadmapBulk` existait déjà : insertion transactionnelle des semaines, objectifs, tâches, livrables et ressources.
- Sources : `C:\Users\lawry\Documents\Mentoring` (`Pavel_Mois1_Final`, roadmap andragogique sur 6 mois).
- En local, un autre agent avait déjà créé la roadmap n°31, « ShopFlow — Python Backend → PCAP → GenAI » : 9 étapes, 15 ressources.

## Ce qui a été modifié
- `server/domain/roadmapImport.ts` : schéma du fichier, qui réutilise `bulkWeekSchema`, et décision idempotente `create` / `fill` / `noop`.
- `scripts/import-roadmap.ts` : la CLI.
  - Vérifie que le compte est bien un mentor et cherche la roadmap par titre parmi les siennes.
  - Ne touche jamais une roadmap qui a déjà des semaines.
  - Approuve les ressources importées et écrit une ligne `[audit]`.
- `test/roadmap-import.test.ts` : idempotence, réutilisation du contrat, rejet des fichiers invalides (objectifs vides, URL `javascript:`, aucune semaine).
- `package.json` (script `roadmap:import`), `docs/deployment.md` (section « Roadmap import »), `PASSATION.md`.
- Données, hors dépôt : `roadmap-shopflow-complete.json`.
  - Semaines 1 à 4 : tirées de `Pavel_Mois1_Final`, avec ses 28 ressources.
  - Mois 2 à 6 : exportés de la roadmap locale n°31.
  - Titre identique à celui de la n°31.

## Est-ce que ça marche ?
Oui. En prod : roadmapId=1, mentorId=2, 9 étapes, 33 ressources, affichée pour Jennifer.

## Comment cela a été testé
- `npm test` : 137 pass, 0 fail. `npm run check` sans erreur.
- Base Docker locale :
  - premier import : `create` ;
  - second import : `noop` ;
  - import du fichier fusionné face à la n°31 existante : `noop`.
- Production : import, puis Playwright connecté en mentor sur https://roadmapmentor.onrender.com. La semaine 1, ses objectifs et les étapes suivantes s'affichent.

## Idées d'innovation
- Un mode `--dry-run` qui affiche le plan sans écrire.
- Un export JSON depuis l'interface mentor, dans le même format, pour dupliquer une roadmap entre environnements.
