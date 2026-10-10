import { GenerationDocumentClient, GenerationDocumentCommand } from "./generation-document-client.lib";

describe("GenerationDocumentClient", () => {
  const originalFetch = globalThis.fetch;
  const command: GenerationDocumentCommand = {
    apiUrl: "http://localhost:3000/v1/documents/generate",
    data: { exceptionalOperations: { global: { title: "Test" } } },
    dataModel: { dataSchema: { fields: [] } }, fileName: "test.docx",
    locale: "fr-FR", template: { blocks: [] },
  };

  afterEach(() => { globalThis.fetch = originalFetch; });

  it("posts the configured contract and returns the DOCX blob", async () => {
    const blob = new Blob(["docx"]);
    const fetchMock = jest.fn<typeof fetch>().mockResolvedValue({ ok: true, blob: () => Promise.resolve(blob) } as Response);
    globalThis.fetch = fetchMock;
    expect(await new GenerationDocumentClient().generateDocx(command)).toBe(blob);
    expect(fetchMock).toHaveBeenCalledWith(command.apiUrl, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ template: command.template, dataModel: command.dataModel,
        data: command.data, fileName: command.fileName, locale: command.locale }),
    });
  });

  it("exposes structured API errors without returning a document", async () => {
    globalThis.fetch = jest.fn<typeof fetch>().mockResolvedValue({ ok: false, status: 422,
      json: () => Promise.resolve({ error: "Validation", details: { field: "title" } }),
    } as Response);
    await expect(new GenerationDocumentClient().generateDocx(command)).rejects.toThrow('Validation - {"field":"title"}');
  });

  it("falls back to HTTP status for non-JSON failures", async () => {
    globalThis.fetch = jest.fn<typeof fetch>().mockResolvedValue({ ok: false, status: 503,
      json: () => Promise.reject(new SyntaxError("Not JSON")),
    } as unknown as Response);
    await expect(new GenerationDocumentClient().generateDocx(command)).rejects.toThrow("HTTP 503");
  });

  it("propagates transport failures", async () => {
    globalThis.fetch = jest.fn<typeof fetch>().mockRejectedValue(new Error("Network unavailable"));
    await expect(new GenerationDocumentClient().generateDocx(command)).rejects.toThrow("Network unavailable");
  });
});
