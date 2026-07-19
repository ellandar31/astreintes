import { Injectable, inject } from "@angular/core";
import { Actions, createEffect, ofType } from "@ngrx/effects";
import { Observable, catchError, concatMap, from, map, mergeMap, of, switchMap, takeUntil } from "rxjs";
import { SignatureProfile } from "../../shared/visa.models";
import { appStore, StoreAuthUser } from "../../store/app-store";
import { AuthActions } from "../auth/auth.actions";
import { ProfileActions } from "./profile.actions";

@Injectable()
/**
 * Maintains the current user's editable profile and signature preferences.
 *
 * Signature data is part of the user document because visas must be rendered in
 * validation screens and RH exports without reopening Firebase Auth-specific
 * APIs. The effect also keeps the Auth user display name aligned after save.
 */
export class ProfileEffects {
  private readonly actions$ = inject(Actions);

  // The profile watch follows the logged-in user and is explicitly stopped on
  // navigation/logout so stale signature data cannot leak to the next session.
  readonly watchProfile$ = createEffect(() =>
    this.actions$.pipe(
      ofType(ProfileActions.watchStarted),
      switchMap(({ user }) =>
        new Observable<ReturnType<typeof ProfileActions.profileChanged | typeof ProfileActions.profileLoadFailed>>((subscriber) => {
          const unsubscribe = appStore.data.observeDocument<SignatureProfile>(
            appStore.paths.user(user.uid),
            (data) => {
              subscriber.next(ProfileActions.profileChanged({ profile: this.profileFromStore(data, user) }));
            },
            () => {
              subscriber.next(ProfileActions.profileLoadFailed({ message: "Impossible de charger le profil." }));
            },
          );

          return unsubscribe;
        }).pipe(takeUntil(this.actions$.pipe(ofType(ProfileActions.watchStopped)))),
      ),
    ),
  );

  // concatMap serializes profile saves: updating Firebase Auth and the Firestore
  // user document must stay ordered to keep the header, profile modal and visa
  // labels consistent immediately after the save.
  readonly saveProfile$ = createEffect(() =>
    this.actions$.pipe(
      ofType(ProfileActions.saveRequested),
      concatMap(({ profile, user }) =>
        from(this.saveProfile(profile, user)).pipe(
          mergeMap(({ savedProfile, updatedUser }) => [
            ProfileActions.profileChanged({ profile: savedProfile }),
            AuthActions.sessionChanged({ user: updatedUser }),
            ProfileActions.saveSucceeded({ completedAt: Date.now(), message: "Profil enregistré." }),
          ]),
          catchError(() => of(ProfileActions.saveFailed({ message: "Impossible d'enregistrer le profil." }))),
        ),
      ),
    ),
  );

  /**
   * Rebuilds a complete profile from a possibly partial legacy document.
   *
   * Older users may not have signature fields yet. The fallbacks keep the visa
   * workflow usable with a simple typed name until the user uploads or draws a
   * signature.
   */
  private profileFromStore(data: SignatureProfile | undefined, user: StoreAuthUser): SignatureProfile {
    return {
      displayName: data?.displayName || user.displayName || "",
      signatureMode: data?.signatureMode || "name",
      signatureName: data?.signatureName || user.displayName || user.email || "",
      signatureImage: data?.signatureImage || "",
      signatureDrawing: data?.signatureDrawing || "",
    };
  }

  /**
   * Persists profile fields used by both the application shell and exports.
   *
   * The display name is pushed to Firebase Auth for provider-level consistency,
   * while signature preferences stay in Firestore where validation/export
   * features can read them through the central store.
   */
  private async saveProfile(
    profile: SignatureProfile,
    user: StoreAuthUser,
  ): Promise<{ savedProfile: SignatureProfile; updatedUser: StoreAuthUser }> {
    const displayName = profile.displayName?.trim() || "";
    const signatureName = profile.signatureName?.trim() || displayName || user.displayName || user.email || "";
    const savedProfile: SignatureProfile = {
      ...profile,
      displayName,
      signatureName,
    };

    if (displayName && displayName !== user.displayName) {
      await appStore.auth.updateProfile(user, { displayName });
    }

    await appStore.data.setDocument(
      appStore.paths.user(user.uid),
      {
        ...savedProfile,
        email: user.email || "",
      },
      { merge: true },
    );

    return {
      savedProfile,
      updatedUser: {
        ...user,
        displayName: displayName || user.displayName,
      },
    };
  }
}
