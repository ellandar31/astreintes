import { Injectable, inject } from "@angular/core";
import { Actions, createEffect, ofType } from "@ngrx/effects";
import { Store } from "@ngrx/store";
import { EMPTY, catchError, exhaustMap, from, map, of, tap } from "rxjs";
import { appStore, StoreAuthUser } from "../../store/app-store";
import { AuthActions } from "./auth.actions";

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
          map(() => AuthActions.operationCompleted()),
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

  /** Register the application profile without overwriting its role, signature or edited name on login. */
  private async registerAuthenticatedUser(currentUser: StoreAuthUser): Promise<void> {
    const savedUser = await appStore.users.get(currentUser.uid);
    await appStore.users.save(currentUser.uid, {
      uid: currentUser.uid,
      email: currentUser.email || "",
      lastLoginAt: appStore.now(),
      ...(!savedUser ? { role: 1, displayName: currentUser.displayName || "" } : {}),
    });
  }
}
