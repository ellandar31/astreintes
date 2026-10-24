import { hasDirectorRights } from "../../shared/user-role-permissions";
import { createFeatureSelector, createSelector } from "@ngrx/store";
import { SettingsState } from "./settings.reducer";
import { selectAuthUser } from "../auth/auth.selectors";

export const selectSettingsState = createFeatureSelector<SettingsState>("settings");

export const selectSettingsUsers = createSelector(selectSettingsState, (state) => state.users);

/** Ownership uses the SQL profile ID, never a mutable email or auth metadata. */
export const selectCurrentApplicationUser = createSelector(selectAuthUser, selectSettingsUsers,
  (session, users) => session ? users.find(user => user.uid === session.uid) : undefined,
);

/** Ordinary users can report interventions, but cannot change the approved planning. */
export const selectCanEditPlanning = createSelector(selectCurrentApplicationUser,
  user => Boolean(user && (user.role === 0 || user.role === 2 || hasDirectorRights(user.role))),
);

/** Fail closed while the current session's database profile is missing; auth metadata never grants an application role. */
export const selectCanManageUsers = createSelector(selectAuthUser, selectSettingsUsers,
  (session, users) => Boolean(session && users.some(user => user.uid === session.uid && user.role === 0)),
);

/** Only known management roles may open settings; missing profiles and ordinary users fail closed. */
export const selectCanOpenSettings = createSelector(selectAuthUser, selectSettingsUsers,
  (session, users) => Boolean(session && users.some(user => user.uid === session.uid
    && (user.role === 0 || user.role === 2 || hasDirectorRights(user.role)))),
);

/** Administrateurs, initiateurs, directeurs et RH peuvent créer les opérations. */
export const selectCanCreateOperations = createSelector(selectAuthUser, selectSettingsUsers,
  (session, users) => Boolean(session && users.some(user => user.uid === session.uid
    && (user.role === 0 || user.role === 2 || hasDirectorRights(user.role)))),
);
export const selectSettingsTeams = createSelector(selectSettingsState, (state) => state.teams);
export const selectSettingsHolidays = createSelector(selectSettingsState, (state) => state.holidays);
export const selectSettingsImportedHolidays = createSelector(selectSettingsState, (state) => state.importedHolidays);
export const selectSettingsIsLoadingOfficialHolidays = createSelector(selectSettingsState, (state) => state.isLoadingOfficialHolidays);
export const selectSettingsIsSaving = createSelector(selectSettingsState, (state) => state.isSaving);
export const selectSettingsMessage = createSelector(selectSettingsState, (state) => state.message);
export const selectSettingsRhCompensation = createSelector(selectSettingsState, (state) => state.rhCompensation);

/** Seuls les profils d'encadrement peuvent être désignés initiateurs d'une opération. */
export const selectOperationInitiators = createSelector(selectSettingsUsers,
  users => users.filter(user => Boolean(user.email) && (user.role === 0 || user.role === 2 || hasDirectorRights(user.role)))
    .sort((first, second) => (first.displayName || first.email).localeCompare(second.displayName || second.email)),
);

/** Les exports RH par opération et par période sont réservés à l'administration, aux directeurs et aux RH. */
export const selectCanExportRh = createSelector(selectCurrentApplicationUser,
  user => Boolean(user && (user.role === 0 || hasDirectorRights(user.role))),
);

export const selectSettingsDirections = createSelector(selectSettingsState, state => state?.directions ?? []);
