import { ExportOperation, ExportTemplateId, RhExportContext } from "./rh-export.models";
import { RhExportCalculationLibrary } from "./rh-export-calculations";
import { escapeHtml, formatRange } from "./rh-export-utils";

export class RhExcelExportLibrary {
  buildExcelHtml(templateId: ExportTemplateId, operation: ExportOperation, context: RhExportContext): string {
    const isWork = templateId === "exceptionalWork";
    const calculator = new RhExportCalculationLibrary(context);
    const onCallRows = calculator.onCallCompensationRows(operation);
    const interventionRows = calculator.interventionCompensationRows(operation, isWork);

    return `
      <!doctype html>
      <html>
        <head>
          <meta charset="utf-8" />
          <style>
            table { border-collapse: collapse; }
            th, td { border: 1px solid #666; padding: 6px; }
            th { background: #d9eaf7; font-weight: bold; }
            .title { font-size: 18px; font-weight: bold; color: #28398a; }
          </style>
        </head>
        <body>
          <table>
            <tr><td class="title" colspan="8">${escapeHtml(operation.title)}</td></tr>
            <tr><th>Type</th><td colspan="7">${escapeHtml(operation.exportTitle)}</td></tr>
            <tr><th>Initiateur</th><td colspan="7">${escapeHtml(operation.initiatorName)}</td></tr>
            <tr><th>Responsable</th><td colspan="7">${escapeHtml(operation.operationManagerName)}</td></tr>
            <tr><th>Période prévisionnelle</th><td colspan="7">${formatRange(operation.forecastStartDate, operation.forecastEndDate)}</td></tr>
            <tr><th>Période réelle</th><td colspan="7">${formatRange(operation.actualStartDate, operation.actualEndDate)}</td></tr>
          </table>
          <br />
          <table>
            <tr><td class="title" colspan="7">Astreinte</td></tr>
            <tr><th>Utilisateur</th><th>Début-Fin</th><th>Type indemnisation</th><th>Détail calcul</th><th>Heures</th><th>Coefficient</th></tr>
            ${onCallRows
              .map(
                (row) => `<tr><td>${escapeHtml(row.name)}</td><td>${formatRange(row.startDate, row.endDate)}</td><td>${escapeHtml(row.label)}</td><td>${calculator.segmentDetailsHtml(row.segments)}</td><td>${row.hours}</td><td>${row.coefficient}</td></tr>`,
              )
              .join("")}
          </table>
          <br />
          <table>
            <tr><td class="title" colspan="9">Interventions / travaux</td></tr>
            <tr><th>Utilisateur</th><th>Début-Fin</th><th>Plage</th><th>Détail calcul</th><th>Heures</th><th>Coefficient</th><th>Repos compensatoire</th><th>Commentaire</th></tr>
            ${interventionRows
              .map(
                (row) => `<tr><td>${escapeHtml(row.userName)}</td><td>${formatRange(row.startDate, row.endDate)}</td><td>${escapeHtml(row.label)}</td><td>${calculator.segmentDetailsHtml(row.segments)}</td><td>${row.hours}</td><td>${row.coefficient}</td><td>${row.restCoefficient}</td><td>${escapeHtml(row.comment)}</td></tr>`,
              )
              .join("")}
          </table>
        </body>
      </html>
    `;
  }
}
