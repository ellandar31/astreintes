# Base de données Astreintes — installation bêta

## Trois scripts à exécuter dans cet ordre

Dans le SQL Editor de Supabase, avec le rôle `postgres`, exécuter séparément :

1. [`01_structure.sql`](../supabase/database/01_structure.sql) : types, 18 tables,
   colonnes, clés étrangères, contraintes et index.
2. [`02_security.sql`](../supabase/database/02_security.sql) : droits SQL,
   politiques RLS, contrôle des profils et autorisation des écritures.
3. [`03_operations.sql`](../supabase/database/03_operations.sql) : horodatage
   `updated_at`, contrôle des périodes d’intervention et verrouillage après envoi RH.

Supabase fournit le schéma `auth`, `auth.users`, `auth.uid()` et les rôles
`anon`, `authenticated`, `service_role`. Les scripts ne créent aucun utilisateur
réel et ne renseignent aucune donnée métier. Chaque script est transactionnel.

`01_structure.sql` est réservé à une base applicative vide : il ne supprime aucune
table et ne constitue pas une mise à niveau d’une ancienne base. Les scripts 02 et
03 peuvent être rejoués sur cette structure sans dupliquer les politiques ni les
déclencheurs. Les droits d’accès sont définis par le script de sécurisation ;
l’installation est complète après l’exécution des trois scripts.

Le dépôt ne contient plus de migrations ni de `schema.sql` concurrent. Pendant
la bêta, les évolutions sont intégrées directement aux trois scripts. Une base
existante n’est pas modifiée par cette réorganisation : son éventuelle recréation
reste une opération distincte. Les commandes Supabase de migration et de seed
sont désactivées dans `config.toml` ; l’installation utilise ces trois fichiers.

## Tables utilisées

| Fonction | Tables |
| --- | --- |
| Utilisateurs, directions et équipes | `app_users`, `directions`, `teams`, `team_members` |
| Calendrier | `schedule_rules`, `public_holidays` |
| Paramétrage RH | `rh_on_call_compensation_rules`, `rh_period_compensation_rules` |
| Astreintes régulières | `regular_on_call_periods`, `regular_interventions`, `visas` |
| Astreintes exceptionnelles | `exceptional_on_calls`, `exceptional_on_call_participants`, `exceptional_on_call_interventions`, `exceptional_on_call_visas` |
| Travaux supplémentaires | `exceptional_works`, `exceptional_work_participants`, `exceptional_work_visas` |

Les identifiants SQL sont générés par PostgreSQL. `app_users.auth_user_id` relie
le profil à Supabase Auth. Les séquences des familles exceptionnelles sont
indépendantes ; l’application préfixe leurs identifiants par `astreinte:` ou `travaux:`.
Les travaux utilisent les périodes réelles des participants, sans table d’interventions.
Les visas conservent un instantané indépendant du profil de leur signataire.

## Métadonnées disponibles

| Tables | Colonne | Type | Usage |
| --- | --- | --- | --- |
| `regular_interventions`, `exceptional_on_call_interventions` | `ticket` | `text`, nullable | Référence du ticket externe |
| `app_users` | `trigram` | `text`, nullable | Code utilisateur sans limite de trois caractères ni contrainte d’unicité |
| `app_users` | `deleted_at` | `timestamptz`, nullable | Date de départ de la société |
| `app_users` | `is_rh` | `boolean NOT NULL DEFAULT false` | Accès indépendant au menu RH et aux exports |
| `regular_on_call_periods`, `exceptional_on_calls`, `exceptional_works` | `treated_at` | `timestamptz`, nullable | Date de traitement par les RH |

Le ticket suit les droits de l’intervention. Le départ est modifiable uniquement
par un administrateur ; il désactive les accès et les nouvelles affectations tout
en conservant l’historique. Le traitement RH suit les droits de l’envoi (admin, directeur), indépendamment de `is_rh`.
Les dates d’envoi et de traitement sont indépendantes et ne sont pas renseignées
automatiquement. Les formulaires actuels conservent les métadonnées omises.

## Vérification

`npm run test:db-schema` crée une base temporaire dans le conteneur Supabase local,
installe les trois scripts, rejoue les scripts 02 et 03, puis vérifie la structure,
les droits des quatre rôles, la permission RH indépendante, le planning, les interventions et les statuts RH.
`npm run test:db-user-roles` utilise le même schéma complet pour les tests d’accès.
La variable `SUPABASE_TEST_CONTAINER` permet de choisir le conteneur.

Les fichiers de `supabase/tests/` sont des fixtures et assertions automatisées.
Ils ne font pas partie de l’installation et ne doivent pas être exécutés dans la
base applicative. Seule la base temporaire créée par le test est supprimée.

## Directions

Le menu « Gestion des directions » est réservé aux administrateurs. Les noms sont
non vides et uniques sans tenir compte de la casse ni des espaces aux extrémités.
Une direction déjà utilisée ne peut pas être supprimée.

`app_users.direction_id` est obligatoire pour les profils Initiateur (2) et
Directeur (3). Les autres profils peuvent être associés à une direction sans
que cette association soit obligatoire. Seul l’administrateur modifie le rôle
et la direction, enregistrés ensemble depuis la liste des utilisateurs.

`regular_on_call_periods.direction_id`, `exceptional_on_calls.direction_id` et
`exceptional_works.direction_id` sont obligatoires. Cette association est propre
à l’opération : changer la direction d’un profil ne réaffecte pas ses anciens
dossiers. La création propose la direction du créateur ; une nouvelle opération
exceptionnelle reprend aussi celle de l’initiateur sélectionné. Elle reste modifiable
avant l’envoi RH. La réaffectation invalide les validations globales correspondantes.

Le tableau de validation du directeur affiche la direction et propose un filtre
incluant « Toutes les directions ». Ce filtre ne modifie pas les droits d’accès SQL.
Les listes partagées sont chargées par NgRx pour la session et vidées à la déconnexion ;
les brouillons de rôle/direction restent locaux à la page de paramétrage.

Les trois scripts d’installation incluent directement cette structure bêta. Ils
n’ont pas été exécutés sur une base applicative existante ; aucun remplissage
arbitraire des directions historiques n’est effectué.

## Préparation des comptes avant connexion

La revue de compte permet à un administrateur actif de préparer un profil par
adresse e-mail via `create_application_user`. `app_users.auth_user_id` reste nul
jusqu’à la création de l’identité Auth, ou référence immédiatement une identité
existante pour cette adresse. Un index unique sur `lower(email)` empêche les
comptes en double. Le déclencheur Auth rattache le profil préparé en conservant
son identifiant applicatif, ses droits, sa direction et sa date de départ.
La préparation ne crée ni mot de passe ni session.

Le bouton de suppression dans la revue supprime définitivement le profil applicatif.
`deleted_at` est réservé à la désactivation remontée par un futur connecteur.
Une date renseignée bloque l’accès ; le rattachement ultérieur d’une identité Auth
ne réactive pas un profil désactivé.

Pour une base bêta existante, réexécuter `02_security.sql` avec le rôle `postgres`
avant de déployer l’interface. Ce script adapte la colonne de rattachement et
installe l’index, la fonction et le déclencheur. Ne pas rejouer `01_structure.sql`
sur une base existante.

L’enregistrement global du paramétrage utilisateur utilise `save_user_assignments`
pour appliquer toutes les affectations modifiées dans une transaction. Une
validation échouée annule l’ensemble ; le changement éventuel du rôle de
l’administrateur courant ne coupe pas le traitement des autres lignes.
Cette fonction est installée en réexécutant `02_security.sql`.

## Purge des opérations RH

Le menu RH propose un aperçu puis une confirmation des opérations traitées depuis
strictement plus d’un ou deux ans (deux ans par défaut). La date `treated_at` et
l’horloge PostgreSQL déterminent l’éligibilité, indépendamment des dates de l’opération.
Les fonctions `list_rh_purge_candidates` et `purge_rh_operations` exigent un profil
actif avec le flag RH. Le rôle de base ne donne pas ce droit à lui seul.

La suppression porte exclusivement sur les identifiants et dates de traitement
confirmés dans l’aperçu. Les lignes sont verrouillées et revérifiées ; si une ligne
a changé, toute la transaction est annulée. Les clés étrangères en cascade retirent
les participants, interventions et visas associés. Aucune purge automatique n’est
planifiée. Pour une base existante, réexécuter `02_security.sql` avant déploiement.
