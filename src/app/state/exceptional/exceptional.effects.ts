import { Injectable, inject } from "@angular/core";
import { Actions, createEffect, ofType } from "@ngrx/effects";
import { Observable, catchError, concatMap, from, map, merge, of, switchMap, takeUntil } from "rxjs";
import {
  ExceptionalIntervention,
  ExceptionalOperation,
  ExceptionalOperationType,
  OperationParticipant,
  SelectableUser,
} from "../../pages/exceptionnel/exceptional.models";
import { asSafeString } from "../../shared/value-normalizers";
import { SignatureVisa, createEmptyVisa } from "../../shared/visa.models";
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

  // setDocument with merge is used on edits so partial modal payloads can update
  // an aggregate without dropping visas or RH metadata that may have changed via
  // validation screens.
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

  // Interventions are saved as part of the operation aggregate: their validity
  // depends on the operation's real periods and visas are reviewed with the same
  // consultation modal.
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

  // RH send status is a business lock. The timestamp is server-side so exports,
  // validation and control screens share a trusted ordering.
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

  // Operations are sorted by start date for deterministic tables; filtering and
  // grouping remain component responsibilities once the store has the snapshot.
  private observeOperations(): Observable<ReturnType<typeof ExceptionalActions.operationsChanged | typeof ExceptionalActions.loadFailed>> {
    return new Observable((subscriber) => {
      const unsubscribe = appStore.data.observeCollection<Record<string, unknown>>(
        appStore.paths.exceptionalOperations(),
        (documents) => {
          const operations = documents
            .map((document) => this.operationFromStore(document.id, document.data))
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
      const unsubscribe = appStore.data.observeCollection<Record<string, unknown>>(
        appStore.paths.users(),
        (documents) => {
          const users = documents
            .map((document) => this.userFromStore(document.id, document.data))
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

  /**
   * Converts persisted JSONB/Firebase-like payloads into a complete operation aggregate.
   *
   * Exceptional operations are consumed by several screens at once: edition,
   * validation and RH exports. A missing array or visa must therefore become an
   * empty business value here instead of surfacing later as a rendering failure.
   */
  private operationFromStore(id: string, data: Record<string, unknown>): ExceptionalOperation {
    return {
      id,
      type: this.operationTypeFromStore(data["type"]),
      initiatorName: asSafeString(data["initiatorName"]),
      initiatorUid: asSafeString(data["initiatorUid"]),
      operationManagerName: asSafeString(data["operationManagerName"]),
      operationManagerUid: asSafeString(data["operationManagerUid"]),
      title: asSafeString(data["title"]),
      startDate: asSafeString(data["startDate"]),
      forecastEndDate: asSafeString(data["forecastEndDate"]),
      actualStartDate: asSafeString(data["actualStartDate"]),
      actualEndDate: asSafeString(data["actualEndDate"]),
      plannedUsers: this.participantsFromStore(data["plannedUsers"]),
      actualUsers: this.participantsFromStore(data["actualUsers"]),
      visas: this.operationVisasFromStore(data["visas"]),
      interventions: this.interventionsFromStore(data["interventions"]),
      sentToRhAt: asSafeString(data["sentToRhAt"]) || undefined,
    };
  }

  private operationTypeFromStore(value: unknown): ExceptionalOperationType {
    return value === "travaux" ? "travaux" : "astreinte";
  }

  private participantsFromStore(value: unknown): OperationParticipant[] {
    if (!Array.isArray(value)) {
      return [];
    }

    return value.map((item) => this.participantFromStore(this.asRecord(item)));
  }

  private participantFromStore(data: Record<string, unknown>): OperationParticipant {
    return {
      userId: asSafeString(data["userId"]),
      displayName: asSafeString(data["displayName"]),
      email: asSafeString(data["email"]),
      startDate: asSafeString(data["startDate"]),
      endDate: asSafeString(data["endDate"]),
      visa: this.visaFromStore(data["visa"]),
    };
  }

  private interventionsFromStore(value: unknown): ExceptionalIntervention[] {
    if (!Array.isArray(value)) {
      return [];
    }

    return value.map((item) => this.interventionFromStore(this.asRecord(item)));
  }

  private interventionFromStore(data: Record<string, unknown>): ExceptionalIntervention {
    return {
      date: asSafeString(data["date"]) || undefined,
      startDate: asSafeString(data["startDate"]),
      endDate: asSafeString(data["endDate"]),
      userId: asSafeString(data["userId"]),
      userName: asSafeString(data["userName"]),
      userEmail: asSafeString(data["userEmail"]),
      wasOnSite: data["wasOnSite"] === true,
      agentVisa: this.visaFromStore(data["agentVisa"]),
      label: asSafeString(data["label"]),
      comment: asSafeString(data["comment"]),
    };
  }

  private operationVisasFromStore(value: unknown): ExceptionalOperation["visas"] {
    const data = this.asRecord(value);

    return {
      initiatorGlobal: this.optionalVisaFromStore(data["initiatorGlobal"]),
      directorGlobal: this.optionalVisaFromStore(data["directorGlobal"]),
      plannedInitiator: this.visaFromStore(data["plannedInitiator"]),
      plannedDirector: this.visaFromStore(data["plannedDirector"]),
      actualInitiator: this.visaFromStore(data["actualInitiator"]),
      actualDirector: this.visaFromStore(data["actualDirector"]),
    };
  }

  private optionalVisaFromStore(value: unknown): SignatureVisa | undefined {
    return this.isRecord(value) ? this.visaFromStore(value) : undefined;
  }

  private visaFromStore(value: unknown): SignatureVisa {
    const data = this.asRecord(value);

    return {
      ...createEmptyVisa(),
      signed: data["signed"] === true,
      signedAt: asSafeString(data["signedAt"]),
      signedByName: asSafeString(data["signedByName"]),
      signedByUid: asSafeString(data["signedByUid"]),
      signatureMode: this.signatureModeFromStore(data["signatureMode"]),
      signatureValue: asSafeString(data["signatureValue"]) || undefined,
    };
  }

  private signatureModeFromStore(value: unknown): SignatureVisa["signatureMode"] {
    return value === "image" || value === "draw" || value === "name" ? value : undefined;
  }

  private userFromStore(id: string, data: Record<string, unknown>): SelectableUser {
    return {
      id,
      uid: asSafeString(data["uid"], id),
      displayName: asSafeString(data["displayName"]),
      email: asSafeString(data["email"]),
    };
  }

  private asRecord(value: unknown): Record<string, unknown> {
    return this.isRecord(value) ? value : {};
  }

  private isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
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
