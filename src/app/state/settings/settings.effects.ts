import { Injectable, inject } from "@angular/core";
import { Actions, createEffect, ofType } from "@ngrx/effects";
import { Action } from "@ngrx/store";
import { Observable, catchError, concatMap, from, map, mergeMap, of, switchMap, takeUntil } from "rxjs";
import {
  OnCallCompensationRule,
  PeriodCompensationRule,
  PublicHoliday,
  RhCompensationSettings,
  RhExportTemplateSetting,
  UserRole,
} from "../../pages/settings/settings.models";
import { appStore } from "../../store/app-store";
import { DomainObserver } from "../../types";
import { SettingsActions, SettingsMessageSource } from "./settings.actions";

type HolidaySourceResponse = Record<string, string>;

const defaultOnCallRows: OnCallCompensationRule[] = [
  { id: "week", label: "Semaine", coefficient: 0 },
  { id: "weekendHoliday", label: "Samedi / Dimanche / Jour férié", coefficient: 0 },
];

const defaultPeriodRows: PeriodCompensationRule[] = [
  { id: "week_18_21", label: "Semaine 18h-21h", interventionCoefficient: 0, workCoefficient: 0, restCoefficient: 0 },
  { id: "night_21_7", label: "Nuit (21h-7h)", interventionCoefficient: 0, workCoefficient: 0, restCoefficient: 0 },
  { id: "week_7_8", label: "Semaine 7h-8h", interventionCoefficient: 0, workCoefficient: 0, restCoefficient: 0 },
  { id: "saturday_7_21", label: "Samedi (7h-21h)", interventionCoefficient: 0, workCoefficient: 0, restCoefficient: 0 },
  { id: "sunday_holiday_7_21", label: "Dimanche/Jours fériés (7h-21h)", interventionCoefficient: 0, workCoefficient: 0, restCoefficient: 0 },
];

const defaultTemplates: RhExportTemplateSetting[] = [
  { id: "regular", label: "Astreintes régulières", fileName: "" },
  { id: "exceptionalOnCall", label: "Astreintes exceptionnelles", fileName: "" },
  { id: "exceptionalWork", label: "Travaux supplémentaires", fileName: "" },
];
const defaultGenerationApiUrl = "http://localhost:3000/v1/documents/generate";

@Injectable()
/**
 * Centralizes persistence for all administration settings.
 *
 * The settings screens configure data reused by other modules: teams feed the
 * regular calendar, public holidays affect compensation rules, and RH templates
 * drive exports. Keeping these reads/writes in effects prevents components from
 * coupling themselves to the current persistence layout.
 */
export class SettingsEffects {
  private readonly actions$ = inject(Actions);

  // Users are sourced from application profiles, not directly from
  // Auth provider, because roles and display names are business data.
  readonly watchUsers$ = createEffect(() =>
    this.actions$.pipe(
      ofType(SettingsActions.usersWatchStarted),
      switchMap(() =>
        this.observeSettings(appStore.users.watch,
          (documents) => {
            const users = documents
              .sort((first, second) => first.email.localeCompare(second.email));

            return SettingsActions.usersChanged({ users });
          },
          (error) => this.failure("users", this.errorMessage(error, "Erreur pendant la gestion des utilisateurs.")),
        ).pipe(takeUntil(this.actions$.pipe(ofType(SettingsActions.usersWatchStopped)))),
      ),
    ),
  );

  // Teams are watched independently because the regular module needs live
  // membership updates to validate overlapping on-call periods.
  readonly watchTeams$ = createEffect(() =>
    this.actions$.pipe(
      ofType(SettingsActions.teamsWatchStarted),
      switchMap(() =>
        this.observeSettings(appStore.teams.watch,
          (documents) => {
            const teams = documents
              .sort((first, second) => first.name.localeCompare(second.name));

            return SettingsActions.teamsChanged({ teams });
          },
          (error) => this.failure("teams", this.errorMessage(error, "Erreur pendant la gestion des équipes.")),
        ).pipe(takeUntil(this.actions$.pipe(ofType(SettingsActions.teamsWatchStopped)))),
      ),
    ),
  );
  // Public holidays are settings data: users may override/import them, and the
  // calculation engine then treats these records as the single source of truth.
  readonly watchHolidays$ = createEffect(() =>
    this.actions$.pipe(
      ofType(SettingsActions.holidaysWatchStarted),
      switchMap(() =>
        this.observeSettings(appStore.holidays.watch,
          (documents) => {
            const holidays = documents
              .sort((first, second) => first.date.localeCompare(second.date));

            return SettingsActions.holidaysChanged({ holidays });
          },
          (error) => this.failure("holidays", this.holidayErrorMessage(error)),
        ).pipe(takeUntil(this.actions$.pipe(ofType(SettingsActions.holidaysWatchStopped)))),
      ),
    ),
  );
  // Compensation settings merge persisted coefficients with application defaults
  // so adding a new rule in code does not break existing deployments.
  readonly watchRhCompensation$ = createEffect(() =>
    this.actions$.pipe(
      ofType(SettingsActions.rhCompensationWatchStarted),
      switchMap(() =>
        this.observeSettings(appStore.rhSettings.watchCompensation,
          (data) => SettingsActions.rhCompensationChanged({ settings: this.compensationFromStore(data) }),
          (error) => this.failure("rhCompensation", this.errorMessage(error, "Erreur pendant la configuration des coefficients RH.")),
        ).pipe(takeUntil(this.actions$.pipe(ofType(SettingsActions.rhCompensationWatchStopped)))),
      ),
    ),
  );
  // Endpoint settings and template JSONB are separate relational resources.
  // Watching them independently avoids reloading large templates for an endpoint edit.
  readonly watchRhTemplates$ = createEffect(() =>
    this.actions$.pipe(
      ofType(SettingsActions.rhTemplatesWatchStarted),
      switchMap(() => this.observeRhTemplateSettings().pipe(takeUntil(this.actions$.pipe(ofType(SettingsActions.rhTemplatesWatchStopped))))),
    ),
  );
  // Role updates are serialized to avoid racing administrative changes from
  // repeated clicks; the last confirmed write is reflected by the live watch.
  readonly updateUserRole$ = createEffect(() =>
    this.actions$.pipe(
      ofType(SettingsActions.userRoleUpdateRequested),
      concatMap(({ role, userId }) =>
        from(appStore.users.save(userId, { role: Number(role) as UserRole })).pipe(
          map(() => this.success("users", "Rôle utilisateur mis à jour.")),
          catchError((error) => of(this.failure("users", this.errorMessage(error, "Erreur pendant la gestion des utilisateurs.")))),
        ),
      ),
    ),
  );

  readonly deleteUser$ = createEffect(() =>
    this.actions$.pipe(
      ofType(SettingsActions.userDeleteRequested),
      concatMap(({ userId }) =>
        from(appStore.users.remove(userId)).pipe(
          map(() => this.success("users", "Utilisateur retiré de la liste applicative.")),
          catchError((error) => of(this.failure("users", this.errorMessage(error, "Erreur pendant la gestion des utilisateurs.")))),
        ),
      ),
    ),
  );

  readonly saveTeam$ = createEffect(() =>
    this.actions$.pipe(
      ofType(SettingsActions.teamSaveRequested),
      concatMap(({ editingTeamId, team }) =>
        from(appStore.teams.save(editingTeamId ?? undefined, team)).pipe(
          mergeMap(() => [this.success("teams", "Équipe enregistrée.")]),
          catchError((error) => of(this.failure("teams", this.errorMessage(error, "Erreur pendant l'enregistrement de l'équipe.")))),
        ),
      ),
    ),
  );

  readonly deleteTeam$ = createEffect(() =>
    this.actions$.pipe(
      ofType(SettingsActions.teamDeleteRequested),
      concatMap(({ teamId }) =>
        from(appStore.teams.remove(teamId)).pipe(
          map(() => this.success("teams", "Équipe supprimée.")),
          catchError((error) => of(this.failure("teams", this.errorMessage(error, "Erreur pendant l'enregistrement de l'équipe.")))),
        ),
      ),
    ),
  );

  // The official holiday API is an external source. We load it separately from
  // saving so the user can review the imported list before it becomes business
  // data used by calculations.
  readonly loadOfficialHolidays$ = createEffect(() =>
    this.actions$.pipe(
      ofType(SettingsActions.officialHolidaysLoadRequested),
      concatMap(({ year, zone }) =>
        from(this.fetchOfficialHolidays(zone, year)).pipe(
          mergeMap((holidays) => [
            SettingsActions.officialHolidaysLoaded({ holidays }),
            this.success("holidays", `${holidays.length} jours fériés officiels chargés.`),
          ]),
          catchError((error) => of(this.failure("holidays", this.holidayErrorMessage(error)))),
        ),
      ),
    ),
  );

  // Imported holidays are written with stable ids (zone + date) to make repeated
  // imports idempotent and prevent duplicate holiday rows.
  readonly saveImportedHolidays$ = createEffect(() =>
    this.actions$.pipe(
      ofType(SettingsActions.importedHolidaysSaveRequested),
      concatMap(({ holidays }) =>
        from(Promise.all(holidays.map((holiday) => appStore.holidays.save(holiday.id, this.holidayPayload(holiday))))).pipe(
          map(() => this.success("holidays", "Jours fériés officiels enregistrés.")),
          catchError((error) => of(this.failure("holidays", this.holidayErrorMessage(error)))),
        ),
      ),
    ),
  );

  readonly saveManualHoliday$ = createEffect(() =>
    this.actions$.pipe(
      ofType(SettingsActions.manualHolidaySaveRequested),
      concatMap(({ holiday }) =>
        from(appStore.holidays.save(holiday.id, this.holidayPayload(holiday))).pipe(
          map(() => this.success("holidays", "Jour férié enregistré.")),
          catchError((error) => of(this.failure("holidays", this.holidayErrorMessage(error)))),
        ),
      ),
    ),
  );

  readonly deleteHoliday$ = createEffect(() =>
    this.actions$.pipe(
      ofType(SettingsActions.holidayDeleteRequested),
      concatMap(({ holidayId }) =>
        from(appStore.holidays.remove(holidayId)).pipe(
          map(() => this.success("holidays", "Jour férié supprimé.")),
          catchError((error) => of(this.failure("holidays", this.holidayErrorMessage(error)))),
        ),
      ),
    ),
  );

  readonly saveRhCompensation$ = createEffect(() =>
    this.actions$.pipe(
      ofType(SettingsActions.rhCompensationSaveRequested),
      concatMap(({ settings }) =>
        from(appStore.rhSettings.saveCompensation(settings)).pipe(
          map(() => this.success("rhCompensation", "Règles d'indemnisation enregistrées.")),
          catchError((error) => of(this.failure("rhCompensation", this.errorMessage(error, "Erreur pendant l'enregistrement des coefficients RH.")))),
        ),
      ),
    ),
  );

  readonly saveRhTemplates$ = createEffect(() =>
    this.actions$.pipe(
      ofType(SettingsActions.rhTemplatesSaveRequested),
      concatMap(({ generationApiUrl, templates }) =>
        from(this.saveRhTemplateSettings(generationApiUrl, templates)).pipe(
          map(() => this.success("rhTemplates", "Modèles Word RH enregistrés.")),
          catchError((error) => of(this.failure("rhTemplates", this.errorMessage(error, "Erreur pendant l'enregistrement des modèles Word RH.")))),
        ),
      ),
    ),
  );

  /** Bridge typed repository subscriptions to NgRx; unsubscription belongs to the effect lifecycle. */
  private observeSettings<T>(subscribe: DomainObserver<T>, toAction: (value: T) => Action, toFailure: (error: unknown) => Action): Observable<Action> {
    return new Observable<Action>(subscriber => subscribe(value => subscriber.next(toAction(value)), error => subscriber.next(toFailure(error))));
  }

  /** Combine independent relational settings while retaining defaults for a new deployment. */
  private observeRhTemplateSettings(): Observable<Action> {
    return new Observable<Action>(subscriber => {
      let generationApiUrl = defaultGenerationApiUrl;
      let templates = defaultTemplates;
      const emit = () => subscriber.next(SettingsActions.rhTemplatesChanged({ generationApiUrl, templates }));
      const fail = (error: unknown) => subscriber.next(this.failure("rhTemplates", this.errorMessage(error, "Erreur pendant la configuration des modèles Word RH.")));
      const stopConfig = appStore.rhSettings.watchExportConfiguration(settings => {
        generationApiUrl = settings.generationApiUrl || defaultGenerationApiUrl;
        emit();
      }, fail);
      const stopTemplates = appStore.rhSettings.watchTemplates(saved => {
        templates = this.mergeRows(defaultTemplates, saved);
        emit();
      }, fail);
      return () => { stopConfig(); stopTemplates(); };
    });
  }

  /** JSONB preserves external model payloads without an intermediate text serialization. */
  private async saveRhTemplateSettings(generationApiUrl: string, templates: RhExportTemplateSetting[]): Promise<void> {
    await appStore.rhSettings.saveExportConfiguration({ generationApiUrl });
    await Promise.all(templates.map(template => appStore.rhSettings.saveTemplate(template)));
  }

  /**
   * Fetches official French public holidays for the selected zone/year.
   *
   * The result is normalized immediately so the rest of the application never
   * depends on the government API response shape.
   */
  private async fetchOfficialHolidays(zone: string, year: number): Promise<PublicHoliday[]> {
    const response = await fetch(`https://calendrier.api.gouv.fr/jours-feries/${zone}/${year}.json`);

    if (!response.ok) {
      throw new Error(`Réponse API invalide (${response.status})`);
    }

    const data = (await response.json()) as HolidaySourceResponse;

    return Object.entries(data)
      .map(([date, label]) => this.toHoliday(zone, date, label, "api.gouv.fr"))
      .sort((first, second) => first.date.localeCompare(second.date));
  }

  /** Add newly introduced rule defaults without resetting coefficients already configured in the database. */
  private compensationFromStore(settings: RhCompensationSettings): RhCompensationSettings {
    return {
      onCall: this.mergeRows(defaultOnCallRows, settings.onCall),
      periods: this.mergeRows(defaultPeriodRows, settings.periods),
    };
  }

  private mergeRows<T extends { id: string }>(defaults: T[], savedRows: Partial<T>[]): T[] {
    return defaults.map((defaultRow) => {
      const savedRow = savedRows.find((row) => row.id === defaultRow.id);
      return savedRow ? { ...defaultRow, ...savedRow } : defaultRow;
    });
  }

  private toHoliday(zone: string, date: string, label: string, source: PublicHoliday["source"]): PublicHoliday {
    return {
      id: `${zone}_${date}`,
      date,
      label: label.trim(),
      zone,
      source,
    };
  }

  private holidayPayload(holiday: PublicHoliday): Omit<PublicHoliday, "id"> {
    return {
      date: holiday.date,
      label: holiday.label,
      zone: holiday.zone,
      source: holiday.source,
    };
  }

  private success(source: SettingsMessageSource, message: string): ReturnType<typeof SettingsActions.operationSucceeded> {
    return SettingsActions.operationSucceeded({ completedAt: Date.now(), message, source });
  }

  private failure(source: SettingsMessageSource, message: string): ReturnType<typeof SettingsActions.operationFailed> {
    return SettingsActions.operationFailed({ completedAt: Date.now(), message, source });
  }

  private holidayErrorMessage(error: unknown): string {
    if (appStore.errors.isError(error)) {
      return `Erreur Base de données (${error.code}) : ${error.message}`;
    }

    if (error instanceof Error) {
      return error.message;
    }

    return "Erreur pendant la gestion des jours fériés.";
  }

  private errorMessage(error: unknown, fallback: string): string {
    return appStore.errors.isError(error) ? `Erreur Base de données (${error.code}) : ${error.message}` : fallback;
  }
}
