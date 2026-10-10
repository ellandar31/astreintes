import { Team } from "../../types";
import { SupabaseClient } from "@supabase/supabase-js";
import { text, idText, numberId, stringIds } from "./store-utils";
import { UsersRepository } from "./users.repository";

/** Team documents aggregate memberships while relational tables keep users and teams independent. */
export class TeamsRepository {
  constructor(private readonly client: SupabaseClient, private readonly users: UsersRepository) { }

  /** Rebuild membership lists using application IDs expected by team filters. */
  async fetchTeams(): Promise<Team[]> {
    const { data: teams, error } = await this.client.from("teams").select("*");
    if (error) {
      throw error;
    }

    const teamIds = (teams ?? []).map((team) => Number(team["id"]));
    const membersByTeam = await this.fetchTeamMembers(teamIds);

    return (teams ?? []).map((team) => ({
      id: idText(team["id"]),
      name: text(team["name"]),
      members: membersByTeam.get(Number(team["id"])) ?? [],
    }));
  }

  private async fetchTeamMembers(teamIds: number[]): Promise<Map<number, string[]>> {
    if (!teamIds.length) {
      return new Map();
    }

    const { data, error } = await this.client.from("team_members").select("team_id,user_id").in("team_id", teamIds);
    if (error) {
      throw error;
    }

    return (data ?? []).reduce((index, row) => {
      const teamId = Number(row["team_id"]);
      const members = index.get(teamId) ?? [];
      members.push(idText(row["user_id"]));
      index.set(teamId, members);
      return index;
    }, new Map<number, string[]>());
  }

  /** Finish membership replacement before the facade notifies subscribers. */
  async saveTeam(identifier: string | undefined, data: Omit<Team, "id">): Promise<string> {
    const id = numberId(identifier);
    const payload = { name: text(data["name"]).trim() || "Equipe" };
    const query = id
      ? this.client.from("teams").update(payload).eq("id", id).select("id").single()
      : this.client.from("teams").insert(payload).select("id").single();
    const { data: savedTeam, error } = await query;

    if (error) {
      throw error;
    }

    const teamId = Number(savedTeam["id"]);
    await this.replaceTeamMembers(teamId, stringIds(data["members"]));
    return String(teamId);
  }

  private async replaceTeamMembers(teamId: number, memberIds: string[]): Promise<void> {
    const { error: deleteError } = await this.client.from("team_members").delete().eq("team_id", teamId);
    if (deleteError) {
      throw deleteError;
    }

    const resolvedUserIds = (await Promise.all(memberIds.map((userId) => this.users.resolveAppUserId(userId)))).filter((userId): userId is number =>
      Number.isInteger(userId),
    );
    const rows = resolvedUserIds.map((userId) => ({ team_id: teamId, user_id: userId }));
    if (!rows.length) {
      return;
    }

    const { error } = await this.client.from("team_members").insert(rows);
    if (error) {
      throw error;
    }
  }
}
