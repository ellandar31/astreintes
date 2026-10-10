# Schéma relationnel Supabase

## Installation initiale

`schema.sql` est le schéma initial pour une installation initiale dans un projet
Supabase vide. Il requiert les rôles Supabase et le schéma `auth` (`auth.users`,
`auth.uid()`). L'exécuter avec le rôle de maintenance `postgres`.
La création est transactionnelle, sans données ni suppression de tables.
Ce fichier n'est pas un script de mise à niveau d'une base existante.

Les identifiants sont générés par PostgreSQL. `app_users.auth_user_id` relie le
profil à Supabase Auth. Les familles exceptionnelles ont des séquences indépendantes ;
l'application préfixe leurs identifiants avec `astreinte:` ou `travaux:`.

## Tables utilisées

| Fonction | Tables |
| --- | --- |
| Utilisateurs et équipes | `app_users`, `teams`, `team_members` |
| Calendrier | `schedule_rules`, `public_holidays` |
| Paramétrage RH | `rh_on_call_compensation_rules`, `rh_period_compensation_rules` |
| Astreintes régulières | `regular_on_call_periods`, `regular_interventions`, `visas` |
| Astreintes exceptionnelles | `exceptional_on_calls`, `exceptional_on_call_participants`, `exceptional_on_call_interventions`, `exceptional_on_call_visas` |
| Travaux supplémentaires | `exceptional_works`, `exceptional_work_participants`, `exceptional_work_visas` |

Les périodes des participants distinguent prévisionnel et réel. Les travaux utilisent
ces périodes sans table d'interventions. Les clés étrangères des visas sont propres
à leur famille. Chaque visa possède une seule cible et une signature unique par
cible et portée.

## Règles métier et permissions

Les interventions restent dans une période valide du même utilisateur. Les
déclencheurs conservent le verrouillage des champs de planning après envoi RH.
Les signatures conservent un instantané indépendant du profil du signataire.

Toutes les tables ont la RLS activée. Les lectures authentifiées et les droits de
base sur les référentiels, paramètres et visas sont conservés. Les politiques
restrictives et déclencheurs protègent les profils, la création des opérations,
le planning, les participants et les interventions. Les initiateurs éditent leurs
propres opérations exceptionnelles ; les administrateurs, directeurs et RH ont les
droits transverses prévus. Seuls les administrateurs attribuent les rôles.
Les mises à jour sans modification métier du parent restent autorisées pour les visas.

## Vérification

`npm run test:db-schema` installe le schéma complet dans une base temporaire du
conteneur Supabase local (`SUPABASE_TEST_CONTAINER` permet d'en préciser le nom).
Il vérifie les profils, les contraintes et l'isolation des familles après une
installation neuve, puis supprime uniquement sa base temporaire.
