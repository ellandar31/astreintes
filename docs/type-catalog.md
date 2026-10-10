# Catalogue des types

Point d'import partagé : `src/app/types/index.ts`. Les modèles sont définis une seule fois,
dans des fichiers regroupés par domaine. Les anciens fichiers `pages/*/*.models.ts`
réexportent ces définitions pour préserver les imports existants.

Les types locaux des composants, des calculs et des états NgRx restent chez leur propriétaire :
ils sont inventoriés ci-dessous, mais ne doivent pas devenir des contrats partagés par défaut.

## Règles de maintenance

- Ajouter un modèle partagé dans `src/app/types/`, puis le réexporter depuis `index.ts`.
- Utiliser des projections (`Pick`, `Omit`) pour réutiliser les mêmes champs plutôt que les dupliquer.
- Réserver `JsonRecord` aux valeurs non typées à la frontière Supabase/JSONB.
- Les repositories renvoient directement les objets métier ; aucun type Document n'est nécessaire.
- Les identifiants applicatifs sont des chaînes côté Angular, numériques côté PostgreSQL ; `uid` porte l'UUID Auth.
- Les IDs des opérations exceptionnelles sont qualifiés (`astreinte:ID`, `travaux:ID`) : leurs séquences SQL sont indépendantes.
- Les champs de période utilisent une date/heure locale ; les horodatages de signature/envoi RH conservent leur fuseau.
- Pour les mises à jour RH, omission = conserver la date ; `null` = annuler l'envoi.
- Régénérer ce fichier avec `npm run docs:types` après un changement de déclaration.

## Définitions partagées

| Fichier | Types |
| --- | --- |
| [database.models.ts](../src/app/types/database.models.ts) | `JsonRecord`, `RelationalTable` |
| [exceptional.models.ts](../src/app/types/exceptional.models.ts) | `ExceptionalOperationType`, `SortField`, `SortDirection`, `ModalMode`, `FilterField`, `OperationParticipant`, `SelectableUser`, `ExceptionalIntervention`, `ExceptionalOperation`, `ExceptionalOperationForm`, `ExceptionalInterventionForm` |
| [persistence.models.ts](../src/app/types/persistence.models.ts) | `RegularPeriodUpdate`, `RegularInterventionUpdate`, `ExceptionalOperationUpdate`, `StoreAuthUser`, `StoreError`, `StoreUnsubscribe`, `DomainObserver` |
| [regular.models.ts](../src/app/types/regular.models.ts) | `RegularTeam`, `RegularUser`, `RegularOnCallPeriod`, `RegularOnCallPeriodForm`, `RegularIntervention`, `RegularInterventionForm`, `RegularPublicHoliday` |
| [rh-control-detail.models.ts](../src/app/types/rh-control-detail.models.ts) | `RhControlDetailLine`, `RhControlDetailItem` |
| [rh-export.models.ts](../src/app/types/rh-export.models.ts) | `ExportTemplateId`, `RhExportPeriod`, `RhPeriodExportOperations`, `CalculationSegment`, `ExportOperation`, `RhExportContext`, `OnCallCompensationRow`, `InterventionCompensationRow` |
| [rh.models.ts](../src/app/types/rh.models.ts) | `RhSection`, `RhUser`, `RhRegularPeriod`, `RhPublicHoliday`, `RhExceptionalIntervention`, `RhExceptionalOperation`, `RhControlRow` |
| [settings.models.ts](../src/app/types/settings.models.ts) | `SettingsSection`, `ScheduleDay`, `Team`, `ScheduleRule`, `PublicHoliday`, `OnCallCompensationRule`, `PeriodCompensationRule`, `RhCompensationSettings` |
| [signature.models.ts](../src/app/types/signature.models.ts) | `VisaSignatureMode`, `VisaStorageTable`, `VisaTargetColumn`, `VisaScope`, `SignatureProfile`, `SignatureVisa` |
| [user.models.ts](../src/app/types/user.models.ts) | `UserRole`, `ManagedUser`, `ApplicationUser` |
| [validation.models.ts](../src/app/types/validation.models.ts) | `ValidationItemKind`, `AppUser`, `ValidationItem`, `VisaProgressItem`, `ValidationSectionId`, `ValidationSection` |

## Définitions locales et projections de fonctionnalités

| Fichier propriétaire | Types |
| --- | --- |
| [src/app/app.component.ts](../src/app/app.component.ts) | `TabId`, `ModalView` |
| [src/app/pages/regular/regular-calendar.component.ts](../src/app/pages/regular/regular-calendar.component.ts) | `CalendarDay` |
| [src/app/pages/rh/rh-controls.component.ts](../src/app/pages/rh/rh-controls.component.ts) | `RhRegularIntervention`, `RhUserControlSection`, `RhMonthControlSection` |
| [src/app/pages/rh/rh-exports.component.ts](../src/app/pages/rh/rh-exports.component.ts) | `RegularInterventionExport` |
| [src/app/shared/modal.component.ts](../src/app/shared/modal.component.ts) | `ModalSize` |
| [src/app/state/app.state.ts](../src/app/state/app.state.ts) | `AppState` |
| [src/app/state/auth/auth.reducer.ts](../src/app/state/auth/auth.reducer.ts) | `AuthState` |
| [src/app/state/exceptional/exceptional.reducer.ts](../src/app/state/exceptional/exceptional.reducer.ts) | `ExceptionalState` |
| [src/app/state/profile/profile.reducer.ts](../src/app/state/profile/profile.reducer.ts) | `ProfileState` |
| [src/app/state/regular/regular.reducer.ts](../src/app/state/regular/regular.reducer.ts) | `RegularState` |
| [src/app/state/settings/settings.actions.ts](../src/app/state/settings/settings.actions.ts) | `SettingsMessageSource`, `SettingsMessageKind` |
| [src/app/state/settings/settings.effects.ts](../src/app/state/settings/settings.effects.ts) | `HolidaySourceResponse` |
| [src/app/state/settings/settings.reducer.ts](../src/app/state/settings/settings.reducer.ts) | `SettingsOperationMessage`, `SettingsState` |
| [src/app/store/relational/domain-observer.ts](../src/app/store/relational/domain-observer.ts) | `Refresh` |
| [src/app/store/relational/exceptional-tables.ts](../src/app/store/relational/exceptional-tables.ts) | `ExceptionalTables` |
| [src/app/store/supabase.config.ts](../src/app/store/supabase.config.ts) | `RuntimeAppConfig` |
