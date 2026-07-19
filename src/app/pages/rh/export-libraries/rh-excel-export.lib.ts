import { APP_LABELS } from "../../../i18n/labels";
import { ExportOperation, ExportTemplateId, RhExportContext } from "./rh-export.models";
import { RhExportCalculationLibrary } from "./rh-export-calculations";
import { escapeHtml, formatRange } from "./rh-export-utils";

const DOCUMENT_LABELS = APP_LABELS.rhDocuments;

/**
 * Génère un fichier Excel HTML destiné au contrôle détaillé des indemnités.
 *
 * L'objectif de cet export n'est pas la présentation officielle mais la
 * traçabilité : chaque ligne expose la règle, le détail du découpage et le
 * coefficient appliqué pour faciliter la vérification du bulletin.
 */
export class RhExcelExportLibrary {
  /**
   * Produit un classeur HTML simple ouvert par Excel.
   *
   * Le même moteur de calcul que le Word/PDF est utilisé pour éviter qu'un agent
   * obtienne un total différent selon le format exporté.
   */
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
            <tr><th>${DOCUMENT_LABELS.fields.type}</th><td colspan="7">${escapeHtml(operation.exportTitle)}</td></tr>
            <tr><th>${DOCUMENT_LABELS.fields.initiator}</th><td colspan="7">${escapeHtml(operation.initiatorName)}</td></tr>
            <tr><th>${DOCUMENT_LABELS.fields.manager}</th><td colspan="7">${escapeHtml(operation.operationManagerName)}</td></tr>
            <tr><th>${DOCUMENT_LABELS.fields.forecastPeriod}</th><td colspan="7">${formatRange(operation.forecastStartDate, operation.forecastEndDate)}</td></tr>
            <tr><th>${DOCUMENT_LABELS.fields.actualPeriod}</th><td colspan="7">${formatRange(operation.actualStartDate, operation.actualEndDate)}</td></tr>
          </table>
          <br />
          <table>
            <tr><td class="title" colspan="7">${DOCUMENT_LABELS.sections.onCall}</td></tr>
            <tr><th>${DOCUMENT_LABELS.fields.user}</th><th>${DOCUMENT_LABELS.fields.range}</th><th>${DOCUMENT_LABELS.fields.indemnityType}</th><th>${DOCUMENT_LABELS.fields.calculationDetail}</th><th>${DOCUMENT_LABELS.fields.hours}</th><th>${DOCUMENT_LABELS.fields.coefficient}</th></tr>
            ${onCallRows
              .map(
                (row) => `<tr><td>${escapeHtml(row.name)}</td><td>${formatRange(row.startDate, row.endDate)}</td><td>${escapeHtml(row.label)}</td><td>${calculator.segmentDetailsHtml(row.segments)}</td><td>${row.hours}</td><td>${row.coefficient}</td></tr>`,
              )
              .join("")}
          </table>
          <br />
          <table>
            <tr><td class="title" colspan="9">${DOCUMENT_LABELS.sections.interventionsAndWork}</td></tr>
            <tr><th>${DOCUMENT_LABELS.fields.user}</th><th>${DOCUMENT_LABELS.fields.range}</th><th>${APP_LABELS.rh.detail.range}</th><th>${DOCUMENT_LABELS.fields.calculationDetail}</th><th>${DOCUMENT_LABELS.fields.hours}</th><th>${DOCUMENT_LABELS.fields.coefficient}</th><th>${DOCUMENT_LABELS.fields.rest}</th><th>${DOCUMENT_LABELS.fields.comment}</th></tr>
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
