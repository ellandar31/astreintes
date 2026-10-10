import { ExceptionalOperation, OperationParticipant, ExceptionalIntervention, ExceptionalOperationUpdate } from "../../types";
import { SupabaseClient } from "@supabase/supabase-js";
import { text, nullableText, idText, numberId, visaKey, participantKey, userDisplayName } from "./store-utils";
import { UsersRepository } from "./users.repository";
import { VisasRepository } from "./visas.repository";
import { databaseDateTime, dateTimeLocalText } from "./date-time";
import { createEmptyVisa } from "../../shared/visa.models";

function operationTypeToDb(value: unknown): "on_call" | "extra_work" {
  return value === "travaux" ? "extra_work" : "on_call";
}

function operationTypeFromDb(value: unknown): "astreinte" | "travaux" {
  return value === "extra_work" ? "travaux" : "astreinte";
}

/** Operations are aggregates of planned participants, actual participants, interventions and visas; child writes must finish before refresh. */
export class ExceptionalRepository {
  constructor(private readonly client: SupabaseClient, private readonly users: UsersRepository, private readonly visas: VisasRepository) { }

  /** Load all child collections before exposing an operation to forms and exports. */
  async fetchExceptionalOperations(): Promise<ExceptionalOperation[]> {
    const { data: operations, error } = await this.client.from("exceptional_operations").select("*");
    if (error) {
      throw error;
    }

    const operationIds = (operations ?? []).map((operation) => Number(operation["id"]));
    const users = await this.users.fetchAppUserMap(
      (operations ?? []).flatMap((operation) => [Number(operation["initiator_user_id"]), Number(operation["operation_manager_user_id"])]),
    );
    const [participants, interventions, operationVisas] = await Promise.all([
      this.fetchExceptionalParticipants(operationIds),
      this.fetchExceptionalInterventions(operationIds),
      this.visas.fetchVisasByTarget("exceptional_operation_id", operationIds),
    ]);

    return (operations ?? []).map((operation) => {
      const initiator = users.get(Number(operation["initiator_user_id"])) ?? {};
      const manager = users.get(Number(operation["operation_manager_user_id"])) ?? {};
      const operationId = Number(operation["id"]);
      return {
        id: String(operationId),
        type: operationTypeFromDb(operation["operation_type"]),
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
    const id = numberId(identifier);
    const payload = {
      operation_type: operationTypeToDb(data["type"]),
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
      ? this.client.from("exceptional_operations").update(payload).eq("id", id).select("id").single()
      : this.client.from("exceptional_operations").insert(payload).select("id").single();
    const { data: savedOperation, error } = await query;

    if (error) {
      throw error;
    }

    const operationId = Number(savedOperation["id"]);
    await this.replaceExceptionalChildren(operationId, data);
    await this.replaceExceptionalOperationVisas(operationId, data["visas"]);
    return String(operationId);
  }

  private async fetchExceptionalParticipants(operationIds: number[]): Promise<Map<string, OperationParticipant[]>> {
    if (!operationIds.length) {
      return new Map();
    }

    const { data, error } = await this.client.from("exceptional_operation_participants").select("*").in("operation_id", operationIds);
    if (error) {
      throw error;
    }

    const participantIds = (data ?? []).map((participant) => Number(participant["id"]));
    const users = await this.users.fetchAppUserMap((data ?? []).map((participant) => Number(participant["user_id"])));
    const visas = await this.visas.fetchVisasByTarget("exceptional_participant_id", participantIds);

    return (data ?? []).reduce((index, participant) => {
      const operationId = Number(participant["operation_id"]);
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
  private async replaceExceptionalChildren(operationId: number, data: ExceptionalOperationUpdate): Promise<void> {
    await this.replaceExceptionalParticipants(operationId, "planned", data.plannedUsers ?? []);
    await this.replaceExceptionalParticipants(operationId, "actual", data.actualUsers ?? []);
    await this.replaceExceptionalInterventions(operationId, data.interventions ?? []);
  }

  /** Child IDs are regenerated on replacement, so visas must be removed then restored against the new targets. */
  private async replaceExceptionalParticipants(operationId: number, kind: "planned" | "actual", participants: OperationParticipant[]): Promise<void> {
    const { data: existing, error: fetchError } = await this.client
      .from("exceptional_operation_participants")
      .select("id")
      .eq("operation_id", operationId)
      .eq("participant_kind", kind);
    if (fetchError) {
      throw fetchError;
    }

    const existingIds = (existing ?? []).map((row) => Number(row["id"]));
    if (existingIds.length) {
      await this.visas.deleteVisas("exceptional_participant_id", existingIds);
      const { error: deleteError } = await this.client.from("exceptional_operation_participants").delete().in("id", existingIds);
      if (deleteError) {
        throw deleteError;
      }
    }

    for (const participant of participants) {
      const userId = await this.users.requireAppUserId(text(participant["userId"]), "Participant d'operation introuvable.");
      const { data: inserted, error } = await this.client
        .from("exceptional_operation_participants")
        .insert({
          operation_id: operationId,
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
      await this.visas.upsertVisa("exceptional_participant_id", Number(inserted["id"]), "exceptional_participant_agent", participant["visa"]);
    }
  }

  private async fetchExceptionalInterventions(operationIds: number[]): Promise<Map<number, ExceptionalIntervention[]>> {
    if (!operationIds.length) {
      return new Map();
    }

    const { data, error } = await this.client.from("exceptional_interventions").select("*").in("operation_id", operationIds);
    if (error) {
      throw error;
    }

    const interventionIds = (data ?? []).map((intervention) => Number(intervention["id"]));
    const users = await this.users.fetchAppUserMap((data ?? []).map((intervention) => Number(intervention["user_id"])));
    const visas = await this.visas.fetchVisasByTarget("exceptional_intervention_id", interventionIds);

    return (data ?? []).reduce((index, intervention) => {
      const operationId = Number(intervention["operation_id"]);
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
  private async replaceExceptionalInterventions(operationId: number, interventions: ExceptionalIntervention[]): Promise<void> {
    const { data: existing, error: fetchError } = await this.client.from("exceptional_interventions").select("id").eq("operation_id", operationId);
    if (fetchError) {
      throw fetchError;
    }

    const existingIds = (existing ?? []).map((row) => Number(row["id"]));
    if (existingIds.length) {
      await this.visas.deleteVisas("exceptional_intervention_id", existingIds);
      const { error: deleteError } = await this.client.from("exceptional_interventions").delete().in("id", existingIds);
      if (deleteError) {
        throw deleteError;
      }
    }

    for (const intervention of interventions) {
      const userId = await this.users.requireAppUserId(text(intervention["userId"]), "Utilisateur d'intervention introuvable.");
      const { data: inserted, error } = await this.client
        .from("exceptional_interventions")
        .insert({
          operation_id: operationId,
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
      await this.visas.upsertVisa("exceptional_intervention_id", Number(inserted["id"]), "exceptional_intervention_agent", intervention["agentVisa"]);
    }
  }

  private async replaceExceptionalOperationVisas(operationId: number, value: ExceptionalOperation["visas"] | undefined): Promise<void> {
    const visas: Partial<ExceptionalOperation["visas"]> = value ?? {};
    await Promise.all([
      this.visas.upsertVisa("exceptional_operation_id", operationId, "exceptional_operation_initiator", visas["initiatorGlobal"]),
      this.visas.upsertVisa("exceptional_operation_id", operationId, "exceptional_operation_director", visas["directorGlobal"]),
      this.visas.upsertVisa("exceptional_operation_id", operationId, "exceptional_planned_initiator", visas["plannedInitiator"]),
      this.visas.upsertVisa("exceptional_operation_id", operationId, "exceptional_planned_director", visas["plannedDirector"]),
      this.visas.upsertVisa("exceptional_operation_id", operationId, "exceptional_actual_initiator", visas["actualInitiator"]),
      this.visas.upsertVisa("exceptional_operation_id", operationId, "exceptional_actual_director", visas["actualDirector"]),
    ]);
  }
}
