# Règles de droits et de validation

Ce document constitue la référence unique des règles d'accès par profil dans
l'application Astreintes. Il regroupe les règles métier, leur mise en œuvre,
les migrations nécessaires et les limites actuelles des protections.

## 1. Profils et identités

| Profil | Valeur Angular | Rôle SQL |
|---|---:|---|
| Administrateur | 0 | `admin` |
| Utilisateur | 1 | `user` |
| Initiateur | 2 | `initiator` |
| Directeur | 3 | `director` |
| RH | 4 | `rh` |

Le profil **RH** est distinct du profil Directeur, mais possède exactement les
mêmes droits. Dans les règles ci-dessous, les autorisations du directeur
s'appliquent aussi au profil RH, y compris l'approbation directeur, les exports,
les contrôles et les paramètres. La gestion des rôles reste réservée à
l'administrateur. Le profil RH est proposé dans le choix de rôle des paramètres
et dans le champ Initiateur des opérations.

Le rôle de référence est celui du profil SQL `app_users` associé à la session
Supabase. Les métadonnées Auth modifiables par le client ne confèrent aucun droit.
Un profil absent ou en cours de chargement ne donne aucun droit privilégié.

L'identifiant SQL du profil sert à vérifier la participation et la qualité
d'initiateur d'une opération. Il est distinct de l'identifiant Supabase Auth.
Le nom ou l'email ne suffit pas à accorder un droit d'édition ou de signature.
Certains rapprochements historiques d'affichage utilisent encore l'email.

## 2. Synthèse des droits

| Fonction | Administrateur | Utilisateur | Initiateur | Directeur / RH |
|---|---|---|---|---|
| Créer une astreinte régulière | Oui | Non | Oui | Oui |
| Modifier ou supprimer le planning régulier | Oui | Non | Oui | Oui |
| Créer une astreinte exceptionnelle ou des travaux supplémentaires | Oui | Non | Oui | Oui |
| Voir les opérations exceptionnelles | Toutes | Celles auxquelles il participe | Celles qu'il initie ou auxquelles il participe | Toutes |
| Modifier ou supprimer une opération exceptionnelle | Toutes | Non | Celles dont il est initiateur | Toutes |
| Gérer les interventions d'une opération exceptionnelle | Toutes | Les siennes | Toutes sur ses opérations ; les siennes sur les autres | Toutes |
| Appliquer un visa | Toutes les lignes | Ses lignes | Ses lignes et les lignes participantes de ses opérations | Toutes les lignes |
| Appliquer l'approbation directeur | Oui | Non | Non | Oui |
| Retirer un visa | Tout visa | Son visa, sur une ligne autorisée | Son visa, sur une ligne autorisée | Son visa, sur une ligne autorisée |
| Exporter par opération ou par période | Oui | Non | Non | Oui |
| Choisir un utilisateur dans les contrôles RH | Oui | Non | Oui, avec périmètre restreint | Oui |
| Ouvrir les paramètres | Oui | Non | Oui | Oui |
| Attribuer des rôles ou supprimer des profils | Oui | Non | Non | Non |

Les droits ne dispensent jamais de respecter les validations métier,
les prérequis de visa ni le verrouillage après envoi aux RH.
L'accès aux paramètres ne confère pas l'administration des utilisateurs.

## 3. Création et choix de l'initiateur

Les administrateurs, initiateurs et directeurs peuvent créer des astreintes
régulières, des astreintes exceptionnelles et des travaux supplémentaires.
Le profil utilisateur ne peut pas créer ces objets.

Dans les formulaires d'opérations exceptionnelles, le champ **Initiateur** ne
propose que les profils administrateur, initiateur et directeur. La liste des
participants reste distincte : un profil utilisateur peut être participant.

Les boutons de création sont masqués pour les profils non autorisés.
L'ouverture du formulaire et sa sauvegarde contrôlent aussi les droits.
Les règles SQL de création s'appliquent aux trois tables parentes, même en
présence d'anciennes politiques permissives.

## 4. Planning et interventions

### 4.1. Astreintes exceptionnelles et travaux supplémentaires

Un utilisateur voit une opération s'il figure dans ses participants
prévisionnels ou réels. Être responsable, partager un email ou avoir un nom
identique ne constitue pas une participation.

Un initiateur voit une opération dans au moins l'un des cas suivants :

- Il est l'initiateur enregistré de l'opération.
- Il figure dans les participants prévisionnels.
- Il figure dans les participants réels.

Il peut modifier et supprimer uniquement les opérations dont il est initiateur.
Sur une opération à laquelle il participe sans être initiateur, il dispose des
mêmes droits qu'un utilisateur : consultation du planning et gestion de ses
propres interventions. Il ne peut pas modifier les participants, leurs dates,
les autres champs du planning ni les interventions des autres agents.

Administrateurs et directeurs voient toutes les opérations et disposent des
droits de création, modification et suppression, sous réserve du verrou RH.

Le droit d'édition repose sur l'initiateur enregistré, pas sur la valeur saisie
dans un formulaire. Modifier le champ Initiateur d'une opération étrangère
ne permet donc pas de s'en attribuer les droits.

### 4.2. Astreintes régulières

Le profil utilisateur consulte le planning régulier sans modifier les dates,
l'affectation ni supprimer les périodes. Il peut ajouter, modifier et supprimer
ses propres interventions sur une période enregistrée.

Administrateurs, initiateurs et directeurs conservent leurs droits d'édition
du planning régulier. La restriction par initiateur des opérations
exceptionnelles n'a pas été étendue à ce planning.

### 4.3. Règles métier communes

Une intervention est rattachée à une astreinte existante. Pour une astreinte
exceptionnelle, elle doit être comprise dans une période réelle du même agent.
Les travaux supplémentaires ne portent pas d'interventions.

Les participants peuvent avoir plusieurs périodes distinctes sur une même
opération. Les périodes d'un même agent ne doivent pas se recouvrir dans une
même zone prévisionnelle ou réelle. Les périodes par participant constituent
la référence métier ; les bornes globales servent à la liste et aux exports.

Le planning en lecture seule est distinct du verrou RH : un agent peut encore
renseigner une intervention personnelle si l'opération n'est pas verrouillée.

## 5. Validation et visas

### 5.1. Autorisation par ligne

Le droit de signer est indépendant de la visibilité d'une ligne dans une liste
ou dans le détail d'une opération. Le filtrage existant de la page de validation
est conservé ; les droits sont vérifiés sur chaque action.

| Profil | Lignes sur lesquelles il peut appliquer son visa |
|---|---|
| Administrateur | Toutes les lignes |
| Utilisateur | Les lignes associées à son identité applicative |
| Initiateur | Ses propres lignes et les lignes participantes des opérations qu'il a initiées |
| Directeur | Toutes les lignes |

Les lignes participantes comprennent le prévisionnel, le réel, les
interventions et leur action globale d'agent. Un initiateur ne peut pas signer
pour les participants d'une opération étrangère au seul motif qu'il la voit.
Les approbations directeur sont réservées aux administrateurs et directeurs.

### 5.2. Signataire et retrait

Un initiateur ou un directeur qui signe une ligne participante y applique sa
propre signature. Le visa conserve l'identité du signataire réel.

La substitution administrative historique est conservée : l'administrateur
peut signer au nom de la personne représentée par la ligne, avec son profil
de signature. Il peut retirer tout visa sur une opération non verrouillée.

Pour les autres profils, retirer un visa exige à la fois d'être autorisé à agir
sur la ligne et d'être le signataire du visa enregistré.

### 5.3. Prérequis et verrouillage

Un visa déjà signé ne peut pas être signé à nouveau directement. L'approbation
directeur exige les visas préalables prévus par le workflow.
La suppression ou l'invalidation d'un visa préalable révoque l'approbation
directeur dépendante. L'envoi RH exige que les validations nécessaires soient
complètes et cohérentes avec les données courantes.


Les chaînes de validation sont les suivantes :

- Astreinte régulière : visa de l'agent et visas de toutes les interventions,
  puis approbation directeur, puis envoi RH.
- Astreinte exceptionnelle ou travaux supplémentaires : visa global de
  l'initiateur, visas de tous les participants prévisionnels et réels et visas
  des interventions éventuelles, puis approbation directeur, puis envoi RH.

Les anciens champs de visa global prévisionnel/réel restent des alias de
compatibilité ; ils ne constituent pas des approbations supplémentaires.

Une signature globale d'agent vise aussi ses interventions associées afin
d'éviter une validation partielle invisible dans les exports.
Les contrôles restent appliqués aux appels directs des méthodes, même si un
bouton est masqué ou désactivé.

## 6. Exports RH

Les exports **par opération** et **par période** sont accessibles uniquement
aux administrateurs et directeurs. Cela couvre les exports Excel par
opération ainsi que l'export Excel par période.

Les deux rubriques sont masquées aux utilisateurs et initiateurs. Leur ouverture
directe et les actions de génération sont également refusées. Le marquage et
l'annulation d'envoi RH dans ces écrans sont réservés aux mêmes profils.
L'envoi reste soumis aux prérequis de validation. En base SQL, les transitions
d'envoi et d'annulation sont réservées aux administrateurs, directeurs et profils
RH ; elles sont refusées aux initiateurs, même propriétaires, et aux utilisateurs.
La création d'un dossier déjà envoyé et la suppression d'un dossier envoyé
suivent la même règle, pour éviter une annulation par suppression puis recréation. Les modifications
sans changement du statut RH conservent les droits de planning existants.

Les coefficients RH restent lisibles pour les calculs. Leur création, modification
et suppression sont réservées aux administrateurs par les politiques SQL.

Une révocation de droits ferme la rubrique d'export ouverte. Les droits sont
revérifiés avant le téléchargement d'un document généré de façon asynchrone.
Le fait de pouvoir consulter les contrôles ne confère aucun droit d'export.

## 7. Contrôle par utilisateur et mois

### 7.1. Sélecteur d'utilisateur

La page comporte un sélecteur PrimeNG **Utilisateur**, présentant le nom et
l'email. Il est disponible pour les administrateurs, initiateurs et directeurs.
Le profil utilisateur consulte ses propres contrôles sans sélecteur.

La sélection initiale privilégie le profil connecté. Une autre sélection
reconstruit les contrôles mensuels de la personne choisie, ferme le détail
précédent et réinitialise les panneaux ouverts. Une personne sans éléments RH
reste sélectionnable et dispose d'une vue vide.

### 7.2. Périmètre de l'initiateur

Choisir un autre utilisateur n'élargit pas les droits de l'initiateur.
Pour les astreintes exceptionnelles et travaux supplémentaires, seules sont
retenues les opérations qu'il a initiées ou auxquelles il participe en
prévisionnel ou en réel. Cette vérification porte sur le profil connecté,
indépendamment de l'utilisateur choisi dans le sélecteur.

Parmi ces opérations, le contrôle isole les périodes et interventions de la
personne sélectionnée. Une opération initiée ou participée n'est donc pas
nécessairement affichée si elle ne produit aucun élément pour cette personne.

Les astreintes régulières ne portent pas d'initiateur enregistré : dans les
contrôles, le profil initiateur ne voit que ses propres périodes régulières.
Cette limitation du contrôle RH ne modifie pas ses droits d'édition du calendrier.

Administrateurs et directeurs peuvent contrôler les différents utilisateurs
sans cette restriction par opération. Un détail devenu inaccessible après une
mise à jour est fermé.

### 7.3. Regroupement et calculs

Les contrôles portent sur les opérations envoyées aux RH et regroupent les
éléments par mois d'envoi RH, pas par mois d'exécution. Les règles de calcul et
les bibliothèques sont partagées avec les exports afin de conserver une
interprétation commune des indemnités.

## 8. Profils et administration des comptes

| Action | Administrateur | Autres profils |
|---|---|---|
| Modifier nom et signature | Tous les profils | Son propre profil |
| Attribuer un rôle | Autorisé | Interdit |
| Changer l'identité Auth | Autorisé, sous contraintes SQL | Interdit |
| Enregistrer un profil à la connexion | Autorisé | Son compte Auth uniquement |
| Modifier l'email | Autorisé | Email courant de son compte Supabase Auth uniquement |
| Supprimer un profil applicatif | Autorisé | Interdit |

Un nouveau profil reçoit le rôle utilisateur. Aucun premier inscrit n'est promu
automatiquement administrateur. La sauvegarde du nom ou de la signature ne
réécrit pas un rôle précédemment chargé : le client transmet les seuls champs
modifiés.

L'accès anonyme aux profils est interdit. Supprimer un profil applicatif ne
supprime pas son compte Supabase Auth. Une future connexion peut recréer un
profil utilisateur, sans restaurer son ancien rôle.

## 9. Mise en œuvre et limites actuelles

### 9.1. Application Angular

NgRx centralise les données et les droits partagés. PrimeNG fournit les
composants d'interaction. Les boutons, formulaires, modales et gestionnaires
d'action utilisent les contrôles de droits correspondant à leur périmètre.

Les listes d'opérations sont filtrées dans l'application. Les droits de visa,
d'export et le périmètre des contrôles RH sont vérifiés dans les composants
Angular ; ces règles ne constituent pas à elles seules un cloisonnement SQL.

### 9.2. Protections SQL préparées

Les migrations protègent les profils et rôles, la création des objets parents,
le planning et les interventions. Les règles restrictives se combinent avec les
anciennes politiques permissives. Les mises à jour contrôlent les anciennes et
nouvelles identités lorsque nécessaire.

Un trigger refuse les changements de planning par un profil non autorisé tout
en permettant les écritures sans changement nécessaires au workflow existant.
Les restrictions exceptionnelles reposent sur l'initiateur enregistré.

Les participants et interventions inchangés ne sont pas reconstruits lors d'une
signature ou d'une modification d'intervention. Les interventions conservent
leur identifiant SQL. Un visa participant modifie sa cible existante sans
recréer sa période.

Les écritures sur plusieurs tables restent des requêtes séparées et ne forment
pas une transaction SQL unique.

### 9.3. Travaux distincts

Le cloisonnement complet des lectures SQL, la protection spécifique des visas
et des signatures de profil, ainsi que l'autorisation du service externe de
génération documentaire restent à traiter séparément. La lecture des profils
est encore disponible aux comptes authentifiés pour les jointures d'affichage.

Ce document ne clôture pas tous les constats du
[rapport d'audit](security-audit-2026-10-10.md).
Les comptes SQL de maintenance et `service_role` restent privilégiés ; leurs
identifiants ne doivent jamais être exposés au navigateur.

## 10. Déploiement

Les migrations présentes dans le dépôt ne prouvent pas leur application à une
base distante. Les tests de droits utilisent une base jetable et ne déploient
aucune modification en production.

Avant application, sauvegarder la base et vérifier les administrateurs actuels :

```sql
SELECT id, auth_user_id, email, role
FROM public.app_users
WHERE role = 'admin';
```

S'il n'existe aucun administrateur, attribuer ce rôle à un compte explicitement
identifié depuis une session SQL d'administration de confiance. Vérifier aussi
les habilitations des administrateurs déjà présents.

Sur le schéma relationnel correspondant à l'application, appliquer dans l'ordre :

1. `supabase/migrations/20261010190000_protect_user_roles.sql`
2. `supabase/migrations/20261010200000_restrict_operation_creation.sql`
3. `supabase/migrations/20261010210000_protect_planning_and_interventions.sql`
4. `supabase/migrations/20261010220000_scope_exceptional_initiator_writes.sql`
5. `supabase/migrations/20261010230000_allow_director_operation_creation.sql`
6. `supabase/migrations/20261010231000_add_rh_role.sql`
7. `supabase/migrations/20261010232000_grant_rh_director_permissions.sql`
8. `supabase/migrations/20261010233000_protect_compensation_and_rh_send.sql`

L'ajout de la valeur d'énumération `rh` doit être validé avant la migration
qui l'utilise : exécuter les deux dernières migrations séparément, sans les
englober dans une transaction commune. Les comptes existants gardent leur rôle ;
seul un administrateur peut attribuer le nouveau profil RH.

Utiliser le SQL Editor ou `psql` avec un compte d'administration de confiance.
Les scripts sont transactionnels et réexécutables. La première migration
remplace les anciennes politiques de `app_users`.
Déployer ensuite le client Angular correspondant et vérifier les cinq profils.

## 11. Vérification

```bash
npm run test:db-user-roles
npm run test:jest
npm run build
```

Le test SQL nécessite Docker et le conteneur Supabase local
`supabase_db_astreintes`. La variable `SUPABASE_TEST_CONTAINER` permet de choisir
un autre conteneur. Il crée une base temporaire distincte, applique les migrations
à deux reprises et vérifie les refus ainsi que les usages autorisés. Il supprime
uniquement la base temporaire créée, jamais la base applicative.

Les tests Jest couvrent notamment les profils absents, les matrices de rôles et la parité Directeur/RH,
les boutons, les appels directs, les visas, les restrictions par opération,
les exports, le sélecteur des contrôles et la fermeture des détails devenus
inaccessibles. La compilation vérifie la cohérence TypeScript et des templates.

Pour une recette métier, vérifier successivement :

1. La création et la consultation des opérations avec chaque profil.
2. L'édition d'une opération propre, participée et étrangère pour un initiateur.
3. Les signatures propres, déléguées et interdites dans la validation.
4. Le retrait des visas, leurs dépendances et le verrouillage RH.
5. L'accès aux deux rubriques d'export.
6. Le changement d'utilisateur dans les contrôles, notamment pour un initiateur.
7. La modification des rôles et la révocation des droits sur une page ouverte.
