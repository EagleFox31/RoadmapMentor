# RM-034 — Kit de sauvegarde Neon + R2, première tranche

**Statut : scripts reproductibles uniquement. La production n'a pas encore été sauvegardée, ni restaurée. L'issue #34 reste ouverte.**

## Périmètre

`scripts/backup/neon-r2-snapshot.sh` exporte PostgreSQL depuis Neon avec `pg_dump -Fc`, vérifie la lisibilité de l'archive avec `pg_restore --list`, chiffre le dump via `age`, copie les preuves dans un **bucket R2 privé distinct** et publie un manifeste **en dernier**. Aucun effacement, aucun `sync --delete`.

`scripts/backup/verify-restore.sh` récupère une génération, vérifie le SHA-256 du fichier chiffré, déchiffre puis restaure le dump dans une **base PostgreSQL neuve et jetable**. Les objets sont copiés vers un **troisième bucket** de récupération.

La copie d'objets demande `--metadata-directive COPY` pour préserver l'ACL `aclpolicy`. Cette compatibilité doit être démontrée sur R2 réel (un CLI réussi ne prouve pas la confidentialité).

## Prérequis

- Linux et `bash`, `pg_dump`/`pg_restore`, `age`, AWS CLI, `sha256sum`.
- Une URL Neon **non poolée**, différente de l'URL poolée que peut utiliser l'application.
- Trois buckets R2 privés : source des preuves, sauvegardes et récupération. La protection contre une panne de compte/provideur nécessite ensuite une copie dans un **autre compte ou fournisseur**.
- Jeton R2 à privilèges limités ; clé privée `age` **hors du dépôt et de l'environnement de sauvegarde**, disponible uniquement lors du test de restauration.
- Aucun secret dans GitHub, le code, les logs ou `terraform.tfstate`.

### Configuration du processus de sauvegarde

| Variable | Sens |
| --- | --- |
| `NEON_BACKUP_DATABASE_URL` | URL PostgreSQL Neon **non poolée** réservée à l'export |
| `R2_ENDPOINT` | Point d'entrée HTTPS S3 de Cloudflare R2 |
| `R2_EVIDENCE_BUCKET` | Bucket privé contenant les preuves |
| `R2_BACKUP_BUCKET` | Bucket **distinct** réservé aux sauvegardes |
| `AGE_RECIPIENT` | Clé publique de chiffrement `age` |
| `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY` | Identifiants de l'outil AWS CLI, stockés comme secrets |
| `BACKUP_RUN_ID` | Facultatif : identifiant unique, sinon date UTC + suffixe aléatoire |

Exécution : `bash scripts/backup/neon-r2-snapshot.sh`. Le fichier `s3://<bucket de sauvegarde>/roadmapmentor/<identifiant>/manifest.json` n'est publié qu'après le dump chiffré et la copie des preuves.

### Test isolé de restauration

Ajouter à l'environnement de sauvegarde : `R2_RECOVERY_BUCKET` (troisième bucket non productif), `RECOVERY_DATABASE_URL` (base neuve, **non production**), `AGE_IDENTITY_FILE` (clé privée), `BACKUP_RUN_ID`, `CONFIRM_DISPOSABLE_RECOVERY=YES`.

Exécution : `bash scripts/backup/verify-restore.sh`. **Vérifier soi-même l'URL de destination** avant cette opération : la variable de confirmation n'est qu'un garde-fou et ne peut pas démontrer qu'une URL PostgreSQL inconnue n'est pas la production.

## Critères de recette restants

1. Vérifier sur la base restaurée la présence des tables, migrations, utilisateurs/mentorats et liens vers les preuves.
2. Comparer les inventaires des preuves, inspecter les métadonnées `aclpolicy`, puis tester propriétaire / mentor autorisé / tiers refusé sur une instance de récupération.
3. Simuler des échecs d'export, de chiffrement et de copie ; s'assurer qu'ils produisent un échec du job et **une alerte réelle**.
4. Déployer une planification indépendante de l'espace temporaire Render, définir RPO/RTO, rétention et copie hors du même compte Cloudflare.
5. Publier un rapport horodaté de restauration dans l'issue #34.

## Limites explicites

- Ces scripts ne mettent pas en place de cron, de rétention, d'alertes ni de stockage inter-fournisseurs.
- La DB est chiffrée **avant** son envoi ; les preuves copiées restent protégées par les droits du bucket R2 et son chiffrement au repos. Pour réduire le risque de compromission de compte, externaliser ensuite la copie des preuves.
- La vérification d'une archive n'est **pas** une restauration validée de l'application.
- Ne pas exécuter ces scripts dans le runner CI sur des **données réelles** : utiliser des bases/buckets de test et secrets de moindre privilège.

Sources de référence :
- https://neon.com/docs/guides/export-neon-postgres-compatible
- https://developers.cloudflare.com/r2/api/s3/api/
- https://developers.cloudflare.com/r2/get-started/cli/
