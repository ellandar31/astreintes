import { createReducer, on } from "@ngrx/store";
import { SignatureProfile } from "../../shared/visa.models";
import { ProfileActions } from "./profile.actions";

export interface ProfileState {
  isLoading: boolean;
  isSaving: boolean;
  message: string;
  profile: SignatureProfile | null;
  saveCompletedAt: number | null;
}

export const initialProfileState: ProfileState = {
  isLoading: false,
  isSaving: false,
  message: "",
  profile: null,
  saveCompletedAt: null,
};

export const profileReducer = createReducer(
  initialProfileState,
  on(ProfileActions.watchStarted, (state): ProfileState => ({
    ...state,
    isLoading: true,
    message: "",
  })),
  on(ProfileActions.watchStopped, (): ProfileState => initialProfileState),
  on(ProfileActions.profileChanged, (state, { profile }): ProfileState => ({
    ...state,
    isLoading: false,
    profile,
  })),
  on(ProfileActions.profileLoadFailed, (state, { message }): ProfileState => ({
    ...state,
    isLoading: false,
    message,
  })),
  on(ProfileActions.saveRequested, (state): ProfileState => ({
    ...state,
    isSaving: true,
    message: "",
  })),
  on(ProfileActions.saveSucceeded, (state, { completedAt, message }): ProfileState => ({
    ...state,
    isSaving: false,
    message,
    saveCompletedAt: completedAt,
  })),
  on(ProfileActions.saveFailed, (state, { message }): ProfileState => ({
    ...state,
    isSaving: false,
    message,
  })),
  on(ProfileActions.messageCleared, (state): ProfileState => ({
    ...state,
    message: "",
  })),
);
