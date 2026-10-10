import { createFeatureSelector, createSelector } from "@ngrx/store";
import { selectCurrentApplicationUser } from "../settings/settings.selectors";
import { ExceptionalState } from "./exceptional.reducer";

export const selectExceptionalState = createFeatureSelector<ExceptionalState>("exceptional");

export const selectExceptionalError = createSelector(selectExceptionalState, (state) => state.error);
export const selectExceptionalOperations = createSelector(selectExceptionalState, (state) => state.operations);
export const selectExceptionalUsers = createSelector(selectExceptionalState, (state) => state.users);

/**
 * Un utilisateur consulte uniquement les opérations auxquelles il participe,
 * en prévisionnel ou en réel. L'identité SQL du profil reste la référence :
 * le profil initiateur voit aussi les opérations dont il est initiateur.
 * Aucun élément n'est affiché tant que le profil de la session n'est pas chargé.
 */
export const selectVisibleExceptionalOperations = createSelector(
  selectExceptionalOperations,
  selectCurrentApplicationUser,
  (operations, user) => {
    if (!user) return [];
    if (user.role === 0 || user.role === 3) return operations;

    return operations.filter(operation =>
      (user.role === 2 && operation.initiatorUid === user.id)
      || operation.plannedUsers.some(participant => participant.userId === user.id)
      || operation.actualUsers.some(participant => participant.userId === user.id),
    );
  },
);
