import { createFeatureSelector, createSelector } from "@ngrx/store";
import { AuthState } from "./auth.reducer";

export const selectAuthState = createFeatureSelector<AuthState>("auth");

export const selectAuthUser = createSelector(selectAuthState, (state) => state.user);
export const selectAuthError = createSelector(selectAuthState, (state) => state.error);
export const selectIsSubmitting = createSelector(selectAuthState, (state) => state.isSubmitting);
export const selectLoadingSession = createSelector(selectAuthState, (state) => state.loadingSession);
export const selectDisplayName = createSelector(
  selectAuthUser,
  (user) => user?.displayName || user?.email || "Utilisateur",
);
