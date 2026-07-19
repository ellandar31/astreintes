import { createFeatureSelector, createSelector } from "@ngrx/store";
import { RegularState } from "./regular.reducer";

export const selectRegularState = createFeatureSelector<RegularState>("regular");

export const selectRegularError = createSelector(selectRegularState, (state) => state.error);
export const selectRegularInterventions = createSelector(selectRegularState, (state) => state.interventions);
export const selectRegularPeriods = createSelector(selectRegularState, (state) => state.periods);
export const selectRegularPublicHolidays = createSelector(selectRegularState, (state) => state.publicHolidays);
export const selectRegularTeams = createSelector(selectRegularState, (state) => state.teams);
export const selectRegularUsers = createSelector(selectRegularState, (state) => state.users);
