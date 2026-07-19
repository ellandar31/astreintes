import { createFeatureSelector, createSelector } from "@ngrx/store";
import { ProfileState } from "./profile.reducer";

export const selectProfileState = createFeatureSelector<ProfileState>("profile");

export const selectProfile = createSelector(selectProfileState, (state) => state.profile);
export const selectProfileIsLoading = createSelector(selectProfileState, (state) => state.isLoading);
export const selectProfileIsSaving = createSelector(selectProfileState, (state) => state.isSaving);
export const selectProfileMessage = createSelector(selectProfileState, (state) => state.message);
export const selectProfileSaveCompletedAt = createSelector(selectProfileState, (state) => state.saveCompletedAt);
