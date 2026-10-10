import { RegularOnCallPeriod, RegularIntervention, RegularPeriodUpdate, RegularInterventionUpdate } from "../../types";
import { SupabaseClient } from "@supabase/supabase-js";
import { text, nullableText, idText, numberId, visaKey, userDisplayName } from "./store-utils";
import { UsersRepository } from "./users.repository";
import { VisasRepository } from "./visas.repository";
import { databaseDateTime, dateTimeLocalText } from "./date-time";

/** Rebuild regular periods and interventions with their user identities and independently persisted visas. */
export class RegularRepository {
  constructor(private readonly client: SupabaseClient, private readonly users: UsersRepository, private readonly visas: VisasRepository) { }

  /** Join user labels and visas in batches before publishing complete periods. */
  async fetchRegularPeriods(): Promise<RegularOnCallPeriod[]> {
    const { data: periods, error } = await this.client.from("regular_on_call_periods").select("*");
    if (error) {
      throw error;
    }

    const periodIds = (periods ?? []).map((period) => Number(period["id"]));
    const users = await this.users.fetchAppUserMap((periods ?? []).map((period) => Number(period["user_id"])));
    const visas = await this.visas.fetchVisasByTarget("regular_period_id", periodIds);

    return (periods ?? []).map((period) => {
      const user = users.get(Number(period["user_id"])) ?? {};
      return {
        id: idText(period["id"]),
        teamId: idText(period["team_id"]),
        userId: idText(period["user_id"]),
        userName: userDisplayName(user),
        userEmail: text(user["email"]),
        startDate: dateTimeLocalText(period["starts_at"]),
        endDate: dateTimeLocalText(period["ends_at"]),
        sentToRhAt: text(period["sent_to_rh_at"]) || undefined,
        agentVisa: visas.get(visaKey(period["id"], "regular_period_agent")),
        directorVisa: visas.get(visaKey(period["id"], "regular_period_director")),
      };
    });
  }

  /** Persist the period first so signatures target its generated database ID. */
  async saveRegularPeriod(identifier: string | undefined, data: RegularPeriodUpdate): Promise<string> {
    const id = numberId(identifier);
    const userId = await this.users.requireAppUserId(text(data["userId"]), "Utilisateur d'astreinte introuvable.");
    const payload = {
      team_id: numberId(text(data["teamId"])),
      user_id: userId,
      starts_at: databaseDateTime(data["startDate"]),
      ends_at: databaseDateTime(data["endDate"]),
      sent_to_rh_at: nullableText(data["sentToRhAt"]),
    };
    const query = id
      ? this.client.from("regular_on_call_periods").update(payload).eq("id", id).select("id").single()
      : this.client.from("regular_on_call_periods").insert(payload).select("id").single();
    const { data: savedPeriod, error } = await query;

    if (error) {
      throw error;
    }

    const periodId = Number(savedPeriod["id"]);
    if (data["agentVisa"]) {
      await this.visas.upsertVisa("regular_period_id", periodId, "regular_period_agent", data["agentVisa"]);
    }
    if (data["directorVisa"]) {
      await this.visas.upsertVisa("regular_period_id", periodId, "regular_period_director", data["directorVisa"]);
    }

    return String(periodId);
  }

  /** Support both a period-specific modal and the cross-period validation collection. */
  async fetchRegularInterventions(parentId?: string): Promise<RegularIntervention[]> {
    let query = this.client.from("regular_interventions").select("*");
    const parentNumericId = numberId(parentId);
    if (parentNumericId) {
      query = query.eq("regular_period_id", parentNumericId);
    }

    const { data: interventions, error } = await query;
    if (error) {
      throw error;
    }

    const interventionIds = (interventions ?? []).map((intervention) => Number(intervention["id"]));
    const users = await this.users.fetchAppUserMap((interventions ?? []).map((intervention) => Number(intervention["user_id"])));
    const visas = await this.visas.fetchVisasByTarget("regular_intervention_id", interventionIds);

    return (interventions ?? []).map((intervention) => {
      const user = users.get(Number(intervention["user_id"])) ?? {};
      return {
        id: idText(intervention["id"]),
        periodId: idText(intervention["regular_period_id"]),
        teamId: "",
        userId: idText(intervention["user_id"]),
        userName: userDisplayName(user),
        userEmail: text(user["email"]),
        startDate: dateTimeLocalText(intervention["starts_at"]),
        endDate: dateTimeLocalText(intervention["ends_at"]),
        comment: text(intervention["comment"]),
        agentVisa: visas.get(visaKey(intervention["id"], "regular_intervention_agent")),
      };
    });
  }

  /** Require a valid user and attach the signature only after the intervention exists. */
  async saveRegularIntervention(identifier: string | undefined, periodId: string, data: RegularInterventionUpdate): Promise<string> {
    const id = numberId(identifier);
    const userId = await this.users.requireAppUserId(text(data["userId"]), "Utilisateur d'intervention introuvable.");
    const payload = {
      regular_period_id: Number(periodId),
      user_id: userId,
      starts_at: databaseDateTime(data["startDate"]),
      ends_at: databaseDateTime(data["endDate"]),
      comment: text(data["comment"]),
    };
    const query = id
      ? this.client.from("regular_interventions").update(payload).eq("id", id).select("id").single()
      : this.client.from("regular_interventions").insert(payload).select("id").single();
    const { data: savedIntervention, error } = await query;

    if (error) {
      throw error;
    }

    const interventionId = Number(savedIntervention["id"]);
    if (data["agentVisa"]) {
      await this.visas.upsertVisa("regular_intervention_id", interventionId, "regular_intervention_agent", data["agentVisa"]);
    }

    return String(interventionId);
  }
}
