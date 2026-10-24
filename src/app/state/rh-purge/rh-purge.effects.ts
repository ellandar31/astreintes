import { Injectable, inject } from "@angular/core";
import { Actions, createEffect, ofType } from "@ngrx/effects";
import { catchError, exhaustMap, from, map, of, switchMap, takeUntil } from "rxjs";
import { appStore } from "../../store/app-store";
import { APP_LABELS } from "../../i18n/labels";
import { AuthActions } from "../auth/auth.actions";
import { RhPurgeActions } from "./rh-purge.state";

@Injectable()
export class RhPurgeEffects {
  private readonly actions$ = inject(Actions);
  private readonly closed$ = this.actions$.pipe(ofType(RhPurgeActions.closed, AuthActions.logoutRequested));

  readonly preview$ = createEffect(() => this.actions$.pipe(
    ofType(RhPurgeActions.previewRequested, RhPurgeActions.userPreviewRequested),
    switchMap(action => from("userId" in action ? appStore.rhPurge.previewUser(action.userId) : appStore.rhPurge.preview(action.years)).pipe(
      map(operations => RhPurgeActions.previewLoaded({ operations })),
      catchError(() => of(RhPurgeActions.failed({ error: APP_LABELS.rh.purge.loadFailed }))),
      takeUntil(this.closed$),
    )),
  ));

  /** Ignore duplicate confirmations while the atomic server transaction is running. */
  readonly purge$ = createEffect(() => this.actions$.pipe(
    ofType(RhPurgeActions.purgeRequested, RhPurgeActions.userPurgeRequested),
    exhaustMap(action => from("userId" in action ? appStore.rhPurge.purgeUser(action.userId, action.operations) : appStore.rhPurge.purge(action.years, action.operations)).pipe(
      map(count => RhPurgeActions.purgeCompleted({ count })),
      catchError(() => of(RhPurgeActions.failed({ error: APP_LABELS.rh.purge.purgeFailed }))),
      takeUntil(this.closed$),
    )),
  ));
}
