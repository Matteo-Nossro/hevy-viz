# Migrations

Les évolutions du schéma post-déploiement se font via des fichiers SQL numérotés dans ce dossier.

## Procédure

1. Créer un fichier `NNN_description.sql` (ex: `001_add_notes_column.sql`)
2. L'appliquer manuellement :

```bash
docker exec -i hevy-viz-db-1 psql -U hevy hevy_viz < db/migrations/001_add_notes_column.sql
```

Pour ce volume de projet (quelques utilisateurs, quelques milliers de lignes), pas besoin d'un outil de migration automatique.
