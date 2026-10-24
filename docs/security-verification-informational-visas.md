# Vérification tenant compte des visas informatifs

> Rapport historique : les références à `schema.sql` et aux migrations décrivent
> l’état audité. Pour l’installation actuelle, voir [les trois scripts SQL](database-schema.md).


État examiné : commit `66ad023`. La règle métier donnée par l'utilisateur fait foi : l'image ou le dessin du visa est informatif et ne valide pas une fiche pour les RH. Cette vérification distingue donc le contenu graphique du statut applicatif, sans assimiler une signature affichée à une approbation RH réelle.

## Constat principal

Le visa (`signature_value`) ne participe pas aux calculs d'indemnisation. Sa modification relève de l'intégrité d'affichage, avec une gravité faible à modérée selon l'usage. La lecture des images tierces n'est pas automatiquement une vulnérabilité élevée : elle dépend des règles de confidentialité et des destinataires attendus.

En revanche, **le statut du visa influence toujours l'envoi applicatif aux RH** :

- `src/app/store/relational/visas.repository.ts:33` déduit `signed` de la présence de `signed_at`, indépendamment du visuel.
- `src/app/shared/visa-workflow.ts:18` et `:23` conditionnent la disponibilité pour les RH aux statuts signés des agents, de l'initiateur et du directeur.
- `src/app/pages/rh/rh-exports.component.ts:160` utilise ces règles pour activer l'envoi.
- `src/app/store/relational/visa-workflow.persistence.ts:29` et `:71` refuse côté navigateur un envoi ne respectant pas ces prérequis.
- `src/app/pages/rh/rh-controls.component.ts:354` et `:400` sélectionne les dossiers envoyés selon `sentToRhAt` ; cela ne prouve aucune validation finale par les RH.

La précédente réduction automatique de tous les risques de visas était donc trop générale. Le contenu graphique peut être purement informatif alors que le statut associé pilote un workflow. Il faut préciser si ces prérequis d'envoi sont réellement voulus ; s'ils ne le sont pas, leur retrait est un changement fonctionnel, pas une correction de signature graphique.

## Risques et corrections réévalués

| Sujet | Conclusion actuelle |
|---|---|
| Visuel falsifiable | Faible à modéré : information affichée modifiable, sans preuve d'effet sur la validation RH finale. |
| Statut de visa falsifiable | Modéré, confirmé statiquement : les droits globaux sur les trois tables de visas permettent encore de modifier `signed_at`, le signataire et le scope. Cela peut tromper les prérequis d'envoi affichés ou les invalider. Aucun effet sur la décision finale RH n'est affirmé. Si ces prérequis doivent être fiables, protéger les écritures du statut/signataire côté serveur indépendamment du visuel. |
| Coefficients RH | Ancien constat corrigé statiquement dans `schema.sql:1222` : politiques restrictives INSERT/UPDATE/DELETE réservées à l'admin sur les deux tables. Le test SQL de refus reste à exécuter sur le schéma courant. |
| Annulation d'envoi RH | `schema.sql:1237` protège désormais les transitions, créations déjà envoyées et suppressions de dossiers envoyés ; elles sont réservées à admin/director/rh. La réouverture par ces rôles est aussi explicitement présente dans l'interface (`unmarkSentToRh`) : elle ne doit plus être présentée comme un contournement interdit sans règle métier contraire. |
| Prérequis d'envoi côté serveur | Le trigger SQL vérifie le rôle autorisé, pas la chaîne de visas. Un rôle autorisé peut donc effectuer l'envoi directement par API sans les prérequis du navigateur. C'est un écart de contrôle uniquement si ces prérequis font partie de la règle métier voulue ; ce n'est pas une preuve de validation RH frauduleuse. |

Les protections ajoutées sont présentes dans le schéma initial ; aucune migration nouvelle correspondante n'apparaît dans `supabase/migrations`. Une base existante n'est pas protégée simplement parce que le fichier d'installation initiale a changé. Vérifier leur application réelle sans réexécuter un schéma initial sur des données existantes.

## Limites

Tests ciblés Jest : 3 suites, 32 tests réussis (`visa-workflow`, `visa-workflow.persistence`, `rh-controls.component`). Ils vérifient le workflow navigateur et les contrôles RH ; ils ne prouvent pas l'autorisation SQL.

`npm run test:db-tests` échoue avant tout contrôle SQL : conteneur `supabase_db_astreintes` absent. `docker ps` ne montre aucun conteneur actif. Aucun service n'a été lancé, aucune base existante modifiée. Les corrections nouvelles ne sont donc pas confirmées en exécution pendant cette vérification. Les anciennes probes documentent l'ancien état et ne doivent pas servir de résultat actuel.

Cette analyse vérifie les chemins d'envoi, de statut et de calcul dans le code. Elle ne vérifie pas le traitement humain des fiches ni les permissions de production. Aucun correctif applicatif effectué.
