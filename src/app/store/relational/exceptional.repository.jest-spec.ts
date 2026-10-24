import { SupabaseClient } from "@supabase/supabase-js";
import { ExceptionalRepository } from "./exceptional.repository";
import { UsersRepository } from "./users.repository";
import { VisasRepository } from "./visas.repository";
import { ExceptionalOperation, ExceptionalOperationType, JsonRecord } from "../../types";
import { createEmptyVisa } from "../../shared/visa.models";
import { tablesForExceptionalType, parseExceptionalId } from "./exceptional-tables";

/** Records table/foreign-key routing without implementing PostgreSQL constraints in mocks. */
function routedClient(existingTable?: string, failure?: Error, rows: Record<string, JsonRecord[]> = {}) {
  const calls: Array<{ table: string; method: string; value?: unknown }> = [];
  const client = {
    from: (table: string) => {
      calls.push({ table, method: "from" });
      const query = Object.assign(Promise.resolve({ data: rows[table] ?? [], error: failure }), {
        select: () => query,
        eq: (column: string, value: unknown) => { calls.push({ table, method: column, value }); return query; },
        in: () => query,
        insert: (value: JsonRecord) => { calls.push({ table, method: "insert", value }); return query; },
        update: (value: JsonRecord) => { calls.push({ table, method: "update", value }); return query; },
        delete: () => { calls.push({ table, method: "delete" }); return query; },
        single: () => Promise.resolve({ data: { id: 100 }, error: failure }),
        maybeSingle: () => Promise.resolve({ data: table === existingTable ? { id: 100 } : null, error: failure }),
      });
      return query;
    },
  } as unknown as SupabaseClient;
  const users = new UsersRepository(client);
  jest.spyOn(users, "resolveAppUserId").mockResolvedValue(7);
  jest.spyOn(users, "requireAppUserId").mockResolvedValue(7);
  const visas = new VisasRepository(client, users);
  jest.spyOn(visas, "upsertVisa").mockResolvedValue();
  return { repository: new ExceptionalRepository(client, users, visas), calls, visas };
}

describe("Separate exceptional persistence families", () => {
  function existingOperation(): ExceptionalOperation {
    const visa = createEmptyVisa();
    const participant = { id: '21', userId: '7', displayName: 'Agent', email: 'agent@test.fr',
      startDate: '2026-10-10T18:00', endDate: '2026-10-11T08:00', visa };
    const intervention = { id: '11', userId: '7', userName: 'Agent', userEmail: 'agent@test.fr',
      startDate: '2026-10-10T19:00', endDate: '2026-10-10T20:00',
      wasOnSite: false, label: '', comment: '', agentVisa: visa };
    return { id: 'astreinte:100', type: 'astreinte', title: 'Existing', initiatorUid: '7', initiatorName: 'Agent',
      operationManagerUid: '7', operationManagerName: 'Agent', startDate: participant.startDate,
      forecastEndDate: participant.endDate, actualStartDate: participant.startDate, actualEndDate: participant.endDate,
      plannedUsers: [participant], actualUsers: [participant],
      interventions: [intervention, { ...intervention, id: '12', userId: '8' }],
      visas: { plannedInitiator: visa, plannedDirector: visa, actualInitiator: visa, actualDirector: visa } };
  }

  it("updates only the changed intervention without replacing participants or foreign interventions", async () => {
    const current = existingOperation();
    const { repository, calls } = routedClient(undefined, undefined, {
      exceptional_on_call_interventions: [{ id: 11 }, { id: 12 }],
    });
    jest.spyOn(repository, 'fetchExceptionalOperation').mockResolvedValue(current);
    await repository.saveExceptionalOperation(current.id, { ...current, interventions: [
      { ...current.interventions[0], comment: 'Own correction' }, current.interventions[1],
    ] });
    expect(calls.filter(call => call.table === 'exceptional_on_call_interventions' && call.method === 'update')).toHaveLength(1);
    expect(calls.filter(call => call.table === 'exceptional_on_call_interventions' && call.method === 'id')).toEqual([
      { table: 'exceptional_on_call_interventions', method: 'id', value: 11 },
    ]);
    expect(calls.some(call => call.method === 'delete' || call.method === 'insert')).toBe(false);
    expect(calls.some(call => call.table === 'exceptional_on_call_participants')).toBe(false);
  });

  it("signs an existing participant without rewriting its dates", async () => {
    const current = existingOperation();
    const { repository, calls, visas } = routedClient();
    jest.spyOn(repository, 'fetchExceptionalOperation').mockResolvedValue(current);
    await repository.saveExceptionalOperation(current.id, { ...current,
      actualUsers: [{ ...current.actualUsers[0], visa: { ...createEmptyVisa(), signed: true } }] });
    expect(calls.some(call => call.table === 'exceptional_on_call_participants')).toBe(false);
    expect(visas.upsertVisa).toHaveBeenCalledWith('participant_id', 21, 'exceptional_participant_agent',
      expect.objectContaining({ signed: true }), 'exceptional_on_call_visas');
  });

  it("does not remove visas when RLS silently rejects an intervention deletion", async () => {
    const current = existingOperation();
    const calls: string[] = [];
    const query = (result: JsonRecord[]) => {
      const value = Object.assign(Promise.resolve({ data: result, error: null }), {
        select: () => value, eq: () => value, in: () => value,
        delete: () => { calls.push('delete'); return query([]); },
      });
      return value;
    };
    const client = { from: () => query([{ id: 11 }, { id: 12 }]) } as unknown as SupabaseClient;
    const users = new UsersRepository(client);
    jest.spyOn(users, 'resolveAppUserId').mockResolvedValue(7);
    const visas = new VisasRepository(client, users);
    const deleteVisas = jest.spyOn(visas, 'deleteVisas').mockResolvedValue();
    const repository = new ExceptionalRepository(client, users, visas);
    jest.spyOn(repository, 'fetchExceptionalOperation').mockResolvedValue(current);
    await expect(repository.saveExceptionalOperation(current.id, {
      ...current, interventions: [current.interventions[0]],
    })).rejects.toThrow('non autorisée');
    expect(calls).toEqual(['delete']);
    expect(deleteVisas).not.toHaveBeenCalled();
  });

  it("waits for every sibling write after a participant visa fails", async () => {
    const { repository, visas } = routedClient();
    const failure = new Error("Visa rejected");
    let release!: () => void;
    let started!: () => void;
    const pending = new Promise<void>(resolve => { release = resolve; });
    const writesStarted = new Promise<void>(resolve => { started = resolve; });
    jest.mocked(visas.upsertVisa)
      .mockRejectedValueOnce(failure)
      .mockImplementationOnce(() => { started(); return pending; });
    const participant = { userId: "7", displayName: "Agent", email: "agent@test.fr",
      startDate: "2026-10-10T18:00", endDate: "2026-10-10T19:00" };
    let settled = false;
    const saving = (async () => {
      try {
        await repository.saveExceptionalOperation(undefined, {
          type: "astreinte", plannedUsers: [participant, { ...participant, userId: "8" }],
        });
      } finally {
        settled = true;
      }
    })();
    const rejection = expect(saving).rejects.toBe(failure);
    await writesStarted;
    expect(settled).toBe(false);
    release();
    await rejection;
    expect(visas.upsertVisa).toHaveBeenCalledTimes(2);
  });

  it.each<[ExceptionalOperationType, string, string]>([
    ["astreinte", "exceptional_on_calls", "operation_id"],
    ["travaux", "exceptional_works", "operation_id"],
  ])("routes %s parents, participants, interventions and visas", async (type, table, parentColumn) => {
    const { repository, calls, visas } = routedClient();
    const family = tablesForExceptionalType(type);
    expect(await repository.saveExceptionalOperation(undefined, {
      type, title: "Test", plannedUsers: [{ userId: "7", displayName: "Agent", email: "agent@test.fr", startDate: "2026-10-10T18:00", endDate: "2026-10-10T19:00" }],
      interventions: type === "astreinte" ? [{ userId: "7", userName: "Agent", userEmail: "agent@test.fr", startDate: "2026-10-10T18:00", endDate: "2026-10-10T19:00", wasOnSite: true, label: "", comment: "" }] : [],
    })).toBe(`${type}:100`);
    expect(calls.find(call => call.table === table && call.method === "insert")?.value).not.toHaveProperty("operation_type");
    for (const child of [family.participants, family.interventions]) {
      if (!child) continue;
      expect(calls.find(call => call.table === child && call.method === "insert")?.value).toHaveProperty(parentColumn, 100);
    }
    expect(visas.upsertVisa).toHaveBeenCalledWith(parentColumn, 100, "exceptional_operation_initiator", undefined, family.visas);
    expect(calls.some(call => call.table === "exceptional_operations")).toBe(false);
    await repository.saveExceptionalOperation(`${type}:100`, { type, title: "Updated" });
    expect(calls.some(call => call.table === table && call.method === "update")).toBe(true);
    if (type === "travaux") {
      expect(calls.some(call => call.table.includes("intervention"))).toBe(false);
      expect(jest.mocked(visas.upsertVisa).mock.calls.some(call => call[0] === "intervention_id")).toBe(false);
    }
  });

  it.each(["exceptional_on_calls", "exceptional_works"])("deletes only the owning table %s", async table => {
    const { repository, calls } = routedClient(table);
    const type = table === "exceptional_on_calls" ? "astreinte" : "travaux";
    await repository.deleteExceptionalOperation(`${type}:100`);
    expect(calls.filter(call => call.method === "delete")).toEqual([{ table, method: "delete" }]);
    expect(calls.every(call => call.table === table)).toBe(true);
    expect(calls.length).toBeGreaterThan(0);
  });

  it("rejects unknown families, missing parents and database errors", async () => {
    const { repository, calls } = routedClient();
    await expect(repository.saveExceptionalOperation(undefined, { title: "No family" })).rejects.toThrow("Type d'operation");
    expect(calls).toHaveLength(0);
    await expect(repository.deleteExceptionalOperation("astreinte:100")).rejects.toThrow("Operation introuvable");
    const failure = new Error("Database unavailable");
    await expect(routedClient(undefined, failure).repository.fetchExceptionalOperations()).rejects.toBe(failure);
    await expect(routedClient(undefined, failure).repository.deleteExceptionalOperation("astreinte:100")).rejects.toBe(failure);
  });

  it.each(["100", "astreinte:0", "travaux:-1", "unknown:1", "travaux:1e3", "travaux:9007199254740992"])("rejects ambiguous/invalid ID %s", id => {
    expect(() => parseExceptionalId(id)).toThrow("Identifiant");
  });

  it("rejects writes with an ID from the other family before touching SQL", async () => {
    const { repository, calls } = routedClient();
    await expect(repository.saveExceptionalOperation("travaux:100", { type: "astreinte" })).rejects.toThrow("type");
    expect(calls).toHaveLength(0);
  });

  it("rejects interventions on work operations before any SQL write", async () => {
    const { repository, calls } = routedClient();
    await expect(repository.saveExceptionalOperation(undefined, {
      type: "travaux", interventions: [{ userId: "7", userName: "Agent", userEmail: "", startDate: "", endDate: "", wasOnSite: false, label: "", comment: "" }],
    })).rejects.toThrow("ne peuvent pas avoir d'interventions");
    expect(calls).toHaveLength(0);
  });

  it.each<[ExceptionalOperationType, string]>([
    ["astreinte", "exceptional_on_calls"], ["travaux", "exceptional_works"],
  ])("reads %s independently without querying the other family", async (type, table) => {
    const { repository, calls } = routedClient();
    expect(await repository.fetchExceptionalOperations(type)).toEqual([]);
    await repository.fetchExceptionalOperation(`${type}:100`);
    // Empty parents skip all child/user/visa requests as well.
    expect(calls.every(call => call.table === table)).toBe(true);
  });
  it("persists a ticket-only correction and treatment date without rebuilding unrelated children", async () => {
    const current = existingOperation();
    const { repository, calls } = routedClient(undefined, undefined, {
      exceptional_on_call_interventions: [{ id: 11 }, { id: 12 }],
    });
    jest.spyOn(repository, "fetchExceptionalOperation").mockResolvedValue(current);
    await repository.saveExceptionalOperation(current.id, { ...current, directionId: "2", treatedAt: "2026-10-24T08:00:00Z",
      interventions: [{ ...current.interventions[0], ticket: "INC-123" }, current.interventions[1]],
    });
    expect(calls.find(call => call.table === "exceptional_on_calls" && call.method === "update")?.value)
      .toMatchObject({ treated_at: "2026-10-24T08:00:00Z", direction_id: 2 });
    const interventionWrites = calls.filter(call => call.table === "exceptional_on_call_interventions" && call.method === "update");
    expect(interventionWrites).toHaveLength(1);
    expect(interventionWrites[0].value).toMatchObject({ ticket: "INC-123" });
  });

});
