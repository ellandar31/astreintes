import { RhExceptionalOperation, RegularIntervention, RegularOnCallPeriod } from "../types";
import { createEmptyVisa } from "./visa.models";

/** Director approval closes the chain; every attached intervention belongs to it. */
export function regularReadyForDirector(period: Pick<RegularOnCallPeriod, "agentVisa">, interventions: readonly Pick<RegularIntervention, "agentVisa">[]): boolean {
  return period.agentVisa?.signed === true && interventions.every(item => item.agentVisa?.signed === true);
}

/** Legacy global visa fields are aliases, not additional approvals to collect. */
export function exceptionalReadyForDirector(operation: Pick<RhExceptionalOperation, "visas" | "plannedUsers" | "actualUsers" | "interventions">): boolean {
  const initiator = operation.visas?.initiatorGlobal ?? operation.visas?.actualInitiator ?? operation.visas?.plannedInitiator;
  return initiator?.signed === true
    && [...(operation.plannedUsers ?? []), ...(operation.actualUsers ?? [])].every(item => item.visa?.signed === true)
    && (operation.interventions ?? []).every(item => item.agentVisa?.signed === true);
}

/** RH receives only a complete chain, including the final director approval. */
export function regularReadyForRh(period: Pick<RegularOnCallPeriod, "agentVisa" | "directorVisa">, interventions: readonly Pick<RegularIntervention, "agentVisa">[]): boolean {
  return regularReadyForDirector(period, interventions) && period.directorVisa?.signed === true;
}

/** Apply the same completeness rule to both exceptional families. */
export function exceptionalReadyForRh(operation: Pick<RhExceptionalOperation, "visas" | "plannedUsers" | "actualUsers" | "interventions">): boolean {
  const director = operation.visas?.directorGlobal ?? operation.visas?.actualDirector ?? operation.visas?.plannedDirector;
  return exceptionalReadyForDirector(operation) && director?.signed === true;
}

/** Clear every director alias so a removed approval cannot reappear through a fallback. */
export function clearExceptionalDirectorVisas<T extends NonNullable<RhExceptionalOperation["visas"]>>(visas: T): T {
  return { ...visas, directorGlobal: createEmptyVisa(), actualDirector: createEmptyVisa(), plannedDirector: createEmptyVisa() };
}
