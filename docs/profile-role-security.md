# Protection des profils et des rôles

Cette première étape corrige les écritures sur `app_users` (F2 de l'audit).
Elle ne corrige pas encore les permissions sur les opérations, les visas ou les
paramètres RH. La lecture des profils reste disponible aux comptes authentifiés
pour préserver les jointures du calendrier et des visas ; son cloisonnement,
notamment celui des signatures, reste à traiter avec l'accès aux opérations.

## Droits

| Action | Administrateur | Utilisateur / initiateur / directeur |
|---|---|---|
| Modifier nom et signature | Tous les profils | Son propre profil |
| Attribuer un rôle | Tous les profils | Interdit |
| Changer l'identité Auth | Tous les profils, sous contraintes SQL | Interdit |
| Enregistrer un profil à la connexion | Autorisé | Son compte Auth, rôle utilisateur à la création |
| Modifier l'email | Autorisé | Seulement l'email courant du compte Supabase Auth |
| Supprimer un profil applicatif | Autorisé | Interdit |
| Accès anonyme aux profils | Sans objet | Interdit |

Le rôle est lu dans `app_users`, jamais dans les métadonnées Auth modifiables
par le client. Les politiques RLS limitent les lignes modifiables et un trigger
protège le rôle et l'identité. Le client n'envoie que les champs modifiés :
une sauvegarde du nom ne réécrit pas un ancien rôle chargé avant une décision
administrative. Les contrôles d'interface ne sont qu'une aide ergonomique.

## Déploiement

1. Sauvegarder la base et vérifier les administrateurs actuels :

   ```sql
   SELECT id, auth_user_id, email, role FROM public.app_users WHERE role = 'admin';
   ```

2. S'il n'y a aucun administrateur, attribuer ce rôle à un compte explicitement
   identifié depuis une session SQL d'administration de confiance. Aucun premier
   inscrit n'est automatiquement promu. Les administrateurs déjà présents sont
   conservés ; vérifier leurs habilitations avant d'appliquer la migration.
3. Exécuter `supabase/migrations/20261010190000_protect_user_roles.sql` avec le
   SQL Editor ou `psql` en administrateur sur le serveur concerné. Le script est
   transactionnel et réexécutable ; il remplace toutes les anciennes politiques
   de `app_users`. Les droits des autres tables ne sont pas modifiés.
4. Déployer le client et vérifier les comptes administrateur et non administrateur.

Les comptes SQL de maintenance et `service_role` restent privilégiés. Ne jamais
exposer leurs identifiants au navigateur. Supprimer un profil applicatif ne
supprime pas le compte Supabase Auth : une future connexion peut recréer un
profil utilisateur, sans rétablir son ancien rôle.

## Tests

```bash
npm run test:db-user-roles
npm run test:jest
npm run build
```

Le test SQL nécessite Docker et le conteneur Supabase local
`supabase_db_astreintes` (`SUPABASE_TEST_CONTAINER` permet de changer son nom).
Il crée une base temporaire distincte, reproduit l'ancienne élévation de rôle,
applique deux fois la migration puis teste les refus et les usages légitimes.
Il supprime uniquement la base qu'il vient de créer, jamais la base applicative.
Ces tests ne prouvent pas que la migration est appliquée en production.
