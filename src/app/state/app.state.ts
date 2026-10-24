import { RhPurgeState, rhPurgeReducer } from "./rh-purge/rh-purge.state";
import { ActionReducerMap } from "@ngrx/store";
import { AuthState, authReducer } from "./auth/auth.reducer";
import { ExceptionalState, exceptionalReducer } from "./exceptional/exceptional.reducer";
import { ProfileState, profileReducer } from "./profile/profile.reducer";
import { RegularState, regularReducer } from "./regular/regular.reducer";
import { SettingsState, settingsReducer } from "./settings/settings.reducer";

export interface AppState {
  auth: AuthState;
  exceptional: ExceptionalState;
  profile: ProfileState;
  regular: RegularState;
  settings: SettingsState;
  rhPurge: RhPurgeState;
}

export const appReducers: ActionReducerMap<AppState> = {
  auth: authReducer,
  exceptional: exceptionalReducer,
  profile: profileReducer,
  regular: regularReducer,
  settings: settingsReducer,
  rhPurge: rhPurgeReducer,
};
