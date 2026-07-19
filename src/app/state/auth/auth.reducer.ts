import { createReducer, on } from "@ngrx/store";
import { StoreAuthUser } from "../../store/app-store";
import { AuthActions } from "./auth.actions";

export interface AuthState {
  error: string;
  isSubmitting: boolean;
  loadingSession: boolean;
  user: StoreAuthUser | null;
}

export const initialAuthState: AuthState = {
  error: "",
  isSubmitting: false,
  loadingSession: true,
  user: null,
};

export const authReducer = createReducer(
  initialAuthState,
  on(AuthActions.emailLoginRequested, AuthActions.googleLoginRequested, (state): AuthState => ({
    ...state,
    error: "",
    isSubmitting: true,
  })),
  on(AuthActions.loginFailed, (state, { error }): AuthState => ({
    ...state,
    error,
    isSubmitting: false,
  })),
  on(AuthActions.emailLoginFormInvalid, (state, { error }): AuthState => ({
    ...state,
    error,
    isSubmitting: false,
  })),
  on(AuthActions.errorCleared, (state): AuthState => ({
    ...state,
    error: "",
  })),
  on(AuthActions.sessionChanged, (state, { user }): AuthState => ({
    ...state,
    error: "",
    isSubmitting: false,
    loadingSession: false,
    user,
  })),
  on(AuthActions.operationCompleted, (state): AuthState => ({
    ...state,
    isSubmitting: false,
  })),
  on(AuthActions.logoutRequested, (state): AuthState => ({
    ...state,
    error: "",
    isSubmitting: false,
    loadingSession: false,
    user: null,
  })),
  on(AuthActions.sessionRegistrationFailed, AuthActions.logoutFailed, (state, { error }): AuthState => ({
    ...state,
    error,
    isSubmitting: false,
  })),
);
