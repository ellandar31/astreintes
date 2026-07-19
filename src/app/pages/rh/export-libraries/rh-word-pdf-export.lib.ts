import { APP_LABELS } from "../../../i18n/labels";
import { createEmptyVisa, SignatureVisa } from "../../../shared/visa.models";
import { ExportOperation, ExportTemplateId, RhExportContext, WordExportTemplate } from "./rh-export.models";
import { escapeAttribute, escapeHtml, formatDate, formatRange, formatTime } from "./rh-export-utils";

type PdfTableCell = string | SignatureVisa | undefined;
type PdfDocument = InstanceType<typeof import("jspdf").jsPDF>;

const DOCUMENT_LABELS = APP_LABELS.rhDocuments;

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

  async buildPdfBlob(template: WordExportTemplate, operations: ExportOperation[]): Promise<Blob> {
    const { jsPDF } = await import("jspdf");
    const doc = new jsPDF({ unit: "pt", format: "a4" });

    operations.forEach((operation, index) => {
      if (index > 0) {
        doc.addPage();
      }

      this.operationPdf(doc, template, operation);
    });

    return doc.output("blob");
  }

  private operationHtml(operation: ExportOperation, templateId: ExportTemplateId, context: RhExportContext): string {
    return `
      <section class="operation">
        <h1>${escapeHtml(operation.exportTitle)}</h1>
        <h2>${DOCUMENT_LABELS.authorization}</h2>
        <table class="meta">
          <tr><th>${DOCUMENT_LABELS.fields.object}</th><td>${escapeHtml(operation.title)}</td></tr>
          <tr><th>${DOCUMENT_LABELS.fields.operationInitiator}</th><td>${escapeHtml(operation.initiatorName)}</td></tr>
          <tr><th>${DOCUMENT_LABELS.fields.operationManager}</th><td>${escapeHtml(operation.operationManagerName)}</td></tr>
          <tr><th>${DOCUMENT_LABELS.fields.plannedSchedule}</th><td>${formatRange(operation.forecastStartDate, operation.forecastEndDate)}</td></tr>
        </table>
        <h3>${DOCUMENT_LABELS.fields.forecastDates}</h3>
        ${this.peopleTable(operation.plannedUsers)}
        ${this.globalVisasHtml(operation)}
        <h3>${DOCUMENT_LABELS.fields.actualDates}</h3>
        ${this.peopleTable(operation.actualUsers)}
        ${this.globalVisasHtml(operation)}
        <p class="muted">${DOCUMENT_LABELS.reminder}</p>
        <h3>${DOCUMENT_LABELS.fields.interventionsDuringOnCall}</h3>
        ${this.interventionsTable(operation.interventions)}
        ${this.globalVisasHtml(operation)}
      </section>
    `;
  }

  private peopleTable(rows: Array<{ name: string; startDate: string; endDate: string; visa: SignatureVisa }>): string {
    const normalizedRows = rows.length ? rows : [{ name: "", startDate: "", endDate: "", visa: createEmptyVisa() }];
    return `
      <table>
        <thead><tr><th>${DOCUMENT_LABELS.fields.agentName}</th><th>${DOCUMENT_LABELS.fields.startDate}</th><th>${DOCUMENT_LABELS.fields.startTime}</th><th>${DOCUMENT_LABELS.fields.endDate}</th><th>${DOCUMENT_LABELS.fields.endTime}</th><th>${DOCUMENT_LABELS.fields.agentVisa}</th></tr></thead>
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
        <thead><tr><th>${DOCUMENT_LABELS.fields.agentName}</th><th>${DOCUMENT_LABELS.fields.startDate}</th><th>${DOCUMENT_LABELS.fields.startTime}</th><th>${DOCUMENT_LABELS.fields.endDate}</th><th>${DOCUMENT_LABELS.fields.endTime}</th><th>${DOCUMENT_LABELS.fields.siteIntervention}</th><th>${DOCUMENT_LABELS.fields.agentVisa}</th></tr></thead>
        <tbody>
          ${normalizedRows.map((row) => this.interventionRowHtml(row)).join("")}
        </tbody>
      </table>
      <p class="muted">${DOCUMENT_LABELS.checkedSiteHint}</p>
    `;
  }

  private globalVisasHtml(operation: ExportOperation): string {
    return `
      <table class="visa-table">
        <tr>
          <td>
            <div class="visa-label">${DOCUMENT_LABELS.fields.initiatorVisa}</div>
            <div>${this.visaHtml(operation.initiatorVisa, "global") || "&nbsp;"}</div>
          </td>
          <td class="right">
            <div class="visa-label">${APP_LABELS.validation.sections.director}</div>
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

    if (this.isImageVisa(visa)) {
      const size = variant === "global" ? { width: 130, height: 34, className: "visa-image global-visa-image" } : { width: 95, height: 26, className: "visa-image" };
      return `<img class="${size.className}" src="${escapeAttribute(visa.signatureValue)}" alt="${APP_LABELS.profile.signatureAlt}" width="${size.width}" height="${size.height}" />${date}`;
    }

    const name = visa.signedByName || visa.signatureValue || DOCUMENT_LABELS.signed;
    return `${escapeHtml(name)}${date}`;
  }

  private interventionRowHtml(row: ExportOperation["interventions"][number]): string {
    const comment = row.comment ? `<br><span class="muted">${escapeHtml(row.comment)}</span>` : "";

    return `<tr><td>${escapeHtml(row.userName)}${comment}</td><td>${formatDate(row.startDate)}</td><td>${formatTime(row.startDate)}</td><td>${formatDate(row.endDate)}</td><td>${formatTime(row.endDate)}</td><td>${row.wasOnSite ? APP_LABELS.common.icons.close : ""}</td><td>${this.visaHtml(row.visa, "line")}</td></tr>`;
  }

  private operationPdf(doc: PdfDocument, template: WordExportTemplate, operation: ExportOperation): void {
    const margin = 36;
    const pageWidth = doc.internal.pageSize.getWidth();
    let y = margin;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(18);
    doc.setTextColor(40, 57, 138);
    doc.text(operation.exportTitle || template.label, pageWidth - margin, y, { align: "right" });
    y += 28;

    y = this.pdfSectionTitle(doc, DOCUMENT_LABELS.authorization, y);
    y = this.pdfTable(
      doc,
      [DOCUMENT_LABELS.field, DOCUMENT_LABELS.fields.value],
      [
        [DOCUMENT_LABELS.fields.object, operation.title],
        [DOCUMENT_LABELS.fields.operationInitiator, operation.initiatorName],
        [DOCUMENT_LABELS.fields.operationManager, operation.operationManagerName],
        [DOCUMENT_LABELS.fields.plannedSchedule, formatRange(operation.forecastStartDate, operation.forecastEndDate)],
      ],
      [150, pageWidth - margin * 2 - 150],
      y,
    );

    y = this.pdfSectionTitle(doc, DOCUMENT_LABELS.fields.forecastDates, y + 6);
    y = this.pdfPeopleTable(doc, operation.plannedUsers, y);
    y = this.pdfGlobalVisas(doc, operation, y + 4);

    y = this.pdfSectionTitle(doc, DOCUMENT_LABELS.fields.actualDates, y + 6);
    y = this.pdfPeopleTable(doc, operation.actualUsers, y);
    y = this.pdfGlobalVisas(doc, operation, y + 4);

    y = this.pdfParagraph(doc, DOCUMENT_LABELS.reminder, y + 4);

    y = this.pdfSectionTitle(doc, DOCUMENT_LABELS.fields.interventionsDuringOnCall, y + 6);
    y = this.pdfInterventionsTable(doc, operation.interventions, y);
    this.pdfGlobalVisas(doc, operation, y + 4);
  }

  private pdfPeopleTable(doc: PdfDocument, rows: Array<{ name: string; startDate: string; endDate: string; visa: SignatureVisa }>, y: number): number {
    const normalizedRows = rows.length ? rows : [{ name: "", startDate: "", endDate: "", visa: createEmptyVisa() }];

    return this.pdfTable(
      doc,
      [DOCUMENT_LABELS.fields.agentName, DOCUMENT_LABELS.fields.startDate, DOCUMENT_LABELS.fields.startTime, DOCUMENT_LABELS.fields.endDate, DOCUMENT_LABELS.fields.endTime, DOCUMENT_LABELS.fields.agentVisa],
      normalizedRows.map((row) => [row.name, formatDate(row.startDate), formatTime(row.startDate), formatDate(row.endDate), formatTime(row.endDate), row.visa]),
      [128, 68, 58, 68, 58, 143],
      y,
    );
  }

  private pdfInterventionsTable(doc: PdfDocument, rows: ExportOperation["interventions"], y: number): number {
    const normalizedRows = rows.length ? rows : [{ userName: "", startDate: "", endDate: "", wasOnSite: false, comment: "", visa: createEmptyVisa() }];

    return this.pdfTable(
      doc,
      [DOCUMENT_LABELS.fields.agentName, DOCUMENT_LABELS.fields.startDate, DOCUMENT_LABELS.fields.startTime, DOCUMENT_LABELS.fields.endDate, DOCUMENT_LABELS.fields.endTime, DOCUMENT_LABELS.fields.site, DOCUMENT_LABELS.fields.agentVisa],
      normalizedRows.map((row) => [
        row.comment ? `${row.userName}\n${row.comment}` : row.userName,
        formatDate(row.startDate),
        formatTime(row.startDate),
        formatDate(row.endDate),
        formatTime(row.endDate),
        row.wasOnSite ? APP_LABELS.common.icons.close : "",
        row.visa,
      ]),
      [117, 66, 55, 66, 55, 35, 129],
      y,
    );
  }

  private pdfGlobalVisas(doc: PdfDocument, operation: ExportOperation, y: number): number {
    y = this.ensurePdfSpace(doc, y, 64);
    const margin = 36;
    const pageWidth = doc.internal.pageSize.getWidth();
    const blockWidth = (pageWidth - margin * 2) / 2;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(40, 57, 138);
    doc.text(DOCUMENT_LABELS.fields.initiatorVisa, margin, y + 10);
    doc.text(APP_LABELS.validation.sections.director, pageWidth - margin, y + 10, { align: "right" });

    this.pdfVisa(doc, operation.initiatorVisa, margin, y + 18, blockWidth - 10, "global");
    this.pdfVisa(doc, operation.directorVisa, margin + blockWidth + 10, y + 18, blockWidth - 10, "global", "right");
    return y + 58;
  }

  private pdfTable(doc: PdfDocument, headers: string[], rows: PdfTableCell[][], widths: number[], y: number): number {
    const margin = 36;
    const rowPadding = 5;
    const headerHeight = 28;

    y = this.ensurePdfSpace(doc, y, headerHeight + 22);
    doc.setFontSize(8);
    doc.setLineWidth(0.6);

    let x = margin;
    headers.forEach((header, index) => {
      doc.setFillColor(206, 236, 240);
      doc.rect(x, y, widths[index], headerHeight, "FD");
      doc.setFont("helvetica", "bold");
      doc.setTextColor(40, 57, 138);
      doc.text(doc.splitTextToSize(header, widths[index] - rowPadding * 2), x + rowPadding, y + 11);
      x += widths[index];
    });
    y += headerHeight;

    rows.forEach((row) => {
      const height = Math.max(
        30,
        ...row.map((cell, index) => {
          if (this.isVisa(cell)) return 42;
          return doc.splitTextToSize(cell || "", widths[index] - rowPadding * 2).length * 10 + rowPadding * 2;
        }),
      );

      y = this.ensurePdfSpace(doc, y, height);
      x = margin;
      row.forEach((cell, index) => {
        doc.setFillColor(255, 255, 255);
        doc.rect(x, y, widths[index], height, "S");

        if (this.isVisa(cell)) {
          this.pdfVisa(doc, cell, x + rowPadding, y + rowPadding, widths[index] - rowPadding * 2, "line");
        } else {
          doc.setFont("helvetica", "normal");
          doc.setFontSize(8);
          doc.setTextColor(17, 24, 39);
          doc.text(doc.splitTextToSize(cell || "", widths[index] - rowPadding * 2), x + rowPadding, y + 12);
        }

        x += widths[index];
      });
      y += height;
    });

    return y + 8;
  }

  private pdfVisa(doc: PdfDocument, visa: SignatureVisa | undefined, x: number, y: number, width: number, variant: "line" | "global", align: "left" | "right" = "left"): void {
    if (!visa?.signed) {
      return;
    }

    const imageWidth = variant === "global" ? 110 : 82;
    const imageHeight = variant === "global" ? 28 : 22;
    const imageX = align === "right" ? x + width - imageWidth : x;

    if (this.isImageVisa(visa)) {
      try {
        doc.addImage(visa.signatureValue, "PNG", imageX, y, imageWidth, imageHeight);
      } catch {
        this.pdfText(doc, visa.signedByName || DOCUMENT_LABELS.signed, x, y + 10, width, align);
      }
    } else {
      this.pdfText(doc, visa.signedByName || visa.signatureValue || DOCUMENT_LABELS.signed, x, y + 10, width, align);
    }

    if (visa.signedAt) {
      this.pdfText(doc, `${formatDate(visa.signedAt)} ${formatTime(visa.signedAt)}`, x, y + imageHeight + 9, width, align, 7);
    }
  }

  private pdfSectionTitle(doc: PdfDocument, title: string, y: number): number {
    y = this.ensurePdfSpace(doc, y, 26);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.setTextColor(40, 57, 138);
    doc.text(title, 36, y);
    return y + 12;
  }

  private pdfParagraph(doc: PdfDocument, text: string, y: number): number {
    y = this.ensurePdfSpace(doc, y, 34);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(82, 97, 113);
    const lines = doc.splitTextToSize(text, doc.internal.pageSize.getWidth() - 72);
    doc.text(lines, 36, y + 10);
    return y + lines.length * 10 + 8;
  }

  private pdfText(doc: PdfDocument, text: string, x: number, y: number, width: number, align: "left" | "right" = "left", size = 8): void {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(size);
    doc.setTextColor(17, 24, 39);
    doc.text(doc.splitTextToSize(text, width), align === "right" ? x + width : x, y, { align });
  }

  private ensurePdfSpace(doc: PdfDocument, y: number, requiredHeight: number): number {
    const bottom = doc.internal.pageSize.getHeight() - 36;
    if (y + requiredHeight <= bottom) {
      return y;
    }

    doc.addPage();
    return 36;
  }

  private isVisa(cell: PdfTableCell): cell is SignatureVisa {
    return Boolean(cell && typeof cell === "object" && "signed" in cell);
  }

  private isImageVisa(visa: SignatureVisa): visa is SignatureVisa & { signatureValue: string } {
    return (
      (visa.signatureMode === "image" || visa.signatureMode === "draw") &&
      typeof visa.signatureValue === "string" &&
      /^data:image\/(?:png|jpeg|jpg|gif|webp);base64,/i.test(visa.signatureValue)
    );
  }
}
