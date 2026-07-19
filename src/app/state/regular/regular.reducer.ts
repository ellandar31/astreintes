import { createReducer, on } from "@ngrx/store";
import {
  RegularIntervention,
  RegularOnCallPeriod,
  RegularPublicHoliday,
  RegularTeam,
  RegularUser,
} from "../../pages/regular/regular.models";
import { RegularActions } from "./regular.actions";

export interface RegularState {
  error: string;
  isSaving: boolean;
  interventions: RegularIntervention[];
  periods: RegularOnCallPeriod[];
  publicHolidays: RegularPublicHoliday[];
  teams: RegularTeam[];
  users: RegularUser[];
}

export const initialRegularState: RegularState = {
  error: "",
  isSaving: false,
  interventions: [],
  periods: [],
  publicHolidays: [],
  teams: [],
  users: [],
};

export const regularReducer = createReducer(
  initialRegularState,
  on(RegularActions.teamsChanged, (state, { teams }): RegularState => ({ ...state, teams })),
  on(RegularActions.usersChanged, (state, { users }): RegularState => ({ ...state, users })),
  on(RegularActions.periodsChanged, (state, { periods }): RegularState => ({ ...state, periods })),
  on(RegularActions.interventionsChanged, (state, { interventions }): RegularState => ({ ...state, interventions })),
  on(RegularActions.publicHolidaysChanged, (state, { publicHolidays }): RegularState => ({ ...state, publicHolidays })),
  on(
    RegularActions.periodSaveRequested,
    RegularActions.periodDeleteRequested,
    RegularActions.interventionSaveRequested,
    RegularActions.interventionDeleteRequested,
    RegularActions.periodVisaUpdateRequested,
    RegularActions.interventionVisaUpdateRequested,
    RegularActions.interventionsVisaBatchUpdateRequested,
    RegularActions.periodRhSentUpdateRequested,
    (state): RegularState => ({
      ...state,
      error: "",
      isSaving: true,
    }),
  ),
  on(RegularActions.operationSucceeded, (state): RegularState => ({
    ...state,
    isSaving: false,
  })),
  on(RegularActions.loadFailed, RegularActions.operationFailed, (state, { message }): RegularState => ({
    ...state,
    error: message,
    isSaving: false,
  })),
);
