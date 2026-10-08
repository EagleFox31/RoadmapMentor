# Runbook d'exploitation (Render + Neon + R2)

Cible : l'hébergement gratuit décrit dans `docs/deployment.md`. Les journaux et l'`x-request-id` sont décrits dans `observability.md`.

## Sondes et alertes
| Sonde | Cible | Alerte si |
|---|---|---|
| Liveness | `GET /health/live` | pas de 200 sous 10 s |
| Readiness | `GET /health/ready` | 503 (base ou stockage injoignable) |
| Pinger externe (UptimeRobot, 5 min) | `/health/ready` | 2 échecs consécutifs ; garde aussi l'instance gratuite éveillée |
| Journaux Render | filtre `"level":"error"` | tout `unhandled_error` ; `api_error` répétés |
| Jobs | événements du scheduler (`scheduled_job_runs`) | créneau sans ligne `succeeded` après l'heure prévue |

Les alertes sont à configurer dans les consoles UptimeRobot/Render : rien n'est appliqué par le dépôt.

## Incident : l'application ne répond pas
1. `/health/live` : KO → déploiement ou instance (Render > Events, redéployer le dernier déploiement sain). OK → étape 2.
2. `/health/ready` : 503 → vérifier Neon (statut du projet, quotas) puis le bucket R2 (clés, nom du bucket).
3. Erreur utilisateur avec `requestId` : chercher la ligne `api_error`/`unhandled_error` portant cet identifiant dans les journaux.
4. Cause identifiée → corriger ; si une régression est en cause, rollback (`docs/deployment.md`, section Rollback).
5. Toute panne notable : ajouter une entrée à `docs/engineering/lessons-learned.md` (contexte, cause, prévention vérifiable).

## Restauration de la base
- Neon : restauration à un instant donné (historique limité sur l'offre gratuite) dans une **branche** ; ne jamais écraser la branche principale avant vérification.
- Vérifier sur la branche restaurée : `npm run db:migrate` sans écriture parasite, comptes et semaines attendus.
- Basculer en changeant `DATABASE_URL` côté Render, puis contrôler `/health/ready`.
- Sauvegarde complémentaire : `pg_dump` planifié selon `docs/deployment.md` (Backup and restore). Tester une restauration avant d'ouvrir à de vrais utilisateurs.

## Rotation des secrets
| Secret | Effet de la rotation |
|---|---|
| `JWT_SECRET` | déconnecte tous les utilisateurs |
| Mot de passe SMTP | envois d'e-mails interrompus jusqu'au redéploiement |
| Clé IA | génération désactivée jusqu'au redéploiement |
| Clés R2 | créer la nouvelle clé, mettre à jour Render, redéployer, puis révoquer l'ancienne |
| `DATABASE_URL` (mot de passe Neon) | réinitialiser dans Neon puis mettre à jour Render immédiatement |

Procédure : générer la nouvelle valeur, la poser dans Render (variable `sync: false`), redéployer, vérifier `/health/ready` et un parcours de connexion, puis révoquer l'ancienne valeur. Toute valeur apparue dans un terminal, un journal ou une capture est considérée comme compromise et tournée. `.env` reste hors Git.

## Mentors et comptes
Création d'un mentor : script `create-mentor` (`docs/deployment.md`, Mentor accounts).

## Hors périmètre actuel
Métriques agrégées (tableau de bord), alertes automatisées et IaC Terraform : à reprendre si l'hébergement quitte l'offre gratuite (RM-016/GH-25).
