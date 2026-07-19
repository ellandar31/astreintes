import { Injectable, inject } from "@angular/core";
import { Actions, createEffect, ofType } from "@ngrx/effects";
import { Observable, catchError, concatMap, from, map, merge, of, switchMap, takeUntil } from "rxjs";
import {
  RegularIntervention,
  RegularOnCallPeriod,
  RegularPublicHoliday,
  RegularTeam,
  RegularUser,
} from "../../pages/regular/regular.models";
import { asSafeString } from "../../shared/value-normalizers";
import { createEmptyVisa } from "../../shared/visa.models";
import { appStore } from "../../store/app-store";
import { RegularActions } from "./regular.actions";

@Injectable()
export class RegularEffects {
  private readonly actions$ = inject(Actions);

  // Centralizes Firebase subscriptions for the Regular feature so UI components remain persistence-agnostic.
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

  readonly savePeriod$ = createEffect(() =>
    this.actions$.pipe(
      ofType(RegularActions.periodSaveRequested),
      concatMap(({ editingPeriodId, existingAgentVisa, existingDirectorVisa, form, selectedTeamId }) => {
        const payload = {
          ...form,
          teamId: selectedTeamId,
          agentVisa: existingAgentVisa || createEmptyVisa(),
          directorVisa: existingDirectorVisa || createEmptyVisa(),
          updatedAt: appStore.data.serverTimestamp(),
        };
        const request = editingPeriodId
          ? appStore.data.updateDocument(appStore.paths.regularOnCallPeriod(editingPeriodId), payload)
          : appStore.data.addDocument(appStore.paths.regularOnCallPeriods(), {
              ...payload,
              createdAt: appStore.data.serverTimestamp(),
            });

        return from(request).pipe(
          map(() => RegularActions.operationSucceeded()),
          catchError((error) => of(RegularActions.operationFailed({ message: this.toErrorMessage(error, "Impossible d'enregistrer l'astreinte.") }))),
        );
      }),
    ),
  );

  readonly saveIntervention$ = createEffect(() =>
    this.actions$.pipe(
      ofType(RegularActions.interventionSaveRequested),
      concatMap(({ editingInterventionId, existingIntervention, form, parentPeriod }) => {
        const payload = {
          ...form,
          comment: form.comment.trim(),
          teamId: parentPeriod.teamId,
          agentVisa: existingIntervention?.agentVisa || createEmptyVisa(),
          updatedAt: appStore.data.serverTimestamp(),
        };
        const request =
          editingInterventionId && existingIntervention?.periodId === parentPeriod.id
            ? appStore.data.updateDocument(appStore.paths.regularIntervention(parentPeriod.id, editingInterventionId), payload)
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
      concatMap(({ interventionId, periodId }) =>
        from(appStore.data.deleteDocument(appStore.paths.regularIntervention(periodId, interventionId))).pipe(
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
              appStore.data.deleteDocument(appStore.paths.regularIntervention(intervention.periodId, intervention.id)),
            ),
            appStore.data.deleteDocument(appStore.paths.regularOnCallPeriod(periodId)),
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
        from(appStore.data.updateDocument(appStore.paths.regularOnCallPeriod(periodId), { [field]: visa })).pipe(
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
        from(appStore.data.updateDocument(appStore.paths.regularIntervention(periodId, interventionId), { agentVisa: visa })).pipe(
          map(() => RegularActions.operationSucceeded()),
          catchError((error) => of(RegularActions.operationFailed({ message: this.toErrorMessage(error, "Impossible d'enregistrer le visa.") }))),
        ),
      ),
    ),
  );

  readonly updateInterventionVisas$ = createEffect(() =>
    this.actions$.pipe(
      ofType(RegularActions.interventionsVisaBatchUpdateRequested),
      concatMap(({ interventions, visa }) =>
        from(
          Promise.all(
            interventions.map((intervention) =>
              appStore.data.updateDocument(appStore.paths.regularIntervention(intervention.periodId, intervention.id), { agentVisa: visa }),
            ),
          ),
        ).pipe(
          map(() => RegularActions.operationSucceeded()),
          catchError((error) => of(RegularActions.operationFailed({ message: this.toErrorMessage(error, "Impossible d'enregistrer les visas.") }))),
        ),
      ),
    ),
  );

  readonly updatePeriodRhSent$ = createEffect(() =>
    this.actions$.pipe(
      ofType(RegularActions.periodRhSentUpdateRequested),
      concatMap(({ periodId, sent }) =>
        from(
          appStore.data.updateDocument(appStore.paths.regularOnCallPeriod(periodId), {
            sentToRhAt: sent ? appStore.data.serverTimestamp() : appStore.data.deleteField(),
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
      const unsubscribe = appStore.data.observeCollection<Record<string, unknown>>(
        appStore.paths.teams(),
        (documents) => {
          const teams = documents
            .map((document) => {
              const data = document.data;
              return {
                id: document.id,
                name: asSafeString(data["name"]),
                members: Array.isArray(data["members"]) ? data["members"].map(String) : [],
              };
            })
            .sort((first, second) => first.name.localeCompare(second.name));

          subscriber.next(RegularActions.teamsChanged({ teams }));
        },
        (error) => subscriber.next(RegularActions.loadFailed({ message: this.toErrorMessage(error, "Impossible de charger les équipes.") })),
      );

      return unsubscribe;
    });
  }

  private observeUsers(): Observable<ReturnType<typeof RegularActions.usersChanged | typeof RegularActions.loadFailed>> {
    return new Observable((subscriber) => {
      const unsubscribe = appStore.data.observeCollection<RegularUser>(
        appStore.paths.users(),
        (documents) => {
          const users = documents
            .map((document) => ({ ...document.data, id: document.id }) as RegularUser)
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
      const unsubscribe = appStore.data.observeCollection<RegularOnCallPeriod>(
        appStore.paths.regularOnCallPeriods(),
        (documents) => {
          const periods = documents.map((document) => ({ ...document.data, id: document.id }) as RegularOnCallPeriod);
          subscriber.next(RegularActions.periodsChanged({ periods }));
        },
        (error) => subscriber.next(RegularActions.loadFailed({ message: this.toErrorMessage(error, "Impossible de charger les astreintes.") })),
      );

      return unsubscribe;
    });
  }

  private observeInterventions(): Observable<ReturnType<typeof RegularActions.interventionsChanged | typeof RegularActions.loadFailed>> {
    return new Observable((subscriber) => {
      const unsubscribe = appStore.data.observeCollection<RegularIntervention>(
        appStore.paths.regularInterventionsGroup(),
        (documents) => {
          const interventions = documents.map((document) => {
            const data = document.data;
            const periodId = document.parentId || asSafeString(data["periodId"]);
            return { ...data, id: document.id, periodId } as RegularIntervention;
          });

          subscriber.next(RegularActions.interventionsChanged({ interventions }));
        },
        (error) => subscriber.next(RegularActions.loadFailed({ message: this.toErrorMessage(error, "Impossible de charger les interventions.") })),
      );

      return unsubscribe;
    });
  }

  private observePublicHolidays(): Observable<ReturnType<typeof RegularActions.publicHolidaysChanged | typeof RegularActions.loadFailed>> {
    return new Observable((subscriber) => {
      const unsubscribe = appStore.data.observeCollection<Record<string, unknown>>(
        appStore.paths.publicHolidays(),
        (documents) => {
          const publicHolidays: RegularPublicHoliday[] = documents
            .map((document) => {
              const data = document.data;
              return {
                id: document.id,
                date: asSafeString(data["date"]),
                label: asSafeString(data["label"], "Jour férié"),
              };
            })
            .filter((holiday) => Boolean(holiday.date));

          subscriber.next(RegularActions.publicHolidaysChanged({ publicHolidays }));
        },
        (error) => subscriber.next(RegularActions.loadFailed({ message: this.toErrorMessage(error, "Impossible de charger les jours fériés.") })),
      );

      return unsubscribe;
    });
  }

  // Regular interventions live below their parent on-call period, so changing dates may require moving the document.
  private async createOrMoveIntervention(
    parentPeriodId: string,
    payload: Record<string, unknown>,
    existingIntervention: RegularIntervention | undefined,
  ): Promise<void> {
    await appStore.data.addDocument(appStore.paths.regularInterventions(parentPeriodId), {
      ...payload,
      createdAt: appStore.data.serverTimestamp(),
    });

    if (existingIntervention) {
      await appStore.data.deleteDocument(appStore.paths.regularIntervention(existingIntervention.periodId, existingIntervention.id));
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
