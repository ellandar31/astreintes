import { ExceptionalOperation, ExceptionalOperationType, OperationParticipant, ExceptionalIntervention, ExceptionalOperationUpdate } from "../../types";
import { SupabaseClient } from "@supabase/supabase-js";
import { text, nullableText, idText, visaKey, participantKey, userDisplayName, deleteById } from "./store-utils";
import { UsersRepository } from "./users.repository";
import { VisasRepository } from "./visas.repository";
import { databaseDateTime, dateTimeLocalText } from "./date-time";
import { createEmptyVisa } from "../../shared/visa.models";

import { ExceptionalTables, exceptionalId, parseExceptionalId, tablesForExceptionalType } from "./exceptional-tables";

/** Operations are aggregates of planned participants, actual participants, interventions and visas; child writes must finish before refresh. */
export class ExceptionalRepository {
  constructor(private readonly client: SupabaseClient, private readonly users: UsersRepository, private readonly visas: VisasRepository) { }

  /** Load all child collections before exposing an operation to forms and exports. */
  async fetchExceptionalOperations(type?: ExceptionalOperationType): Promise<ExceptionalOperation[]> {
    if (type) return this.fetchFamily(type);
    const [works, onCalls] = await Promise.all([
      this.fetchFamily("travaux"), this.fetchFamily("astreinte"),
    ]);
    return [...works, ...onCalls];
  }

  /** Partial edits load only their family; access to the other tables is not required. */
  async fetchExceptionalOperation(identifier: string): Promise<ExceptionalOperation | undefined> {
    const { type } = parseExceptionalId(identifier);
    return (await this.fetchFamily(type)).find(operation => operation.id === identifier);
  }

  private async fetchFamily(type: ExceptionalOperationType): Promise<ExceptionalOperation[]> {
    const tables = tablesForExceptionalType(type);
    const { data: operations, error } = await this.client.from(tables.table).select("*");
    if (error) {
      throw error;
    }

    const operationIds = (operations ?? []).map((operation) => Number(operation["id"]));
    const users = await this.users.fetchAppUserMap(
      (operations ?? []).flatMap((operation) => [Number(operation["initiator_user_id"]), Number(operation["operation_manager_user_id"])]),
    );
    const [participants, interventions, operationVisas] = await Promise.all([
      this.fetchExceptionalParticipants(operationIds, tables),
      this.fetchExceptionalInterventions(operationIds, tables),
      this.visas.fetchVisasByTarget(tables.parentColumn, operationIds, tables.visas),
    ]);

    return (operations ?? []).map((operation) => {
      const initiator = users.get(Number(operation["initiator_user_id"])) ?? {};
      const manager = users.get(Number(operation["operation_manager_user_id"])) ?? {};
      const operationId = Number(operation["id"]);
      return {
        id: exceptionalId(type, operationId),
        type,
        initiatorUid: idText(operation["initiator_user_id"]),
        initiatorName: userDisplayName(initiator),
        operationManagerUid: idText(operation["operation_manager_user_id"]),
        operationManagerName: text(operation["operation_manager_name"]) || userDisplayName(manager),
        title: text(operation["title"]),
        startDate: dateTimeLocalText(operation["planned_starts_at"]),
        forecastEndDate: dateTimeLocalText(operation["planned_ends_at"]),
        actualStartDate: dateTimeLocalText(operation["actual_starts_at"]),
        actualEndDate: dateTimeLocalText(operation["actual_ends_at"]),
        sentToRhAt: text(operation["sent_to_rh_at"]) || undefined,
        plannedUsers: participants.get(participantKey(operationId, "planned")) ?? [],
        actualUsers: participants.get(participantKey(operationId, "actual")) ?? [],
        interventions: interventions.get(operationId) ?? [],
        visas: {
          initiatorGlobal: operationVisas.get(visaKey(operationId, "exceptional_operation_initiator")),
          directorGlobal: operationVisas.get(visaKey(operationId, "exceptional_operation_director")),
          plannedInitiator: operationVisas.get(visaKey(operationId, "exceptional_planned_initiator")) ?? createEmptyVisa(),
          plannedDirector: operationVisas.get(visaKey(operationId, "exceptional_planned_director")) ?? createEmptyVisa(),
          actualInitiator: operationVisas.get(visaKey(operationId, "exceptional_actual_initiator")) ?? createEmptyVisa(),
          actualDirector: operationVisas.get(visaKey(operationId, "exceptional_actual_director")) ?? createEmptyVisa(),
        },
      };
    });
  }

  /** Await child and visa writes so subsequent refreshes see a complete aggregate. */
  async saveExceptionalOperation(identifier: string | undefined, data: ExceptionalOperationUpdate): Promise<string> {
    const tables = tablesForExceptionalType(data.type);
    // Work hours are actual participant periods; rejecting here prevents partial parent writes.
    if (tables.type === "travaux" && data.interventions?.length) {
      throw new Error("Les travaux exceptionnels ne peuvent pas avoir d'interventions.");
    }
    const identity = identifier ? parseExceptionalId(identifier) : undefined;
    if (identity && identity.type !== data.type) throw new Error("Le type d'une operation existante ne peut pas etre change.");
    const id = identity?.id;
    const payload = {
      initiator_user_id: await this.users.resolveAppUserId(text(data["initiatorUid"])),
      operation_manager_user_id: await this.users.resolveAppUserId(text(data["operationManagerUid"])),
      operation_manager_name: text(data["operationManagerName"]),
      title: text(data["title"], "Operation"),
      planned_starts_at: databaseDateTime(data["startDate"]),
      planned_ends_at: databaseDateTime(data["forecastEndDate"]),
      actual_starts_at: databaseDateTime(data["actualStartDate"]),
      actual_ends_at: databaseDateTime(data["actualEndDate"]),
      sent_to_rh_at: nullableText(data["sentToRhAt"]),
    };
    const query = id
      ? this.client.from(tables.table).update(payload).eq("id", id).select("id").single()
      : this.client.from(tables.table).insert(payload).select("id").single();
    const { data: savedOperation, error } = await query;

    if (error) {
      throw error;
    }

    const operationId = Number(savedOperation["id"]);
    await this.replaceExceptionalChildren(operationId, data, tables);
    await this.replaceExceptionalOperationVisas(operationId, data["visas"], tables);
    return exceptionalId(tables.type, operationId);
  }

  /** A qualified ID routes deletion directly; the other family is never queried. */
  async deleteExceptionalOperation(identifier: string): Promise<void> {
    const { type, id } = parseExceptionalId(identifier);
    const tables = tablesForExceptionalType(type);
    const { data, error } = await this.client.from(tables.table).select("id").eq("id", id).maybeSingle();
    if (error) throw error;
    if (!data) throw new Error(`Operation introuvable : ${identifier}`);
    await deleteById(this.client, tables.table, id);
  }

  private async fetchExceptionalParticipants(operationIds: number[], tables: ExceptionalTables): Promise<Map<string, OperationParticipant[]>> {
    if (!operationIds.length) {
      return new Map();
    }

    const { data, error } = await this.client.from(tables.participants).select("*").in(tables.parentColumn, operationIds);
    if (error) {
      throw error;
    }

    const participantIds = (data ?? []).map((participant) => Number(participant["id"]));
    const users = await this.users.fetchAppUserMap((data ?? []).map((participant) => Number(participant["user_id"])));
    const visas = await this.visas.fetchVisasByTarget("participant_id", participantIds, tables.visas);

    return (data ?? []).reduce((index, participant) => {
      const operationId = Number(participant[tables.parentColumn]);
      const kind = text(participant["participant_kind"]);
      const user = users.get(Number(participant["user_id"])) ?? {};
      const key = participantKey(operationId, kind);
      const rows = index.get(key) ?? [];
      rows.push({
        userId: idText(participant["user_id"]),
        displayName: userDisplayName(user),
        email: text(user["email"]),
        startDate: dateTimeLocalText(participant["starts_at"]),
        endDate: dateTimeLocalText(participant["ends_at"]),
        visa: visas.get(visaKey(participant["id"], "exceptional_participant_agent")) ?? createEmptyVisa(),
      });
      index.set(key, rows);
      return index;
    }, new Map<string, OperationParticipant[]>());
  }

  /** These separate requests preserve the existing write order; they are not a database transaction. */
  private async replaceExceptionalChildren(operationId: number, data: ExceptionalOperationUpdate, tables: ExceptionalTables): Promise<void> {
    await this.replaceExceptionalParticipants(operationId, "planned", data.plannedUsers ?? [], tables);
    await this.replaceExceptionalParticipants(operationId, "actual", data.actualUsers ?? [], tables);
    await this.replaceExceptionalInterventions(operationId, data.interventions ?? [], tables);
  }

  /** Child IDs are regenerated on replacement, so visas must be removed then restored against the new targets. */
  private async replaceExceptionalParticipants(operationId: number, kind: "planned" | "actual", participants: OperationParticipant[], tables: ExceptionalTables): Promise<void> {
    const { data: existing, error: fetchError } = await this.client
      .from(tables.participants)
      .select("id")
      .eq(tables.parentColumn, operationId)
      .eq("participant_kind", kind);
    if (fetchError) {
      throw fetchError;
    }

    const existingIds = (existing ?? []).map((row) => Number(row["id"]));
    if (existingIds.length) {
      await this.visas.deleteVisas("participant_id", existingIds, tables.visas);
      const { error: deleteError } = await this.client.from(tables.participants).delete().in("id", existingIds);
      if (deleteError) {
        throw deleteError;
      }
    }

    for (const participant of participants) {
      const userId = await this.users.requireAppUserId(text(participant["userId"]), "Participant d'operation introuvable.");
      const { data: inserted, error } = await this.client
        .from(tables.participants)
        .insert({
          [tables.parentColumn]: operationId,
          participant_kind: kind,
          user_id: userId,
          starts_at: databaseDateTime(participant["startDate"]),
          ends_at: databaseDateTime(participant["endDate"]),
        })
        .select("id")
        .single();
      if (error) {
        throw error;
      }
      await this.visas.upsertVisa("participant_id", Number(inserted["id"]), "exceptional_participant_agent", participant["visa"], tables.visas);
    }
  }

  private async fetchExceptionalInterventions(operationIds: number[], tables: ExceptionalTables): Promise<Map<number, ExceptionalIntervention[]>> {
    if (!tables.interventions || !operationIds.length) {
      return new Map();
    }

    const { data, error } = await this.client.from(tables.interventions).select("*").in(tables.parentColumn, operationIds);
    if (error) {
      throw error;
    }

    const interventionIds = (data ?? []).map((intervention) => Number(intervention["id"]));
    const users = await this.users.fetchAppUserMap((data ?? []).map((intervention) => Number(intervention["user_id"])));
    const visas = await this.visas.fetchVisasByTarget("intervention_id", interventionIds, tables.visas);

    return (data ?? []).reduce((index, intervention) => {
      const operationId = Number(intervention[tables.parentColumn]);
      const user = users.get(Number(intervention["user_id"])) ?? {};
      const rows = index.get(operationId) ?? [];
      rows.push({
        userId: idText(intervention["user_id"]),
        userName: userDisplayName(user),
        userEmail: text(user["email"]),
        startDate: dateTimeLocalText(intervention["starts_at"]),
        endDate: dateTimeLocalText(intervention["ends_at"]),
        wasOnSite: intervention["was_on_site"] === true,
        label: text(intervention["label"]),
        comment: text(intervention["comment"]),
        agentVisa: visas.get(visaKey(intervention["id"], "exceptional_intervention_agent")) ?? createEmptyVisa(),
      });
      index.set(operationId, rows);
      return index;
    }, new Map<number, ExceptionalIntervention[]>());
  }

  /** Preserve signature snapshots when rebuilding intervention rows from an edited operation aggregate. */
  private async replaceExceptionalInterventions(operationId: number, interventions: ExceptionalIntervention[], tables: ExceptionalTables): Promise<void> {
    if (!tables.interventions) return;
    const { data: existing, error: fetchError } = await this.client.from(tables.interventions).select("id").eq(tables.parentColumn, operationId);
    if (fetchError) {
      throw fetchError;
    }

    const existingIds = (existing ?? []).map((row) => Number(row["id"]));
    if (existingIds.length) {
      await this.visas.deleteVisas("intervention_id", existingIds, tables.visas);
      const { error: deleteError } = await this.client.from(tables.interventions).delete().in("id", existingIds);
      if (deleteError) {
        throw deleteError;
      }
    }

    for (const intervention of interventions) {
      const userId = await this.users.requireAppUserId(text(intervention["userId"]), "Utilisateur d'intervention introuvable.");
      const { data: inserted, error } = await this.client
        .from(tables.interventions)
        .insert({
          [tables.parentColumn]: operationId,
          user_id: userId,
          starts_at: databaseDateTime(intervention["startDate"]),
          ends_at: databaseDateTime(intervention["endDate"]),
          was_on_site: intervention["wasOnSite"] === true,
          label: text(intervention["label"]),
          comment: text(intervention["comment"]),
        })
        .select("id")
        .single();
      if (error) {
        throw error;
      }
      await this.visas.upsertVisa("intervention_id", Number(inserted["id"]), "exceptional_intervention_agent", intervention["agentVisa"], tables.visas);
    }
  }

  private async replaceExceptionalOperationVisas(operationId: number, value: ExceptionalOperation["visas"] | undefined, tables: ExceptionalTables): Promise<void> {
    const visas: Partial<ExceptionalOperation["visas"]> = value ?? {};
    await Promise.all([
      this.visas.upsertVisa(tables.parentColumn, operationId, "exceptional_operation_initiator", visas["initiatorGlobal"], tables.visas),
      this.visas.upsertVisa(tables.parentColumn, operationId, "exceptional_operation_director", visas["directorGlobal"], tables.visas),
      this.visas.upsertVisa(tables.parentColumn, operationId, "exceptional_planned_initiator", visas["plannedInitiator"], tables.visas),
      this.visas.upsertVisa(tables.parentColumn, operationId, "exceptional_planned_director", visas["plannedDirector"], tables.visas),
      this.visas.upsertVisa(tables.parentColumn, operationId, "exceptional_actual_initiator", visas["actualInitiator"], tables.visas),
      this.visas.upsertVisa(tables.parentColumn, operationId, "exceptional_actual_director", visas["actualDirector"], tables.visas),
    ]);
  }
}
