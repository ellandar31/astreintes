# Droits de création du planning

Les créations d'astreintes régulières, d'astreintes exceptionnelles et de travaux
supplémentaires sont réservées aux administrateurs, initiateurs et directeurs.
Le profil utilisateur ne peut pas créer ces objets. Les profils absents ou
en cours de chargement n'obtiennent aucun droit de création.

Les contrôles Angular masquent les boutons et refusent l'ouverture ainsi que la
sauvegarde d'un nouveau formulaire. Les droits NgRx sont chargés dès la session,
indépendamment du module visible. Une politique SQL restrictive bloque aussi les
INSERT directs, même lorsque d'anciennes politiques permissives sont présentes.

Cette migration concerne uniquement la création des objets parents. Elle conserve
les traitements existants d'ajout d'interventions sur une astreinte enregistrée,
y compris leurs contraintes métier et le verrou d'envoi RH. Elle ne constitue pas
encore le cloisonnement complet des lectures, mises à jour, participants et visas.

## Déploiement

Après sauvegarde et vérification des comptes administrateurs, appliquer dans l'ordre :

1. `supabase/migrations/20261010190000_protect_user_roles.sql`
2. `supabase/migrations/20261010200000_restrict_operation_creation.sql`
3. `supabase/migrations/20261010230000_allow_director_operation_creation.sql`

Les scripts doivent être exécutés avec un compte SQL d'administration de confiance
sur la base relationnelle concernée. Ils sont transactionnels et réexécutables.
Déployer ensuite le client Angular. Aucun script n'est automatiquement appliqué
à la base distante par les tests.

## Vérification

`npm run test:db-user-roles` teste les migrations de droits dans une base jetable du
conteneur Supabase local. Il vérifie le refus des créations pour les profils
non autorisés, leur acceptation pour les profils autorisés et le maintien des
INSERT d'interventions sur des astreintes existantes. Les tests Jest couvrent les
boutons, les appels directs aux composants et la surveillance des droits à la connexion.
