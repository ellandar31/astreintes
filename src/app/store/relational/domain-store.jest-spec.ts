import { SupabaseClient } from "@supabase/supabase-js";
import { SupabaseDomainStore } from "./domain-store";
import { DomainObserverService } from "./domain-observer";
import { UsersRepository } from "./users.repository";
import { RegularRepository } from "./regular.repository";
import { ExceptionalRepository } from "./exceptional.repository";
import { VisasRepository } from "./visas.repository";

import { JsonRecord, RegularOnCallPeriod, ExceptionalOperation } from "../../types";
import { createEmptyVisa } from "../../shared/visa.models";

/** Filter real foreign keys and simulate generated numeric IDs, rather than returning document envelopes. */
function relationalClient(tables: Record<string, JsonRecord[]> = {}, failure?: Error) {
  const writes: Array<{ table: string; payload: JsonRecord }> = [];
  const channel = { on: jest.fn().mockReturnThis(), subscribe: jest.fn().mockReturnThis() };
  const removeChannel = jest.fn();
  const client = {
    channel: jest.fn(() => channel), removeChannel,
    from: jest.fn((table: string) => {
      let rows = tables[table] ?? [];
      // Evaluate after fluent filters run, using a real Promise instead of a custom thenable.
      const query = Object.assign(Promise.resolve().then(() => ({ data: rows, error: failure })), {
        select: jest.fn(() => query), limit: jest.fn(() => query), order: jest.fn(() => query),
        eq: jest.fn((key: string, value: unknown) => { rows = rows.filter(row => row[key] === value); return query; }),
        in: jest.fn((key: string, values: unknown[]) => { rows = rows.filter(row => values.includes(row[key])); return query; }),
        update: jest.fn((payload: JsonRecord) => { writes.push({ table, payload }); return query; }),
        insert: jest.fn((payload: JsonRecord) => {
          writes.push({ table, payload });
          rows = [{ ...payload, id: 100 }];
          return query;
        }),
        upsert: jest.fn((payload: JsonRecord) => { writes.push({ table, payload }); rows = [{ ...payload, id: 100 }]; return query; }),
        single: jest.fn(() => Promise.resolve({ data: rows[0], error: failure })),
        maybeSingle: jest.fn(() => Promise.resolve({ data: rows[0] ?? null, error: failure })),
      });
      return query;
    }),
  } as unknown as SupabaseClient;
  return { client, channel, removeChannel, writes };
}

const authId = "690d58ef-7ec0-4a47-9511-2856263cf526";
const userRow = { id: 7, auth_user_id: authId, email: "agent@example.fr", display_name: "Agent", role: "director" };
const visa = { ...createEmptyVisa(), signed: true, signedAt: "2026-09-14T12:00:00Z", signedByName: "Original signer", signedByUid: authId, signatureValue: "snapshot" };
const period: RegularOnCallPeriod = {
  id: "11", teamId: "2", userId: "7", userName: "Agent", userEmail: userRow.email,
  startDate: "2026-09-12T18:00", endDate: "2026-09-13T08:00", agentVisa: visa, sentToRhAt: "2026-09-14T15:00:00Z",
};
const operation: ExceptionalOperation = {
    id: "travaux:31", type: "travaux", title: "Works", initiatorUid: "7", initiatorName: "Agent", operationManagerUid: "", operationManagerName: "Manager",
  startDate: "", forecastEndDate: "", actualStartDate: "", actualEndDate: "",
  plannedUsers: [{ userId: "7", displayName: "Agent", email: userRow.email, startDate: period.startDate, endDate: period.endDate, visa }],
  actualUsers: [], interventions: [],
  visas: { plannedInitiator: visa, plannedDirector: createEmptyVisa(), actualInitiator: createEmptyVisa(), actualDirector: createEmptyVisa() },
};

describe("Typed relational persistence", () => {
  afterEach(() => jest.restoreAllMocks());

  it.each(["7", authId, userRow.email])("resolves %s into a direct application user", async identifier => {
    const users = new UsersRepository(relationalClient({ app_users: [userRow] }).client);
    expect(await users.resolveAppUserId(identifier)).toBe(7);
    const user = await users.fetchUser(identifier);
    expect(user).toMatchObject({ id: "7", uid: authId, displayName: "Agent", role: 3 });
    expect(user).not.toHaveProperty("data");
    expect(user).not.toHaveProperty("parentId");
  });

  it("rejects missing mandatory users and propagates database errors", async () => {
    await expect(new UsersRepository(relationalClient().client).requireAppUserId("99", "Missing user")).rejects.toThrow("Missing user");
    const failure = new Error("Database unavailable");
    await expect(new UsersRepository(relationalClient({}, failure).client).fetchUsers()).rejects.toBe(failure);
  });

  it("does not replay role, identity or signatures in partial profile writes", async () => {
    const { client, writes } = relationalClient({ app_users: [userRow] });
    await new SupabaseDomainStore(client).users.save(authId, { displayName: "New", lastLoginAt: "2026-09-14T15:00:00Z" });
    expect(writes[0]).toEqual({ table: "app_users", payload: { display_name: "New", last_login_at: "2026-09-14T15:00:00Z" } });
  });

  it.each([0, 1, 2, 3, 4] as const)("writes only the explicit role %s for an administrative update", async role => {
    const { client, writes } = relationalClient({ app_users: [userRow] });
    await new UsersRepository(client).saveUser("7", { role });
    expect(writes[0].payload).toEqual({ role: ["admin", "user", "initiator", "director", "rh"][role] });
  });

  it.each([null, "", "0", {}, -1, 5, Number.NaN])("rejects invalid role %p without coercing it to admin", async role => {
    const { client, writes } = relationalClient({ app_users: [userRow] });
    await expect(new UsersRepository(client).saveUser("7", { role } as never)).rejects.toThrow("Invalid application role");
    expect(writes).toEqual([]);
  });

  it("creates an application profile from the authentication UUID", async () => {
    const { client, writes } = relationalClient();
    expect(await new SupabaseDomainStore(client).users.save(authId, { uid: authId, email: userRow.email, role: 1 })).toBe("100");
    expect(writes[0].payload).toMatchObject({ auth_user_id: authId, email: userRow.email, role: "user" });
  });

  it("rebuilds regular joins and filters interventions by period", async () => {
    const { client } = relationalClient({
      app_users: [userRow],
      regular_on_call_periods: [{ id: 11, team_id: 2, user_id: 7, starts_at: "2026-09-12T18:00:00Z", ends_at: "2026-09-13T08:00:00Z" }],
      regular_interventions: [{ id: 21, regular_period_id: 11, user_id: 7, comment: "On site" }, { id: 22, regular_period_id: 12, user_id: 7 }],
      visas: [{ id: 1, regular_period_id: 11, scope: "regular_period_agent", signed_at: visa.signedAt, signed_by_user: userRow, signature_value: visa.signatureValue }],
    });
    const store = new SupabaseDomainStore(client);
    const periods = await store.regular.listPeriods();
    expect(periods).toMatchObject([{ id: "11", userId: "7", userName: "Agent", agentVisa: { signed: true, signedByUid: authId, signatureValue: "snapshot" } }]);
    expect(new Date(periods[0].startDate).getTime()).toBe(new Date("2026-09-12T18:00:00Z").getTime());
    expect(await store.regular.listInterventions("11")).toMatchObject([{ id: "21", periodId: "11", userName: "Agent", comment: "On site" }]);
    expect(await store.regular.listInterventions()).toHaveLength(2);
  });

  it("isolates planned, actual and intervention joins per operation and supplies empty visas", async () => {
    const { client } = relationalClient({
      app_users: [userRow],
      exceptional_works: [{ id: 31, title: "Works", initiator_user_id: 7 }],
      exceptional_on_calls: [{ id: 32 }],
      exceptional_work_participants: [
        { id: 41, operation_id: 31, participant_kind: "planned", user_id: 7, starts_at: "2026-09-12T18:00:00Z" },
        { id: 42, operation_id: 31, participant_kind: "actual", user_id: 7 },
      ],
      exceptional_on_call_participants: [{ id: 43, operation_id: 32, participant_kind: "planned", user_id: 7 }],
      exceptional_work_interventions: [{ id: 51, operation_id: 31, user_id: 7, was_on_site: true }],
      exceptional_work_visas: [{ id: 61, participant_id: 41, scope: "exceptional_participant_agent", signed_at: visa.signedAt, signature_value: "snapshot" }],
    });
    const operations = await new SupabaseDomainStore(client).exceptional.listOperations();
    expect(operations[0]).toMatchObject({ id: "travaux:31", type: "travaux", plannedUsers: [{ displayName: "Agent", visa: { signatureValue: "snapshot" } }], actualUsers: [{ userId: "7" }], interventions: [] });
    expect(client.from).not.toHaveBeenCalledWith("exceptional_work_interventions");
    expect(operations[1]).toMatchObject({ id: "astreinte:32", type: "astreinte", actualUsers: [], interventions: [], visas: { plannedInitiator: createEmptyVisa() } });
    expect(new Date(operations[0].plannedUsers[0].startDate).getTime()).toBe(new Date("2026-09-12T18:00:00Z").getTime());
  });

  it.each(["", "   "])("uses email for unnamed participants (%j)", async displayName => {
    const { client } = relationalClient({
      app_users: [{ ...userRow, display_name: displayName }], regular_on_call_periods: [{ id: 11, user_id: 7 }],
      exceptional_on_calls: [{ id: 31, initiator_user_id: 7 }],
      exceptional_on_call_participants: [{ id: 41, operation_id: 31, participant_kind: "planned", user_id: 7 }],
    });
    const store = new SupabaseDomainStore(client);
    expect((await store.regular.listPeriods())[0].userName).toBe(userRow.email);
    expect((await store.exceptional.listOperations())[0].plannedUsers[0].displayName).toBe(userRow.email);
    expect((await store.users.get("7"))?.displayName).toBe(displayName);
  });

  it("isolates matching SQL IDs across parents, children and signatures", async () => {
    const { client } = relationalClient({
      app_users: [userRow, { ...userRow, id: 8, display_name: "Other agent" }],
      exceptional_works: [{ id: 31, title: "Work" }],
      exceptional_on_calls: [{ id: 31, title: "On call" }],
      exceptional_work_participants: [{ id: 41, operation_id: 31, participant_kind: "actual", user_id: 7 }],
      exceptional_on_call_participants: [{ id: 41, operation_id: 31, participant_kind: "actual", user_id: 8 }],
      exceptional_work_interventions: [{ id: 51, operation_id: 31, user_id: 7 }],
      exceptional_on_call_interventions: [{ id: 51, operation_id: 31, user_id: 8 }],
      exceptional_work_visas: [{ participant_id: 41, scope: "exceptional_participant_agent", signature_value: "Work signature" }],
      exceptional_on_call_visas: [{ participant_id: 41, scope: "exceptional_participant_agent", signature_value: "On-call signature" }],
    });
    const operations = await new SupabaseDomainStore(client).exceptional.listOperations();
    expect(operations).toMatchObject([
      { id: "travaux:31", actualUsers: [{ displayName: "Agent", visa: { signatureValue: "Work signature" } }], interventions: [] },
      { id: "astreinte:31", actualUsers: [{ displayName: "Other agent", visa: { signatureValue: "On-call signature" } }], interventions: [{ userName: "Other agent" }] },
    ]);
  });

  it("cancels RH send with NULL while preserving omitted dates and visas", async () => {
    jest.spyOn(RegularRepository.prototype, "fetchRegularPeriods").mockResolvedValue([period]);
    const save = jest.spyOn(RegularRepository.prototype, "saveRegularPeriod").mockResolvedValue("11");
    await new SupabaseDomainStore(relationalClient().client).regular.updatePeriod("11", { sentToRhAt: null });
    expect(save).toHaveBeenCalledWith("11", { ...period, sentToRhAt: null }, period);
  });

  it("invalidates a regular visa without rewriting the read-only planning timestamps", async () => {
    const { client, writes } = relationalClient({ app_users: [userRow] });
    const users = new UsersRepository(client);
    const repository = new RegularRepository(client, users, new VisasRepository(client, users));
    await repository.saveRegularPeriod(period.id, { ...period, directorVisa: createEmptyVisa() }, period);
    expect(writes.some(write => write.table === 'regular_on_call_periods')).toBe(false);
    expect(writes.some(write => write.table === 'visas')).toBe(true);
  });

  it("merges an exceptional edit without losing participants or signature snapshots", async () => {
    jest.spyOn(ExceptionalRepository.prototype, "fetchExceptionalOperation").mockResolvedValue(operation);
    const save = jest.spyOn(ExceptionalRepository.prototype, "saveExceptionalOperation").mockResolvedValue("travaux:31");
    await new SupabaseDomainStore(relationalClient().client).exceptional.saveOperation("travaux:31", { title: "Changed" });
    expect(save).toHaveBeenCalledWith("travaux:31", { ...operation, title: "Changed" });
  });

  it("preserves the family and participants when cancelling an exceptional RH send", async () => {
    jest.spyOn(ExceptionalRepository.prototype, "fetchExceptionalOperation").mockResolvedValue(operation);
    const save = jest.spyOn(ExceptionalRepository.prototype, "saveExceptionalOperation").mockResolvedValue("travaux:31");
    await new SupabaseDomainStore(relationalClient().client).exceptional.saveOperation("travaux:31", { sentToRhAt: null });
    expect(save).toHaveBeenCalledWith("travaux:31", { ...operation, sentToRhAt: null });
  });

  it("rejects implicit transfers between exceptional families", async () => {
    jest.spyOn(ExceptionalRepository.prototype, "fetchExceptionalOperation").mockResolvedValue(operation);
    const save = jest.spyOn(ExceptionalRepository.prototype, "saveExceptionalOperation");
    await expect(new SupabaseDomainStore(relationalClient().client).exceptional.saveOperation("travaux:31", { type: "astreinte" })).rejects.toThrow("type");
    expect(save).not.toHaveBeenCalled();
  });

  it("observes both exceptional parent tables for local and remote refreshes", async () => {
    const { client, channel, removeChannel } = relationalClient();
    jest.spyOn(ExceptionalRepository.prototype, "fetchExceptionalOperations").mockResolvedValue([operation]);
    const store = new SupabaseDomainStore(client);
    let stop = () => undefined as void;
    await new Promise<void>(resolve => { stop = store.exceptional.watchOperations(() => resolve()); });
    expect(channel.on.mock.calls.map(call => call[1].table)).toEqual([
      "exceptional_on_calls", "exceptional_works", "exceptional_on_call_participants", "exceptional_work_participants",
      "exceptional_on_call_interventions", "exceptional_on_call_visas", "exceptional_work_visas", "app_users",
    ]);
    stop();
    expect(removeChannel).toHaveBeenCalledTimes(8);
  });

  it("rejects missing edited records instead of creating incomplete aggregates", async () => {
    const store = new SupabaseDomainStore(relationalClient().client);
    await expect(store.regular.updatePeriod("99", { sentToRhAt: null })).rejects.toThrow("Astreinte introuvable");
    await expect(store.exceptional.saveOperation("astreinte:99", { title: "Missing" })).rejects.toThrow("Operation introuvable");
  });


  it("refreshes joined profile names after local writes and releases channels", async () => {
    const { client, channel, removeChannel } = relationalClient();
    const fetch = jest.spyOn(RegularRepository.prototype, "fetchRegularPeriods").mockResolvedValue([period]);
    jest.spyOn(UsersRepository.prototype, "saveUser").mockResolvedValue("7");
    const store = new SupabaseDomainStore(client);
    const next = jest.fn();
    let stop = () => undefined as void;
    await new Promise<void>(resolve => { stop = store.regular.watchPeriods(value => { next(value); resolve(); }); });
    fetch.mockResolvedValue([{ ...period, userName: "New" }]);
    await store.users.save("7", { displayName: "New" });
    expect(next).toHaveBeenLastCalledWith([{ ...period, userName: "New" }]);
    expect(channel.on.mock.calls.map(call => call[1].table)).toEqual(["regular_on_call_periods", "visas", "app_users"]);
    stop();
    expect(removeChannel).toHaveBeenCalledTimes(3);
    await store.users.save("7", { displayName: "Other" });
    expect(next).toHaveBeenCalledTimes(2);
  });

  it("does not notify listeners after a failed write", async () => {
    const { client } = relationalClient();
    const observer = new DomainObserverService(client);
    const next = jest.fn();
    let stop = () => undefined as void;
    await new Promise<void>(resolve => { stop = observer.watch(["app_users"], () => Promise.resolve([]), value => { next(value); resolve(); }); });
    await expect(observer.write(["app_users"], () => Promise.reject(new Error("Rejected")))).rejects.toThrow("Rejected");
    expect(next).toHaveBeenCalledTimes(1);
    stop();
  });

  it("does not deliver an in-flight read after unsubscription", async () => {
    const observer = new DomainObserverService(relationalClient().client);
    let resolveLoad: (value: string[]) => void = () => undefined;
    const pending = new Promise<string[]>(resolve => { resolveLoad = resolve; });
    const next = jest.fn();
    const stop = observer.watch(["app_users"], () => pending, next);
    stop();
    resolveLoad(["late"]);
    await pending;
    await Promise.resolve();
    expect(next).not.toHaveBeenCalled();
  });
});

it("maps the RH SQL role to its distinct application profile", async () => {
  const users = new UsersRepository(relationalClient({ app_users: [{ ...userRow, role: 'rh' }] }).client);
  expect(await users.fetchUser('7')).toMatchObject({ id: '7', role: 4 });
});

describe("Optional operation and employee metadata", () => {
  it("reads and patches employee metadata without clearing omitted departure dates", async () => {
    const stamp = "2026-10-24T08:00:00Z";
    const { client, writes } = relationalClient({ app_users: [{ ...userRow, trigram: "ABC", deleted_at: stamp }] });
    const users = new UsersRepository(client);
    expect(await users.fetchUser("7")).toMatchObject({ trigram: "ABC", deletedAt: stamp });
    await users.saveUser("7", { trigram: "DEF" });
    expect(writes[0].payload).toEqual({ trigram: "DEF" });
    await users.saveUser("7", { deletedAt: null });
    expect(writes[1].payload).toEqual({ deleted_at: null });
  });

  it("persists regular tickets and treatment dates while preserving omitted metadata", async () => {
    const stamp = "2026-10-24T08:00:00Z";
    const { client, writes } = relationalClient({ app_users: [userRow],
      regular_on_call_periods: [{ id: 11, treated_at: stamp }],
      regular_interventions: [{ id: 12, regular_period_id: 11, user_id: 7, ticket: "INC-123" }],
    });
    const users = new UsersRepository(client);
    const repository = new RegularRepository(client, users, new VisasRepository(client, users));
    expect((await repository.fetchRegularPeriods())[0].treatedAt).toBe(stamp);
    const intervention = (await repository.fetchRegularInterventions())[0];
    expect(intervention.ticket).toBe("INC-123");
    await repository.saveRegularIntervention("12", "11", { ...intervention, ticket: "INC-456" });
    expect(writes[writes.length - 1]?.payload["ticket"]).toBe("INC-456");
    await repository.saveRegularIntervention("12", "11", { ...intervention, ticket: undefined });
    expect(writes[writes.length - 1]?.payload).not.toHaveProperty("ticket");
    await repository.saveRegularPeriod("11", { ...period, agentVisa: undefined, treatedAt: stamp }, period);
    expect(writes[writes.length - 1]?.payload["treated_at"]).toBe(stamp);
    await repository.saveRegularPeriod("11", { ...period, agentVisa: undefined, treatedAt: null }, period);
    expect(writes[writes.length - 1]?.payload["treated_at"]).toBeNull();
  });
});
