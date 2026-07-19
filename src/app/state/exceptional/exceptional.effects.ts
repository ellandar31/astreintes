import { Injectable, inject } from "@angular/core";
import { Actions, createEffect, ofType } from "@ngrx/effects";
import { Observable, catchError, concatMap, from, map, merge, of, switchMap, takeUntil } from "rxjs";
import { ExceptionalOperation, SelectableUser } from "../../pages/exceptionnel/exceptional.models";
import { appStore } from "../../store/app-store";
import { ExceptionalActions } from "./exceptional.actions";

@Injectable()
export class ExceptionalEffects {
  private readonly actions$ = inject(Actions);

  // Keeps Firebase access for exceptional operations outside presentation components.
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

  readonly saveOperation$ = createEffect(() =>
    this.actions$.pipe(
      ofType(ExceptionalActions.operationSaveRequested),
      concatMap(({ operationId, payload }) => {
        const request = operationId
          ? appStore.data.setDocument(
              appStore.paths.exceptionalOperation(operationId),
              { ...payload, updatedAt: appStore.data.serverTimestamp() },
              { merge: true },
            )
          : appStore.data.addDocument(appStore.paths.exceptionalOperations(), {
              ...payload,
              createdAt: appStore.data.serverTimestamp(),
              updatedAt: appStore.data.serverTimestamp(),
            });

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
        from(appStore.data.deleteDocument(appStore.paths.exceptionalOperation(operationId))).pipe(
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
          appStore.data.setDocument(
            appStore.paths.exceptionalOperation(operationId),
            { ...payload, updatedAt: appStore.data.serverTimestamp() },
            { merge: true },
          ),
        ).pipe(
          map(() => ExceptionalActions.operationSucceeded()),
          catchError((error) =>
            of(ExceptionalActions.operationFailed({ message: this.toErrorMessage(error, "Impossible d'enregistrer le visa.") })),
          ),
        ),
      ),
    ),
  );

  readonly saveInterventions$ = createEffect(() =>
    this.actions$.pipe(
      ofType(ExceptionalActions.interventionsSaveRequested),
      concatMap(({ operationId, interventions }) =>
        from(
          appStore.data.setDocument(
            appStore.paths.exceptionalOperation(operationId),
            {
              interventions,
              updatedAt: appStore.data.serverTimestamp(),
            },
            { merge: true },
          ),
        ).pipe(
          map(() => ExceptionalActions.operationSucceeded()),
          catchError((error) =>
            of(ExceptionalActions.operationFailed({ message: this.toErrorMessage(error, "Impossible d'enregistrer les interventions.") })),
          ),
        ),
      ),
    ),
  );

  readonly updateOperationRhSent$ = createEffect(() =>
    this.actions$.pipe(
      ofType(ExceptionalActions.operationRhSentUpdateRequested),
      concatMap(({ operationId, sent }) =>
        from(
          appStore.data.updateDocument(appStore.paths.exceptionalOperation(operationId), {
            sentToRhAt: sent ? appStore.data.serverTimestamp() : appStore.data.deleteField(),
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

  private observeOperations(): Observable<ReturnType<typeof ExceptionalActions.operationsChanged | typeof ExceptionalActions.loadFailed>> {
    return new Observable((subscriber) => {
      const unsubscribe = appStore.data.observeCollection<ExceptionalOperation>(
        appStore.paths.exceptionalOperations(),
        (documents) => {
          const operations = documents
            .map((document) => ({ ...document.data, id: document.id }) as ExceptionalOperation)
            .sort((first, second) => (first.startDate || "").localeCompare(second.startDate || ""));

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
      const unsubscribe = appStore.data.observeCollection<SelectableUser>(
        appStore.paths.users(),
        (documents) => {
          const users = documents
            .map((document) => ({ ...document.data, id: document.id }) as SelectableUser)
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
