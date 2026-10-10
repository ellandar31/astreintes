import { Injectable, inject } from "@angular/core";
import { Actions, createEffect, ofType } from "@ngrx/effects";
import { Observable, catchError, concatMap, from, map, merge, of, switchMap, takeUntil } from "rxjs";
import {
  RegularIntervention,
  RegularUser,
} from "../../pages/regular/regular.models";
import { RegularInterventionUpdate } from "../../types";
import { createEmptyVisa } from "../../shared/visa.models";
import { appStore } from "../../store/app-store";
import { RegularActions } from "./regular.actions";

@Injectable()
/**
 * Persistence boundary for the regular on-call calendar.
 *
 * The feature combines several business references (teams, users, holidays) with
 * periods and their interventions. Components dispatch intent actions;
 * repositories own persistence joins; effects manage the subscription lifecycle
 * and translate user intent into typed domain operations.
 */
export class RegularEffects {
  private readonly actions$ = inject(Actions);

  // Centralizes persistence subscriptions for the Regular feature so UI components remain persistence-agnostic.
  readonly watchRegular$ = createEffect(() =>
    this.actions$.pipe(
      ofType(RegularActions.watchStarted),
      switchMap(() =>
        merge(
          this.observeTeams(),
          this.observeUsers(),
          this.observePeriods(),
          this.observeInterventions(),
          this.observePublicHolidays(),
        ).pipe(takeUntil(this.actions$.pipe(ofType(RegularActions.watchStopped)))),
      ),
    ),
  );

  // Send the existing snapshots; persistence compares saved dates/assignees and
  // revokes approvals only when their business target actually changed.
  readonly savePeriod$ = createEffect(() =>
    this.actions$.pipe(
      ofType(RegularActions.periodSaveRequested),
      concatMap(({ editingPeriodId, existingAgentVisa, existingDirectorVisa, form, selectedTeamId }) => {
        const payload = {
          ...form,
          teamId: selectedTeamId,
          agentVisa: existingAgentVisa || createEmptyVisa(),
          directorVisa: existingDirectorVisa || createEmptyVisa(),
        };
        const request = editingPeriodId
          ? appStore.regular.updatePeriod(editingPeriodId, payload)
          : appStore.regular.savePeriod(undefined, payload);

        return from(request).pipe(
          map(() => RegularActions.operationSucceeded()),
          catchError((error) => of(RegularActions.operationFailed({ message: this.toErrorMessage(error, "Impossible d'enregistrer l'astreinte.") }))),
        );
      }),
    ),
  );

  // Moving an intervention retains the existing create-then-delete workflow so
  // the previous intervention survives if creating the new one fails.
  readonly saveIntervention$ = createEffect(() =>
    this.actions$.pipe(
      ofType(RegularActions.interventionSaveRequested),
      concatMap(({ editingInterventionId, existingIntervention, form, parentPeriod }) => {
        const payload = {
          ...form,
          comment: form.comment.trim(),
          teamId: parentPeriod.teamId,
          agentVisa: existingIntervention?.agentVisa || createEmptyVisa(),
        };
        const request =
          editingInterventionId && existingIntervention?.periodId === parentPeriod.id
            ? appStore.regular.updateIntervention(editingInterventionId, parentPeriod.id, payload)
            : this.createOrMoveIntervention(parentPeriod.id, payload, existingIntervention);

        return from(request).pipe(
          map(() => RegularActions.operationSucceeded()),
          catchError((error) => of(RegularActions.operationFailed({ message: this.toErrorMessage(error, "Impossible d'enregistrer l'intervention.") }))),
        );
      }),
    ),
  );

  readonly deleteIntervention$ = createEffect(() =>
    this.actions$.pipe(
      ofType(RegularActions.interventionDeleteRequested),
      concatMap(({ interventionId }) =>
        from(appStore.regular.deleteIntervention(interventionId)).pipe(
          map(() => RegularActions.operationSucceeded()),
          catchError((error) => of(RegularActions.operationFailed({ message: this.toErrorMessage(error, "Impossible de supprimer l'intervention.") }))),
        ),
      ),
    ),
  );

  readonly deletePeriod$ = createEffect(() =>
    this.actions$.pipe(
      ofType(RegularActions.periodDeleteRequested),
      concatMap(({ interventions, periodId }) =>
        from(
          Promise.all([
            ...interventions.map((intervention) =>
              appStore.regular.deleteIntervention(intervention.id),
            ),
            appStore.regular.deletePeriod(periodId),
          ]),
        ).pipe(
          map(() => RegularActions.operationSucceeded()),
          catchError((error) => of(RegularActions.operationFailed({ message: this.toErrorMessage(error, "Impossible de supprimer l'astreinte.") }))),
        ),
      ),
    ),
  );

  readonly updatePeriodVisa$ = createEffect(() =>
    this.actions$.pipe(
      ofType(RegularActions.periodVisaUpdateRequested),
      concatMap(({ field, periodId, visa }) =>
        from(appStore.regular.updatePeriod(periodId, { [field]: visa })).pipe(
          map(() => RegularActions.operationSucceeded()),
          catchError((error) => of(RegularActions.operationFailed({ message: this.toErrorMessage(error, "Impossible d'enregistrer le visa.") }))),
        ),
      ),
    ),
  );

  readonly updateInterventionVisa$ = createEffect(() =>
    this.actions$.pipe(
      ofType(RegularActions.interventionVisaUpdateRequested),
      concatMap(({ interventionId, periodId, visa }) =>
        from(appStore.regular.updateIntervention(interventionId, periodId, { agentVisa: visa })).pipe(
          map(() => RegularActions.operationSucceeded()),
          catchError((error) => of(RegularActions.operationFailed({ message: this.toErrorMessage(error, "Impossible d'enregistrer le visa.") }))),
        ),
      ),
    ),
  );

  // A global regular-period visa also signs the user's attached interventions.
  // The batch action keeps that cross-period business rule in one place.
  readonly updateInterventionVisas$ = createEffect(() =>
    this.actions$.pipe(
      ofType(RegularActions.interventionsVisaBatchUpdateRequested),
      concatMap(({ interventions, visa }) =>
        from(
          Promise.all(
            interventions.map((intervention) =>
              appStore.regular.updateIntervention(intervention.id, intervention.periodId, { agentVisa: visa }),
            ),
          ),
        ).pipe(
          map(() => RegularActions.operationSucceeded()),
          catchError((error) => of(RegularActions.operationFailed({ message: this.toErrorMessage(error, "Impossible d'enregistrer les visas.") }))),
        ),
      ),
    ),
  );

  // Once sent to RH, the period becomes read-only in the UI. Clearing the field
  // is the controlled correction path before any further change.
  readonly updatePeriodRhSent$ = createEffect(() =>
    this.actions$.pipe(
      ofType(RegularActions.periodRhSentUpdateRequested),
      concatMap(({ periodId, sent }) =>
        from(
          appStore.regular.updatePeriod(periodId, {
            sentToRhAt: sent ? appStore.now() : null,
          }),
        ).pipe(
          map(() => RegularActions.operationSucceeded()),
          catchError((error) => of(RegularActions.operationFailed({ message: this.toErrorMessage(error, "Impossible de modifier l'envoi RH.") }))),
        ),
      ),
    ),
  );

  private observeTeams(): Observable<ReturnType<typeof RegularActions.teamsChanged | typeof RegularActions.loadFailed>> {
    return new Observable((subscriber) => {
      const unsubscribe = appStore.teams.watch(
        (documents) => {
          const teams = [...documents];
            teams.sort((first, second) => first.name.localeCompare(second.name));

          subscriber.next(RegularActions.teamsChanged({ teams }));
        },
        (error) => subscriber.next(RegularActions.loadFailed({ message: this.toErrorMessage(error, "Impossible de charger les équipes.") })),
      );

      return unsubscribe;
    });
  }

  private observeUsers(): Observable<ReturnType<typeof RegularActions.usersChanged | typeof RegularActions.loadFailed>> {
    return new Observable((subscriber) => {
      const unsubscribe = appStore.users.watch(
        (documents) => {
          const users = documents
            .filter((user) => Boolean(user.email))
            .sort((first, second) => this.userLabel(first).localeCompare(this.userLabel(second)));

          subscriber.next(RegularActions.usersChanged({ users }));
        },
        (error) => subscriber.next(RegularActions.loadFailed({ message: this.toErrorMessage(error, "Impossible de charger les utilisateurs.") })),
      );

      return unsubscribe;
    });
  }

  private observePeriods(): Observable<ReturnType<typeof RegularActions.periodsChanged | typeof RegularActions.loadFailed>> {
    return new Observable((subscriber) => {
      const unsubscribe = appStore.regular.watchPeriods(
        (documents) => {
          const periods = documents;
          subscriber.next(RegularActions.periodsChanged({ periods }));
        },
        (error) => subscriber.next(RegularActions.loadFailed({ message: this.toErrorMessage(error, "Impossible de charger les astreintes.") })),
      );

      return unsubscribe;
    });
  }

  // Validation needs interventions across periods; the repository preserves periodId foreign keys.
  private observeInterventions(): Observable<ReturnType<typeof RegularActions.interventionsChanged | typeof RegularActions.loadFailed>> {
    return new Observable((subscriber) => {
      const unsubscribe = appStore.regular.watchInterventions(
        (documents) => {
          const interventions = documents;

          subscriber.next(RegularActions.interventionsChanged({ interventions }));
        },
        (error) => subscriber.next(RegularActions.loadFailed({ message: this.toErrorMessage(error, "Impossible de charger les interventions.") })),
      );

      return unsubscribe;
    });
  }

  private observePublicHolidays(): Observable<ReturnType<typeof RegularActions.publicHolidaysChanged | typeof RegularActions.loadFailed>> {
    return new Observable((subscriber) => {
      const unsubscribe = appStore.holidays.watch(
        (documents) => {
          const publicHolidays = documents.filter(holiday => Boolean(holiday.date));

          subscriber.next(RegularActions.publicHolidaysChanged({ publicHolidays }));
        },
        (error) => subscriber.next(RegularActions.loadFailed({ message: this.toErrorMessage(error, "Impossible de charger les jours fériés.") })),
      );

      return unsubscribe;
    });
  }

  // The chosen parent must contain the intervention's dates and user before it is recreated.
  private async createOrMoveIntervention(
    parentPeriodId: string,
    payload: RegularInterventionUpdate,
    existingIntervention: RegularIntervention | undefined,
  ): Promise<void> {
    await appStore.regular.saveIntervention(undefined, parentPeriodId, {
      ...payload,
    });

    if (existingIntervention) {
      await appStore.regular.deleteIntervention(existingIntervention.id);
    }
  }

  private userLabel(user: RegularUser): string {
    return user.displayName ? `${user.displayName} (${user.email})` : user.email;
  }

  private toErrorMessage(error: unknown, fallback: string): string {
    if (appStore.errors.isError(error)) {
      if (error.code === "permission-denied") {
        return `${fallback} Les règles ne permettent pas encore cette opération.`;
      }

      return `${fallback} Erreur de la base (${error.code}) : ${error.message}`;
    }

    return fallback;
  }
}
