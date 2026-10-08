#!/bin/sh
# Applique les migrations puis démarre le serveur (plan Render gratuit : pas de preDeployCommand).
set -e
node dist/db-migrate.js
exec npm run start
