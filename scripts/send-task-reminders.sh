#!/bin/bash

# Script pour envoyer manuellement des rappels de tâches
# Usage: ./scripts/send-task-reminders.sh [MENTOR_TOKEN]

# Couleurs pour l'affichage
GREEN='\033[0;32m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
API_URL="${API_URL:-http://localhost:5000}"
ENDPOINT="/api/jobs/send-task-reminders"

# Vérifier si le token est fourni
if [ -z "$1" ]; then
    echo -e "${RED}Erreur: Token mentor manquant${NC}"
    echo "Usage: $0 MENTOR_TOKEN"
    echo ""
    echo "Pour obtenir un token:"
    echo "1. Connectez-vous en tant que mentor sur l'application"
    echo "2. Ouvrez la console développeur (F12)"
    echo "3. Tapez: localStorage.getItem('token')"
    exit 1
fi

MENTOR_TOKEN="$1"

echo -e "${BLUE}=== Envoi des Rappels de Tâches ===${NC}"
echo "URL: ${API_URL}${ENDPOINT}"
echo ""

# Envoyer la requête
RESPONSE=$(curl -s -X POST "${API_URL}${ENDPOINT}" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${MENTOR_TOKEN}" \
  -w "\n%{http_code}")

# Séparer le corps de la réponse et le code HTTP
HTTP_BODY=$(echo "$RESPONSE" | head -n -1)
HTTP_CODE=$(echo "$RESPONSE" | tail -n 1)

# Afficher le résultat
if [ "$HTTP_CODE" -eq 200 ]; then
    echo -e "${GREEN}✓ Rappels envoyés avec succès!${NC}"
    echo ""
    echo "Résumé:"
    echo "$HTTP_BODY" | jq '.'
else
    echo -e "${RED}✗ Erreur lors de l'envoi (Code: $HTTP_CODE)${NC}"
    echo ""
    echo "Réponse:"
    echo "$HTTP_BODY"
fi
