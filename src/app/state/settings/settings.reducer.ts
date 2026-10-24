import { createReducer, on } from "@ngrx/store";
import {
  Direction,
  PublicHoliday,
  RhCompensationSettings,
  Team,
  ManagedUser,
} from "../../pages/settings/settings.models";
import { SettingsActions, SettingsMessageKind, SettingsMessageSource } from "./settings.actions";

export interface SettingsOperationMessage {
  completedAt: number;
  kind: SettingsMessageKind;
  message: string;
  source: SettingsMessageSource;
}

export interface SettingsState {
  directions: Direction[];
  isSaving: boolean;
  importedHolidays: PublicHoliday[];
  isLoadingOfficialHolidays: boolean;
  holidays: PublicHoliday[];
  message: SettingsOperationMessage | null;
  rhCompensation: RhCompensationSettings | null;
  teams: Team[];
  users: ManagedUser[];
}

export const initialSettingsState: SettingsState = {
  directions: [],
  isSaving: false,
  importedHolidays: [],
  isLoadingOfficialHolidays: false,
  holidays: [],
  message: null,
  rhCompensation: null,
  teams: [],
  users: [],
};

export const settingsReducer = createReducer(
  initialSettingsState,
  on(SettingsActions.directionsChanged, (state, { directions }): SettingsState => ({ ...state, directions })),
  on(SettingsActions.usersChanged, (state, { users }): SettingsState => ({
    ...state,
    users,
  })),
  on(SettingsActions.teamsChanged, (state, { teams }): SettingsState => ({
    ...state,
    teams,
  })),
  on(SettingsActions.holidaysChanged, (state, { holidays }): SettingsState => ({
    ...state,
    holidays,
  })),
  on(SettingsActions.officialHolidaysLoadRequested, (state): SettingsState => ({
    ...state,
    importedHolidays: [],
    isLoadingOfficialHolidays: true,
    message: null,
  })),
  on(SettingsActions.officialHolidaysLoaded, (state, { holidays }): SettingsState => ({
    ...state,
    importedHolidays: holidays,
    isLoadingOfficialHolidays: false,
  })),
  on(SettingsActions.rhCompensationChanged, (state, { settings }): SettingsState => ({
    ...state,
    rhCompensation: settings,
  })),
  on(
    SettingsActions.directionSaveRequested,
    SettingsActions.directionDeleteRequested,
    SettingsActions.userRoleUpdateRequested,
    SettingsActions.userDeleteRequested,
    SettingsActions.teamSaveRequested,
    SettingsActions.teamDeleteRequested,
    SettingsActions.importedHolidaysSaveRequested,
    SettingsActions.manualHolidaySaveRequested,
    SettingsActions.holidayDeleteRequested,
    SettingsActions.rhCompensationSaveRequested,
    (state): SettingsState => ({
      ...state,
      isSaving: true,
      message: null,
    }),
  ),
  on(SettingsActions.operationSucceeded, (state, { completedAt, message, source }): SettingsState => ({
    ...state,
    isLoadingOfficialHolidays: false,
    isSaving: false,
    message: {
      completedAt,
      kind: "success",
      message,
      source,
    },
  })),
  on(SettingsActions.operationFailed, (state, { completedAt, message, source }): SettingsState => ({
    ...state,
    isLoadingOfficialHolidays: false,
    isSaving: false,
    message: {
      completedAt,
      kind: "failure",
      message,
      source,
    },
  })),
);
