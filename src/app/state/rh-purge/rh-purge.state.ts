import { createActionGroup, createFeatureSelector, createReducer, emptyProps, on, props } from "@ngrx/store";
import { AuthActions } from "../auth/auth.actions";
import { RhPurgeOperation, RhRetentionYears } from "../../types/rh-purge.models";

export const RhPurgeActions = createActionGroup({ source: "RH Purge", events: {
  "Preview Requested": props<{ years: RhRetentionYears }>(),
  "User Preview Requested": props<{ userId: string }>(),
  "User Purge Requested": props<{ userId: string; operations: RhPurgeOperation[] }>(),
  "Preview Loaded": props<{ operations: RhPurgeOperation[] }>(),
  "Purge Requested": props<{ years: RhRetentionYears; operations: RhPurgeOperation[] }>(),
  "Purge Completed": props<{ count: number }>(),
  "Failed": props<{ error: string }>(),
  "Closed": emptyProps(),
} });
export interface RhPurgeState {
  years: RhRetentionYears;
  userId: string | null;
  operations: RhPurgeOperation[];
  loading: boolean;
  purging: boolean;
  error: string;
  deletedCount: number | null;
}
const initialState: RhPurgeState = { years: 2, userId: null, operations: [], loading: false, purging: false, error: "", deletedCount: null };
/** Preview is discarded on every retention change so stale rows can never be confirmed. */
export const rhPurgeReducer = createReducer(initialState,
  on(RhPurgeActions.previewRequested, (_state, { years }) => ({ ...initialState, years, loading: true })),
  on(RhPurgeActions.userPreviewRequested, (_state, { userId }) => ({ ...initialState, userId, loading: true })),
  on(RhPurgeActions.previewLoaded, (state, { operations }) => ({ ...state, operations, loading: false })),
  on(RhPurgeActions.purgeRequested, RhPurgeActions.userPurgeRequested, state => ({ ...state, purging: true, error: "", deletedCount: null })),
  on(RhPurgeActions.purgeCompleted, (state, { count }) => ({ ...state, operations: [], purging: false, deletedCount: count })),
  on(RhPurgeActions.failed, (state, { error }) => ({ ...state, operations: [], loading: false, purging: false, error })),
  on(RhPurgeActions.closed, AuthActions.logoutRequested, () => initialState),
);
export const selectRhPurge = createFeatureSelector<RhPurgeState>("rhPurge");
