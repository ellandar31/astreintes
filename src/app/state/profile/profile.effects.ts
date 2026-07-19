import { Injectable, inject } from "@angular/core";
import { Actions, createEffect, ofType } from "@ngrx/effects";
import { Observable, catchError, concatMap, from, map, mergeMap, of, switchMap, takeUntil } from "rxjs";
import { SignatureProfile } from "../../shared/visa.models";
import { appStore, StoreAuthUser } from "../../store/app-store";
import { AuthActions } from "../auth/auth.actions";
import { ProfileActions } from "./profile.actions";

@Injectable()
export class ProfileEffects {
  private readonly actions$ = inject(Actions);

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

  private profileFromStore(data: SignatureProfile | undefined, user: StoreAuthUser): SignatureProfile {
    return {
      displayName: data?.displayName || user.displayName || "",
      signatureMode: data?.signatureMode || "name",
      signatureName: data?.signatureName || user.displayName || user.email || "",
      signatureImage: data?.signatureImage || "",
      signatureDrawing: data?.signatureDrawing || "",
    };
  }

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
