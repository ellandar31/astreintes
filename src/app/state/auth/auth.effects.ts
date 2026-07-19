import { Injectable, inject } from "@angular/core";
import { Actions, createEffect, ofType } from "@ngrx/effects";
import { Store } from "@ngrx/store";
import { EMPTY, catchError, exhaustMap, from, map, of, tap } from "rxjs";
import { appStore, StoreAuthUser } from "../../store/app-store";
import { AuthActions } from "./auth.actions";

@Injectable()
/**
 * Boundary between Firebase Authentication and the application state.
 *
 * Firebase only proves identity; the business role, display data and last login
 * are stored in the application users collection so administration screens,
 * validation rights and exports can all rely on the same user record.
 */
export class AuthEffects {
  private readonly actions$ = inject(Actions);
  private readonly store = inject(Store);

  // The auth listener is intentionally registered once from NgRx: components only
  // react to sessionChanged actions and never subscribe directly to Firebase Auth.
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

  // Login requests are exhaust-mapped to avoid concurrent Firebase popups or
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

  readonly googleLogin$ = createEffect(() =>
    this.actions$.pipe(
      ofType(AuthActions.googleLoginRequested),
      exhaustMap(() =>
        from(appStore.auth.signInWithGoogle()).pipe(
          map(() => AuthActions.operationCompleted()),
          catchError(() => of(AuthActions.loginFailed({ error: "Connexion Google impossible pour le moment." }))),
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

  /**
   * Ensures every authenticated account also has a business user document.
   *
   * Existing roles are preserved by merge updates. New users receive the default
   * role 1 (standard user), leaving administrator/director/initiateur elevation
   * to the settings workflow.
   */
  private async registerAuthenticatedUser(currentUser: StoreAuthUser): Promise<void> {
    const userReference = appStore.paths.user(currentUser.uid);
    const savedUser = await appStore.data.getDocument(userReference);
    const userPayload = {
      uid: currentUser.uid,
      email: currentUser.email || "",
      displayName: currentUser.displayName || "",
      lastLoginAt: appStore.data.serverTimestamp(),
    };

    // La session Firebase et les droits applicatifs sont séparés.
    // On garantit ici qu'un utilisateur authentifié existe aussi dans la base métier.
    if (savedUser) {
      await appStore.data.setDocument(userReference, userPayload, { merge: true });
      return;
    }

    await appStore.data.setDocument(userReference, {
      ...userPayload,
      role: 1,
    });
  }
}
