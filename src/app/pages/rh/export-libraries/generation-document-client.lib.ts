export interface GenerationDocumentCommand {
  apiUrl: string;
  data: Record<string, unknown>;
  dataModel: unknown;
  fileName: string;
  locale: string;
  template: unknown;
}

/**
 * Client minimal du moteur documentaire générique.
 *
 * L'application d'astreintes reste propriétaire des règles RH et prépare le
 * JSON métier. Le projet generationDoc reste, lui, responsable du rendu DOCX :
 * cette classe matérialise cette frontière par un contrat HTTP explicite.
 */
export class GenerationDocumentClient {
  async generateDocx(command: GenerationDocumentCommand): Promise<Blob> {
    const response = await fetch(command.apiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        template: command.template,
        dataModel: command.dataModel,
        data: command.data,
        fileName: command.fileName,
        locale: command.locale,
      }),
    });

    if (!response.ok) {
      throw new Error(await this.responseMessage(response));
    }

    return await response.blob();
  }

  private async responseMessage(response: Response): Promise<string> {
    const fallback = `HTTP ${response.status}`;

    try {
      const payload = await response.json() as { details?: unknown; error?: string };
      const details = typeof payload.details === "string" ? payload.details : JSON.stringify(payload.details ?? "");
      return [payload.error, details].filter(Boolean).join(" - ") || fallback;
    } catch {
      return fallback;
    }
  }
}
