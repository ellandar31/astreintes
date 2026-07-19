import { createReducer, on } from "@ngrx/store";
import { ExceptionalOperation, SelectableUser } from "../../pages/exceptionnel/exceptional.models";
import { ExceptionalActions } from "./exceptional.actions";

export interface ExceptionalState {
  error: string;
  isSaving: boolean;
  operations: ExceptionalOperation[];
  users: SelectableUser[];
}

export const initialExceptionalState: ExceptionalState = {
  error: "",
  isSaving: false,
  operations: [],
  users: [],
};

export const exceptionalReducer = createReducer(
  initialExceptionalState,
  on(ExceptionalActions.operationsChanged, (state, { operations }): ExceptionalState => ({ ...state, operations })),
  on(ExceptionalActions.usersChanged, (state, { users }): ExceptionalState => ({ ...state, users })),
  on(
    ExceptionalActions.operationSaveRequested,
    ExceptionalActions.operationPatchRequested,
    ExceptionalActions.operationDeleteRequested,
    ExceptionalActions.interventionsSaveRequested,
    ExceptionalActions.operationRhSentUpdateRequested,
    (state): ExceptionalState => ({
      ...state,
      error: "",
      isSaving: true,
    }),
  ),
  on(ExceptionalActions.operationSucceeded, (state): ExceptionalState => ({
    ...state,
    isSaving: false,
  })),
  on(ExceptionalActions.loadFailed, ExceptionalActions.operationFailed, (state, { message }): ExceptionalState => ({
    ...state,
    error: message,
    isSaving: false,
  })),
);
