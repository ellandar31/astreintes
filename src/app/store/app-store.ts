import { AuthError, SupabaseClient, User, createClient } from "@supabase/supabase-js";
import { supabaseConfig } from "./supabase.config";

type JsonRecord = Record<string, unknown>;
type RelationalTable =
  | "app_users"
  | "teams"
  | "team_members"
  | "schedule_rules"
  | "public_holidays"
  | "rh_on_call_compensation_rules"
  | "rh_period_compensation_rules"
  | "rh_export_settings"
  | "rh_export_templates"
  | "regular_on_call_periods"
  | "regular_interventions"
  | "exceptional_operations"
  | "exceptional_operation_participants"
  | "exceptional_interventions"
  | "visas";

export interface StoreAuthUser {
  displayName: string | null;
  email: string | null;
  uid: string;
}

export type StoreUnsubscribe = () => void;

export interface StoreCollection {
  readonly collectionName: string;
  readonly parentCollectionName?: string;
  readonly parentId?: string;
}

export interface StoreDocumentReference extends StoreCollection {
  readonly documentId: string;
}

export interface StoreDocument<T = JsonRecord> {
  id: string;
  data: T;
  parentId: string;
}

export interface StoreError {
  code?: string;
  message: string;
}

type StorePayload = JsonRecord;
type SetDocumentOptions = { merge?: boolean };
type RefreshCallback = () => Promise<void>;

const deleteFieldMarker = Symbol("delete-field");

const supabase = createClient(supabaseConfig.url, supabaseConfig.anonKey, {
  auth: {
    autoRefreshToken: true,
    detectSessionInUrl: true,
    persistSession: true,
  },
});

function mapAuthUser(user: User | null): StoreAuthUser | null {
  if (!user) {
    return null;
  }

  const metadata = user.user_metadata ?? {};
  const displayName = metadata["display_name"] || metadata["full_name"] || metadata["name"] || null;

  return {
    displayName: typeof displayName === "string" ? displayName : null,
    email: user.email ?? null,
    uid: user.id,
  };
}

function documentReference(collectionName: string, documentId: string, parent?: Pick<StoreCollection, "parentCollectionName" | "parentId">): StoreDocumentReference {
  return {
    collectionName,
    documentId,
    parentCollectionName: parent?.parentCollectionName,
    parentId: parent?.parentId,
  };
}

function collectionReference(collectionName: string, parent?: Pick<StoreCollection, "parentCollectionName" | "parentId">): StoreCollection {
  return {
    collectionName,
    parentCollectionName: parent?.parentCollectionName,
    parentId: parent?.parentId,
  };
}

function generatedDocumentId(): string {
  const browserCrypto = globalThis.crypto;

  if (typeof browserCrypto?.randomUUID === "function") {
    return browserCrypto.randomUUID();
  }

  return `id-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

function isDeleteFieldMarker(value: unknown): boolean {
  return value === deleteFieldMarker;
}

function mergePayload(currentData: StorePayload, update: StorePayload): StorePayload {
  const merged = { ...currentData };

  Object.entries(update).forEach(([key, value]) => {
    if (isDeleteFieldMarker(value)) {
      delete merged[key];
      return;
    }

    merged[key] = value;
  });

  return merged;
}

function toError(error: unknown): Error {
  return error instanceof Error ? error : new Error("Erreur Supabase inconnue.");
}

function text(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function nullableText(value: unknown): string | null {
  const normalized = text(value).trim();
  return normalized || null;
}

function idText(value: unknown): string {
  return typeof value === "number" || typeof value === "bigint" ? String(value) : text(value);
}

function numberId(value: string | undefined): number | null {
  if (!value) {
    return null;
  }

  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asArray(value: unknown): JsonRecord[] {
  return Array.isArray(value) ? value.filter(isRecord) : [];
}

function relationTable(reference: StoreCollection): RelationalTable {
  switch (reference.collectionName) {
    case "settings.users":
      return "app_users";
    case "settings.teams":
      return "teams";
    case "settings.scheduleRules":
      return "schedule_rules";
    case "settings.publicHolidays":
      return "public_holidays";
    case "settings.rhExportTemplates":
      return "rh_export_templates";
    case "regularOnCallPeriods":
      return "regular_on_call_periods";
    case "regularInterventions":
      return "regular_interventions";
    case "exceptionalOperations":
      return "exceptional_operations";
    case "settings":
      return "rh_export_settings";
    default:
      return "app_users";
  }
}

function userRoleToDb(value: unknown): "admin" | "user" | "initiator" | "director" {
  const role = Number(value);
  if (role === 0) {
    return "admin";
  }
  if (role === 2) {
    return "initiator";
  }
  if (role === 3) {
    return "director";
  }
  return "user";
}

function userRoleFromDb(value: unknown): number {
  if (value === "admin") {
    return 0;
  }
  if (value === "initiator") {
    return 2;
  }
  if (value === "director") {
    return 3;
  }
  return 1;
}

function operationTypeToDb(value: unknown): "on_call" | "extra_work" {
  return value === "travaux" ? "extra_work" : "on_call";
}

function operationTypeFromDb(value: unknown): "astreinte" | "travaux" {
  return value === "extra_work" ? "travaux" : "astreinte";
}

function scheduleDayToDb(value: unknown): string {
  switch (text(value).toLowerCase()) {
    case "lundi":
      return "monday";
    case "mardi":
      return "tuesday";
    case "mercredi":
      return "wednesday";
    case "jeudi":
      return "thursday";
    case "vendredi":
      return "friday";
    case "samedi":
      return "saturday";
    case "dimanche":
      return "sunday";
    case "jour ferie":
    case "jour férié":
      return "public_holiday";
    default:
      return text(value);
  }
}

function scheduleDayFromDb(value: unknown): string {
  switch (value) {
    case "monday":
      return "Lundi";
    case "tuesday":
      return "Mardi";
    case "wednesday":
      return "Mercredi";
    case "thursday":
      return "Jeudi";
    case "friday":
      return "Vendredi";
    case "saturday":
      return "Samedi";
    case "sunday":
      return "Dimanche";
    case "public_holiday":
      return "Jour ferie";
    default:
      return text(value);
  }
}

/**
 * Relational persistence adapter exposed through the historical appStore API.
 *
 * NgRx effects still manipulate business documents because that keeps the UI
 * migration small. This class is the anti-corruption layer: it translates those
 * documents to normalized Supabase tables and rebuilds aggregates on reads.
 */
class SupabaseRelationalStore {
  private readonly collectionRefreshers = new Map<string, Set<RefreshCallback>>();
  private readonly documentRefreshers = new Map<string, Set<RefreshCallback>>();

  constructor(private readonly client: SupabaseClient) {}

  observeCollection<T>(
    reference: StoreCollection,
    next: (documents: StoreDocument<T>[]) => void,
    error?: (error: unknown) => void,
  ): StoreUnsubscribe {
    const refresh = async () => {
      try {
        next(await this.fetchCollection<T>(reference));
      } catch (refreshError) {
        error?.(refreshError);
      }
    };
    const unsubscribeRefresh = this.registerCollectionRefresher(reference, refresh);

    refresh();

    const channels = this.subscriptionTables(reference).map((table) =>
      this.client
        .channel(`relation:${table}:${reference.collectionName}:${reference.parentId ?? "root"}:${generatedDocumentId()}`)
        .on("postgres_changes", { event: "*", schema: "public", table }, () => void refresh())
        .subscribe(),
    );

    return () => {
      unsubscribeRefresh();
      channels.forEach((channel) => void this.client.removeChannel(channel));
    };
  }

  observeDocument<T>(
    reference: StoreDocumentReference,
    next: (data: T | undefined) => void,
    error?: (error: unknown) => void,
  ): StoreUnsubscribe {
    const refresh = async () => {
      try {
        next(await this.getDocument<T>(reference));
      } catch (refreshError) {
        error?.(refreshError);
      }
    };
    const unsubscribeRefresh = this.registerDocumentRefresher(reference, refresh);

    refresh();

    const channels = this.subscriptionTables(reference).map((table) =>
      this.client
        .channel(`relation-document:${table}:${reference.collectionName}:${reference.documentId}:${generatedDocumentId()}`)
        .on("postgres_changes", { event: "*", schema: "public", table }, () => void refresh())
        .subscribe(),
    );

    return () => {
      unsubscribeRefresh();
      channels.forEach((channel) => void this.client.removeChannel(channel));
    };
  }

  async getDocument<T>(reference: StoreDocumentReference): Promise<T | undefined> {
    switch (reference.collectionName) {
      case "settings.users":
        return (await this.fetchUserDocument(reference.documentId))?.data as T | undefined;
      case "settings":
        if (reference.documentId === "rhCompensationRules") {
          return (await this.fetchRhCompensation()) as T;
        }
        if (reference.documentId === "rhExportTemplates") {
          return (await this.fetchRhExportSettings()) as T;
        }
        return undefined;
      default:
        return (await this.fetchCollection<T>({ ...reference })).find((document) => document.id === reference.documentId)?.data;
    }
  }

  async addDocument(reference: StoreCollection, data: StorePayload): Promise<StoreDocumentReference> {
    const id = await this.insertDocument(reference, data);
    const newReference = documentReference(reference.collectionName, id, reference);
    await this.refreshAfterWrite(newReference);
    return newReference;
  }

  async setDocument(reference: StoreDocumentReference, data: StorePayload, options?: SetDocumentOptions): Promise<void> {
    const nextData = options?.merge ? mergePayload((await this.getDocument(reference)) ?? {}, data) : data;
    await this.saveDocument(reference, nextData);
    await this.refreshAfterWrite(reference);
  }

  async updateDocument(reference: StoreDocumentReference, data: StorePayload): Promise<void> {
    const currentData = await this.getDocument<StorePayload>(reference);

    if (!currentData) {
      throw new Error(`Document introuvable: ${reference.collectionName}/${reference.documentId}`);
    }

    await this.saveDocument(reference, mergePayload(currentData, data));
    await this.refreshAfterWrite(reference);
  }

  async deleteDocument(reference: StoreDocumentReference): Promise<void> {
    await this.deleteRelationalDocument(reference);
    await this.refreshAfterWrite(reference);
  }

  serverTimestamp(): string {
    return new Date().toISOString();
  }

  deleteField(): unknown {
    return deleteFieldMarker;
  }

  private async fetchCollection<T>(reference: StoreCollection): Promise<StoreDocument<T>[]> {
    switch (reference.collectionName) {
      case "settings.users":
        return (await this.fetchUsers()) as StoreDocument<T>[];
      case "settings.teams":
        return (await this.fetchTeams()) as StoreDocument<T>[];
      case "settings.scheduleRules":
        return (await this.fetchScheduleRules()) as StoreDocument<T>[];
      case "settings.publicHolidays":
        return (await this.fetchPublicHolidays()) as StoreDocument<T>[];
      case "settings.rhExportTemplates":
        return (await this.fetchRhExportTemplateItems()) as StoreDocument<T>[];
      case "regularOnCallPeriods":
        return (await this.fetchRegularPeriods()) as StoreDocument<T>[];
      case "regularInterventions":
        return (await this.fetchRegularInterventions(reference.parentId)) as StoreDocument<T>[];
      case "exceptionalOperations":
        return (await this.fetchExceptionalOperations()) as StoreDocument<T>[];
      default:
        return [];
    }
  }

  private async insertDocument(reference: StoreCollection, data: StorePayload): Promise<string> {
    switch (reference.collectionName) {
      case "settings.teams":
        return this.saveTeam(undefined, data);
      case "regularOnCallPeriods":
        return this.saveRegularPeriod(undefined, data);
      case "regularInterventions":
        return this.saveRegularIntervention(undefined, reference.parentId ?? text(data["periodId"]), data);
      case "exceptionalOperations":
        return this.saveExceptionalOperation(undefined, data);
      default: {
        const generatedId = generatedDocumentId();
        await this.saveDocument(documentReference(reference.collectionName, generatedId, reference), data);
        return generatedId;
      }
    }
  }

  private async saveDocument(reference: StoreDocumentReference, data: StorePayload): Promise<void> {
    switch (reference.collectionName) {
      case "settings.users":
        await this.saveUser(reference.documentId, data);
        return;
      case "settings.teams":
        await this.saveTeam(reference.documentId, data);
        return;
      case "settings.scheduleRules":
        await this.saveScheduleRule(reference.documentId, data);
        return;
      case "settings.publicHolidays":
        await this.savePublicHoliday(reference.documentId, data);
        return;
      case "settings.rhExportTemplates":
        await this.saveRhExportTemplateItem(reference.documentId, data);
        return;
      case "regularOnCallPeriods":
        await this.saveRegularPeriod(reference.documentId, data);
        return;
      case "regularInterventions":
        await this.saveRegularIntervention(reference.documentId, reference.parentId ?? text(data["periodId"]), data);
        return;
      case "exceptionalOperations":
        await this.saveExceptionalOperation(reference.documentId, data);
        return;
      case "settings":
        if (reference.documentId === "rhCompensationRules") {
          await this.saveRhCompensation(data);
          return;
        }
        if (reference.documentId === "rhExportTemplates") {
          await this.saveRhExportSettings(data);
        }
    }
  }

  private async deleteRelationalDocument(reference: StoreDocumentReference): Promise<void> {
    const id = numberId(reference.documentId);

    switch (reference.collectionName) {
      case "settings.users":
        await this.deleteUser(reference.documentId);
        return;
      case "settings.teams":
        await this.deleteById("teams", id);
        return;
      case "settings.scheduleRules":
        await this.deleteById("schedule_rules", id);
        return;
      case "settings.publicHolidays":
        await this.deleteById("public_holidays", id);
        return;
      case "settings.rhExportTemplates":
        await this.deleteById("rh_export_templates", id);
        return;
      case "regularOnCallPeriods":
        await this.deleteById("regular_on_call_periods", id);
        return;
      case "regularInterventions":
        await this.deleteById("regular_interventions", id);
        return;
      case "exceptionalOperations":
        await this.deleteById("exceptional_operations", id);
    }
  }

  private async fetchUsers(): Promise<StoreDocument[]> {
    const { data, error } = await this.client.from("app_users").select("*");
    if (error) {
      throw error;
    }

    return (data ?? []).map((row) => this.userDocument(row));
  }

  private async fetchUserDocument(identifier: string): Promise<StoreDocument | undefined> {
    const id = numberId(identifier);
    let query = this.client.from("app_users").select("*").limit(1);
    query = id ? query.eq("id", id) : query.eq(isUuid(identifier) ? "auth_user_id" : "email", identifier);
    const { data, error } = await query.maybeSingle();

    if (error) {
      throw error;
    }

    return data ? this.userDocument(data) : undefined;
  }

  private userDocument(row: JsonRecord): StoreDocument {
    const id = idText(row["id"]);
    const authUserId = text(row["auth_user_id"]);

    return {
      id,
      parentId: "",
      data: {
        uid: authUserId,
        email: text(row["email"]),
        displayName: text(row["display_name"]),
        role: userRoleFromDb(row["role"]),
        signatureMode: text(row["signature_mode"], "name"),
        signatureName: text(row["signature_name"]),
        signatureImage: text(row["signature_image"]),
        signatureDrawing: text(row["signature_drawing"]),
        lastLoginAt: text(row["last_login_at"]),
      },
    };
  }

  private async saveUser(identifier: string, data: StorePayload): Promise<string> {
    const existing = await this.fetchUserDocument(identifier);
    const payload = {
      auth_user_id: text(data["uid"], existing ? text(existing.data["uid"]) : identifier),
      email: text(data["email"], existing ? text(existing.data["email"]) : ""),
      display_name: text(data["displayName"], existing ? text(existing.data["displayName"]) : ""),
      role: userRoleToDb(data["role"] ?? existing?.data["role"]),
      signature_mode: text(data["signatureMode"], existing ? text(existing.data["signatureMode"]) : "name"),
      signature_name: text(data["signatureName"], existing ? text(existing.data["signatureName"]) : ""),
      signature_image: text(data["signatureImage"], existing ? text(existing.data["signatureImage"]) : ""),
      signature_drawing: text(data["signatureDrawing"], existing ? text(existing.data["signatureDrawing"]) : ""),
      last_login_at: nullableText(data["lastLoginAt"] ?? existing?.data["lastLoginAt"]),
    };
    const query = existing
      ? this.client.from("app_users").update(payload).eq("id", Number(existing.id)).select("id").single()
      : this.client.from("app_users").insert(payload).select("id").single();
    const { data: savedRow, error } = await query;

    if (error) {
      throw error;
    }

    return idText(savedRow["id"]);
  }

  private async deleteUser(identifier: string): Promise<void> {
    const existing = await this.fetchUserDocument(identifier);
    if (!existing) {
      return;
    }

    await this.deleteById("app_users", Number(existing.id));
  }

  private async fetchTeams(): Promise<StoreDocument[]> {
    const { data: teams, error } = await this.client.from("teams").select("*");
    if (error) {
      throw error;
    }

    const teamIds = (teams ?? []).map((team) => Number(team["id"]));
    const membersByTeam = await this.fetchTeamMembers(teamIds);

    return (teams ?? []).map((team) => ({
      id: idText(team["id"]),
      parentId: "",
      data: {
        name: text(team["name"]),
        members: membersByTeam.get(Number(team["id"])) ?? [],
      },
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

  private async saveTeam(identifier: string | undefined, data: StorePayload): Promise<string> {
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
    await this.replaceTeamMembers(teamId, this.stringIds(data["members"]));
    return String(teamId);
  }

  private async replaceTeamMembers(teamId: number, memberIds: string[]): Promise<void> {
    const { error: deleteError } = await this.client.from("team_members").delete().eq("team_id", teamId);
    if (deleteError) {
      throw deleteError;
    }

    const resolvedUserIds = (await Promise.all(memberIds.map((userId) => this.resolveAppUserId(userId)))).filter((userId): userId is number =>
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

  private async fetchScheduleRules(): Promise<StoreDocument[]> {
    const { data, error } = await this.client.from("schedule_rules").select("*");
    if (error) {
      throw error;
    }

    return (data ?? []).map((row) => ({
      id: idText(row["id"]),
      parentId: "",
      data: {
        day: scheduleDayFromDb(row["day"]),
        hoStart: text(row["hour_start"]),
        hoEnd: text(row["hour_end"]),
      },
    }));
  }

  private async saveScheduleRule(identifier: string, data: StorePayload): Promise<string> {
    const id = numberId(identifier);
    const payload = {
      day: scheduleDayToDb(data["day"]),
      hour_start: text(data["hoStart"]),
      hour_end: text(data["hoEnd"]),
    };
    const query = id
      ? this.client.from("schedule_rules").update(payload).eq("id", id).select("id").single()
      : this.client.from("schedule_rules").insert(payload).select("id").single();
    const { data: savedRow, error } = await query;

    if (error) {
      throw error;
    }

    return idText(savedRow["id"]);
  }

  private async fetchPublicHolidays(): Promise<StoreDocument[]> {
    const { data, error } = await this.client.from("public_holidays").select("*");
    if (error) {
      throw error;
    }

    return (data ?? []).map((row) => ({
      id: idText(row["id"]),
      parentId: "",
      data: {
        date: text(row["holiday_date"]),
        label: text(row["label"]),
        zone: text(row["zone"]),
        source: text(row["source"]),
      },
    }));
  }

  private async savePublicHoliday(identifier: string, data: StorePayload): Promise<string> {
    const id = numberId(identifier);
    const payload = {
      zone: text(data["zone"], "metropole"),
      holiday_date: text(data["date"]),
      label: text(data["label"], "Jour ferie"),
      source: text(data["source"]) === "manual" ? "manual" : "api.gouv.fr",
    };
    const query = id
      ? this.client.from("public_holidays").update(payload).eq("id", id).select("id").single()
      : this.client.from("public_holidays").upsert(payload, { onConflict: "zone,holiday_date" }).select("id").single();
    const { data: savedRow, error } = await query;

    if (error) {
      throw error;
    }

    return idText(savedRow["id"]);
  }

  private async fetchRhCompensation(): Promise<JsonRecord> {
    const [onCall, periods] = await Promise.all([
      this.client.from("rh_on_call_compensation_rules").select("*").order("sort_order"),
      this.client.from("rh_period_compensation_rules").select("*").order("sort_order"),
    ]);

    if (onCall.error) {
      throw onCall.error;
    }
    if (periods.error) {
      throw periods.error;
    }

    return {
      onCall: (onCall.data ?? []).map((row) => ({
        id: text(row["code"]),
        label: text(row["label"]),
        coefficient: Number(row["coefficient"] ?? 0),
      })),
      periods: (periods.data ?? []).map((row) => ({
        id: text(row["code"]),
        label: text(row["label"]),
        interventionCoefficient: Number(row["intervention_coefficient"] ?? 0),
        workCoefficient: Number(row["work_coefficient"] ?? 0),
        restCoefficient: Number(row["rest_coefficient"] ?? 0),
      })),
    };
  }

  private async saveRhCompensation(data: StorePayload): Promise<void> {
    const onCallRows = asArray(data["onCall"]).map((row, index) => ({
      code: text(row["id"]),
      label: text(row["label"]),
      coefficient: Number(row["coefficient"] ?? 0),
      sort_order: index,
    }));
    const periodRows = asArray(data["periods"]).map((row, index) => ({
      code: text(row["id"]),
      label: text(row["label"]),
      intervention_coefficient: Number(row["interventionCoefficient"] ?? 0),
      work_coefficient: Number(row["workCoefficient"] ?? 0),
      rest_coefficient: Number(row["restCoefficient"] ?? 0),
      sort_order: index,
    }));

    if (onCallRows.length) {
      const { error } = await this.client.from("rh_on_call_compensation_rules").upsert(onCallRows, { onConflict: "code" });
      if (error) {
        throw error;
      }
    }
    if (periodRows.length) {
      const { error } = await this.client.from("rh_period_compensation_rules").upsert(periodRows, { onConflict: "code" });
      if (error) {
        throw error;
      }
    }
  }

  private async fetchRhExportSettings(): Promise<JsonRecord> {
    const { data, error } = await this.client.from("rh_export_settings").select("*").eq("singleton_key", true).maybeSingle();
    if (error) {
      throw error;
    }

    return { generationApiUrl: text(data?.["generation_api_url"]) };
  }

  private async saveRhExportSettings(data: StorePayload): Promise<void> {
    const { error } = await this.client.from("rh_export_settings").upsert(
      {
        singleton_key: true,
        generation_api_url: text(data["generationApiUrl"], "http://localhost:3000/v1/documents/generate"),
      },
      { onConflict: "singleton_key" },
    );
    if (error) {
      throw error;
    }
  }

  private async fetchRhExportTemplateItems(): Promise<StoreDocument[]> {
    const { data, error } = await this.client.from("rh_export_templates").select("*");
    if (error) {
      throw error;
    }

    return (data ?? []).map((row) => ({
      id: text(row["code"]),
      parentId: "rhExportTemplates",
      data: {
        id: text(row["code"]),
        label: text(row["label"]),
        fileName: text(row["file_name"]),
        templateFileName: text(row["template_file_name"]),
        dataModelFileName: text(row["data_model_file_name"]),
        generationTemplate: row["generation_template"],
        dataModel: row["data_model"],
      },
    }));
  }

  private async saveRhExportTemplateItem(code: string, data: StorePayload): Promise<string> {
    const payload = {
      code,
      label: text(data["label"], code),
      file_name: text(data["fileName"]),
      template_file_name: text(data["templateFileName"]),
      data_model_file_name: text(data["dataModelFileName"]),
      generation_template: data["generationTemplate"] ?? this.parseJsonText(data["generationTemplateJson"]),
      data_model: data["dataModel"] ?? this.parseJsonText(data["dataModelJson"]),
    };
    const { error } = await this.client.from("rh_export_templates").upsert(payload, { onConflict: "code" });

    if (error) {
      throw error;
    }

    return code;
  }

  private async fetchRegularPeriods(): Promise<StoreDocument[]> {
    const { data: periods, error } = await this.client.from("regular_on_call_periods").select("*");
    if (error) {
      throw error;
    }

    const periodIds = (periods ?? []).map((period) => Number(period["id"]));
    const users = await this.fetchAppUserMap((periods ?? []).map((period) => Number(period["user_id"])));
    const visas = await this.fetchVisasByTarget("regular_period_id", periodIds);

    return (periods ?? []).map((period) => {
      const user = users.get(Number(period["user_id"])) ?? {};
      return {
        id: idText(period["id"]),
        parentId: "",
        data: {
          teamId: idText(period["team_id"]),
          userId: idText(period["user_id"]),
          userName: text(user["display_name"]),
          userEmail: text(user["email"]),
          startDate: text(period["starts_at"]),
          endDate: text(period["ends_at"]),
          sentToRhAt: text(period["sent_to_rh_at"]),
          agentVisa: visas.get(this.visaKey(period["id"], "regular_period_agent")),
          directorVisa: visas.get(this.visaKey(period["id"], "regular_period_director")),
        },
      };
    });
  }

  private async saveRegularPeriod(identifier: string | undefined, data: StorePayload): Promise<string> {
    const id = numberId(identifier);
    const userId = await this.requireAppUserId(text(data["userId"]), "Utilisateur d'astreinte introuvable.");
    const payload = {
      team_id: numberId(text(data["teamId"])),
      user_id: userId,
      starts_at: text(data["startDate"]),
      ends_at: text(data["endDate"]),
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
      await this.upsertVisa("regular_period_id", periodId, "regular_period_agent", data["agentVisa"]);
    }
    if (data["directorVisa"]) {
      await this.upsertVisa("regular_period_id", periodId, "regular_period_director", data["directorVisa"]);
    }

    return String(periodId);
  }

  private async fetchRegularInterventions(parentId?: string): Promise<StoreDocument[]> {
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
    const users = await this.fetchAppUserMap((interventions ?? []).map((intervention) => Number(intervention["user_id"])));
    const visas = await this.fetchVisasByTarget("regular_intervention_id", interventionIds);

    return (interventions ?? []).map((intervention) => {
      const user = users.get(Number(intervention["user_id"])) ?? {};
      return {
        id: idText(intervention["id"]),
        parentId: idText(intervention["regular_period_id"]),
        data: {
          periodId: idText(intervention["regular_period_id"]),
          teamId: "",
          userId: idText(intervention["user_id"]),
          userName: text(user["display_name"]),
          userEmail: text(user["email"]),
          startDate: text(intervention["starts_at"]),
          endDate: text(intervention["ends_at"]),
          comment: text(intervention["comment"]),
          agentVisa: visas.get(this.visaKey(intervention["id"], "regular_intervention_agent")),
        },
      };
    });
  }

  private async saveRegularIntervention(identifier: string | undefined, periodId: string, data: StorePayload): Promise<string> {
    const id = numberId(identifier);
    const userId = await this.requireAppUserId(text(data["userId"]), "Utilisateur d'intervention introuvable.");
    const payload = {
      regular_period_id: Number(periodId),
      user_id: userId,
      starts_at: text(data["startDate"]),
      ends_at: text(data["endDate"]),
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
      await this.upsertVisa("regular_intervention_id", interventionId, "regular_intervention_agent", data["agentVisa"]);
    }

    return String(interventionId);
  }

  private async fetchExceptionalOperations(): Promise<StoreDocument[]> {
    const { data: operations, error } = await this.client.from("exceptional_operations").select("*");
    if (error) {
      throw error;
    }

    const operationIds = (operations ?? []).map((operation) => Number(operation["id"]));
    const users = await this.fetchAppUserMap(
      (operations ?? []).flatMap((operation) => [Number(operation["initiator_user_id"]), Number(operation["operation_manager_user_id"])]),
    );
    const [participants, interventions, operationVisas] = await Promise.all([
      this.fetchExceptionalParticipants(operationIds),
      this.fetchExceptionalInterventions(operationIds),
      this.fetchVisasByTarget("exceptional_operation_id", operationIds),
    ]);

    return (operations ?? []).map((operation) => {
      const initiator = users.get(Number(operation["initiator_user_id"])) ?? {};
      const manager = users.get(Number(operation["operation_manager_user_id"])) ?? {};
      const operationId = Number(operation["id"]);
      return {
        id: String(operationId),
        parentId: "",
        data: {
          type: operationTypeFromDb(operation["operation_type"]),
          initiatorUid: idText(operation["initiator_user_id"]),
          initiatorName: text(initiator["display_name"]),
          operationManagerUid: idText(operation["operation_manager_user_id"]),
          operationManagerName: text(operation["operation_manager_name"]) || text(manager["display_name"]),
          title: text(operation["title"]),
          startDate: text(operation["planned_starts_at"]),
          forecastEndDate: text(operation["planned_ends_at"]),
          actualStartDate: text(operation["actual_starts_at"]),
          actualEndDate: text(operation["actual_ends_at"]),
          sentToRhAt: text(operation["sent_to_rh_at"]),
          plannedUsers: participants.get(this.participantKey(operationId, "planned")) ?? [],
          actualUsers: participants.get(this.participantKey(operationId, "actual")) ?? [],
          interventions: interventions.get(operationId) ?? [],
          visas: {
            initiatorGlobal: operationVisas.get(this.visaKey(operationId, "exceptional_operation_initiator")),
            directorGlobal: operationVisas.get(this.visaKey(operationId, "exceptional_operation_director")),
            plannedInitiator: operationVisas.get(this.visaKey(operationId, "exceptional_planned_initiator")),
            plannedDirector: operationVisas.get(this.visaKey(operationId, "exceptional_planned_director")),
            actualInitiator: operationVisas.get(this.visaKey(operationId, "exceptional_actual_initiator")),
            actualDirector: operationVisas.get(this.visaKey(operationId, "exceptional_actual_director")),
          },
        },
      };
    });
  }

  private async saveExceptionalOperation(identifier: string | undefined, data: StorePayload): Promise<string> {
    const id = numberId(identifier);
    const payload = {
      operation_type: operationTypeToDb(data["type"]),
      initiator_user_id: await this.resolveAppUserId(text(data["initiatorUid"])),
      operation_manager_user_id: await this.resolveAppUserId(text(data["operationManagerUid"])),
      operation_manager_name: text(data["operationManagerName"]),
      title: text(data["title"], "Operation"),
      planned_starts_at: nullableText(data["startDate"]),
      planned_ends_at: nullableText(data["forecastEndDate"]),
      actual_starts_at: nullableText(data["actualStartDate"]),
      actual_ends_at: nullableText(data["actualEndDate"]),
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

  private async fetchExceptionalParticipants(operationIds: number[]): Promise<Map<string, JsonRecord[]>> {
    if (!operationIds.length) {
      return new Map();
    }

    const { data, error } = await this.client.from("exceptional_operation_participants").select("*").in("operation_id", operationIds);
    if (error) {
      throw error;
    }

    const participantIds = (data ?? []).map((participant) => Number(participant["id"]));
    const users = await this.fetchAppUserMap((data ?? []).map((participant) => Number(participant["user_id"])));
    const visas = await this.fetchVisasByTarget("exceptional_participant_id", participantIds);

    return (data ?? []).reduce((index, participant) => {
      const operationId = Number(participant["operation_id"]);
      const kind = text(participant["participant_kind"]);
      const user = users.get(Number(participant["user_id"])) ?? {};
      const key = this.participantKey(operationId, kind);
      const rows = index.get(key) ?? [];
      rows.push({
        userId: idText(participant["user_id"]),
        displayName: text(user["display_name"]),
        email: text(user["email"]),
        startDate: text(participant["starts_at"]),
        endDate: text(participant["ends_at"]),
        visa: visas.get(this.visaKey(participant["id"], "exceptional_participant_agent")),
      });
      index.set(key, rows);
      return index;
    }, new Map<string, JsonRecord[]>());
  }

  private async replaceExceptionalChildren(operationId: number, data: StorePayload): Promise<void> {
    await this.replaceExceptionalParticipants(operationId, "planned", asArray(data["plannedUsers"]));
    await this.replaceExceptionalParticipants(operationId, "actual", asArray(data["actualUsers"]));
    await this.replaceExceptionalInterventions(operationId, asArray(data["interventions"]));
  }

  private async replaceExceptionalParticipants(operationId: number, kind: "planned" | "actual", participants: JsonRecord[]): Promise<void> {
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
      await this.deleteVisas("exceptional_participant_id", existingIds);
      const { error: deleteError } = await this.client.from("exceptional_operation_participants").delete().in("id", existingIds);
      if (deleteError) {
        throw deleteError;
      }
    }

    for (const participant of participants) {
      const userId = await this.requireAppUserId(text(participant["userId"]), "Participant d'operation introuvable.");
      const { data: inserted, error } = await this.client
        .from("exceptional_operation_participants")
        .insert({
          operation_id: operationId,
          participant_kind: kind,
          user_id: userId,
          starts_at: text(participant["startDate"]),
          ends_at: text(participant["endDate"]),
        })
        .select("id")
        .single();
      if (error) {
        throw error;
      }
      await this.upsertVisa("exceptional_participant_id", Number(inserted["id"]), "exceptional_participant_agent", participant["visa"]);
    }
  }

  private async fetchExceptionalInterventions(operationIds: number[]): Promise<Map<number, JsonRecord[]>> {
    if (!operationIds.length) {
      return new Map();
    }

    const { data, error } = await this.client.from("exceptional_interventions").select("*").in("operation_id", operationIds);
    if (error) {
      throw error;
    }

    const interventionIds = (data ?? []).map((intervention) => Number(intervention["id"]));
    const users = await this.fetchAppUserMap((data ?? []).map((intervention) => Number(intervention["user_id"])));
    const visas = await this.fetchVisasByTarget("exceptional_intervention_id", interventionIds);

    return (data ?? []).reduce((index, intervention) => {
      const operationId = Number(intervention["operation_id"]);
      const user = users.get(Number(intervention["user_id"])) ?? {};
      const rows = index.get(operationId) ?? [];
      rows.push({
        userId: idText(intervention["user_id"]),
        userName: text(user["display_name"]),
        userEmail: text(user["email"]),
        startDate: text(intervention["starts_at"]),
        endDate: text(intervention["ends_at"]),
        wasOnSite: intervention["was_on_site"] === true,
        label: text(intervention["label"]),
        comment: text(intervention["comment"]),
        agentVisa: visas.get(this.visaKey(intervention["id"], "exceptional_intervention_agent")),
      });
      index.set(operationId, rows);
      return index;
    }, new Map<number, JsonRecord[]>());
  }

  private async replaceExceptionalInterventions(operationId: number, interventions: JsonRecord[]): Promise<void> {
    const { data: existing, error: fetchError } = await this.client.from("exceptional_interventions").select("id").eq("operation_id", operationId);
    if (fetchError) {
      throw fetchError;
    }

    const existingIds = (existing ?? []).map((row) => Number(row["id"]));
    if (existingIds.length) {
      await this.deleteVisas("exceptional_intervention_id", existingIds);
      const { error: deleteError } = await this.client.from("exceptional_interventions").delete().in("id", existingIds);
      if (deleteError) {
        throw deleteError;
      }
    }

    for (const intervention of interventions) {
      const userId = await this.requireAppUserId(text(intervention["userId"]), "Utilisateur d'intervention introuvable.");
      const { data: inserted, error } = await this.client
        .from("exceptional_interventions")
        .insert({
          operation_id: operationId,
          user_id: userId,
          starts_at: text(intervention["startDate"]),
          ends_at: text(intervention["endDate"]),
          was_on_site: intervention["wasOnSite"] === true,
          label: text(intervention["label"]),
          comment: text(intervention["comment"]),
        })
        .select("id")
        .single();
      if (error) {
        throw error;
      }
      await this.upsertVisa("exceptional_intervention_id", Number(inserted["id"]), "exceptional_intervention_agent", intervention["agentVisa"]);
    }
  }

  private async replaceExceptionalOperationVisas(operationId: number, value: unknown): Promise<void> {
    const visas = isRecord(value) ? value : {};
    await Promise.all([
      this.upsertVisa("exceptional_operation_id", operationId, "exceptional_operation_initiator", visas["initiatorGlobal"]),
      this.upsertVisa("exceptional_operation_id", operationId, "exceptional_operation_director", visas["directorGlobal"]),
      this.upsertVisa("exceptional_operation_id", operationId, "exceptional_planned_initiator", visas["plannedInitiator"]),
      this.upsertVisa("exceptional_operation_id", operationId, "exceptional_planned_director", visas["plannedDirector"]),
      this.upsertVisa("exceptional_operation_id", operationId, "exceptional_actual_initiator", visas["actualInitiator"]),
      this.upsertVisa("exceptional_operation_id", operationId, "exceptional_actual_director", visas["actualDirector"]),
    ]);
  }

  private async fetchVisasByTarget(targetColumn: string, targetIds: number[]): Promise<Map<string, JsonRecord>> {
    if (!targetIds.length) {
      return new Map();
    }

    const { data, error } = await this.client.from("visas").select("*, signed_by_user:signed_by_user_id(auth_user_id,email,display_name)").in(targetColumn, targetIds);
    if (error) {
      throw error;
    }

    return (data ?? []).reduce((index, row) => {
      index.set(this.visaKey(row[targetColumn], text(row["scope"])), this.visaFromRow(row));
      return index;
    }, new Map<string, JsonRecord>());
  }

  private visaFromRow(row: JsonRecord): JsonRecord {
    const signer = isRecord(row["signed_by_user"]) ? row["signed_by_user"] : {};
    return {
      signed: Boolean(row["signed_at"]),
      signedAt: text(row["signed_at"]),
      signedByName: text(row["signed_by_name"]),
      signedByUid: text(signer["auth_user_id"]),
      signatureMode: row["signature_mode"] ?? undefined,
      signatureValue: text(row["signature_value"]) || undefined,
    };
  }

  private async upsertVisa(targetColumn: string, targetId: number, scope: string, value: unknown): Promise<void> {
    const visa = isRecord(value) ? value : {};
    const signed = visa["signed"] === true;
    const payload: JsonRecord = {
      scope,
      [targetColumn]: targetId,
      signed_by_user_id: signed ? await this.resolveAppUserId(text(visa["signedByUid"])) : null,
      signed_by_name: signed ? text(visa["signedByName"], "Signature migree") : "",
      signed_at: signed ? nullableText(visa["signedAt"]) : null,
      signature_mode: signed ? visa["signatureMode"] ?? null : null,
      signature_value: signed ? text(visa["signatureValue"]) : "",
    };
    const { data: existing, error: fetchError } = await this.client
      .from("visas")
      .select("id")
      .eq(targetColumn, targetId)
      .eq("scope", scope)
      .maybeSingle();

    if (fetchError) {
      throw fetchError;
    }

    const query = existing ? this.client.from("visas").update(payload).eq("id", Number(existing["id"])) : this.client.from("visas").insert(payload);
    const { error } = await query;

    if (error) {
      throw error;
    }
  }

  private async deleteVisas(targetColumn: string, targetIds: number[]): Promise<void> {
    if (!targetIds.length) {
      return;
    }

    const { error } = await this.client.from("visas").delete().in(targetColumn, targetIds);
    if (error) {
      throw error;
    }
  }

  private async resolveAppUserId(identifier: string): Promise<number | null> {
    if (!identifier) {
      return null;
    }

    const id = numberId(identifier);
    let query = this.client.from("app_users").select("id").limit(1);
    query = id ? query.eq("id", id) : query.eq(isUuid(identifier) ? "auth_user_id" : "email", identifier);
    const { data, error } = await query.maybeSingle();

    if (error) {
      throw error;
    }

    return data ? Number(data["id"]) : null;
  }

  private async requireAppUserId(identifier: string, message: string): Promise<number> {
    const userId = await this.resolveAppUserId(identifier);
    if (!userId) {
      throw new Error(message);
    }

    return userId;
  }

  private async fetchAppUserMap(userIds: number[]): Promise<Map<number, JsonRecord>> {
    const ids = [...new Set(userIds.filter((userId) => Number.isInteger(userId) && userId > 0))];
    if (!ids.length) {
      return new Map();
    }

    const { data, error } = await this.client.from("app_users").select("id,email,display_name,auth_user_id").in("id", ids);
    if (error) {
      throw error;
    }

    return (data ?? []).reduce((index, user) => {
      index.set(Number(user["id"]), user);
      return index;
    }, new Map<number, JsonRecord>());
  }

  private visaKey(targetId: unknown, scope: string): string {
    return `${targetId}:${scope}`;
  }

  private participantKey(operationId: number, kind: string): string {
    return `${operationId}:${kind}`;
  }

  private stringIds(value: unknown): string[] {
    if (!Array.isArray(value)) {
      return [];
    }

    return value.map((item) => idText(item)).filter(Boolean);
  }

  private parseJsonText(value: unknown): unknown {
    if (typeof value !== "string" || !value.trim()) {
      return null;
    }

    try {
      return JSON.parse(value);
    } catch {
      return null;
    }
  }

  private async deleteById(table: RelationalTable, id: number | null): Promise<void> {
    if (!id) {
      return;
    }

    const { error } = await this.client.from(table).delete().eq("id", id);
    if (error) {
      throw error;
    }
  }

  private subscriptionTables(reference: StoreCollection): RelationalTable[] {
    switch (reference.collectionName) {
      case "settings.teams":
        return ["teams", "team_members"];
      case "settings":
        return "documentId" in reference && reference.documentId === "rhCompensationRules"
          ? ["rh_on_call_compensation_rules", "rh_period_compensation_rules"]
          : ["rh_export_settings"];
      case "regularOnCallPeriods":
        return ["regular_on_call_periods", "visas"];
      case "regularInterventions":
        return ["regular_interventions", "visas"];
      case "exceptionalOperations":
        return ["exceptional_operations", "exceptional_operation_participants", "exceptional_interventions", "visas"];
      default:
        return [relationTable(reference)];
    }
  }

  private registerCollectionRefresher(reference: StoreCollection, refresh: RefreshCallback): StoreUnsubscribe {
    return this.registerRefresher(this.collectionRefreshers, this.collectionKey(reference), refresh);
  }

  private registerDocumentRefresher(reference: StoreDocumentReference, refresh: RefreshCallback): StoreUnsubscribe {
    return this.registerRefresher(this.documentRefreshers, this.documentKey(reference), refresh);
  }

  private registerRefresher(registry: Map<string, Set<RefreshCallback>>, key: string, refresh: RefreshCallback): StoreUnsubscribe {
    const refreshers = registry.get(key) ?? new Set<RefreshCallback>();
    refreshers.add(refresh);
    registry.set(key, refreshers);

    return () => {
      refreshers.delete(refresh);

      if (!refreshers.size) {
        registry.delete(key);
      }
    };
  }

  private async refreshAfterWrite(reference: StoreDocumentReference): Promise<void> {
    await this.runRefreshers([
      this.documentKey(reference),
      this.collectionKey(reference),
      this.collectionKey({ collectionName: reference.collectionName }),
    ]);
  }

  private async runRefreshers(keys: string[]): Promise<void> {
    const uniqueRefreshers = new Set<RefreshCallback>();

    keys.forEach((key) => {
      this.documentRefreshers.get(key)?.forEach((refresh) => uniqueRefreshers.add(refresh));
      this.collectionRefreshers.get(key)?.forEach((refresh) => uniqueRefreshers.add(refresh));
    });

    await Promise.all([...uniqueRefreshers].map((refresh) => refresh()));
  }

  private collectionKey(reference: StoreCollection): string {
    return `${reference.collectionName}:${reference.parentId ?? ""}`;
  }

  private documentKey(reference: StoreDocumentReference): string {
    return `${reference.collectionName}:${reference.documentId}`;
  }
}

const dataStore = new SupabaseRelationalStore(supabase);

export const appStore = {
  auth: {
    onSessionChanged(callback: (user: StoreAuthUser | null) => void): StoreUnsubscribe {
      const { data } = supabase.auth.onAuthStateChange((_event, session) => callback(mapAuthUser(session?.user ?? null)));
      void supabase.auth.getSession().then(({ data: sessionData }) => callback(mapAuthUser(sessionData.session?.user ?? null)));

      return () => data.subscription.unsubscribe();
    },

    async createWithEmail(email: string, password: string): Promise<unknown> {
      const { data, error } = await supabase.auth.signUp({ email, password });

      if (error) {
        throw error;
      }

      return data;
    },

    async signInWithEmail(email: string, password: string): Promise<unknown> {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });

      if (error) {
        throw error;
      }

      return data;
    },

    async signOut(): Promise<void> {
      const { error } = await supabase.auth.signOut();

      if (error) {
        throw error;
      }
    },

    async updateProfile(_user: StoreAuthUser, profile: { displayName?: string }): Promise<void> {
      const { error } = await supabase.auth.updateUser({
        data: {
          display_name: profile.displayName ?? "",
        },
      });

      if (error) {
        throw error;
      }
    },
  },

  data: dataStore,

  paths: {
    users: () => collectionReference("settings.users"),
    user: (userId: string) => documentReference("settings.users", userId),
    teams: () => collectionReference("settings.teams"),
    team: (teamId: string) => documentReference("settings.teams", teamId),
    scheduleRules: () => collectionReference("settings.scheduleRules"),
    scheduleRule: (ruleId: string) => documentReference("settings.scheduleRules", ruleId),
    publicHolidays: () => collectionReference("settings.publicHolidays"),
    publicHoliday: (holidayId: string) => documentReference("settings.publicHolidays", holidayId),
    rhExportTemplates: () => documentReference("settings", "rhExportTemplates"),
    rhExportTemplateItems: () =>
      collectionReference("settings.rhExportTemplates", {
        parentCollectionName: "settings",
        parentId: "rhExportTemplates",
      }),
    rhExportTemplate: (templateId: string) =>
      documentReference("settings.rhExportTemplates", templateId, {
        parentCollectionName: "settings",
        parentId: "rhExportTemplates",
      }),
    rhCompensationRules: () => documentReference("settings", "rhCompensationRules"),
    regularOnCallPeriods: () => collectionReference("regularOnCallPeriods"),
    regularOnCallPeriod: (periodId: string) => documentReference("regularOnCallPeriods", periodId),
    regularInterventions: (periodId: string) =>
      collectionReference("regularInterventions", {
        parentCollectionName: "regularOnCallPeriods",
        parentId: periodId,
      }),
    regularIntervention: (periodId: string, interventionId: string) =>
      documentReference("regularInterventions", interventionId, {
        parentCollectionName: "regularOnCallPeriods",
        parentId: periodId,
      }),
    regularInterventionsGroup: () => collectionReference("regularInterventions"),
    exceptionalOperations: () => collectionReference("exceptionalOperations"),
    exceptionalOperation: (operationId: string) => documentReference("exceptionalOperations", operationId),
  },

  errors: {
    isError(error: unknown): error is StoreError {
      return error instanceof AuthError || error instanceof Error || Boolean((error as { message?: unknown })?.message);
    },

    toMessage(error: unknown): string {
      return toError(error).message;
    },
  },
};
