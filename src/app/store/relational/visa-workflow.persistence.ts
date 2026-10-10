import { APP_LABELS } from "../../i18n/labels";
import { createEmptyVisa } from "../../shared/visa.models";
import { revalidateExceptionalOperation, revalidateRegularIntervention, revalidateRegularPeriod } from "../../shared/visa-revalidation";
import { clearExceptionalDirectorVisas, exceptionalReadyForDirector, exceptionalReadyForRh, regularReadyForDirector, regularReadyForRh } from "../../shared/visa-workflow";
import { ExceptionalOperationUpdate, RegularInterventionUpdate, RegularPeriodUpdate } from "../../types";
import { ExceptionalRepository } from "./exceptional.repository";
import { RegularRepository } from "./regular.repository";

/** Recheck persisted prerequisites: a stale UI must never bypass the approval chain. */
export class VisaWorkflowPersistence {
  private readonly pending = new Map<string, Promise<void>>();
  constructor(private readonly regular: RegularRepository, private readonly exceptional: ExceptionalRepository) { }

  /** Removing a prerequisite revokes the final approval in the same observed write. */
  savePeriod(id: string | undefined, update: RegularPeriodUpdate): Promise<string> {
    return this.serialize(`regular:${id ?? "new"}`, () => this.persistPeriod(id, update));
  }

  private async persistPeriod(id: string | undefined, update: RegularPeriodUpdate): Promise<string> {
    const current = id ? (await this.regular.fetchRegularPeriods()).find(item => item.id === id) : undefined;
    if (id && !current) throw new Error(`Astreinte introuvable : ${id}`);
    const merged = revalidateRegularPeriod(current, update);
    const interventions = id ? await this.regular.fetchRegularInterventions(id) : [];
    const ready = regularReadyForDirector(merged, interventions);
    if (!ready && merged.directorVisa?.signed && !current?.directorVisa?.signed) {
      throw new Error(APP_LABELS.validation.messages.directorPrerequisites);
    }
    if (!ready && merged.directorVisa?.signed) merged.directorVisa = createEmptyVisa();
    if (merged.sentToRhAt && !regularReadyForRh(merged, interventions)) throw new Error(APP_LABELS.validation.messages.rhPrerequisites);
    return this.regular.saveRegularPeriod(id, merged);
  }

  /** New unsigned interventions invalidate approval too; clearing RH remains the correction path. */
  saveIntervention(id: string | undefined, periodId: string, update: RegularInterventionUpdate): Promise<string> {
    return this.serialize(`regular:${periodId}`, () => this.persistIntervention(id, periodId, update));
  }

  private async persistIntervention(id: string | undefined, periodId: string, update: RegularInterventionUpdate): Promise<string> {
    const current = id ? (await this.regular.fetchRegularInterventions(periodId)).find(item => item.id === id) : undefined;
    if (id && !current) throw new Error(`Intervention introuvable : ${id}`);
    const merged = revalidateRegularIntervention(current, periodId, update);
    if (!merged.agentVisa?.signed) {
      const period = (await this.regular.fetchRegularPeriods()).find(item => item.id === periodId);
      if (!period) throw new Error(`Astreinte introuvable : ${periodId}`);
      if (period.sentToRhAt) throw new Error(APP_LABELS.validation.messages.rhPrerequisites);
      if (period.directorVisa?.signed) {
        await this.regular.saveRegularPeriod(periodId, { ...period, directorVisa: createEmptyVisa() });
      }
    }
    return this.regular.saveRegularIntervention(id, periodId, merged);
  }

  /** Both exceptional families share approval rules, but keep their own persistence tables. */
  saveOperation(id: string | undefined, update: ExceptionalOperationUpdate): Promise<string> {
    return this.serialize(`exceptional:${id ?? "new"}`, () => this.persistOperation(id, update));
  }

  private async persistOperation(id: string | undefined, update: ExceptionalOperationUpdate): Promise<string> {
    const current = id ? await this.exceptional.fetchExceptionalOperation(id) : undefined;
    if (id && !current) throw new Error(`Operation introuvable : ${id}`);
    if (current && update.type && update.type !== current.type) throw new Error("Le type d'une operation existante ne peut pas etre change.");
    const merged = revalidateExceptionalOperation(current, update);
    if (!exceptionalReadyForDirector(merged)) {
      const requested = merged.visas?.directorGlobal ?? merged.visas?.actualDirector ?? merged.visas?.plannedDirector;
      const previous = current?.visas.directorGlobal ?? current?.visas.actualDirector ?? current?.visas.plannedDirector;
      if (requested?.signed && !previous?.signed) throw new Error(APP_LABELS.validation.messages.directorPrerequisites);
      if (merged.visas && [merged.visas.directorGlobal, merged.visas.actualDirector, merged.visas.plannedDirector].some(visa => visa?.signed)) {
        merged.visas = clearExceptionalDirectorVisas(merged.visas);
      }
    }
    if (merged.sentToRhAt && !exceptionalReadyForRh(merged)) throw new Error(APP_LABELS.validation.messages.rhPrerequisites);
    return this.exceptional.saveExceptionalOperation(id, merged);
  }

  /** Serialize dependent read/check/write sequences without introducing another state store. */
  private async serialize<T>(key: string, task: () => Promise<T>): Promise<T> {
    const previous = this.pending.get(key);
    let release!: () => void;
    const completion = new Promise<void>(resolve => { release = resolve; });
    this.pending.set(key, completion);
    try {
      await previous;
      return await task();
    } finally {
      release();
      if (this.pending.get(key) === completion) this.pending.delete(key);
    }
  }
}
