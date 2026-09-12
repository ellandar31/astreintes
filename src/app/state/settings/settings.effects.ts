import { Injectable, inject } from "@angular/core";
import { Actions, createEffect, ofType } from "@ngrx/effects";
import { Action } from "@ngrx/store";
import { Observable, catchError, concatMap, from, map, mergeMap, of, switchMap, takeUntil } from "rxjs";
import {
  ManagedUser,
  OnCallCompensationRule,
  PeriodCompensationRule,
  PublicHoliday,
  RhCompensationSettings,
  RhExportTemplateSetting,
  Team,
  UserRole,
} from "../../pages/settings/settings.models";
import { asSafeString } from "../../shared/value-normalizers";
import { StoreCollection, StoreDocument, StoreDocumentReference, appStore } from "../../store/app-store";
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
  { id: "exceptionalWork", label: "Travaux exceptionnels", fileName: "" },
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

  // Users are sourced from the application collection, not directly from
  // Auth provider, because roles and display names are business data.
  readonly watchUsers$ = createEffect(() =>
    this.actions$.pipe(
      ofType(SettingsActions.usersWatchStarted),
      switchMap(() =>
        this.observeSettingsCollection<Record<string, unknown>>(
          appStore.paths.users(),
          (documents) => {
            const users = documents
              .map((document) => this.userFromStore(document.id, document.data))
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
        this.observeSettingsCollection<Record<string, unknown>>(
          appStore.paths.teams(),
          (documents) => {
            const teams = documents
              .map((document) => this.teamFromStore(document.id, document.data))
              .sort((first, second) => first.name.localeCompare(second.name));

            return SettingsActions.teamsChanged({ teams });
          },
          (error) => this.failure("teams", this.errorMessage(error, "Erreur pendant la gestion des équipes.")),
        ).pipe(takeUntil(this.actions$.pipe(ofType(SettingsActions.teamsWatchStopped)))),
      ),
    ),
  );
  // Public holidays are settings data: users may override/import them, and the
  // calculation engine then treats this collection as the single source of truth.
  readonly watchHolidays$ = createEffect(() =>
    this.actions$.pipe(
      ofType(SettingsActions.holidaysWatchStarted),
      switchMap(() =>
        this.observeSettingsCollection<Record<string, unknown>>(
          appStore.paths.publicHolidays(),
          (documents) => {
            const holidays = documents
              .map((document) => this.holidayFromStore(document.id, document.data))
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
        this.observeSettingsDocument<Record<string, unknown>>(
          appStore.paths.rhCompensationRules(),
          (data) => SettingsActions.rhCompensationChanged({ settings: this.compensationFromStore(data) }),
          (error) => this.failure("rhCompensation", this.errorMessage(error, "Erreur pendant la configuration des coefficients RH.")),
        ).pipe(takeUntil(this.actions$.pipe(ofType(SettingsActions.rhCompensationWatchStopped)))),
      ),
    ),
  );
  // RH document settings split the endpoint from template payloads. Document
  // stores often have payload-size and JSON-shape constraints, while designer
  // templates can contain embedded images; one item per template avoids brittle
  // saves as models grow.
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
        from(appStore.data.updateDocument(appStore.paths.user(userId), { role: Number(role) as UserRole })).pipe(
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
        from(appStore.data.deleteDocument(appStore.paths.user(userId))).pipe(
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
        from(editingTeamId ? appStore.data.setDocument(appStore.paths.team(editingTeamId), team) : appStore.data.addDocument(appStore.paths.teams(), team)).pipe(
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
        from(appStore.data.deleteDocument(appStore.paths.team(teamId))).pipe(
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
        from(Promise.all(holidays.map((holiday) => appStore.data.setDocument(appStore.paths.publicHoliday(holiday.id), this.holidayPayload(holiday))))).pipe(
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
        from(appStore.data.setDocument(appStore.paths.publicHoliday(holiday.id), this.holidayPayload(holiday))).pipe(
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
        from(appStore.data.deleteDocument(appStore.paths.publicHoliday(holidayId))).pipe(
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
        from(appStore.data.setDocument(appStore.paths.rhCompensationRules(), { ...settings, updatedAt: new Date().toISOString() })).pipe(
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

  /**
   * Wraps collection listeners as NgRx actions.
   *
   * The helper deliberately keeps subscription lifecycle management inside the
   * effect while avoiding deeply nested callbacks in each watch effect. Each
   * feature-specific watch only describes how documents become business actions.
   */
  private observeSettingsCollection<T>(
    reference: StoreCollection,
    toAction: (documents: StoreDocument<T>[]) => Action,
    toFailure: (error: unknown) => Action,
  ): Observable<Action> {
    return new Observable<Action>((subscriber) => {
      const unsubscribe = appStore.data.observeCollection<T>(
        reference,
        (documents) => subscriber.next(toAction(documents)),
        (error) => subscriber.next(toFailure(error)),
      );

      return unsubscribe;
    });
  }

  /**
   * Wraps singleton settings documents with the same action/error contract used
   * by collection watches. Document settings are optional because a new
   * deployment starts without RH configuration documents.
   */
  private observeSettingsDocument<T>(
    reference: StoreDocumentReference,
    toAction: (data: T | undefined) => Action,
    toFailure: (error: unknown) => Action,
  ): Observable<Action> {
    return new Observable<Action>((subscriber) => {
      const unsubscribe = appStore.data.observeDocument<T>(
        reference,
        (data) => subscriber.next(toAction(data)),
        (error) => subscriber.next(toFailure(error)),
      );

      return unsubscribe;
    });
  }

  /**
   * Rebuilds the RH document configuration from two persistence sources.
   *
   * The endpoint is lightweight singleton configuration. The template JSONs are
   * stored in `items` to keep each payload isolated and to make partial template
   * updates possible later.
   */
  private observeRhTemplateSettings(): Observable<Action> {
    return new Observable<Action>((subscriber) => {
      let generationApiUrl = defaultGenerationApiUrl;
      let templates = defaultTemplates;
      const emitChange = () => subscriber.next(SettingsActions.rhTemplatesChanged({ generationApiUrl, templates }));

      const unsubscribeConfig = appStore.data.observeDocument<Record<string, unknown>>(
        appStore.paths.rhExportTemplates(),
        (data) => {
          generationApiUrl = this.generationApiUrlFromStore(data);
          emitChange();
        },
        (error) => subscriber.next(this.failure("rhTemplates", this.errorMessage(error, "Erreur pendant la configuration des modèles Word RH."))),
      );

      const unsubscribeTemplates = appStore.data.observeCollection<Record<string, unknown>>(
        appStore.paths.rhExportTemplateItems(),
        (documents) => {
          templates = this.templatesFromDocuments(documents);
          emitChange();
        },
        (error) => subscriber.next(this.failure("rhTemplates", this.errorMessage(error, "Erreur pendant la configuration des modèles Word RH."))),
      );

      return () => {
        unsubscribeConfig();
        unsubscribeTemplates();
      };
    });
  }

  /**
   * Saves template payloads separately from global configuration.
   *
   * Keeping a historical `templates` metadata field on the parent document would
   * reintroduce document-size pressure, so the parent only stores lightweight
   * settings and each item owns its model JSON.
   */
  private async saveRhTemplateSettings(generationApiUrl: string, templates: RhExportTemplateSetting[]): Promise<void> {
    const updatedAt = new Date().toISOString();
    await appStore.data.setDocument(appStore.paths.rhExportTemplates(), { generationApiUrl, updatedAt });
    await Promise.all(
      templates.map((template) =>
        appStore.data.setDocument(appStore.paths.rhExportTemplate(template.id), {
          ...this.templatePayload(template),
          updatedAt,
        }),
      ),
    );
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

  // User documents may come from Firebase history or Supabase JSONB rows.
  // Normalization keeps the settings UI independent from provider-specific
  // payload details and prevents one malformed optional field from hiding the
  // whole user list.
  private userFromStore(id: string, data: Record<string, unknown>): ManagedUser {
    return {
      id,
      uid: asSafeString(data["uid"], id),
      email: asSafeString(data["email"]),
      displayName: asSafeString(data["displayName"]),
      role: this.userRoleFromStore(data["role"]),
      lastLoginAt: data["lastLoginAt"],
    };
  }

  /**
   * Keeps role handling defensive during provider migrations.
   *
   * Historical Firebase rows and new Supabase JSONB rows can expose numbers as
   * either numeric or string values depending on the import path. Unknown values
   * are deliberately downgraded to the standard user role instead of breaking the
   * full settings table.
   */
  private userRoleFromStore(value: unknown): UserRole {
    const role = Number(value);
    return role === 0 || role === 2 || role === 3 ? role : 1;
  }

  private holidayFromStore(id: string, data: Record<string, unknown>): PublicHoliday {
    const source = data["source"] === "manual" ? "manual" : "api.gouv.fr";

    return {
      id,
      date: asSafeString(data["date"]),
      label: asSafeString(data["label"]),
      zone: asSafeString(data["zone"]),
      source,
    };
  }

  // Legacy teams may contain members saved as strings or objects. Normalization
  // keeps the regular module independent from previous UI choices.
  private teamFromStore(id: string, data: Record<string, unknown>): Team {
    return {
      id,
      name: asSafeString(data["name"]),
      members: this.normalizeMembers(data["members"]),
    };
  }

  // Defaults are merged at read time to preserve existing coefficients while
  // ensuring newly introduced rules appear without a migration script.
  private compensationFromStore(data: Record<string, unknown> | undefined): RhCompensationSettings {
    const savedOnCallRows = Array.isArray(data?.["onCall"]) ? (data["onCall"] as Partial<OnCallCompensationRule>[]) : [];
    const savedPeriodRows = Array.isArray(data?.["periods"]) ? (data["periods"] as Partial<PeriodCompensationRule>[]) : [];

    return {
      onCall: this.mergeRows(defaultOnCallRows, savedOnCallRows),
      periods: this.mergeRows(defaultPeriodRows, savedPeriodRows),
    };
  }

  private templatesFromStore(data: Record<string, unknown> | undefined): RhExportTemplateSetting[] {
    const savedTemplates = Array.isArray(data?.["templates"]) ? (data["templates"] as Record<string, unknown>[]) : [];

    return this.mergeRows(defaultTemplates, savedTemplates.map((template) => this.templateFromStore(template)));
  }

  private templatesFromDocuments(documents: StoreDocument<Record<string, unknown>>[]): RhExportTemplateSetting[] {
    return this.mergeRows(
      defaultTemplates,
      documents.map((document) => this.templateFromStore({ ...document.data, id: document.id })),
    );
  }

  /**
   * Rehydrates template JSONs saved as strings.
   *
   * Some document stores accept arrays, but not every nested-array shape.
   * Document-generation models are outside our control and may contain exactly
   * that structure, so we persist them as JSON text and only parse them back
   * inside the application boundary.
   */
  private templateFromStore(data: Record<string, unknown>): Partial<RhExportTemplateSetting> {
    return {
      id: this.templateIdFromStore(data["id"]),
      label: asSafeString(data["label"]),
      fileName: asSafeString(data["fileName"]),
      templateFileName: asSafeString(data["templateFileName"]),
      dataModelFileName: asSafeString(data["dataModelFileName"]),
      generationTemplate: this.jsonPayloadFromStore(data["generationTemplateJson"]) ?? data["generationTemplate"],
      dataModel: this.jsonPayloadFromStore(data["dataModelJson"]) ?? data["dataModel"],
    };
  }

  /**
   * Serializes external template definitions before writing to persistence.
   *
   * The JSON string is intentionally preferred over the parsed object: it avoids
   * nested-array constraints and preserves the uploaded model exactly as expected
   * by the document-generation service.
   */
  private templatePayload(template: RhExportTemplateSetting): Record<string, unknown> {
    return {
      id: template.id,
      label: template.label,
      fileName: template.fileName || "",
      templateFileName: template.templateFileName || "",
      dataModelFileName: template.dataModelFileName || "",
      ...(template.generationTemplate ? { generationTemplateJson: JSON.stringify(template.generationTemplate) } : {}),
      ...(template.dataModel ? { dataModelJson: JSON.stringify(template.dataModel) } : {}),
    };
  }

  private jsonPayloadFromStore(value: unknown): unknown | undefined {
    if (typeof value !== "string" || !value.trim()) {
      return undefined;
    }

    try {
      return JSON.parse(value);
    } catch {
      return undefined;
    }
  }

  private templateIdFromStore(value: unknown): RhExportTemplateSetting["id"] | undefined {
    return value === "regular" || value === "exceptionalOnCall" || value === "exceptionalWork" ? value : undefined;
  }

  private generationApiUrlFromStore(data: Record<string, unknown> | undefined): string {
    const value = asSafeString(data?.["generationApiUrl"]);
    return value || defaultGenerationApiUrl;
  }

  private mergeRows<T extends { id: string }>(defaults: T[], savedRows: Partial<T>[]): T[] {
    return defaults.map((defaultRow) => {
      const savedRow = savedRows.find((row) => row.id === defaultRow.id);
      return savedRow ? { ...defaultRow, ...savedRow } : defaultRow;
    });
  }

  // Accepts several historical member payloads because team membership changed
  // during the application lifetime. Only stable identifiers are kept.
  private normalizeMembers(value: unknown): string[] {
    if (!Array.isArray(value)) {
      return [];
    }

    return value
      .map((member) => {
        if (typeof member === "string") {
          return member;
        }

        if (member && typeof member === "object") {
          const memberRecord = member as Record<string, unknown>;

          if ("id" in memberRecord) {
            return asSafeString(memberRecord["id"]);
          }

          if ("uid" in memberRecord) {
            return asSafeString(memberRecord["uid"]);
          }

          if ("email" in memberRecord) {
            return asSafeString(memberRecord["email"]);
          }
        }

        return "";
      })
      .filter(Boolean);
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
