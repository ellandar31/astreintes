import { GenerationDocumentClient } from "./generation-document-client.lib";

function expect(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(message);
  }
}

const originalFetch = globalThis.fetch;
let capturedUrl = "";
let capturedBody: Record<string, unknown> | null = null;

globalThis.fetch = (async (url: RequestInfo | URL, init?: RequestInit) => {
  capturedUrl = String(url);
  capturedBody = JSON.parse(String(init?.body ?? "{}")) as Record<string, unknown>;
  return new Response(new Blob(["docx"]), { status: 200 });
}) as typeof fetch;

async function main(): Promise<void> {
  const client = new GenerationDocumentClient();
  const blob = await client.generateDocx({
    apiUrl: "http://localhost:3000/v1/documents/generate",
    data: { exceptionalOperations: { global: { title: "Test" } } },
    dataModel: { dataSchema: { fields: [] } },
    fileName: "test.docx",
    locale: "fr-FR",
    template: { blocks: [] },
  });

  expect(capturedUrl === "http://localhost:3000/v1/documents/generate", "Le client doit appeler l'URL configurée.");
  expect(capturedBody?.["fileName"] === "test.docx", "Le nom de fichier doit être transmis à generationDoc.");
  expect(Boolean(capturedBody?.["template"]), "Le template documentaire doit être transmis.");
  expect(Boolean(capturedBody?.["dataModel"]), "Le modèle de données doit être transmis.");
  expect(blob.size === 4, "La réponse DOCX doit être retournée sous forme de Blob.");

  globalThis.fetch = originalFetch;
  console.log("generation-document-client.lib: OK");
}

main().catch((error: unknown) => {
  globalThis.fetch = originalFetch;
  throw error;
});
