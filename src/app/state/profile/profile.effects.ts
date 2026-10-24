import { Injectable, inject } from "@angular/core";
import { Actions, createEffect, ofType } from "@ngrx/effects";
import { Observable, catchError, concatMap, from, mergeMap, of, switchMap, takeUntil } from "rxjs";
import { ApplicationUser } from "../../types";
import { SignatureProfile } from "../../shared/visa.models";
import { appStore, StoreAuthUser } from "../../store/app-store";
import { AuthActions } from "../auth/auth.actions";
import { ProfileActions } from "./profile.actions";

@Injectable()
/**
 * Maintains the current user's editable display name and visa name.
 *
 * Signature data is part of the application profile because visas must be rendered in
 * validation screens and RH exports without reopening provider-specific auth
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
          const unsubscribe = appStore.users.watchOne(user.uid,
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

  // concatMap serializes profile saves: updating Auth provider and the persisted
  // application profile must stay ordered to keep the header, profile modal and visa
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
   * Projects legacy profiles onto the name-only visa settings.
   * Historical visa snapshots are independent and remain unchanged.
   */
  private profileFromStore(data: ApplicationUser | undefined, user: StoreAuthUser): SignatureProfile {
    return {
      displayName: data?.displayName ?? user.displayName ?? "",
      signatureMode: "name",
      signatureName: data?.signatureName || user.displayName || user.email || "",
      signatureImage: "",
      signatureDrawing: "",
    };
  }

  /**
   * Persists profile fields used by both the application shell and exports.
   *
   * The display name is pushed to Auth provider for provider-level consistency,
   * while the visa name stays in application data where validation/export
   * features can read them through the central store.
   */
  private async saveProfile(
    profile: SignatureProfile,
    user: StoreAuthUser,
  ): Promise<{ savedProfile: SignatureProfile; updatedUser: StoreAuthUser }> {
    const displayName = profile.displayName?.trim() || "";
    const signatureName = profile.signatureName?.trim() || displayName || user.displayName || user.email || "";
    const savedProfile: SignatureProfile = {
      displayName,
      signatureName,
      // Clear obsolete graphics when saving so they cannot be reused by legacy clients.
      signatureMode: "name",
      signatureImage: "",
      signatureDrawing: "",
    };

    if (displayName && displayName !== user.displayName) {
      await appStore.auth.updateProfile(user, { displayName });
    }

    await appStore.users.save(user.uid, { ...savedProfile, email: user.email || "" });

    return {
      savedProfile,
      updatedUser: {
        ...user,
        displayName: displayName || user.displayName,
      },
    };
  }
}
