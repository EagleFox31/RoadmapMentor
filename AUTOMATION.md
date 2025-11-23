# Automatisation des Rappels de Tâches

Ce guide explique comment configurer l'envoi automatique de rappels de tâches aux apprenants.

## Option 1 : Déploiements Planifiés Replit (Recommandé)

Replit propose des **Scheduled Deployments** qui permettent d'exécuter automatiquement des tâches à intervalles réguliers.

### Configuration

1. **Accédez à l'outil de Publication** :
   - Cliquez sur le bouton "Publish" dans votre Replit
   - Sélectionnez l'option **"Scheduled"** (Planifié)
   - Cliquez sur "Set up your published app"

2. **Configurez le Planning** :
   
   **Rappels de mi-semaine (Mercredi à 10h)** :
   - Description : "Every Wednesday at 10:00 AM"
   - Expression cron : `0 10 * * 3`
   
   **Rappels de fin de semaine (Dimanche à 18h)** :
   - Description : "Every Sunday at 6:00 PM"
   - Expression cron : `0 18 * * 0`

3. **Commande à exécuter** :
   ```bash
   curl -X POST http://localhost:5000/api/jobs/send-task-reminders \
     -H "Authorization: Bearer VOTRE_TOKEN_MENTOR"
   ```

4. **Configuration de Build** :
   - Build command : `npm install`
   - Run command : La commande curl ci-dessus

### Notes Importantes

- **Token d'authentification** : Vous devez créer un token mentor permanent et le stocker de manière sécurisée
- **Coûts** : Les déploiements planifiés utilisent des crédits Replit Core
- **Timeout** : Configurez un timeout approprié (30-60 secondes recommandé)

## Option 2 : Services Externes de Cron

Vous pouvez également utiliser des services externes comme :

### GitHub Actions

Créez un fichier `.github/workflows/task-reminders.yml` :

```yaml
name: Send Task Reminders

on:
  schedule:
    # Mercredi à 10h UTC
    - cron: '0 10 * * 3'
    # Dimanche à 18h UTC
    - cron: '0 18 * * 0'

jobs:
  send-reminders:
    runs-on: ubuntu-latest
    steps:
      - name: Send Task Reminders
        run: |
          curl -X POST https://votre-app.replit.app/api/jobs/send-task-reminders \
            -H "Authorization: Bearer ${{ secrets.MENTOR_TOKEN }}"
```

### Autres Services

- **EasyCron** : https://www.easycron.com
- **Cron-job.org** : https://cron-job.org
- **AWS EventBridge** : Pour des solutions d'entreprise

## Option 3 : Appel Manuel

Pour tester ou envoyer des rappels ponctuels :

```bash
curl -X POST https://votre-app.replit.app/api/jobs/send-task-reminders \
  -H "Authorization: Bearer VOTRE_TOKEN_MENTOR"
```

Réponse attendue :
```json
{
  "message": "Task reminders sent successfully.",
  "sent": 1,
  "skipped": 0,
  "learners": 1
}
```

## Calendrier Recommandé

- **Mercredi 10h** : Rappel de mi-semaine pour vérifier la progression
- **Dimanche 18h** : Rappel de fin de semaine avant le début de la nouvelle semaine

## Fonctionnement

1. Le système parcourt tous les apprenants
2. Pour chaque apprenant, il vérifie toutes les semaines et compte les tâches non terminées
3. Si des tâches sont en attente, un email est envoyé (seulement si l'apprenant a activé les notifications)
4. Les statistiques sont retournées : nombre d'emails envoyés, ignorés, et total d'apprenants

## Préférences de Notification

Les apprenants peuvent gérer leurs préférences de notification via :
- Le bouton ⚙️ (Paramètres) dans la barre supérieure
- Page `/preferences`

Les emails ne sont envoyés que si l'apprenant a activé "Rappels de tâches" dans ses préférences.
