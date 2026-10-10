import { Injectable, inject } from "@angular/core";
import { Actions, createEffect, ofType } from "@ngrx/effects";
import { Observable, catchError, concatMap, from, map, merge, of, switchMap, takeUntil } from "rxjs";
import {
  SelectableUser,
} from "../../pages/exceptionnel/exceptional.models";
import { appStore } from "../../store/app-store";
import { ExceptionalActions } from "./exceptional.actions";

@Injectable()
/**
 * Persistence boundary for exceptional on-call and exceptional work operations.
 *
 * Operations carry their participants, real/planned periods, interventions,
 * visas and RH-send marker in a single aggregate. This keeps validation and RH
 * exports consistent because they always read one coherent operation snapshot.
 */
export class ExceptionalEffects {
  private readonly actions$ = inject(Actions);

  // Keeps persistence access for exceptional operations outside presentation components.
  readonly watchExceptional$ = createEffect(() =>
    this.actions$.pipe(
      ofType(ExceptionalActions.watchStarted),
      switchMap(() =>
        merge(
          this.observeOperations(),
          this.observeUsers(),
        ).pipe(takeUntil(this.actions$.pipe(ofType(ExceptionalActions.watchStopped)))),
      ),
    ),
  );

  // The domain API merges partial edits with the current operation so validation
  // signatures and RH metadata are preserved when a modal omits those fields.
  readonly saveOperation$ = createEffect(() =>
    this.actions$.pipe(
      ofType(ExceptionalActions.operationSaveRequested),
      concatMap(({ operationId, payload }) => {
        const request = appStore.exceptional.saveOperation(operationId ?? undefined, payload);

        return from(request).pipe(
          map(() => ExceptionalActions.operationSucceeded()),
          catchError((error) =>
            of(ExceptionalActions.operationFailed({ message: this.toErrorMessage(error, "Impossible d'enregistrer l'opération.") })),
          ),
        );
      }),
    ),
  );

  readonly deleteOperation$ = createEffect(() =>
    this.actions$.pipe(
      ofType(ExceptionalActions.operationDeleteRequested),
      concatMap(({ operationId }) =>
        from(appStore.exceptional.deleteOperation(operationId)).pipe(
          map(() => ExceptionalActions.operationSucceeded()),
          catchError((error) =>
            of(ExceptionalActions.operationFailed({ message: this.toErrorMessage(error, "Impossible de supprimer l'opération.") })),
          ),
        ),
      ),
    ),
  );

  readonly patchOperation$ = createEffect(() =>
    this.actions$.pipe(
      ofType(ExceptionalActions.operationPatchRequested),
      concatMap(({ operationId, payload }) =>
        from(
          appStore.exceptional.saveOperation(operationId, payload),
        ).pipe(
          map(() => ExceptionalActions.operationSucceeded()),
          catchError((error) =>
            of(ExceptionalActions.operationFailed({ message: this.toErrorMessage(error, "Impossible d'enregistrer le visa.") })),
          ),
        ),
      ),
    ),
  );

  // Interventions are saved as part of the operation aggregate: their validity
  // depends on the operation's real periods and visas are reviewed with the same
  // consultation modal.
  readonly saveInterventions$ = createEffect(() =>
    this.actions$.pipe(
      ofType(ExceptionalActions.interventionsSaveRequested),
      concatMap(({ operationId, interventions }) =>
        from(
          appStore.exceptional.saveOperation(operationId, { interventions }),
        ).pipe(
          map(() => ExceptionalActions.operationSucceeded()),
          catchError((error) =>
            of(ExceptionalActions.operationFailed({ message: this.toErrorMessage(error, "Impossible d'enregistrer les interventions.") })),
          ),
        ),
      ),
    ),
  );

  // RH send status is a business lock. All callers share the same timestamp
  // format; NULL is the explicit cancellation path through the domain API.
  readonly updateOperationRhSent$ = createEffect(() =>
    this.actions$.pipe(
      ofType(ExceptionalActions.operationRhSentUpdateRequested),
      concatMap(({ operationId, sent }) =>
        from(
          appStore.exceptional.saveOperation(operationId, {
            sentToRhAt: sent ? appStore.now() : null,
          }),
        ).pipe(
          map(() => ExceptionalActions.operationSucceeded()),
          catchError((error) =>
            of(ExceptionalActions.operationFailed({ message: this.toErrorMessage(error, "Impossible de modifier l'envoi RH.") })),
          ),
        ),
      ),
    ),
  );

  // Operations are sorted by start date for deterministic tables; filtering and
  // grouping remain component responsibilities once the store has the snapshot.
  private observeOperations(): Observable<ReturnType<typeof ExceptionalActions.operationsChanged | typeof ExceptionalActions.loadFailed>> {
    return new Observable((subscriber) => {
      const unsubscribe = appStore.exceptional.watchOperations(
        (documents) => {
          const operations = [...documents];
            operations.sort((first, second) => (first.startDate || "").localeCompare(second.startDate || ""));

          subscriber.next(ExceptionalActions.operationsChanged({ operations }));
        },
        (error) =>
          subscriber.next(ExceptionalActions.loadFailed({ message: this.toErrorMessage(error, "Impossible de charger les opérations.") })),
      );

      return unsubscribe;
    });
  }

  private observeUsers(): Observable<ReturnType<typeof ExceptionalActions.usersChanged | typeof ExceptionalActions.loadFailed>> {
    return new Observable((subscriber) => {
      const unsubscribe = appStore.users.watch(
        (documents) => {
          const users = documents
            .filter((user) => Boolean(user.email))
            .sort((first, second) => this.userLabel(first).localeCompare(this.userLabel(second)));

          subscriber.next(ExceptionalActions.usersChanged({ users }));
        },
        (error) =>
          subscriber.next(ExceptionalActions.loadFailed({ message: this.toErrorMessage(error, "Impossible de charger les utilisateurs.") })),
      );

      return unsubscribe;
    });
  }

  private userLabel(user: SelectableUser): string {
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
