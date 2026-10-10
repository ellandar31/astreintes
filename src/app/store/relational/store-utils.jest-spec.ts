import { generatedSubscriptionId } from "./store-utils";

describe("Subscription identifiers", () => {
  const originalCrypto = Object.getOwnPropertyDescriptor(globalThis, "crypto");

  afterEach(() => {
    if (originalCrypto) Object.defineProperty(globalThis, "crypto", originalCrypto);
    else Reflect.deleteProperty(globalThis, "crypto");
    jest.restoreAllMocks();
  });

  it("uses the browser UUID when available", () => {
    const randomUUID = jest.fn().mockReturnValue("browser-uuid");
    Object.defineProperty(globalThis, "crypto", { configurable: true, value: { randomUUID } });
    expect(generatedSubscriptionId()).toBe("browser-uuid");
    expect(randomUUID).toHaveBeenCalledTimes(1);
  });

  it.each([undefined, {}])("keeps channel names distinct without secure-context APIs (%j)", crypto => {
    Object.defineProperty(globalThis, "crypto", { configurable: true, value: crypto });
    jest.spyOn(Date, "now").mockReturnValue(0);
    const ids = Array.from({ length: 100 }, generatedSubscriptionId);
    expect(new Set(ids).size).toBe(100);
    expect(ids.every(id => id.startsWith("watch-0-"))).toBe(true);
  });
});
