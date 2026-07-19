import { createFeatureSelector, createSelector } from "@ngrx/store";
import { ExceptionalState } from "./exceptional.reducer";

export const selectExceptionalState = createFeatureSelector<ExceptionalState>("exceptional");

export const selectExceptionalError = createSelector(selectExceptionalState, (state) => state.error);
export const selectExceptionalOperations = createSelector(selectExceptionalState, (state) => state.operations);
export const selectExceptionalUsers = createSelector(selectExceptionalState, (state) => state.users);
