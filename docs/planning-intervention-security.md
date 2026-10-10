# Droits sur le planning et les interventions

Le profil utilisateur (1) consulte le planning, sans modifier les dates,
l'affectation des astreintes régulières ni les participants et leurs dates
prévisionnelles/réelles dans les deux familles exceptionnelles. Il ne peut pas
supprimer ces objets parents. Il peut ajouter, modifier et supprimer uniquement
ses propres interventions sur une astreinte enregistrée, hors verrouillage RH.
Les travaux supplémentaires ne portent pas d'interventions.

Dans les deux familles exceptionnelles, un initiateur (2) ne voit que les opérations
dont il est initiateur ou participant prévisionnel/réel. Il modifie ou supprime
uniquement celles dont il est initiateur. Sur une opération à laquelle il participe
sans être initiateur, il a les mêmes droits qu'un utilisateur : lecture du planning
et gestion de ses interventions personnelles. Administrateurs et directeurs
conservent leurs droits. Les droits des astreintes régulières restent inchangés.

La création
reste réservée aux administrateurs, initiateurs et directeurs. Un profil non chargé n'accorde
aucun droit. Le propriétaire est déterminé par l'identifiant SQL de son profil
lié à la session Supabase, pas par son nom ou son email.

## Application et base

NgRx fournit les droits aux pages et modales. Les champs de planning en lecture
seule sont distincts du verrou RH, afin de conserver les interventions personnelles.
Les gestionnaires contrôlent aussi les appels directs, indépendamment des boutons.

La migration SQL ajoute des politiques restrictives sur les participants et
interventions : un UPDATE vérifie le propriétaire ancien ET nouveau. Un trigger
interdit toute modification des objets parents par le rôle utilisateur, en
autorisant leurs écritures sans changement nécessaires au workflow de visas.
Les anciennes politiques permissives ne contournent pas ces nouvelles restrictions.

Les interventions exceptionnelles gardent désormais leur identifiant SQL.
L'enregistrement cible uniquement les lignes modifiées ; les participants inchangés
et les interventions des autres agents ne sont plus reconstruits. La signature
d'un participant met à jour son visa sans recréer sa période.
Les écritures multi-tables restent des requêtes séparées, pas une transaction SQL.

## Déploiement

Après sauvegarde, appliquer avec un compte SQL d'administration :

1. `supabase/migrations/20261010190000_protect_user_roles.sql`
2. `supabase/migrations/20261010200000_restrict_operation_creation.sql`
3. `supabase/migrations/20261010210000_protect_planning_and_interventions.sql`
4. `supabase/migrations/20261010220000_scope_exceptional_initiator_writes.sql`
5. `supabase/migrations/20261010230000_allow_director_operation_creation.sql`

Puis déployer le client Angular correspondant. Les scripts sont réexécutables.
Les tests n'appliquent jamais de migration à la base distante.

## Vérification et périmètre

`npm run test:db-user-roles` vérifie les refus SQL et les interventions personnelles
dans une base jetable. Jest couvre les champs désactivés, les gestionnaires et les
écritures ciblées. L'administrateur conserve tous les droits.

Le cloisonnement complet des lectures et la protection spécifique des visas
(point F3 de l'audit) restent des travaux distincts. Cette migration ne prétend
pas résoudre l'intégralité des constats de l'audit.
