# Persistance relationnelle typée

`../app-store.ts` est le point d'entrée des effects NgRx. Un seul client
Supabase est partagé par les repositories. NgRx reste propriétaire de l'état
applicatif ; la persistance ne crée ni cache partagé ni second store.

Le flux est désormais : tables Supabase → repositories → modèles métier →
effects NgRx. Il n'y a plus d'enveloppe `{ id, parentId, data }`, de références
de collections, de `setDocument` ou de marqueur `deleteField`.

## API par domaine

| API | Repository | Responsabilité |
| --- | --- | --- |
| `appStore.users` | `users.repository.ts` | Profils, rôles, signatures personnelles, identités Auth/application |
| `appStore.teams` | `teams.repository.ts` | Équipes et appartenances |
| `appStore.schedule` | `schedule.repository.ts` | Règles horaires et jours |
| `appStore.holidays` | `holidays.repository.ts` | Jours fériés par zone/date |
| `appStore.rhSettings` | `rh-settings.repository.ts` | Coefficients, configuration et modèles JSONB |
| `appStore.regular` | `regular.repository.ts` | Périodes et interventions régulières |
| `appStore.exceptional` | `exceptional.repository.ts` | Opérations, participants et interventions |

`visas.repository.ts` partage la résolution des utilisateurs et gère les
instantanés de signature. Un changement de profil ne réécrit pas les visas signés.

`domain-store.ts` compose les API typées. Une mise à jour partielle conserve les
champs omis ; `sentToRhAt: null` annule explicitement l'envoi RH. Les écritures
d'agrégats exceptionnels restent plusieurs requêtes ordonnées, sans transaction
SQL implicite.

`domain-observer.ts` relit les objets complets au chargement, après une écriture
locale réussie et sur les événements realtime des tables dépendantes. Les jointures
utilisateurs/visas font partie de ces dépendances. La désinscription libère les
canaux et empêche la livraison d'une lecture encore en cours.

Pendant une écriture locale, les notifications des tables concernées ne publient
pas les jointures intermédiaires (suppression puis recréation des participants,
par exemple). Une relecture complète suit la réussite de l'écriture. Les écritures
parallèles sont comptées par table et seules les réponses de la dernière demande
de lecture sont livrées, afin qu'une réponse lente ne restaure pas un ancien visa.
Cette protection côté client ne remplace pas une transaction SQL pour les autres
clients connectés.

## Chaîne de validation

`shared/visa-workflow.ts` définit les prérequis communs à la validation et aux
exports RH : agent et interventions pour le régulier ; initiateur, participants
prévisionnels/réels et interventions pour l'exceptionnel. Le directeur signe en
dernier. L'envoi RH nécessite la chaîne complète, directeur compris. Les anciens
champs de visa initiateur/directeur sont des alias, pas des validations distinctes.

`visa-workflow.persistence.ts` relit les prérequis avant les écritures du store,
retire le visa directeur si un prérequis manque et refuse les envois incomplets.
Les écritures locales d'un même agrégat sont sérialisées pour éviter une course
entre suppression de visa et signature directeur. Il ne s'agit pas d'une garantie
transactionnelle entre plusieurs clients : les accès SQL directs restent soumis
aux contraintes et policies déployées sur le serveur.

`shared/visa-revalidation.ts` compare les données persistées avec les modifications
avant l'écriture. Un changement d'horaires ou d'utilisateur retire le visa de la
période régulière ou de l'intervention concernée et celui du directeur. Pour une
opération exceptionnelle, les lignes ajoutées/modifiées repartent sans visa ; les
lignes inchangées gardent leur signature. Toute modification de ces cibles, y
compris un retrait, retire les visas globaux initiateur/directeur et leurs alias.
Un changement des bornes globales seul invalide les visas du volet concerné.
Les bornes globales recalculées à partir d'une ligne modifiée n'invalident pas les
autres lignes. Un changement d'ordre, de libellé ou de format de date représentant
le même instant ne demande pas une nouvelle signature. Les doublons sont comptés
séparément pour qu'une nouvelle ligne identique n'hérite pas d'un ancien visa.
Une intervention déplacée ne conserve pas la signature de son ancienne cible.
Les envois RH existants restent verrouillés : leur annulation est nécessaire
avant une modification entraînant une revalidation.

`date-time.ts` adapte les bornes `timestamptz` en heure locale du navigateur au
format `YYYY-MM-DDTHH:mm`, puis écrit des instants ISO UTC explicites. Les dates
calendaires des jours fériés et les horodatages d'audit sont traités séparément.

Les types sont définis dans `src/app/types/` et accessibles via son `index.ts`.
L'inventaire complet est dans [le catalogue des types](../../../../docs/type-catalog.md).
Chaque module de persistance doit rester sous 500 lignes.

## Familles exceptionnelles

`exceptional_on_calls` contient les astreintes exceptionnelles et
`exceptional_works` les travaux supplémentaires. Le type métier provient de la
table, plus d'une colonne `operation_type`. `exceptional-tables.ts` centralise
le routage des écritures et des clés étrangères.

Chaque famille possède ses tables `exceptional_on_call_*` / `exceptional_work_*`
de participants et visas. Seules les astreintes possèdent des interventions.
Les enfants ont une clé `operation_id`
vers leur seule table parente. Les visas ont une seule cible : `operation_id`,
`participant_id` ou, pour les astreintes uniquement, `intervention_id`, avec des clés étrangères propres à leur
famille. La table historique `visas` ne contient plus que les visas réguliers.

Toutes les tables ont leur propre séquence auto-incrémentée. Les IDs SQL existants
sont conservés ; les IDs Angular deviennent `astreinte:ID` et `travaux:ID` pour
éviter toute collision dans les entités NgRx et les listes combinées.
Le type d'une opération existante ne peut pas être changé implicitement par une
mise à jour ; une telle conversion demanderait une migration explicite des liens.

La première migration `20261010090000_split_exceptional_operations.sql` sépare les
parents ; la seconde `20261010093000_isolate_exceptional_families.sql` sépare les
enfants, visas et séquences, puis supprime les tables communes. Chaque migration
est transactionnelle et vérifie les copies. Les droits existants et verrous RH
sont conservés. Les écritures/lectures ciblées ne chargent pas l'autre famille ;
seule la liste combinée agrège les deux familles pour l'interface.
La troisième migration `20261010100000_remove_work_interventions.sql` retire la
table d'interventions de travaux et la cible correspondante des visas. Elle refuse
de s'exécuter tant que ces données ne sont pas vides, sans les supprimer.
Le repository refuse toute création d'intervention sur des travaux avant les
écritures ; le calcul RH utilise leurs participants réels.

Test SQL indépendant : `npm run test:db-exceptional-split`. Docker et le conteneur
local `supabase_db_astreintes` doivent être disponibles. `SUPABASE_TEST_CONTAINER`
permet de choisir un autre conteneur. Le test crée puis supprime uniquement une
base jetable ; il n'applique aucune migration à la base applicative.

Vérification : `npm run test:jest` et `npm run build`.
