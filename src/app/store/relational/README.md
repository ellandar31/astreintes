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
SQL implicite. Les modèles Word sont enregistrés comme JSON structuré dans JSONB.

`domain-observer.ts` relit les objets complets au chargement, après une écriture
locale réussie et sur les événements realtime des tables dépendantes. Les jointures
utilisateurs/visas font partie de ces dépendances. La désinscription libère les
canaux et empêche la livraison d'une lecture encore en cours.

`date-time.ts` adapte les bornes `timestamptz` en heure locale du navigateur au
format `YYYY-MM-DDTHH:mm`, puis écrit des instants ISO UTC explicites. Les dates
calendaires des jours fériés et les horodatages d'audit sont traités séparément.

Les types sont définis dans `src/app/types/` et accessibles via son `index.ts`.
L'inventaire complet est dans [le catalogue des types](../../../../docs/type-catalog.md).
Chaque module de persistance doit rester sous 500 lignes.

Vérification : `npm run test:jest` et `npm run build`.
