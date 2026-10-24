# Audit de sécurité — 10 octobre 2026

> Rapport historique : les références à `schema.sql` et aux migrations décrivent
> l’état audité. Pour l’installation actuelle, voir [les trois scripts SQL](database-schema.md).


> Rapport historique : les nouvelles migrations modifient ces conclusions. Consulter [la nouvelle analyse](security-reanalysis-2026-10-10.md) pour l'état actuel, notamment la protection des rôles désormais testée.

Audit ciblé des risques les plus élevés, réalisé avec Vibe Code Security Reviewer. Périmètre : client Angular/NgRx, repositories Supabase, schéma SQL versionné, configuration Auth, génération documentaire et passerelle Nginx. Inspection en lecture seule des permissions et politiques de la base Supabase locale ; aucune donnée personnelle consultée, aucune mutation ou exploitation effectuée.

## Conclusion et limites de validation

Le principal risque est une autorisation fondée uniquement sur la présence d'une session Supabase. Les politiques `USING (true)` et `WITH CHECK (true)` n'imposent ni propriétaire, ni rôle métier. Le client possède des restrictions métier, mais un appel direct à l'API les contourne.

La base locale active ne correspond pas au schéma versionné : elle contient uniquement `public.app_documents`, avec SELECT/INSERT/UPDATE/DELETE accordés à `authenticated` et quatre politiques inconditionnelles. Ce défaut de cloisonnement est confirmé dans son catalogue. Les tables relationnelles ne sont pas présentes localement. Le fichier `schema.sql` ne contient pas les GRANT : les scénarios relationnels ci-dessous sont confirmés statiquement et exploitables dès que les permissions API nécessaires au fonctionnement du client sont accordées. Les permissions, la configuration Auth et l'exposition réseau de production restent à vérifier. Aucun test d'attaque en production n'a été effectué.

| ID | Gravité | Confiance | Chemin affecté et impact | Preuve | Correction et vérification |
|---|---|---|---|---|---|
| F1 | Élevée ; critique si inscription publique sur le déploiement | Élevée pour les politiques ; exposition production non vérifiée | Accès transversal aux données et mutations : un compte ordinaire peut lire ou modifier les documents d'autres utilisateurs, les périodes, interventions et paramètres RH. | Catalogue local : `app_documents`, droits CRUD pour `authenticated`, politiques `true`. Schéma relationnel : politiques de lecture/mutation inconditionnelles, notamment `schema.sql:1389`, `1438`, `1599`, `1732`, `1753`. `supabase/config.toml:176,221,226` permet l'inscription sans confirmation ; `auth.ts:36` expose le signup. | Remplacer les politiques globales par des droits par opération et par cible, fondés sur `auth.uid()` et des rôles protégés. Pour une application interne, contrôler l'admission des comptes côté serveur. Vérifier qu'anon, compte non admis et utilisateur d'une autre équipe ne peuvent pas lire/modifier les données protégées. |
| F2 | Élevée | Élevée, statique ; sous réserve des GRANT relationnels | Élévation de privilèges et usurpation : un utilisateur peut modifier son rôle en `admin`/`director`, ou les profils et signatures d'autrui. | `schema.sql:236` stocke rôle et identité dans `app_users`; `1501,1697` autorise insert/update sans contrôle. `users.repository.ts:98` inclut `role` et `auth_user_id` dans le payload. Les droits directeur/admin sont évalués côté client, par exemple `validation-page.component.ts:140`. Aucune contrainte serveur du schéma ne protège ces colonnes. | Séparer le profil éditable des habilitations ; empêcher les écritures directes sur rôle/identité via les GRANT de colonnes et une procédure administrative autorisée. Politique de profil liée à `auth.uid()`. Tester qu'un utilisateur peut éditer son nom mais ne peut changer aucun rôle, identité ou profil tiers. |
| F3 | Élevée | Élevée, statique ; sous réserve des GRANT relationnels | Falsification des validations et modification après envoi RH : signatures directeur/agent falsifiables et verrou métier contournable. | `schema.sql:1592,1788` accepte tout insert/update de visa ; `visas.repository.ts:48` reçoit signataire, date, contenu et scope du client. Les contraintes `schema.sql:691` vérifient la forme, pas l'identité ou l'ordre des approvals. Les fonctions `schema.sql:170,187` autorisent un changement si `new.sent_to_rh_at` vaut NULL ; une mise à NULL de ce champ permet ensuite de modifier une période envoyée. | Faire valider la signature et l'envoi RH par une opération serveur : signataire déduit de la session, rôle et cible vérifiés, prérequis contrôlés, horodatage serveur. Interdire le déverrouillage direct ; prévoir une procédure de réouverture autorisée et tracée. Tester signature au nom d'un tiers, signature directeur avec rôle user, envoi incomplet, effacement de la date RH puis modification et suppression. |
| F4 | Élevée | Élevée pour le chemin de données ; attaque dépendante des permissions relationnelles et de CORS | Exfiltration RH lors d'un export Word : un compte ayant accès en écriture aux paramètres peut remplacer l'URL du générateur par un serveur qu'il contrôle. | `schema.sql:1739` permet l'update global de `rh_export_settings`; `rh-settings.repository.ts:98` persiste une URL libre. `rh-exports.component.ts:169` envoie le payload RH à cette URL via `generation-document-client.lib.ts:19`. Le JSON inclut noms et signatures (`rh-json-export.lib.ts:167,186`). Un serveur attaquant peut accepter le preflight CORS et recevoir le POST déclenché par la victime. | Protéger l'administration des paramètres côté serveur et imposer une liste d'origines HTTPS approuvées hors des données éditables. Idéalement utiliser un endpoint serveur fixe pour la génération. Tester que le changement vers une origine non approuvée est refusé et qu'aucun POST RH n'est émis vers cette origine. |

Ces constats partagent une cause commune (autorisation trop large), mais F2–F4 demandent également des protections propres aux colonnes sensibles, aux transitions métier et aux destinations d'export. Masquer les écrans ne résout aucun de ces scénarios.

## Priorités

1. Vérifier immédiatement les GRANT/politiques et l'admission des comptes sur le déploiement réel ; limiter l'accès si les politiques correspondent à celles examinées.
2. Livrer une migration de droits complète : profils, habilitations, équipes, périodes, interventions, visas et paramètres RH. Supprimer les anciennes politiques permissives : ajouter une politique restrictive à côté ne suffit pas lorsqu'elles se combinent par OR.
3. Déplacer signatures, envoi RH et réouverture dans des opérations serveur autorisées ; fixer les destinations de génération documentaire.
4. Exécuter des tests d'autorisation négatifs via l'API et comparer le schéma déployé au schéma versionné. Ne pas considérer les tests de composants comme preuve des droits SQL.

## Contrôles observés

RLS activée dans le schéma relationnel et sur la table locale ; authentification Supabase ; requêtes structurées via le SDK ; contraintes de cible et de cohérence des visas ; validations de certaines plages de dates ; filtrage des formats d'images de signatures. Ces contrôles ne compensent pas les politiques d'autorisation inconditionnelles.

Aucune clé privilégiée trouvée dans les fichiers applicatifs/configurations parcourus. La clé anon de développement dans le client est publique par conception. Ce contrôle ne couvre pas exhaustivement l'historique Git, les secrets du déploiement ni les bundles effectivement publiés.

Référence technique : [Supabase — Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security), pour l'articulation entre GRANT, politiques et tests allow/deny.

Contrôle des dépendances : `npm audit --omit=dev --json` exécuté pendant cet audit, résultat : zéro vulnérabilité signalée. Cela couvre les avis connus du registre pour les dépendances de production installées, pas les défauts applicatifs ci-dessus.
