import { createFeatureSelector, createSelector } from "@ngrx/store";
import { SettingsState } from "./settings.reducer";

export const selectSettingsState = createFeatureSelector<SettingsState>("settings");

export const selectSettingsUsers = createSelector(selectSettingsState, (state) => state.users);
export const selectSettingsTeams = createSelector(selectSettingsState, (state) => state.teams);
export const selectSettingsHolidays = createSelector(selectSettingsState, (state) => state.holidays);
export const selectSettingsImportedHolidays = createSelector(selectSettingsState, (state) => state.importedHolidays);
export const selectSettingsIsLoadingOfficialHolidays = createSelector(selectSettingsState, (state) => state.isLoadingOfficialHolidays);
export const selectSettingsIsSaving = createSelector(selectSettingsState, (state) => state.isSaving);
export const selectSettingsMessage = createSelector(selectSettingsState, (state) => state.message);
export const selectSettingsRhCompensation = createSelector(selectSettingsState, (state) => state.rhCompensation);
export const selectSettingsRhTemplates = createSelector(selectSettingsState, (state) => state.rhTemplates);
