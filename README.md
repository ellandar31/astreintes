# Astreintes

Application web de gestion des astreintes, des interventions et des travaux supplémentaires destinée aux collectivités et aux services techniques.

L'objectif est de couvrir l'ensemble du cycle de vie des astreintes :

- préparation des astreintes ;
- planification des agents ;
- saisie des horaires réels ;
- validation des interventions ;
- calcul des indemnisations ;
- contrôle des règles réglementaires ;
- préparation des exports RH et Paie.

---

# Fonctionnalités

## Architecture et types

L'état partagé est géré par NgRx. Les effects utilisent une API de persistance
typée par domaine ; les repositories Supabase renvoient directement les objets
métier, sans conversion intermédiaire en documents.

- [Architecture de persistance](src/app/store/relational/README.md)
- [Règles de droits, validation et contrôles RH](docs/access-rules.md)
- [Catalogue des types et règles de maintenance](docs/type-catalog.md)
- [Séparation SQL des astreintes et travaux supplémentaires](docs/exceptional-database-split.md)
- Point d'import centralisé : `src/app/types/index.ts`.
- Mise à jour du catalogue : `npm run docs:types`.

## Gestion des astreintes

L'application permet de gérer :

- les astreintes régulières ;
- les astreintes exceptionnelles ;
- les travaux supplémentaires.

Chaque fiche peut contenir :

- plusieurs agents prévus ;
- plusieurs agents réellement intervenus ;
- plusieurs interventions ;
- plusieurs validations.

---

## Gestion des interventions

Pour chaque intervention, il est possible de renseigner :

- le collaborateur ;
- la date et l'heure de début ;
- la date et l'heure de fin ;
- la présence sur site ;
- un libellé ;
- un commentaire.

---

## Validation

L'application permet de gérer les différentes étapes de validation.

Les signatures disponibles sont :

- Agent
- Initiateur
- Directeur
- RH (mêmes droits que Directeur)

Les signatures peuvent être :

- dessinées directement dans l'application ;
- enregistrées dans le profil utilisateur ;
- importées sous forme d'image.

---

## Calcul RH

L'application calcule automatiquement :

### Astreintes

- indemnités de semaine ;
- indemnités samedi ;
- indemnités dimanche ;
- indemnités jours fériés.

### Interventions

Calcul selon les plages horaires :

- Semaine 18h00 → 21h00
- Nuit 21h00 → 07h00
- Semaine 07h00 → 08h00
- Samedi 07h00 → 21h00
- Dimanche / Jour férié 07h00 → 21h00

### Repos compensateurs

Les interventions peuvent être converties en repos compensateurs selon les règles définies.

---

# Module RH

Le module RH est composé de plusieurs écrans.

## Contrôles

Visualisation des compteurs réglementaires par collaborateur.

Affichage :

- heures d'astreinte ;
- nombre de week-ends réalisés ;
- jours fériés réalisés ;
- heures supplémentaires ;
- indicateurs de dépassement.

---

## Indemnisation

Calcul automatique des éléments variables de paie.

Affichage :

- coefficient d'astreinte ;
- coefficient d'intervention ;
- coefficient de travaux supplémentaires ;
- coefficient de repos compensateurs.

---

## Exports

L'application permet :

- la préparation des éléments destinés à la paie (Excel).

---

# Paramétrage

L'application permet de gérer :

- les utilisateurs ;
- les équipes ;
- les jours fériés ;
- les signatures ;
- les paramètres d'indemnisation.

---

# Technologies

- Angular 20
- Supabase Authentication
- Supabase Postgres / Realtime
- TypeScript

---

# Outillage

Git : https://github.com/ellandar31/astreintes
Sonar : https://sonarcloud.io/project/overview?id=ellandar31_astreintes

---

# Architecture

```
Accueil
││
├── Planification
│   ├── Astreintes
│   ├── Astreintes exceptionnelles
│   └── Travaux supplémentaires
│
├── Validation
│
├── RH
│   ├── Contrôles
│   ├── Indemnisation
│   └── Exports
│
└── Paramétrage
|    ├── Utilisateurs
|    ├── Équipes
|    ├── Jours fériés
|    └── Signatures
│
└── Profil
 

```

---

# Installation

Installation des dépendances :

```bash
npm ci --ignore-scripts
```

## Politique des dépendances

Le fichier `package-lock.json` est versionné et la CI utilise `npm ci --ignore-scripts`
pour reproduire les versions sans exécuter les scripts des dépendances. Les versions
Angular, PrimeNG et NgRx sont fixées ; les plages `^` autorisent les mises à jour
mineures compatibles et les plages `~` limitent les mises à jour aux correctifs.
Toute mise à jour du lockfile doit être validée par les tests, la couverture et le build.

Le projet utilise `@angular/build` plutôt que le paquet complet de build Angular :
aucun builder Webpack n'est nécessaire. Cela retire une chaîne de dépendances inutilisées.
Les `overrides` sont des correctifs de sécurité ciblés, pas des exclusions de l'audit.
Celui de `@istanbuljs/load-nyc-config` impose `js-yaml` 4.3.2 et retire l'ancienne
chaîne `argparse` / `sprintf-js` ; sa compatibilité YAML est couverte par un test Jest.
Lancer `npm audit` pour l'ensemble des dépendances et `npm audit --omit=dev` pour
les dépendances de production. La CI bloque les alertes de niveau modéré ou supérieur.

Configuration Supabase :

1. en local, lancer `npx supabase start` ;
2. ouvrir le SQL Editor de Supabase Studio sur un projet vide ;
3. exécuter le contenu de `schema.sql` avec le rôle `postgres` ;
4. renseigner `url` et `anonKey` dans `src/app/store/supabase.config.ts` pour changer de projet ;
5. activer l'authentification Email dans Supabase Auth.

Lancement de l'application :

```bash
npm start
```

ou

```bash
ng serve
```

Compilation :

```bash
ng build
```

---

# Déploiement

Le frontend Angular est une application statique servie par Nginx dans l'image
Docker du projet. Supabase reste un service séparé : soit un projet Supabase
hébergé, soit une instance Supabase lancée ou self-hostée avec Docker.

## Préparer Supabase

### Option recommandée : Supabase hébergé

1. Créer un projet Supabase.
2. Activer l'authentification Email dans Supabase Auth.
3. Dans le SQL Editor du projet vide, exécuter le contenu de `schema.sql`
   avec le rôle `postgres`.

4. Récupérer l'URL du projet et la clé `anon public` dans Supabase :
   `Project settings > API`.
5. Renseigner ces valeurs dans :

```text
src/app/store/supabase.config.ts
```

### Option locale / self-host Docker

Pour lancer Supabase localement :

```bash
npx supabase start
```

Pour installer les tables applicatives dans une base vide, ouvrir le SQL Editor
de Supabase Studio et exécuter `schema.sql` avec le rôle `postgres`.

URLs locales utiles :

- API Supabase : `http://127.0.0.1:54321`
- Studio Supabase : `http://127.0.0.1:54323`
- Mailpit : `http://127.0.0.1:54324`

Sur Windows, le service Analytics Supabase est désactivé dans
`supabase/config.toml`, car il nécessite une configuration Docker particulière.
Ce service n'est pas nécessaire pour l'application.

## Construire et lancer l'application avec Docker

L'image Docker sert le frontend Angular avec Nginx. Le même conteneur joue aussi
le rôle de gateway Supabase : les appels navigateur partent vers `/supabase`,
puis Nginx les relaie vers l'API Supabase interne. Cette approche permet
d'exposer une seule URL publique, notamment avec Tailscale Funnel, sans publier
directement Supabase.

La configuration est injectée au démarrage du conteneur par les variables
d'environnement `SUPABASE_INTERNAL_URL`, `SUPABASE_PUBLIC_URL` et
`SUPABASE_ANON_KEY`, ce qui permet de modifier la cible depuis Portainer sans
reconstruire le bundle Angular.

Nginx s'exécute sans privilèges root et écoute sur le port interne `8080`, publié
sur le port `8180` du serveur (`8180:8080`). Le port externe et l'URL publique
restent inchangés. L'installation Docker/CI utilise `npm ci --ignore-scripts` ;
les outils Angular sont vérifiés par la compilation, sans exécuter les scripts
de cycle de vie des dépendances.

Construction :

```bash
docker compose build
```

Lancement :

```bash
docker compose up -d
```

Application :

```text
http://localhost:8180
```

## Déploiement avec Portainer

Dans Portainer, créer une nouvelle stack depuis le repository Git ou coller le
contenu de `compose.yaml`.

Variables d'environnement à renseigner dans la stack :

```text
SUPABASE_INTERNAL_URL=http://host.docker.internal:8000
SUPABASE_PUBLIC_URL=
SUPABASE_ANON_KEY=<cle-anon-public-supabase>
```

`SUPABASE_INTERNAL_URL` est l'adresse utilisée par Nginx depuis le conteneur
`astreintes`. Si Supabase est publié sur le port `8000` du miniPC, la valeur
recommandée est :

```text
SUPABASE_INTERNAL_URL=http://host.docker.internal:8000
```

`SUPABASE_PUBLIC_URL` est optionnelle. Si elle est vide, l'application utilise
automatiquement l'origine courante avec le préfixe `/supabase`, par exemple :

```text
https://<nom-funnel-tailnet>/supabase
```

Avec Tailscale Funnel, il faut donc exposer uniquement le conteneur applicatif
et garder Supabase derrière la gateway. Attention : `http://127.0.0.1:54321` ne
convient pas pour les utilisateurs distants, car cette adresse pointerait vers
leur propre machine et non vers le miniPC.

Arrêt :

```bash
docker compose down
```

## Points de contrôle avant mise en production

- `npm ci`
- `npm test`
- `npm run build`
- `npm audit --omit=dev`
- schéma `schema.sql` installé
- authentification Email activée
- URL et clé `anon public` Supabase renseignées dans les variables Docker
- sauvegarde/restauration de la base Supabase validée

## Schéma de données

Le schéma initial est fourni dans [`schema.sql`](schema.sql) et documenté dans
[`docs/database-schema.md`](docs/database-schema.md). Il contient toutes les tables,
contraintes, fonctions et permissions nécessaires à une installation neuve.

---

## Export Excel par période RH

Le menu RH « Export Excel par période d'envoi RH » filtre les opérations sur leur
date d'envoi aux RH, et non sur leurs dates d'exécution. Les dates de début et de
fin sont incluses, selon le calendrier local utilisé dans l'application.

Le fichier `.xlsx` contient trois onglets : astreintes régulières, astreintes
exceptionnelles et travaux supplémentaires. Chaque ligne reprend l'utilisateur,
l'opération, le directeur signataire, la date d'envoi RH, les périodes et le
détail du calcul. Les opérations non envoyées sont exclues ; une opération sans
heures indemnisables reste visible avec un total nul. Le moteur de calcul est
commun à l'export individuel et à l'export groupé. ExcelJS est chargé uniquement
au moment de la génération, avec une version exacte dans le lockfile.

Tests dédiés : `npm run test:rh-period-excel` (également inclus dans `npm test`).

# Feuille de route

Les évolutions prévues sont notamment :

- tableau de bord RH avec compteurs réglementaires ;

---

# Licence

Projet personnel développé dans le cadre de la gestion des astreintes et des travaux supplémentaires.
