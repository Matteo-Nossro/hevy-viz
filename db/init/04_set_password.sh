#!/bin/bash
# Exécuté en dernier par docker-entrypoint-initdb.d (ordre alphabétique).
# À ce stade, 01_schema.sql a déjà créé le rôle authenticator avec un placeholder.
# On le remplace ici par le vrai password issu de la variable d'env.
#
# Note : ce script ne tourne qu'au PREMIER boot (volume db_data vide).
# Si vous changez PGRST_AUTHENTICATOR_PASSWORD dans .env après coup, il faut
# soit faire docker compose down -v (perd les données), soit passer par
# Adminer : ALTER ROLE authenticator PASSWORD 'nouveau_password';
set -euo pipefail

psql --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" \
  -c "ALTER ROLE authenticator PASSWORD '${PGRST_AUTHENTICATOR_PASSWORD}';"

echo "04_set_password.sh : mot de passe du rôle authenticator mis à jour."
