# Hevy Viz

Application web multi-utilisateurs pour visualiser et analyser vos exports CSV de l'application **Hevy** (workout tracker). Données stockées dans PostgreSQL, API auto-générée par PostgREST, frontend Vue 3.

## Fonctionnalités

- **Import incrémental** : déposez plusieurs exports successifs, les doublons sont ignorés automatiquement (dédup en base via contrainte UNIQUE). Mode « Remplacer » disponible.
- **Multi-utilisateurs** : lecture partagée entre potes (workout, InBody, mensurations visibles par tous), écriture strictement isolée par Row Level Security PostgreSQL.
- **Comparaison entre utilisateurs** : onglet « Comparer » — régularité, volume, streak, records, heatmap multi-user, top exercices, évolution composition corporelle et ratio recomp.
- **Stats globales** : volume, fréquence, durée, top exercices, par semaine et par mois.
- **Carte thermique anatomique** : silhouette humaine colorée selon les groupes musculaires travaillés.
- **Historique** : toutes les séances, recherche, filtre, drawer de détail.
- **Progression par exercice** : courbes 1RM estimé, poids max, volume.
- **Records & badges** : PRs avec dates, gamification (séances, volume cumulé, séries consécutives).
- **Rapport mensuel** : KPI, comparaison mois précédent / année précédente.
- **Calendrier** mensuel avec records.
- **Mensurations corporelles** (si `measurement_data.csv` importé).
- **InBody** : saisie manuelle des scans d'analyse de composition corporelle, comparaison entre scans, graphiques d'évolution avec zones normales, analyse segmentaire droite/gauche avec détection d'asymétrie.

## Stack

- **Frontend** : Vue 3 (Composition API) + Vite + Tailwind CSS + Chart.js + chartjs-plugin-annotation + PapaParse
- **API** : PostgREST v12 (auto-généré depuis le schéma PostgreSQL)
- **BDD** : PostgreSQL 16 avec Row Level Security
- **Infra** : Docker Compose (4 conteneurs) — nginx, postgrest, postgres, adminer

---

## Quickstart — Portainer (Stack Git, recommandé)

1. Pousser ce dépôt sur GitHub
2. Dans Portainer → **Stacks** → **Add Stack** → **Repository**
3. URL du repo, branch `main`, compose path : `docker-compose.yml`
4. Dans "Environment variables", saisir les variables ci-dessous (équivalent du `.env`)
5. **Deploy the stack**

Variables à renseigner dans Portainer :
```
POSTGRES_USER=hevy
POSTGRES_PASSWORD=votre_mot_de_passe_fort
POSTGRES_DB=hevy_viz
PGRST_AUTHENTICATOR_PASSWORD=votre_mot_de_passe_postgrest
HTTP_PORT=8080
ADMINER_PORT=8081
```

Portainer clone le repo et build l'image frontend localement sur le LXC. Aucun registry externe requis.

---

## Quickstart — Manuel (docker compose)

```bash
cp .env.example .env
# Éditez .env et changez les passwords
docker compose up -d
```

- Frontend : `http://IP_LXC:8080`
- Adminer : `http://IP_LXC:8081` (login : server=`db`, user/pass = valeurs .env)

---

## Configuration nginx Proxmox / Cloudflare Tunnel

Le nginx de l'hôte Proxmox pointe vers le LXC. Exemple de bloc (dans votre config nginx hôte) :

```nginx
server {
    listen 443 ssl;
    server_name hevy.votredomaine.fr;

    # Basic auth pour protéger l'accès
    auth_basic "Hevy Viz";
    auth_basic_user_file /etc/nginx/.htpasswd;

    location / {
        proxy_pass http://IP_LXC:8080;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

Pour créer le fichier htpasswd : `htpasswd -c /etc/nginx/.htpasswd guillaume`

**Adminer** : ne pas l'exposer via le tunnel public. Soit accès uniquement en local/VPN, soit sous-domaine dédié avec basic auth stricte.

---

## Dev local (hot reload)

```bash
cd frontend
npm install
npm run dev
```

Le proxy Vite (`vite.config.js`) redirige `/api` vers `http://localhost:8080`. Démarrez le compose d'abord :

```bash
docker compose up -d
```

L'app dev tourne sur `http://localhost:5173`, elle attaque le backend du compose sur `:8080`.

---

## Architecture

```
hevy-viz/
├── docker-compose.yml         # 4 services : db, postgrest, frontend, adminer
├── .env.example               # Modèle de configuration
│
├── frontend/                  # SPA Vue 3
│   ├── Dockerfile             # Multi-stage : node build → nginx serve
│   ├── nginx.conf             # Serve SPA + proxy /api → postgrest
│   ├── src/
│   │   ├── api/client.js      # Client API centralisé (X-Username header)
│   │   ├── composables/       # useWorkoutData, useMeasurementData, useExerciseMapping, useInbodyData, useCompareData
│   │   ├── views/             # UserPickerView + vues métier (dont CompareView)
│   │   └── config/muscleMapping.js
│   └── vite.config.js         # Proxy /api en dev
│
└── db/
    ├── init/                  # Exécutés au premier boot de Postgres
    │   ├── 01_schema.sql      # Tables, rôles, permissions
    │   ├── 02_rls.sql         # Row Level Security + current_user_id()
    │   ├── 03_functions.sql   # RPC import_workout_sets, import_measurements
    │   └── 04_set_password.sh # ALTER ROLE authenticator PASSWORD '...'
    └── migrations/            # Évolutions de schéma post-déploiement
    │       └── 001_inbody_scans.sql
```

### Auth via header X-Username + RLS

Aucun JWT ni OAuth. Le frontend stocke le username dans `localStorage` et l'envoie dans le header `X-Username` à chaque requête. Le nginx interne forward ce header vers PostgREST. PostgREST injecte les headers dans `request.headers` (setting Postgres). La fonction `api.current_user_id()` lit ce setting pour résoudre l'id utilisateur.

**Modèle RLS post-migration 002** :
- `workout_sets`, `measurements`, `inbody_scans` : SELECT libre pour tout user authentifié, INSERT/UPDATE/DELETE limités au `user_id` courant.
- `exercise_mapping_overrides` : toutes opérations limitées au user courant (préférence personnelle).

La lecture cross-user permet la comparaison entre utilisateurs sans opt-in, tout en garantissant qu'aucun user ne peut modifier les données d'un autre.

---

## Backups

```bash
# Dump
docker exec hevy-viz-db-1 pg_dump -U hevy hevy_viz > backup_$(date +%Y%m%d).sql

# Cron hôte (tous les jours à 2h)
0 2 * * * docker exec hevy-viz-db-1 pg_dump -U hevy hevy_viz > /backups/hevy_$(date +\%Y\%m\%d).sql
```

## Restauration

```bash
docker exec -i hevy-viz-db-1 psql -U hevy hevy_viz < backup.sql
```

---

## Évolutions du schéma

Créez un fichier numéroté dans `db/migrations/` et appliquez-le manuellement sur une instance déjà déployée :

```bash
docker exec -i hevy-viz-db-1 psql -U hevy hevy_viz < db/migrations/001_inbody_scans.sql
```

> Les scripts dans `db/init/` ne s'exécutent qu'au **premier boot** (volume vide). Pour un déploiement existant, utilisez toujours `db/migrations/`.

### Migrations disponibles

| Fichier | Description |
|---|---|
| `001_inbody_scans.sql` | Table `api.inbody_scans` — suivi des scans InBody (composition corporelle, données segmentaires, eau corporelle, métabolisme) |
| `02_open_read_access.sql` | Ouverture de la lecture cross-user — workout_sets, measurements et inbody_scans lisibles par tous les users authentifiés ; écriture toujours isolée ; exercise_mapping_overrides reste privé |

```bash
docker exec -i hevy-viz-db-1 psql -U hevy hevy_viz < db/migrations/02_open_read_access.sql
```

## Installation comme application (PWA)

Hevy Viz est une Progressive Web App installable sur mobile et desktop — elle se lance en plein écran, sans la barre du navigateur, comme une vraie app native.

### iOS (Safari)

1. Ouvrir `hevy.nossereau.fr` dans **Safari**
2. Appuyer sur l'icône **Partager** (carré avec flèche vers le haut)
3. Défiler et appuyer sur **« Sur l'écran d'accueil »**
4. Confirmer → l'icône Hevy Viz apparaît sur l'écran d'accueil

> L'app se lance en mode standalone (sans barre Safari). Le thème sombre et la barre de statut sont correctement configurés.

### Android (Chrome)

1. Ouvrir `hevy.nossereau.fr` dans **Chrome**
2. Menu (⋮) → **« Installer l'application »** ou **« Ajouter à l'écran d'accueil »**
3. Confirmer → l'icône apparaît sur l'écran d'accueil

### Desktop (Chrome / Edge)

1. Ouvrir `hevy.nossereau.fr`
2. Cliquer sur l'icône d'installation dans la barre d'URL (icône d'écran avec +)
3. Confirmer → l'app s'ouvre dans sa propre fenêtre

### Comportement PWA

- **Mise à jour silencieuse** : quand une nouvelle version est déployée, un toast apparaît en bas de l'écran. Cliquer « Mettre à jour » recharge l'app avec la nouvelle version.
- **Mode hors ligne** : si la connexion est perdue, une bannière s'affiche et les données déjà chargées restent visibles. Les requêtes `/api/*` sont servies depuis le cache Workbox (NetworkFirst, fallback 3 s).
- **Assets mis en cache** : JS, CSS, fonts — l'app démarre même sans réseau si elle a déjà été ouverte une fois.

### Icônes PWA

Les icônes sont générées depuis `public/vite.svg` via le script `scripts/generate-icons.js` :

```bash
cd frontend
node scripts/generate-icons.js
```

Tailles produites : 16×16, 32×32 (favicon), 180×180 (iOS), 192×192 et 512×512 (Android + splash), 512×512 maskable (Android adaptive icons).

> **Splash screens iOS** : iOS ne génère pas de splash screen automatique depuis le manifest. Seule l'icône `apple-touch-icon` est configurée. Pour des splash screens personnalisés par modèle d'iPhone, il faudrait ajouter des `<link rel="apple-touch-startup-image">` pour chaque résolution — hors scope actuel.

---

## Mise à jour (Portainer Stack Git)

```
git push
# Dans Portainer : Stack → Pull and redeploy
```

Aucun SSH nécessaire. Portainer recrée les images et redémarre les conteneurs. Le volume `db_data` est préservé.

---

## Changement de password authenticator post-déploiement

Le script `04_set_password.sh` ne tourne qu'au **premier boot** (volume `db_data` vide). Si vous changez `PGRST_AUTHENTICATOR_PASSWORD` dans `.env` après coup :

```bash
# Option A : via Adminer (sans perte de données)
# → Se connecter à Adminer, onglet SQL, exécuter :
ALTER ROLE authenticator PASSWORD 'nouveau_password';

# Option B : wipe complet (perd toutes les données)
docker compose down -v && docker compose up -d
```

---

## Format CSV attendu

Hevy exporte en français :
- `workout_data.csv` : `title, start_time, end_time, description, exercise_title, superset_id, exercise_notes, set_index, set_type, weight_kg, reps, distance_km, duration_seconds, rpe`
- `measurement_data.csv` (optionnel) : `date, weight_kg, fat_percent, neck_cm, shoulder_cm, chest_cm, ...`

Dates au format français (`"24 avr. 2026, 16:28"`) — converties en ISO 8601 avant envoi à Postgres.
