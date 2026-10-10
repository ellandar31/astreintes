import { ExceptionalOperationType } from "../../types";

/** Each family owns its parent table; child/visa foreign keys must follow that family. */
export const exceptionalTables = {
  astreinte: {
    type: "astreinte",
    table: "exceptional_on_calls", participants: "exceptional_on_call_participants",
    interventions: "exceptional_on_call_interventions", visas: "exceptional_on_call_visas", parentColumn: "operation_id",
  },
  travaux: {
    type: "travaux",
    table: "exceptional_works", participants: "exceptional_work_participants",
    interventions: null, visas: "exceptional_work_visas", parentColumn: "operation_id",
  },
} as const;

export type ExceptionalTables = typeof exceptionalTables[ExceptionalOperationType];

/** Never silently store an unknown family as an on-call period. */
export function tablesForExceptionalType(type: ExceptionalOperationType | undefined): ExceptionalTables {
  if (type !== "astreinte" && type !== "travaux") {
    throw new Error("Type d'operation exceptionnelle invalide.");
  }
  return exceptionalTables[type];
}

/** SQL IDs are now independent; the namespace prevents collisions in combined NgRx/RH lists. */
export function exceptionalId(type: ExceptionalOperationType, id: number): string {
  return `${type}:${id}`;
}

/** Reject ambiguous legacy IDs instead of updating/deleting the wrong family. */
export function parseExceptionalId(identifier: string): { type: ExceptionalOperationType; id: number } {
  const match = /^(astreinte|travaux):([1-9]\d*)$/.exec(identifier);
  const id = Number(match?.[2]);
  if (!match || !Number.isSafeInteger(id)) throw new Error("Identifiant d'operation exceptionnel invalide.");
  return { type: match[1] as ExceptionalOperationType, id };
}
