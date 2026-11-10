import { SupabaseClient } from "@supabase/supabase-js";
import { RhPurgeRepository } from "./rh-purge.repository";

describe("RH purge persistence", () => {
  it("maps preview identities and sends the exact treatment snapshot for deletion", async () => {
    const stamp = "2020-01-01T12:00:00Z";
    const range = jest.fn().mockResolvedValue({ data: [{ operation_id: 7, operation_type: "regular", title: "Old", treated_at: stamp }], error: null });
    const rpc = jest.fn().mockReturnValue({ range });
    const repository = new RhPurgeRepository({ rpc } as unknown as SupabaseClient);
    const rows = await repository.preview(2);
    expect(range).toHaveBeenCalledWith(0, 499);
    expect(rows).toEqual([{ id: "7", type: "regular", title: "Old", treatedAt: stamp }]);
    rpc.mockResolvedValue({ data: 1, error: null });
    expect(await repository.purge(2, rows)).toBe(1);
    expect(rpc).toHaveBeenLastCalledWith("purge_rh_operations", { retention_years: 2, operations: [{ id: "7", type: "regular", treatedAt: stamp }] });
    rpc.mockResolvedValue({ error: new Error("Stale preview") });
    await expect(repository.purge(2, rows)).rejects.toThrow("Stale preview");
  });
  it("keeps the selected user and the previewed outcome in the user purge request", async () => {
    const treatedAt = "2026-10-23T12:00:00Z";
    const record = { operation_id: 7, operation_type: "exceptionalWork", title: "Shared", treated_at: treatedAt,
      delete_operation: false, starts_at: "2026-10-21T12:00:00Z", ends_at: "2026-10-21T13:00:00Z" };
    const range = jest.fn().mockResolvedValue({ data: [record, record, { ...record, operation_id: 8 }], error: null });
    const rpc = jest.fn().mockReturnValue({ range });
    const repository = new RhPurgeRepository({ rpc } as unknown as SupabaseClient);
    const operations = await repository.previewUser("2");
    expect(rpc).toHaveBeenCalledWith("list_rh_user_purge_candidates", { target_user_id: 2 });
    expect(operations.map(row => row.id)).toEqual(["7", "8"]);
    expect(operations[0]).toMatchObject({ deleteOperation: false, startsAt: record.starts_at, endsAt: record.ends_at });
    rpc.mockResolvedValue({ data: 1, error: null });
    expect(await repository.purgeUser("2", [operations[0]])).toBe(1);
    expect(rpc).toHaveBeenLastCalledWith("purge_rh_user_participations", {
      target_user_id: 2, operations: [{ id: "7", type: "exceptionalWork", treatedAt, deleteOperation: false }],
    });
  });

  it("loads subsequent preview pages beyond the API row limit", async () => {
    const rows = Array.from({ length: 500 }, (_, index) => ({ operation_id: index, operation_type: "regular", title: "Old", treated_at: "2020-01-01" }));
    const range = jest.fn().mockResolvedValueOnce({ data: rows, error: null })
      .mockResolvedValueOnce({ data: [{ ...rows[0], operation_id: 500 }], error: null });
    const rpc = jest.fn().mockReturnValue({ range });
    const preview = await new RhPurgeRepository({ rpc } as unknown as SupabaseClient).preview(2);
    expect(preview).toHaveLength(501);
    expect(range).toHaveBeenLastCalledWith(500, 999);
  });

});
