import { createEmptyVisa, SignatureVisa } from "../../../shared/visa.models";
import { ExportOperation, ExportTemplateId, RhExportContext, WordExportTemplate } from "./rh-export.models";
import { escapeAttribute, escapeHtml, formatDate, formatRange, formatTime } from "./rh-export-utils";

export class RhWordPdfExportLibrary {
  buildWordHtml(template: WordExportTemplate, operations: ExportOperation[], templateId: ExportTemplateId, context: RhExportContext): string {
    return `
      <!doctype html>
      <html>
        <head>
          <meta charset="utf-8" />
          <title>${escapeHtml(template.label)}</title>
          <style>
            @page { margin: 1.2cm 1cm; }
            body { font-family: Arial, sans-serif; color: #111827; font-size: 10pt; }
            h1 { color: #28398a; font-size: 22pt; text-align: right; margin: 0; }
            h2 { color: #28398a; font-size: 15pt; margin: 18px 0 8px; }
            h3 { color: #28398a; font-size: 12pt; margin: 16px 0 8px; }
            table { border-collapse: collapse; width: 100%; margin: 8px 0 14px; }
            th, td { border: 1px solid #111827; padding: 5px 6px; vertical-align: top; }
            th { color: #28398a; background: #ceecf0; text-align: center; }
            .meta th { width: 24%; text-align: left; background: #ffffff; }
            .operation { page-break-after: always; }
            .operation:last-child { page-break-after: auto; }
            .muted { color: #526171; }
            .visa-table { border-collapse: collapse; width: 100%; margin: 2px 0 16px; }
            .visa-table td { border: 0; padding: 0; width: 50%; vertical-align: top; }
            .visa-table .right { text-align: right; }
            .visa-label { color: #28398a; font-weight: bold; }
            .visa-image { display: block; height: 26px; width: 95px; max-height: 26px; max-width: 95px; object-fit: contain; }
            .global-visa-image { height: 34px; width: 130px; max-height: 34px; max-width: 130px; }
            .visa-table .right .visa-image { margin-left: auto; }
            .visa-date { font-size: 8.5pt; color: #526171; margin-top: 2px; }
          </style>
        </head>
        <body>${operations.map((operation) => this.operationHtml(operation, templateId, context)).join("")}</body>
      </html>
    `;
  }

  buildPdfHtml(template: WordExportTemplate, operations: ExportOperation[], templateId: ExportTemplateId, context: RhExportContext): string {
    return this.buildWordHtml(template, operations, templateId, context);
  }

  private operationHtml(operation: ExportOperation, templateId: ExportTemplateId, context: RhExportContext): string {
    return `
      <section class="operation">
        <h1>${escapeHtml(operation.exportTitle)}</h1>
        <h2>Autorisation</h2>
        <table class="meta">
          <tr><th>Objet des Astreintes</th><td>${escapeHtml(operation.title)}</td></tr>
          <tr><th>Initiateur de l'opération</th><td>${escapeHtml(operation.initiatorName)}</td></tr>
          <tr><th>Responsable de l'opération</th><td>${escapeHtml(operation.operationManagerName)}</td></tr>
          <tr><th>Date & horaires prévus</th><td>${formatRange(operation.forecastStartDate, operation.forecastEndDate)}</td></tr>
        </table>
        <h3>Dates prévisionnelles</h3>
        ${this.peopleTable(operation.plannedUsers)}
        ${this.globalVisasHtml(operation)}
        <h3>Dates réelles</h3>
        ${this.peopleTable(operation.actualUsers)}
        ${this.globalVisasHtml(operation)}
        <p class="muted">Pensez à demander au Directeur de Garde l'autorisation d'accès aux bâtiments en dehors des heures ouvrables.</p>
        <h3>Interventions au cours de l'astreinte</h3>
        ${this.interventionsTable(operation.interventions)}
        ${this.globalVisasHtml(operation)}
      </section>
    `;
  }

  private peopleTable(rows: Array<{ name: string; startDate: string; endDate: string; visa: SignatureVisa }>): string {
    const normalizedRows = rows.length ? rows : [{ name: "", startDate: "", endDate: "", visa: createEmptyVisa() }];
    return `
      <table>
        <thead><tr><th>Nom & Prénom de l'Agent</th><th>Date Début</th><th>Heure Début</th><th>Date Fin</th><th>Heure Fin</th><th>Visa de l'Agent</th></tr></thead>
        <tbody>
          ${normalizedRows
            .map((row) => `<tr><td>${escapeHtml(row.name)}</td><td>${formatDate(row.startDate)}</td><td>${formatTime(row.startDate)}</td><td>${formatDate(row.endDate)}</td><td>${formatTime(row.endDate)}</td><td>${this.visaHtml(row.visa, "line")}</td></tr>`)
            .join("")}
        </tbody>
      </table>
    `;
  }

  private interventionsTable(rows: ExportOperation["interventions"]): string {
    const normalizedRows = rows.length ? rows : [{ userName: "", startDate: "", endDate: "", wasOnSite: false, comment: "", visa: createEmptyVisa() }];
    return `
      <table>
        <thead><tr><th>Nom & Prénom de l'Agent</th><th>Date Début</th><th>Heure Début</th><th>Date Fin</th><th>Heure Fin</th><th>* Int Site</th><th>Visa de l'Agent</th></tr></thead>
        <tbody>
          ${normalizedRows
            .map((row) => `<tr><td>${escapeHtml(row.userName)}${row.comment ? `<br><span class="muted">${escapeHtml(row.comment)}</span>` : ""}</td><td>${formatDate(row.startDate)}</td><td>${formatTime(row.startDate)}</td><td>${formatDate(row.endDate)}</td><td>${formatTime(row.endDate)}</td><td>${row.wasOnSite ? "X" : ""}</td><td>${this.visaHtml(row.visa, "line")}</td></tr>`)
            .join("")}
        </tbody>
      </table>
      <p class="muted">* Cocher la case si intervention avec déplacement.</p>
    `;
  }

  private globalVisasHtml(operation: ExportOperation): string {
    return `
      <table class="visa-table">
        <tr>
          <td>
            <div class="visa-label">Visa initiateur</div>
            <div>${this.visaHtml(operation.initiatorVisa, "global") || "&nbsp;"}</div>
          </td>
          <td class="right">
            <div class="visa-label">Visa directeur</div>
            <div>${this.visaHtml(operation.directorVisa, "global") || "&nbsp;"}</div>
          </td>
        </tr>
      </table>
    `;
  }

  private visaHtml(visa: SignatureVisa | undefined, variant: "line" | "global"): string {
    if (!visa?.signed) {
      return "";
    }

    const date = visa.signedAt ? `<div class="visa-date">${formatDate(visa.signedAt)} ${formatTime(visa.signedAt)}</div>` : "";

    if ((visa.signatureMode === "image" || visa.signatureMode === "draw") && visa.signatureValue) {
      const size = variant === "global" ? { width: 130, height: 34, className: "visa-image global-visa-image" } : { width: 95, height: 26, className: "visa-image" };
      return `<img class="${size.className}" src="${escapeAttribute(visa.signatureValue)}" alt="Signature de ${escapeAttribute(visa.signedByName || "l'agent")}" width="${size.width}" height="${size.height}" />${date}`;
    }

    const name = visa.signedByName || visa.signatureValue || "Signé";
    return `${escapeHtml(name)}${date}`;
  }

}
