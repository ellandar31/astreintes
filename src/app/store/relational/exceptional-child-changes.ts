import { ExceptionalIntervention, OperationParticipant } from "../../types";

/** UI-only labels and the legacy date alias must not cause writes to another owner's rows. */
export function sameIntervention(first: ExceptionalIntervention, second: ExceptionalIntervention): boolean {
  return first.userId === second.userId && first.startDate === second.startDate
    && first.endDate === second.endDate && first.wasOnSite === second.wasOnSite
    && first.label === second.label && first.comment === second.comment
    && (second.ticket === undefined || first.ticket === second.ticket)
    && JSON.stringify(first.agentVisa) === JSON.stringify(second.agentVisa);
}

/** Participant visas may change independently, but untouched planning must never be rebuilt. */
export function sameParticipants(first: OperationParticipant[], second: OperationParticipant[], includeVisa = true): boolean {
  const identity = (row: OperationParticipant): string => JSON.stringify([
    row.userId, row.startDate, row.endDate, includeVisa ? row.visa : undefined,
  ]);
  return first.length === second.length && first.every((row, index) => identity(row) === identity(second[index]));
}
