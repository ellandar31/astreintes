# Astreintes — guide orateur RSSI

45 minutes : 38 minutes de présentation et 7 minutes de discussion. Les trois annexes ne sont pas chronométrées.

Source : C:\Users\ellan\workspace\astreintes, commit `bad21eb82c6ca3224803dbe54766a25da0df0320`. État observé le 10 octobre 2026. Prototype / pilote, production à préparer. Revue statique ciblée : 44 fichiers intégralement audités sur 224 versionnés, autres consommateurs vérifiés par extraits. Pas de test SQL/HTTP ou de vérification de production pendant cette revue. Aucun code applicatif modifié.

## 1. Sécurité du projet
Astreintes

Durée : 1 min.

Présenter Astreintes comme un prototype ou pilote dont la production reste à préparer. L'objectif de cette réunion est de décider du niveau de protection attendu et des preuves nécessaires avant d'utiliser des données réelles. Le support distingue quatre défauts étayés dans le code, des mesures déjà présentes et des questions d'exploitation. Les anciens audits du dépôt concernent plusieurs états successifs. La présente revue s'appuie sur l'état courant et ne reprend pas leurs niveaux de gravité automatiquement. La présentation dure 38 minutes, suivies de 7 minutes de discussion. Les annexes apportent les références et les tests attendus.

Sources :

- Contexte fourni par le porteur du projet : prototype/pilote, 45 minutes
- README.md:3-13
- Révision source : bad21eb82c6ca3224803dbe54766a25da0df0320

## 2. Décision attendue des RSSI

Durée : 2 min.

La recommandation est de conditionner le passage en production à des résultats observables. Ce n'est pas une décision d'homologation déjà prise. Le RSSI et le responsable métier doivent déterminer les conditions d'un pilote, l'audience des données et l'autorité qui acceptera les risques résiduels. Les corrections d'accès SQL sont prioritaires car un bouton masqué ne protège pas une API. L'admission et l'exploitation doivent être définies avant de rendre l'application accessible. Proposer des données fictives pendant les travaux permet de poursuivre la recette fonctionnelle. Aucune exposition Internet réelle, ni configuration de production, n'a été fournie ou vérifiée. Demander qui porte la décision et qui fournit les preuves techniques.

Sources :

- schema.sql:967-975
- docs/access-rules.md, sections 9 et 10
- Contexte utilisateur : production à préparer

## 3. Périmètre et niveau de preuve

Durée : 1 min.

La cible est C:\Users\ellan\workspace\astreintes, commit bad21eb82c6ca3224803dbe54766a25da0df0320. L'arbre était propre au début de la revue. Un baseline indépendant, une revue d'architecture et une investigation de configuration ont complété la validation des constats par le parent. La couverture reste partielle : 44 fichiers ont été intégralement examinés pour la sécurité, des extraits de consommateurs supplémentaires ont été vérifiés et 180 fichiers n'ont pas été intégralement audités. Aucun test SQL, HTTP, démarrage de service, scan de réseau ou contact avec la production n'a été exécuté. Les comptes et secrets déployés, l'historique Git et les dépendances installées ne sont pas exhaustivement audités. Les anciens résultats d'audit et de tests ne prouvent pas l'état de ce déploiement futur.

Sources :

- Rapport Codex Security, scan 9e15c02b-6161-4ac4-8a80-9ea039621f37
- scope et coverage.json du scan courant

## 4. Données et impacts métier

Durée : 1 min.

Le projet gère les astreintes, interventions et travaux supplémentaires, puis prépare des calculs et fichiers RH. Le code ne démontre pas un paiement automatique ni une décision humaine finale de validation RH. Il faut donc relier chaque risque à son impact concret : accès à des commentaires ou dates d'activité, modification des heures calculées, fiabilité du statut d'approbation, perte de disponibilité pendant la planification. Les signatures stockées sont des visuels et des métadonnées applicatives. Aucun mécanisme de signature cryptographique n'a été établi. La sensibilité exacte des commentaires et la liste des destinataires autorisés doivent être définies par le responsable métier, avec le DPO pour les questions relatives aux données personnelles.

Sources :

- README.md:3-13
- schema.sql:185-194,223-246,414-427
- src/app/pages/rh/export-libraries/rh-period-excel-export.lib.ts:49-73

## 5. Architecture et flux réels

Durée : 2 min.

Suivre un exemple simple : l'agent s'authentifie auprès de Supabase, Angular reçoit sa session, les repositories appellent PostgREST, PostgreSQL applique ses droits et politiques, puis NgRx met à jour l'écran. Il n'existe pas dans les sources inspectées de serveur métier intermédiaire centralisant toutes les autorisations. En Docker, le navigateur peut utiliser la même origine et le préfixe /supabase. Nginx relaie alors l'appel vers un service Supabase séparé. Le compose applicatif ne contient pas ce service. Realtime provoque des rechargements par le même client. Les exports Excel sont générés sur le poste. L'architecture est compatible avec un accès direct sécurisé si les droits de chaque table et les opérations sensibles sont correctement définis.

Sources :

- src/app/store/app-store.ts:10-29
- src/app/store/relational/domain-observer.ts:18-43
- nginx.conf:22-33
- Dockerfile:15-30
- compose.yaml:4-12

## 6. Frontières de confiance

Durée : 1 min.

Le contrôle à évaluer est celui qui s'applique à la requête réellement reçue, pas celui qui guide l'utilisateur dans le parcours normal. Un utilisateur connecté possède déjà un jeton lui permettant d'appeler l'API. Il peut utiliser son navigateur ou un client HTTP sans être administrateur. La gateway ne rajoute pas une autorisation métier. Auth répond à la question de l'identité, tandis que les GRANT et politiques déterminent les opérations et lignes accessibles. Une restriction permissive vraie peut coexister avec une restriction AS RESTRICTIVE sur les écritures : cette coexistence ne prouve pas un contournement, car les restrictions doivent également être satisfaites. Nous avons donc examiné les règles finales par opération.

Sources :

- schema.sql:967-975,1098,1159-1163
- https://supabase.com/docs/guides/database/postgres/row-level-security

## 7. Rôles métier et séparation des fonctions

Durée : 2 min.

La matrice synthétise docs/access-rules.md et les contrôles existants. Directeur et RH sont deux rôles différents, mais ont les mêmes habilitations dans le code. Cette parité inclut des fonctions de planning et d'approbation, pas seulement la consultation RH. Il faut décider si cette séparation est suffisante pour l'organisation cible. L'administrateur conserve une exception de substitution de visa au nom d'un tiers documentée. Une correction des visas doit préserver cette exception uniquement si elle est acceptée, autorisée et tracée. Les profils absents ou non chargés ne confèrent pas de droits privilégiés dans les sélecteurs inspectés. Ne pas confondre le rôle SQL de transport authenticated avec les rôles métier stockés dans app_users.

Sources :

- docs/access-rules.md, sections 1, 2, 5 et 8
- src/app/shared/user-role-permissions.ts:1-4
- src/app/state/settings/settings.selectors.ts:10-44,56-59
- schema.sql:986-995,1019-1082

## 8. Mesures déjà présentes

Durée : 1 min.

Le projet ne part pas de zéro. Le trigger de profil empêche un utilisateur de se promouvoir ou d'usurper son identité. Les politiques restrictives limitent la création de planning, l'édition des opérations et interventions, les coefficients RH et les transitions d'envoi. Nginx utilise un utilisateur non root à l'exécution. npm ci --ignore-scripts et le lockfile limitent les écarts d'installation. La CI lance un audit npm. Des scripts de tests SQL créent des bases isolées et vérifient des refus. Ces contrôles sont établis dans les sources, sans résultat d'exécution nouvellement produit ici. La clé anon de repli identifiée dans le frontend est publique et locale. Cela ne certifie pas la nature de la clé injectée dans un futur déploiement.

Sources :

- schema.sql:1037-1082,1117-1268
- Dockerfile:7,26-29
- .github/workflows/ci.yml:9-32
- package.json, scripts test:db-tests et test:all
- src/app/store/supabase.config.ts:58-65

## 9. Quatre constats à traiter avant production

Durée : 2 min.

Les quatre constats ont des causes et des corrections distinctes. Ils supposent un compte authentifié, une API accessible à ce compte et le schéma inspecté installé. La qualification modérée tient compte du contexte pilote, du compte requis, des contrôles existants et de l'absence de preuve de paiement automatique ou de validation finale RH frauduleuse. La confiance élevée concerne la lecture des contrôles et des chemins dans le code. Elle ne représente pas une reproduction HTTP ou une confirmation en production. La priorité de traitement peut être élevée pour le projet même si la gravité technique reste modérée : ces défauts touchent les propriétés fondamentales à démontrer avant l'usage de données réelles. Les anciens audits du dépôt ne doivent pas être combinés avec ce tableau comme s'ils portaient sur le même état.

Sources :

- Rapport Codex Security courant, quatre constats de gravité medium
- schema.sql:967-975,1075,1159-1163,1203-1217

## 10. R1 · Lectures hors périmètre métier

Durée : 2 min.

Les règles métier limitent la visibilité des opérations exceptionnelles pour utilisateurs et initiateurs. Cependant la politique authenticated_access autorise SELECT sans cette restriction, et le repository charge toutes les opérations d'une famille. Les enfants et visas reçoivent la même politique de base. Les images et dessins de signatures de profils sont aussi accessibles aux authentifiés via profiles_read et les lectures de profils. Le besoin d'un annuaire partagé ne suffit pas à décider de l'audience des signatures. Ne pas présenter le planning régulier partagé comme un défaut si sa consultation globale est voulue. Le test de recette doit utiliser deux opérations étrangères et plusieurs rôles, puis appeler l'API directement pour les parents et chaque collection enfant. Une vue annuaire doit respecter les droits de sa table source et ne pas devenir un contournement de RLS.

Sources :

- docs/access-rules.md, sections 2 et 4.1
- schema.sql:967-975,1075
- src/app/store/relational/exceptional.repository.ts:33-36
- src/app/store/relational/users.repository.ts:43-57
- https://supabase.com/docs/guides/database/postgres/row-level-security

## 11. R2 · Statuts et attribution des visas

Durée : 3 min.

Le code transforme signed_at non nul en signed=true. Ce booléen alimente la disponibilité de l'approbation directeur et de l'envoi RH dans le navigateur. Les trois tables concernées sont visas, exceptional_on_call_visas et exceptional_work_visas. Elles reçoivent CRUD sans restriction spécifique de rôle, cible ou signataire. Un compte peut donc modifier l'attribution et le statut hors du parcours UI. Les contraintes FK et de forme vérifient une structure cohérente, pas le droit de signer. La portée reste précisément celle du workflow applicatif : une image ou un dessin informatif n'est pas une preuve de décision finale RH, et aucun mécanisme de signature cryptographique n'a été établi. Prévoir une fonction transactionnelle qui dérive l'identité et l'heure, autorise le scope et les retraits, contrôle le dossier, puis journalise. L'exception administrative doit être explicitement conservée ou retirée après décision métier.

Sources :

- schema.sql:414-427,903-918,943-957,967-975
- src/app/store/relational/visas.repository.ts:29-35,43-67
- src/app/shared/visa-workflow.ts:4-25
- docs/security-verification-informational-visas.md
- docs/access-rules.md, section 5.2

## 12. R3 · Intégrité après envoi RH

Durée : 3 min.

Prendre l'exemple d'une intervention personnelle de durée valide : après l'envoi RH, l'agent appelle directement l'API et change cette durée dans la période permise. La politique propriétaire reste satisfaite. Les triggers de rattachement et de dates ne vérifient pas l'état envoyé du parent. Il peut également supprimer la ligne. Pour les participants exceptionnels, l'initiateur conserve des écritures sans verrou parent. Les triggers de verrou après envoi portent sur les parents, et guard_rh_send_transition protège le changement de statut, pas la mutation enfant. Les données rechargées et les calculs peuvent alors diverger de ce qui a été examiné avant envoi. La réouverture par admin/director/rh est une action prévue dans l'interface et en SQL : elle n'est pas présentée comme une attaque. La correction doit verrouiller le parent en transaction, couvrir les anciennes et nouvelles cibles lors des déplacements et tester les courses avec l'envoi RH.

Sources :

- schema.sql:572,579,586,593,882-898
- schema.sql:1159-1163,1203-1217,1237-1268
- src/app/store/relational/visa-workflow.persistence.ts:39-51
- src/app/pages/rh/rh-exports.component.ts:172-178,257-274

## 13. R4 · Paramètres calendaires communs

Durée : 2 min.

La correction des coefficients RH ne couvre pas tous les paramètres qui influencent l'application. public_holidays reçoit les droits généraux, alors que l'écran le réserve à l'administrateur. Le calcul détecte les jours fériés à partir des données chargées. L'attaquant peut donc modifier cette classification sans changer un coefficient. schedule_rules reste aussi sous politique large, même si son effet exact sur tous les calculs n'est pas établi dans cette revue. Les équipes et leurs membres nécessitent la même revue de matrice, car certains droits d'encadrement sont voulus, mais le profil utilisateur n'ouvre pas les paramètres. La correction doit être définie par table et par opération, puis validée avec des cas positifs et négatifs. Garder les lectures nécessaires aux calculs et ne pas retirer arbitrairement les fonctions métier existantes.

Sources :

- schema.sql:259-268,372-379,967-975,1222-1232
- src/app/pages/settings/settings-page.component.ts:42
- src/app/store/relational/holidays.repository.ts:26-39
- src/app/store/relational/schedule.repository.ts:71-82
- src/app/pages/rh/export-libraries/rh-export-calculations.ts:299-304

## 14. Chaîne RH et cohérence transactionnelle

Durée : 1 min.

Ce point complète les constats de visas et de verrou sans inventer un cinquième incident indépendant. Un rôle admin/director/rh peut modifier sent_to_rh_at directement alors que le navigateur exigerait les visas. docs/access-rules.md décrit ces prérequis comme une règle attendue : ils doivent donc être imposés au même niveau que les écritures. Les requêtes de sauvegarde des agrégats sont séparées; la sérialisation dans une instance de navigateur ne fournit pas de transaction entre plusieurs clients. Une fonction SQL doit relire et verrouiller la cible, vérifier la chaîne sur les données actuelles, effectuer la transition et produire une trace dans la même transaction. Prévoir une version de dossier ou un instantané si le métier a besoin de retrouver exactement les heures et règles utilisées lors d'un export.

Sources :

- src/app/shared/visa-workflow.ts:4-25
- src/app/store/relational/visa-workflow.persistence.ts:19-34,57-90
- schema.sql:1237-1268
- docs/access-rules.md, sections 5.3 et 9.2

## 15. Admission, sessions et départs

Durée : 2 min.

Les réglages locaux autorisent l'inscription par email sans confirmation et un minimum de six caractères. Les facteurs MFA TOTP/téléphone sont désactivés dans cette configuration. Ces valeurs ne sont pas attribuées à un service de production inconnu. L'organisation doit choisir une admission par invitation ou par fournisseur d'identité autorisé, puis une politique de session et de MFA. Un compte authentifié non admis ne doit pas recevoir de données métier. Supprimer un profil applicatif ne supprime pas le compte Supabase Auth; une nouvelle connexion peut recréer un profil utilisateur. Le départ doit donc traiter l'identité Auth, les sessions et le profil, avec preuve de révocation. Supabase distingue l'ajout d'un facteur et l'application de l'exigence MFA aux ressources : activer une possibilité d'enrôlement ne suffit pas à protéger les actions privilégiées.

Sources :

- supabase/config.toml:176-185,221-226,303-309
- src/app/store/app-store.ts:10-16
- src/app/store/relational/auth.ts:29-62
- docs/access-rules.md, section 8
- https://supabase.com/docs/guides/auth/auth-mfa

## 16. Exposition réseau et navigateur

Durée : 2 min.

La documentation envisage Tailscale Funnel pour HTTPS public. Le serveur Nginx écoute sur HTTP 8080 et compose publie 8180 sans adresse de liaison restreinte. La cible interne par défaut est http://host.docker.internal:8000. Ces valeurs nécessitent une revue du déploiement choisi : réseau de confiance, ports atteignables, chiffrement externe et éventuellement interne. Le bloc gateway relaie tous les suffixes, mais cela ne prouve pas que Studio ou un service administratif se trouve derrière cet upstream. Il faut inventorier les routes effectives, puis limiter celles dont l'application a besoin. nginx.conf ne déclare pas de CSP, frame-ancestors ou Referrer-Policy. Une infrastructure amont peut en ajouter, à vérifier. L'absence d'en-têtes ne démontre pas une XSS. Contrôler aussi les données de protocole transmises au service après terminaison TLS et tester les WebSockets nécessaires à Realtime.

Sources :

- nginx.conf:2,22-33
- compose.yaml:6,11-12
- README.md, déploiement Portainer et Tailscale Funnel
- index.html

## 17. Données personnelles et copies exportées

Durée : 1 min.

Les exports sont générés côté navigateur. Le code d'un bouton peut vérifier le rôle, mais un utilisateur disposant des données brutes peut conserver une copie par un autre moyen. Le cloisonnement des lectures est donc la première limite de confidentialité. La CNIL fournit un guide de sécurité couvrant notamment authentification, habilitations, traçabilité et sauvegardes. Ce support ne prononce pas de conformité RGPD ni de qualification biométrique des signatures. Le DPO et le métier doivent définir les finalités, données nécessaires, durées de conservation et destinataires. L'exploitation doit identifier le lieu d'hébergement, les prestataires, les conditions de copie et les protections des postes. Prévoir une procédure de suppression et le traitement des exports, sauvegardes et journaux sans fixer ici de durée légale inventée.

Sources :

- src/app/pages/rh/rh-exports.component.ts:371-386
- src/app/pages/rh/export-libraries/rh-period-excel-export.lib.ts:49-73
- schema.sql:185-194,1075
- https://www.cnil.fr/fr/guide-de-la-securite-des-donnees-personnelles

## 18. Traçabilité et réponse à incident

Durée : 1 min.

Des timestamps de modification existent, mais le schéma inspecté n'établit pas un journal métier immuable retraçant chaque acteur et transition. On ne peut pas conclure que les services externes ne produisent aucun log : leur configuration n'a pas été vérifiée. Le besoin est de démontrer une traçabilité adaptée à la question 'qui a changé quelles heures ou quelle habilitation ?'. Une table d'événements alimentée côté serveur est une possibilité. Elle doit être protégée contre les modifications par l'utilisateur à l'origine de l'action. Les traces ne devraient pas recopier les images de signature, secrets ou commentaires complets sans nécessité. Définir qui consulte les journaux, qui reçoit les alertes et comment suspendre un compte puis conserver les éléments utiles. La durée de conservation est à décider selon le besoin et les règles de l'organisation.

Sources :

- schema.sql, fonctions set_updated_at et triggers associés
- schema.sql:1237-1268
- https://www.cnil.fr/fr/guide-de-la-securite-des-donnees-personnelles

## 19. Disponibilité et restauration

Durée : 1 min.

Le dépôt demande une sauvegarde/restauration validée avant production, mais aucun résultat d'exercice n'a été produit dans cette revue. La stack applicative ne déploie pas Supabase, donc la responsabilité du service de base doit être attribuée séparément. Faire préciser RTO et RPO par le métier, sans proposer de valeurs arbitraires : combien de temps l'application peut-elle être indisponible, et combien de saisies peut-on perdre ? Le test doit restaurer une base isolée, vérifier les données et les refus d'accès, puis reconnecter une version compatible du frontend. Les paramètres Auth et secrets nécessaires doivent être récupérables avec des contrôles d'accès adaptés. Prévoir un mode de fonctionnement pendant l'arrêt et la réconciliation des saisies au retour. restart:unless-stopped ne prouve pas une haute disponibilité ni un plan de reprise.

Sources :

- README.md, points de contrôle avant mise en production
- compose.yaml:13
- Dockerfile:15-30
- https://www.cnil.fr/fr/guide-de-la-securite-des-donnees-personnelles

## 20. CI et preuves de non-régression

Durée : 2 min.

La CI actuelle lance npm test, qui exécute Jest et les exports RH. Les contrôles SQL se trouvent dans test:db-tests ou test:all et ne sont pas appelés par ce workflow. Les scripts attendent un conteneur PostgreSQL/Supabase et créent leurs propres bases temporaires. Ajouter une instance isolée à la CI et tester installation complète, migrations réappliquées, cas positifs et négatifs des cinq rôles. Couvrir les quatre constats et les courses de transition RH. Le lockfile et npm ci sont déjà présents. Les images node:22-alpine et nginx-unprivileged:stable-alpine restent des tags mobiles, et package.json ne définit pas engines/packageManager. Stabiliser ces versions avec un processus de mise à jour, plutôt que figer sans maintenance. Aucun audit npm actualisé n'a été relancé ici : les anciens fichiers audit ne prouvent pas l'absence actuelle de vulnérabilités connues.

Sources :

- .github/workflows/ci.yml:16-32
- package.json, scripts test et test:all
- scripts/test-schema.cjs
- scripts/test-user-roles.cjs
- Dockerfile:2,15
- https://supabase.com/docs/guides/database/postgres/row-level-security

## 21. Choix de protection côté serveur

Durée : 2 min.

Ce sont des options proposées, pas des changements effectués. Option 1 conserve les repositories et ajoute les contrôles manquants. Elle convient pour corriger rapidement les lectures et paramètres, mais une chaîne de visas et un verrou d'agrégat peuvent rester difficiles à maintenir dans plusieurs triggers. Option 2 conserve Supabase et place signature, retrait, envoi et réouverture dans des fonctions transactionnelles à privilèges minimaux. La RLS continue à contrôler les lectures et écritures ordinaires. Elle permet de relire/verrouiller le parent, dériver la session et produire une trace commune. C'est la proposition proportionnée au prototype. Option 3 introduit une API intermédiaire, retire les écritures directes sensibles et centralise les transitions; elle ajoute un service à exploiter sans supprimer le besoin de permissions SQL. Choisir la troisième si les exigences d'intégration, d'audit ou d'isolation la justifient. Prévoir un déploiement de la base avant le client et empêcher les anciens appels d'écriture de rester ouverts.

Sources :

- src/app/store/relational/visas.repository.ts:43-67
- src/app/store/relational/visa-workflow.persistence.ts:19-90
- src/app/store/relational/exceptional.repository.ts, saveExceptionalOperation
- schema.sql:967-975,1237-1268

## 22. Plan proposé et critères de mise en service

Durée : 3 min.

Faire acter les propriétaires de chaque travail plutôt que des dates non estimées. A définit audience, parité RH/directeur, signification des visas, admission, hébergement et besoin de reprise. B corrige les lectures, les trois familles de visas, les mutations après envoi et les paramètres calendaires. Ses preuves comprennent des appels directs API pour cinq rôles, des refus et des succès, ainsi que les courses entre envoi et mutation. C produit une configuration de déploiement documentée, une preuve de MFA privilégiée, des journaux d'actions et une restauration réussie avec permissions. D vérifie le schéma réellement installé et le client compatible, réalise la recette métier, évalue les risques restants puis consigne l'autorisation. Ne pas rejouer un schéma initial sur une base existante : utiliser des migrations adaptées, sauvegarder et tester avant déploiement. Le retour arrière ne doit pas réouvrir les politiques permissives supprimées. Aucun budget ou délai n'a été chiffré dans cette revue.

Sources :

- docs/access-rules.md, sections 10 et 11
- supabase/migrations/20261010233000_protect_compensation_and_rh_send.sql
- schema.sql:967-1268
- Rapport de revue courant : remédiations et tests attendus

## 23. Discussion et arbitrages

Durée : 7 min.

Réserver sept minutes aux décisions. Première question : l'organisation accepte-t-elle une consultation globale des opérations, ou confirme-t-elle le périmètre documenté de participation/initiation ? Cela fixe la RLS de lecture. Deuxième question : les statuts de visas sont-ils des prérequis obligatoires d'envoi et quelles exceptions de substitution sont nécessaires ? Troisième question : la parité RH/directeur est-elle voulue ? Ensuite, déterminer l'admission, l'hébergement, le responsable d'exploitation, les objectifs de reprise et l'autorité qui décidera. Recueillir les décisions sans déclarer le projet approuvé en l'absence de recette. Les trois annexes suivantes sont disponibles pour les détails de source et les tests, mais ne font pas partie des 38 minutes de présentation. Proposer comme livrable de la réunion une liste de responsables et de preuves attendues.

Sources :

- docs/access-rules.md, sections 1, 2, 5 et 10
- Contexte utilisateur : prototype / pilote

## 24. Annexe · Preuves des quatre constats

R1 : authenticated_access autorise SELECT sans participation. Les politiques exceptionnelles qui utilisent can_access_exceptional concernent les mutations. profiles_read est également global. R2 : signataire, date et scope sont des valeurs client; les constraints ne vérifient que structure et FK; signed_at devient signed=true. R3 : les triggers parent ne s'exécutent pas sur une mutation enfant. Les politiques d'intervention/participant vérifient ownership et rôle, mais pas sent_to_rh_at du parent. Les contrôles et exports reconstruisent les données courantes. R4 : les jours fériés n'ont pas la politique admin-only des coefficients et servent à classifier les jours des calculs. Pour chaque constat, le rapport contient les extraits, les contre-indications, les préconditions et les remédiations. La localisation d'un contrôle partagé ne signifie pas que les quatre risques ont une seule correction.

Sources :

- schema.sql:967-975,1075,1159-1163,1203-1217
- src/app/store/relational/exceptional.repository.ts:33-36
- src/app/store/relational/visas.repository.ts:29-35,43-67
- src/app/pages/rh/rh-exports.component.ts:257-274
- src/app/pages/rh/export-libraries/rh-export-calculations.ts:299-304

## 25. Annexe · Recette directe SQL / API

Exécuter dans un environnement isolé avec données fictives et jetons de tests, après installation complète et migrations. Pour R1, vérifier toutes les familles de données, y compris relations et signatures, et la visibilité autorisée d'un participant/initiator/director/rh. Pour R2, tester INSERT, UPDATE, DELETE, remplacement d'un visa, scope directeur, identité tierce et exception administrative explicite. Pour R3, envoyer le dossier puis tenter changement de durée, ajout, suppression, déplacement entre parents et modification de participants. Exécuter une course contrôlée entre envoi et mutation pour vérifier le verrou transactionnel. Pour R4, tester chaque paramètre avec user et rôle autorisé. Ajouter les accès sans profil ou révoqués. Vérifier aussi qu'un refus peut prendre la forme d'une réponse vide avec certaines politiques RLS; ne pas exiger uniquement une erreur HTTP. Ces tests sont proposés et n'ont pas été exécutés pendant la présente revue.

Sources :

- supabase/tests/compensation-rh-permissions-assertions.sql
- scripts/test-schema.cjs
- scripts/test-user-roles.cjs
- RemediationTests des quatre constats courants

## 26. Annexe · Références et précautions

Références officielles consultées le 10 octobre 2026 pour les mesures proposées. Supabase RLS : https://supabase.com/docs/guides/database/postgres/row-level-security. Ce guide décrit la combinaison des GRANT et des politiques et recommande des tests allow/deny. Supabase MFA : https://supabase.com/docs/guides/auth/auth-mfa. La protection implique enrôlement et application de l'exigence selon le niveau d'assurance. CNIL : https://www.cnil.fr/fr/guide-de-la-securite-des-donnees-personnelles. Utiliser le guide avec le DPO et le RSSI pour choisir les mesures adaptées; aucune conclusion de conformité n'est fournie ici. Les documents d'audit historiques du dépôt sont des éléments de contexte sur des commits antérieurs. Leur contenu a été confronté aux sources courantes : l'ancienne modification libre des coefficients RH et l'ancienne annulation d'envoi par initiateur ne sont pas présentées comme défauts encore ouverts dans le schéma actuel.

Sources :

- https://supabase.com/docs/guides/database/postgres/row-level-security
- https://supabase.com/docs/guides/auth/auth-mfa
- https://www.cnil.fr/fr/guide-de-la-securite-des-donnees-personnelles
- docs/security-audit-current-2026-10-10.md
- docs/security-verification-informational-visas.md
