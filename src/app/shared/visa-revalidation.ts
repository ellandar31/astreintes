import { ExceptionalOperation, ExceptionalOperationUpdate, RegularIntervention, RegularInterventionUpdate, RegularOnCallPeriod, RegularPeriodUpdate } from "../types";
import { clearExceptionalDirectorVisas } from "./visa-workflow";
import { createEmptyVisa } from "./visa.models";

/** Compare instants rather than date-picker serialization (seconds and timezone suffixes). */
function dateIdentity(value: string | undefined): string {
  const raw = value?.trim() ?? "";
  const instant = raw ? Date.parse(raw) : Number.NaN;
  return Number.isNaN(instant) ? raw : String(instant);
}

function sameRange(first: { startDate?: string; endDate?: string }, second: { startDate?: string; endDate?: string }): boolean {
  return dateIdentity(first.startDate) === dateIdentity(second.startDate) && dateIdentity(first.endDate) === dateIdentity(second.endDate);
}

/** A period visa approves both its assignee and its time window, not merely its ID. */
export function revalidateRegularPeriod(current: RegularOnCallPeriod | undefined, update: RegularPeriodUpdate): RegularPeriodUpdate {
  const merged = { ...current, ...update };
  if (current && (current.userId !== merged.userId || current.teamId !== merged.teamId || !sameRange(current, merged))) {
    merged.agentVisa = createEmptyVisa();
    merged.directorVisa = createEmptyVisa();
  }
  return merged;
}

/** A moved/new intervention cannot inherit an approval from its previous period. */
export function revalidateRegularIntervention(current: RegularIntervention | undefined, periodId: string, update: RegularInterventionUpdate): RegularInterventionUpdate {
  const merged = { ...current, ...update };
  if (current?.periodId !== periodId || current.userId !== merged.userId || !sameRange(current, merged)) {
    merged.agentVisa = createEmptyVisa();
  }
  return merged;
}

/** Match a multiset of business targets: row order and duplicate periods are not identities. */
function revalidateRows<T>(current: readonly T[], next: readonly T[], identity: (row: T) => string, clearVisa: (row: T) => T): { rows: T[]; changed: boolean } {
  const remaining = new Map<string, number>();
  current.forEach(row => { const key = identity(row); remaining.set(key, (remaining.get(key) ?? 0) + 1); });
  let changed = false;
  const rows = next.map(row => {
    const key = identity(row);
    const count = remaining.get(key) ?? 0;
    if (count) {
      remaining.set(key, count - 1);
      return row;
    }
    changed = true;
    return clearVisa(row);
  });
  return { rows, changed: changed || [...remaining.values()].some(count => count > 0) };
}

function participantIdentity(row: { userId: string; startDate: string; endDate: string }): string {
  return JSON.stringify([row.userId, dateIdentity(row.startDate), dateIdentity(row.endDate)]);
}

/** Only changed targets lose their own visas; the initiator/director approve the complete aggregate. */
export function revalidateExceptionalOperation(current: ExceptionalOperation | undefined, update: ExceptionalOperationUpdate): ExceptionalOperationUpdate {
  const merged = { ...current, ...update };
  if (!current) return merged;
  const planned = revalidateRows(current.plannedUsers, merged.plannedUsers ?? [], participantIdentity, row => ({ ...row, visa: createEmptyVisa() }));
  const actual = revalidateRows(current.actualUsers, merged.actualUsers ?? [], participantIdentity, row => ({ ...row, visa: createEmptyVisa() }));
  const interventions = revalidateRows(current.interventions, merged.interventions ?? [], participantIdentity, row => ({ ...row, agentVisa: createEmptyVisa() }));
  const plannedRangeChanged = dateIdentity(current.startDate) !== dateIdentity(merged.startDate) || dateIdentity(current.forecastEndDate) !== dateIdentity(merged.forecastEndDate);
  const actualRangeChanged = dateIdentity(current.actualStartDate) !== dateIdentity(merged.actualStartDate) || dateIdentity(current.actualEndDate) !== dateIdentity(merged.actualEndDate);
  // The form derives global bounds from participant rows. Do not revoke unrelated
  // rows when those computed bounds change because just one participant was edited.
  merged.plannedUsers = plannedRangeChanged && !planned.changed ? planned.rows.map(row => ({ ...row, visa: createEmptyVisa() })) : planned.rows;
  merged.actualUsers = actualRangeChanged && !actual.changed ? actual.rows.map(row => ({ ...row, visa: createEmptyVisa() })) : actual.rows;
  merged.interventions = actualRangeChanged && !actual.changed ? interventions.rows.map(row => ({ ...row, agentVisa: createEmptyVisa() })) : interventions.rows;
  const changed = planned.changed || actual.changed || interventions.changed || plannedRangeChanged || actualRangeChanged
    || current.initiatorUid !== merged.initiatorUid || current.operationManagerUid !== merged.operationManagerUid;
  if (changed && merged.visas) {
    merged.visas = {
      ...clearExceptionalDirectorVisas(merged.visas),
      initiatorGlobal: createEmptyVisa(), plannedInitiator: createEmptyVisa(), actualInitiator: createEmptyVisa(),
    };
  }
  return merged;
}
