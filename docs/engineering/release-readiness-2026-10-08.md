# RoadmapMentor — Audit de clôture / préparation à la release
_Date : 8 octobre 2026 · Référence : `main` au commit `b68435f` (fusion PR #78)_

## Décision de clôture

**Le périmètre métier V1 est globalement développé. La mise en production fiable n'est pas encore attestée.** Les tests GitHub ne prouvent ni la délivrabilité d'un e-mail Resend, ni un upload/lecture R2 réel, ni une restauration de Neon.

Le terme **andragogie** s'applique à toute la conception : problème concret, expérimentation autonome, production d'une preuve et retour du mentor. Une ressource « consultée » n'est pas une compétence démontrée.

## Revue des 20 fiches RM

| Fiche | Classement au 08/10 | Preuve / reste |
| --- | --- | --- |
| RM-001 Inscription | Fonctionnel | Formulaire LEARNER, validation structurée, test navigateur |
| RM-002 Provisionnement mentor | Fonctionnel | `mentor:create` et contrôle des rôles, exécution live non attestée |
| RM-003 Roadmaps / mentorats | Fonctionnel | UI `/roadmaps`, API, tests d'accès |
| RM-004 Multi-roadmap | Fonctionnel | URL `?roadmap`, clés de cache et chargement filtré |
| RM-005 Dépendances | Vérification résiduelle | CI OK, mais rapport d'audit prod actuel non vérifié dans cet audit |
| RM-006 Migrations | Fonctionnel en CI | Drizzle `0000`–`0007`, base vierge et rejeu ; historique Neon live à vérifier |
| RM-007 Parcours API/E2E | Fonctionnel | CI GitHub en succès sur `main` |
| RM-008 Authentification | Fonctionnel, compromis documenté | Rôle/compte revérifiés côté serveur ; JWT localStorage |
| RM-009 Durcissement HTTP | Fonctionnel | CSP, limites, erreurs, rate limiting, uploads |
| RM-010 N+1 et pagination | Partiel | Groupements et contraintes en place ; mesures/performance/pagination à compléter selon besoin |
| RM-011 Jobs multi-instance | Partiel | Réservation idempotente des créneaux ; reprise après crash non démontrée |
| RM-012 Stockage R2 | Code prêt, **recette réelle bloquante** | Faux S3 en CI ; tester véritable R2 avec plusieurs comptes |
| RM-013 Refactoring backend | Fonctionnel | Routes et stores par domaine |
| RM-014 Médias/bundle | Fonctionnel | Budgets CI et frontend optimisé |
| RM-015 Dépendances/outillage | Fonctionnel, exceptions amont | Avertissements transitifs documentés |
| RM-016 Terraform cloud | **Différé / hors V1 Render** | Modules sont des contrats, aucune infra AWS provisionnée |
| RM-017 Observabilité | Partiel | Logs structurés ; alertes, métriques, restauration manquantes |
| RM-018 Labs | Fonctionnel Python, vérification IA résiduelle | Exécution Pyodide et soumission prouvées en Chromium CI ; génération IA de labs à confirmer |
| RM-019 Ressources andragogiques | **Terminé côté développement** | PR #76/#77/#78 fusionnées ; PDF tiers à tester |
| RM-020 Invitations | Fonctionnel en CI, **recette réelle bloquante** | Acceptation du lien testée ; réception Resend live non attestée |

## Les portes de sortie d'une bêta avec utilisateurs réels

1. **Issue #34, priorité 0** : sauvegardes horodatées, chiffrées et vérification d'une restauration à blanc de la base Neon et des preuves Cloudflare R2. La simple présence de volumes persistants n'est pas une sauvegarde. Ne jamais écraser la production pendant un test de restauration.
2. **Recette des intégrations** : vraie invitation Resend reçue et acceptée, upload R2 signé, lecture privée apprenant/mentor autorisé, refus d'un tiers, santé `/health/ready`, et consultation PDF avec/sans CORS.
3. **Surveillance élémentaire** : alerte de panne application/base/sauvegarde et constat d'échec des rappels.
4. **Release réversible** : vérification après déploiement et restauration du code précédent **sans supposer qu'une migration DB est réversible**.
5. **Validation des dépendances** : exécuter un audit reproductible de la chaîne de production et classifier tout résultat résiduel ; ne pas prétendre zéro vulnérabilité par simple succès des tests.

Une bêta privée peut précéder l'automatisation intégrale Terraform/EC2. Le choix du fournisseur doit être motivé par le coût et la fiabilité, pas par un ancien epic.

## Triage de l'epic GitHub #25

**Cible active : Render + Neon + Cloudflare R2, e-mails Resend.** La fondation Terraform AWS/HCP est historique et ne justifie pas de dépenses.

| Issue | Disposition recommandée | Commentaire |
| --- | --- | --- |
| #25 | Requalifier comme epic de fiabilité du déploiement actuel | Porter sauvegardes, smoke test, rollback, état des services |
| #27, #28, #29 | **Différer** | HCP/AWS/EC2/cloud-init non requis pour Render |
| #30 | Optionnelle | Registre immutable GHCR utile seulement avec un pipeline basé sur image |
| #31 | À réécrire | Déploiement Render actuel ≠ SSM/EC2 |
| #32 | À garder | Smoke tests et rollback adaptés à Render |
| #33 | À vérifier | HTTPS / domaine du déploiement actuel avant d'ajouter un fournisseur DNS |
| #34 | **Priorité immédiate** | Sauvegardes/restauration Neon + R2 indépendantes |
| #35 | Différer la partie Terraform | Alertes coûts/sécurité seulement avec infra Terraform active |

## Règles de vérité

- **Implémenté** signifie code fusionné sur `main`.
- **Testé en CI** signifie tests automatisés sur les environnements jetables de GitHub Actions.
- **Validé en production** nécessite des observations réelles, datées, et une recette reproductible.
- **Clôturé** nécessite les critères de l'issue validés et les réserves tracées séparément.
- Ne pas créer de deuxième infrastructure AWS si le déploiement Render satisfait le besoin et le budget.

## Preuves vérifiables

- PR #78 fusionnée : https://github.com/EagleFox31/RoadmapMentor/pull/78
- CI de `main` à ce commit : https://github.com/EagleFox31/RoadmapMentor/actions/runs/37794710023
- Backlog de travail : `docs/backlog.md`
- Procédures déploiement : `docs/deployment.md`
- Mécanismes de stockage : `server/objectStorage.ts`
- Issue prioritaire : https://github.com/EagleFox31/RoadmapMentor/issues/34

_Les rapports passés des différentes tâches sont préservés dans le backlog à titre historique. Cette revue n'est ni un pentest ni un test direct des intégrations déployées._
