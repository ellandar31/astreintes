import { SupabaseClient } from "@supabase/supabase-js";
import { DomainObserverService } from "./domain-observer";

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(done => { resolve = done; });
  return { promise, resolve };
}

function setup() {
  const callbacks: (() => void)[] = [];
  const channel = { on: jest.fn((_event: string, _filter: unknown, callback: () => void) => { callbacks.push(callback); return channel; }), subscribe: jest.fn(() => channel) };
  const client = { channel: jest.fn(() => channel), removeChannel: jest.fn() };
  return { observer: new DomainObserverService(client as unknown as SupabaseClient), callbacks };
}


describe("Aggregate refresh ordering", () => {

  it("ignores a slow older response arriving after a newer snapshot", async () => {
    const { observer, callbacks } = setup();
    const old = deferred<string>();
    const latest = deferred<string>();
    const load = jest.fn().mockReturnValueOnce(old.promise).mockReturnValueOnce(latest.promise);
    const next = jest.fn();
    observer.watch(["regular_on_call_periods"], load, next);
    callbacks[0]();
    latest.resolve("signed");
    await latest.promise;
    old.resolve("unsigned");
    await old.promise;
    expect(next.mock.calls).toEqual([["signed"]]);
  });

  it("does not reload partial data during a write and refreshes after completion", async () => {
    const { observer, callbacks } = setup();
    const load = jest.fn().mockResolvedValue("complete");
    const next = jest.fn();
    const stop = observer.watch(["regular_on_call_periods"], load, next);
    await Promise.resolve();
    const task = deferred<string>();
    const write = observer.write(["regular_on_call_periods"], () => task.promise);
    callbacks[0]();
    callbacks[0]();
    expect(load).toHaveBeenCalledTimes(1);
    task.resolve("saved");
    await write;
    expect(load).toHaveBeenCalledTimes(2);
    expect(next).toHaveBeenCalledTimes(2);
    stop();
    callbacks[0]();
    await Promise.resolve();
    expect(next).toHaveBeenCalledTimes(2);
  });
});
