import { Injectable, inject } from "@angular/core";
import { Actions, createEffect, ofType } from "@ngrx/effects";
import { Store } from "@ngrx/store";
import { EMPTY, Observable, catchError, distinctUntilChanged, exhaustMap, from, map, of, switchMap, tap, timer } from "rxjs";
import { appStore, StoreAuthUser } from "../../store/app-store";
import { AuthActions } from "./auth.actions";
import { SettingsActions } from "../settings/settings.actions";

@Injectable()
/**
 * Boundary between Authentication provider and the application state.
 *
 * Auth provider only proves identity; the business role, display data and last login
 * are stored in the application users collection so administration screens,
 * validation rights and exports can all rely on the same user record.
 */
export class AuthEffects {
  private readonly actions$ = inject(Actions);
  private readonly store = inject(Store);

  /** Session permissions cannot depend on which page currently watches the user directory. */
  readonly watchSessionUsers$ = createEffect(() => this.actions$.pipe(
    ofType(AuthActions.sessionChanged, AuthActions.logoutRequested),
    // Focus and token refresh events for the same account must keep live data and permissions.
    // Only logout or an identity change starts a new subscription lifecycle.
    map(action => "user" in action ? action.user?.uid ?? null : null),
    distinctUntilChanged(),
    switchMap(uid => new Observable<ReturnType<typeof SettingsActions.usersChanged> | ReturnType<typeof AuthActions.logoutRequested>>(subscriber => {
      // Clear cached permissions on session switches and failures, rather than retaining a former role.
      subscriber.next(SettingsActions.usersChanged({ users: [] }));
      if (!uid) {
        subscriber.complete();
        return;
      }
      const stop = appStore.users.watch(
        users => {
          const profile = users.find(user => user.uid === uid);
          subscriber.next(!profile || profile.deletedAt
            ? AuthActions.logoutRequested()
            : SettingsActions.usersChanged({ users }));
        },
        () => subscriber.next(SettingsActions.usersChanged({ users: [] })),
      );
      // Realtime may be disabled or miss a deletion after RLS hides the profile.
      // Poll only the current profile; transient network failures are not deletions.
      const polling = timer(15_000, 15_000).pipe(
        switchMap(() => from(appStore.users.get(uid)).pipe(catchError(() => EMPTY))),
      ).subscribe(profile => {
        if (!profile || profile.deletedAt) subscriber.next(AuthActions.logoutRequested());
      });
      return () => { stop(); polling.unsubscribe(); };
    })),
  ));

  // The auth listener is intentionally registered once from NgRx: components only
  // react to sessionChanged actions and never subscribe directly to Auth provider.
  readonly startSessionWatch$ = createEffect(
    () =>
      this.actions$.pipe(
        ofType(AuthActions.sessionWatchStarted),
        tap(() => {
          appStore.auth.onSessionChanged((user) => {
            this.store.dispatch(AuthActions.sessionChanged({ user }));
          });
        }),
      ),
    { dispatch: false },
  );

  readonly registerSessionUser$ = createEffect(() =>
    this.actions$.pipe(
      ofType(AuthActions.sessionChanged),
      exhaustMap(({ user }) => {
        if (!user) {
          return EMPTY;
        }

        return from(this.registerAuthenticatedUser(user)).pipe(
          map(active => active ? AuthActions.operationCompleted() : AuthActions.logoutRequested()),
          catchError(() => of(AuthActions.sessionRegistrationFailed({ error: "Impossible de synchroniser le profil utilisateur." }))),
        );
      }),
    ),
  );

  // Login requests are exhaust-mapped to avoid concurrent provider redirects or
  // duplicated account creations when the user double-clicks the login button.
  readonly emailLogin$ = createEffect(() =>
    this.actions$.pipe(
      ofType(AuthActions.emailLoginRequested),
      exhaustMap(({ email, password, createAccount }) =>
        from(createAccount ? appStore.auth.createWithEmail(email, password) : appStore.auth.signInWithEmail(email, password)).pipe(
          map(() => AuthActions.operationCompleted()),
          catchError(() =>
            of(AuthActions.loginFailed({ error: "Connexion impossible. Vérifiez l'adresse email et le mot de passe." })),
          ),
        ),
      ),
    ),
  );

  readonly logout$ = createEffect(() =>
    this.actions$.pipe(
      ofType(AuthActions.logoutRequested),
      exhaustMap(() =>
        from(appStore.auth.signOut()).pipe(
          map(() => AuthActions.operationCompleted()),
          catchError(() => of(AuthActions.logoutFailed({ error: "Déconnexion impossible pour le moment." }))),
        ),
      ),
    ),
  );

  /** A login must never recreate a removed profile; SQL provisions new accounts at signup. */
  private async registerAuthenticatedUser(currentUser: StoreAuthUser): Promise<boolean> {
    const savedUser = await appStore.users.get(currentUser.uid);
    if (!savedUser || savedUser.deletedAt) return false;
    await appStore.users.save(currentUser.uid, {
      uid: currentUser.uid,
      email: currentUser.email || "",
      lastLoginAt: appStore.now(),
    });
    return true;
  }
}
