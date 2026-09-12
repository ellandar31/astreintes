import { AuthError, SupabaseClient, User, createClient } from "@supabase/supabase-js";
import { supabaseConfig } from "./supabase.config";

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

export interface StoreDocument<T = Record<string, unknown>> {
  id: string;
  data: T;
  parentId: string;
}

interface StoreRow {
  collection_name: string;
  data: Record<string, unknown>;
  document_id: string;
  parent_collection_name: string | null;
  parent_id: string | null;
}

export interface StoreError {
  code?: string;
  message: string;
}

type StorePayload = Record<string, unknown>;
type SetDocumentOptions = { merge?: boolean };
type RefreshCallback = () => Promise<void>;

const appDocumentsTable = "app_documents";
const deleteFieldMarker = Symbol("delete-field");

const supabase = createClient(supabaseConfig.url, supabaseConfig.anonKey, {
  auth: {
    autoRefreshToken: true,
    detectSessionInUrl: true,
    persistSession: true,
  },
});

/**
 * Maps Supabase Auth metadata to the stable user shape consumed by NgRx.
 *
 * Supabase providers do not agree on the display-name field. Normalizing it at
 * the boundary keeps validation, profile and RH exports independent from the
 * selected identity provider.
 */
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

function mapRows<T>(rows: StoreRow[] | null): StoreDocument<T>[] {
  return (rows ?? []).map((row) => ({
    id: row.document_id,
    data: row.data as T,
    parentId: row.parent_id ?? "",
  }));
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

/**
 * Generates ids without assuming a secure browser context.
 *
 * The self-hosted deployment can run over plain HTTP through Tailscale while
 * TLS is being configured. In that context some browsers expose neither
 * crypto.randomUUID nor the full Web Crypto API, so realtime subscriptions and
 * document creation must not depend exclusively on randomUUID.
 */
function generatedDocumentId(): string {
  const browserCrypto = globalThis.crypto;

  if (typeof browserCrypto?.randomUUID === "function") {
    return browserCrypto.randomUUID();
  }

  if (typeof browserCrypto?.getRandomValues === "function") {
    const bytes = browserCrypto.getRandomValues(new Uint8Array(16));
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;

    return [...bytes]
      .map((byte, index) => {
        const value = byte.toString(16).padStart(2, "0");
        return index === 4 || index === 6 || index === 8 || index === 10 ? `-${value}` : value;
      })
      .join("");
  }

  return `id-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

function isDeleteFieldMarker(value: unknown): boolean {
  return value === deleteFieldMarker;
}

/**
 * Applies partial updates while honoring the former document-store deleteField API.
 *
 * Existing effects already express business corrections as "delete this field"
 * when an RH send is cancelled. Keeping this sentinel avoids leaking Supabase
 * JSONB implementation details into feature effects.
 */
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

class SupabaseDocumentStore {
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

    const channel = this.client
      .channel(`collection:${reference.collectionName}:${reference.parentId ?? "root"}:${generatedDocumentId()}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: appDocumentsTable,
          filter: `collection_name=eq.${reference.collectionName}`,
        },
        () => void this.fetchCollection<T>(reference).then(next).catch(error),
      )
      .subscribe();

    return () => {
      unsubscribeRefresh();
      void this.client.removeChannel(channel);
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

    const channel = this.client
      .channel(`document:${reference.collectionName}:${reference.documentId}:${generatedDocumentId()}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: appDocumentsTable,
          filter: `document_id=eq.${reference.documentId}`,
        },
        () => void this.getDocument<T>(reference).then(next).catch(error),
      )
      .subscribe();

    return () => {
      unsubscribeRefresh();
      void this.client.removeChannel(channel);
    };
  }

  async getDocument<T>(reference: StoreDocumentReference): Promise<T | undefined> {
    const { data, error } = await this.documentQuery(reference).maybeSingle<Pick<StoreRow, "data">>();

    if (error) {
      throw error;
    }

    return data?.data as T | undefined;
  }

  async addDocument(reference: StoreCollection, data: StorePayload): Promise<StoreDocumentReference> {
    const newReference = documentReference(reference.collectionName, generatedDocumentId(), reference);
    await this.setDocument(newReference, data);
    return newReference;
  }

  async setDocument(reference: StoreDocumentReference, data: StorePayload, options?: SetDocumentOptions): Promise<void> {
    const nextData = options?.merge ? mergePayload((await this.getDocument(reference)) ?? {}, data) : data;
    const { error } = await this.client.from(appDocumentsTable).upsert(
      {
        collection_name: reference.collectionName,
        data: nextData,
        document_id: reference.documentId,
        parent_collection_name: reference.parentCollectionName ?? null,
        parent_id: reference.parentId ?? null,
      },
      { onConflict: "collection_name,document_id" },
    );

    if (error) {
      throw error;
    }

    await this.refreshAfterWrite(reference);
  }

  async updateDocument(reference: StoreDocumentReference, data: StorePayload): Promise<void> {
    const currentData = await this.getDocument<StorePayload>(reference);

    if (!currentData) {
      throw new Error(`Document introuvable: ${reference.collectionName}/${reference.documentId}`);
    }

    const { error } = await this.client
      .from(appDocumentsTable)
      .update({ data: mergePayload(currentData, data) })
      .eq("collection_name", reference.collectionName)
      .eq("document_id", reference.documentId);

    if (error) {
      throw error;
    }

    await this.refreshAfterWrite(reference);
  }

  async deleteDocument(reference: StoreDocumentReference): Promise<void> {
    const { error } = await this.client
      .from(appDocumentsTable)
      .delete()
      .eq("collection_name", reference.collectionName)
      .eq("document_id", reference.documentId);

    if (error) {
      throw error;
    }

    await this.refreshAfterWrite(reference);
  }

  serverTimestamp(): string {
    return new Date().toISOString();
  }

  deleteField(): unknown {
    return deleteFieldMarker;
  }

  private async fetchCollection<T>(reference: StoreCollection): Promise<StoreDocument<T>[]> {
    let query = this.client.from(appDocumentsTable).select("collection_name,document_id,parent_collection_name,parent_id,data").eq("collection_name", reference.collectionName);

    if (reference.parentId) {
      query = query.eq("parent_id", reference.parentId);
    }

    const { data, error } = await query;

    if (error) {
      throw error;
    }

    return mapRows<T>(data as StoreRow[]);
  }

  private documentQuery(reference: StoreDocumentReference) {
    return this.client
      .from(appDocumentsTable)
      .select("data")
      .eq("collection_name", reference.collectionName)
      .eq("document_id", reference.documentId);
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

  /**
   * Refreshes local NgRx subscriptions after writes.
   *
   * Supabase Realtime may be unavailable or delayed behind a reverse proxy,
   * especially for the first self-hosted deployments. A write-side refresh keeps
   * the initiating screen consistent immediately while the realtime channel
   * remains useful for external changes from other sessions.
   */
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

const dataStore = new SupabaseDocumentStore(supabase);

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
