import { CommonModule } from "@angular/common";
import { Component, OnDestroy } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { Unsubscribe, collection, deleteField, doc, onSnapshot, serverTimestamp, updateDoc } from "firebase/firestore";
import { db } from "../../firebase";
import { SignatureVisa, createEmptyVisa } from "../../shared/visa.models";
import { RhExceptionalOperation, RhRegularPeriod } from "./rh.models";

type ExportTemplateId = "regular" | "exceptionalOnCall" | "exceptionalWork";

interface WordExportTemplate {
  id: ExportTemplateId;
  label: string;
  fileName: string;
}

interface RegularInterventionExport {
  id: string;
  periodId: string;
  userName: string;
  userEmail: string;
  startDate: string;
  endDate: string;
  comment?: string;
  agentVisa?: SignatureVisa;
}

interface OnCallCompensationRule {
  id: string;
  label: string;
  coefficient: number;
}

interface PeriodCompensationRule {
  id: string;
  label: string;
  interventionCoefficient: number;
  workCoefficient: number;
  restCoefficient: number;
}

interface CalculationSegment {
  startDate: string;
  endDate: string;
  hours: number;
}

interface ExportOperation {
  sourceId: string;
  sourceCollection: "regularOnCallPeriods" | "exceptionalOperations";
  title: string;
  exportTitle: string;
  initiatorName: string;
  operationManagerName: string;
  forecastStartDate: string;
  forecastEndDate: string;
  actualStartDate: string;
  actualEndDate: string;
  plannedUsers: Array<{ name: string; startDate: string; endDate: string; visa: SignatureVisa }>;
  actualUsers: Array<{ name: string; startDate: string; endDate: string; visa: SignatureVisa }>;
  interventions: Array<{
    userName: string;
    startDate: string;
    endDate: string;
    wasOnSite: boolean;
    comment: string;
    visa: SignatureVisa;
  }>;
  initiatorVisa: SignatureVisa;
  directorVisa: SignatureVisa;
  sentToRhAt?: string;
}

@Component({
  selector: "app-rh-exports",
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: "./rh-exports.component.html",
  styleUrl: "./rh-exports.component.css",
})
export class RhExportsComponent implements OnDestroy {
  readonly templates: WordExportTemplate[] = [
    { id: "regular", label: "Astreintes régulières", fileName: "" },
    { id: "exceptionalOnCall", label: "Astreintes exceptionnelles", fileName: "" },
    { id: "exceptionalWork", label: "Travaux exceptionnels", fileName: "" },
  ];

  selectedMonth = this.toMonthKey(new Date());
  exportMessage = "";
  regularPeriods: RhRegularPeriod[] = [];
  regularInterventions: RegularInterventionExport[] = [];
  exceptionalOperations: RhExceptionalOperation[] = [];
  publicHolidays: Array<{ id: string; date: string; label: string }> = [];
  onCallCompensationRules: OnCallCompensationRule[] = [
    { id: "week", label: "Semaine", coefficient: 0 },
    { id: "weekendHoliday", label: "Samedi / Dimanche / Jour férié", coefficient: 0 },
  ];
  periodCompensationRules: PeriodCompensationRule[] = [
    { id: "week_18_21", label: "Semaine 18h-21h", interventionCoefficient: 0, workCoefficient: 0, restCoefficient: 0 },
    { id: "night_21_7", label: "Nuit (21h-7h)", interventionCoefficient: 0, workCoefficient: 0, restCoefficient: 0 },
    { id: "week_7_8", label: "Semaine 7h-8h", interventionCoefficient: 0, workCoefficient: 0, restCoefficient: 0 },
    { id: "saturday_7_21", label: "Samedi (7h-21h)", interventionCoefficient: 0, workCoefficient: 0, restCoefficient: 0 },
    { id: "sunday_holiday_7_21", label: "Dimanche/Jours fériés (7h-21h)", interventionCoefficient: 0, workCoefficient: 0, restCoefficient: 0 },
  ];

  private readonly unsubscribes: Unsubscribe[] = [
    onSnapshot(doc(db, "rhSettings", "exportTemplates"), (snapshot) => {
      const data = snapshot.data();
      const savedTemplates = Array.isArray(data?.["templates"]) ? (data["templates"] as Partial<WordExportTemplate>[]) : [];

      this.templates.forEach((template) => {
        const savedTemplate = savedTemplates.find((item) => item.id === template.id);
        template.fileName = savedTemplate?.fileName || "";
      });
    }),
    onSnapshot(doc(db, "rhSettings", "compensationRules"), (snapshot) => {
      const data = snapshot.data();

      if (!data) {
        return;
      }

      this.onCallCompensationRules = this.mergeRows(this.onCallCompensationRules, data["onCall"] || []);
      this.periodCompensationRules = this.mergeRows(this.periodCompensationRules, data["periods"] || []);
    }),
    onSnapshot(collection(db, "regularOnCallPeriods"), (snapshot) => {
      this.regularPeriods = snapshot.docs.map((document) => ({ id: document.id, ...document.data() }) as RhRegularPeriod);
    }),
    onSnapshot(collection(db, "regularInterventions"), (snapshot) => {
      this.regularInterventions = snapshot.docs.map(
        (document) => ({ id: document.id, ...document.data() }) as RegularInterventionExport,
      );
    }),
    onSnapshot(collection(db, "exceptionalOperations"), (snapshot) => {
      this.exceptionalOperations = snapshot.docs.map((document) => ({ id: document.id, ...document.data() }) as RhExceptionalOperation);
    }),
    onSnapshot(collection(db, "publicHolidays"), (snapshot) => {
      this.publicHolidays = snapshot.docs.map((document) => ({ id: document.id, ...document.data() }) as { id: string; date: string; label: string });
    }),
  ];

  ngOnDestroy(): void {
    this.unsubscribes.forEach((unsubscribe) => unsubscribe());
  }

  exportOperation(templateId: ExportTemplateId, operation: ExportOperation): void {
    this.exportMessage = "";
    const template = this.templateFor(templateId);

    if (!template.fileName) {
      this.exportMessage = "Aucun modèle Word n'est configuré pour cet export dans les paramètres RH.";
      return;
    }

    this.downloadFile(
      `${this.slug(operation.title)}_${this.selectedMonth}.doc`,
      "application/msword;charset=utf-8",
      this.buildWordHtml(template, [operation], templateId),
    );
    this.exportMessage = `Export Word généré pour ${operation.title}.`;
  }

  exportExcelOperation(templateId: ExportTemplateId, operation: ExportOperation): void {
    this.exportMessage = "";
    this.downloadFile(
      `${this.slug(operation.title)}_${this.selectedMonth}.xls`,
      "application/vnd.ms-excel;charset=utf-8",
      this.buildExcelHtml(templateId, operation),
    );
    this.exportMessage = `Export Excel généré pour ${operation.title}.`;
  }

  exportPdfOperation(templateId: ExportTemplateId, operation: ExportOperation): void {
    this.exportMessage = "";
    const template = this.templateFor(templateId);

    if (!template.fileName) {
      this.exportMessage = "Aucun modèle Word n'est configuré pour cet export dans les paramètres RH.";
      return;
    }

    const printWindow = window.open("", "_blank");

    if (!printWindow) {
      this.exportMessage = "Impossible d'ouvrir la fenêtre PDF. Vérifiez le blocage des popups.";
      return;
    }

    printWindow.document.open();
    printWindow.document.write(this.buildWordHtml(template, [operation], templateId));
    printWindow.document.close();
    printWindow.document.title = `${this.slug(operation.title)}_${this.selectedMonth}`;
    printWindow.setTimeout(() => {
      printWindow.focus();
      printWindow.print();
    }, 250);
  }

  async markSentToRh(operation: ExportOperation): Promise<void> {
    this.exportMessage = "";

    await updateDoc(doc(db, operation.sourceCollection, operation.sourceId), {
      sentToRhAt: serverTimestamp(),
    });

    this.exportMessage = `${operation.title} marqué comme envoyé aux RH.`;
  }

  async unmarkSentToRh(operation: ExportOperation): Promise<void> {
    this.exportMessage = "";

    await updateDoc(doc(db, operation.sourceCollection, operation.sourceId), {
      sentToRhAt: deleteField(),
    });

    this.exportMessage = `Envoi RH supprimé pour ${operation.title}.`;
  }

  exportRows(templateId: ExportTemplateId): ExportOperation[] {
    return this.operationsForTemplate(templateId);
  }

  templateFor(templateId: ExportTemplateId): WordExportTemplate {
    return this.templates.find((template) => template.id === templateId) || this.templates[0];
  }

  formatRange(startValue: string, endValue: string): string {
    return `${this.formatDate(startValue)} ${this.formatTime(startValue)} - ${this.formatDate(endValue)} ${this.formatTime(endValue)}`;
  }

  private operationsForTemplate(templateId: ExportTemplateId): ExportOperation[] {
    if (templateId === "regular") {
      return this.regularPeriods
        .filter((period) => this.overlapsSelectedMonth(period.startDate, period.endDate))
        .sort((first, second) => first.startDate.localeCompare(second.startDate))
        .map((period) => {
          const interventions = this.regularInterventions
            .filter((intervention) => intervention.periodId === period.id)
            .sort((first, second) => first.startDate.localeCompare(second.startDate));

          return {
            sourceId: period.id,
            sourceCollection: "regularOnCallPeriods",
            title: `Astreinte régulière - ${period.userName || period.userEmail}`,
            exportTitle: "Astreintes Régulières",
            initiatorName: "",
            operationManagerName: "",
            forecastStartDate: period.startDate,
            forecastEndDate: period.endDate,
            actualStartDate: period.startDate,
            actualEndDate: period.endDate,
            plannedUsers: [{ name: period.userName || period.userEmail, startDate: period.startDate, endDate: period.endDate, visa: period.agentVisa || createEmptyVisa() }],
            actualUsers: [{ name: period.userName || period.userEmail, startDate: period.startDate, endDate: period.endDate, visa: period.agentVisa || createEmptyVisa() }],
            interventions: interventions.map((intervention) => ({
              userName: intervention.userName || intervention.userEmail,
              startDate: intervention.startDate,
              endDate: intervention.endDate,
              wasOnSite: false,
              comment: intervention.comment || "",
              visa: intervention.agentVisa || createEmptyVisa(),
            })),
            initiatorVisa: createEmptyVisa(),
            directorVisa: period.directorVisa || createEmptyVisa(),
            sentToRhAt: period.sentToRhAt,
          };
        });
    }

    const operationType = templateId === "exceptionalOnCall" ? "astreinte" : "travaux";
    const exportTitle = templateId === "exceptionalOnCall" ? "Astreintes Exceptionnelles" : "Travaux Exceptionnels";

    return this.exceptionalOperations
      .filter((operation) => operation.type === operationType)
      .filter((operation) => this.overlapsSelectedMonth(operation.startDate, operation.forecastEndDate || operation.actualEndDate || operation.startDate))
      .sort((first, second) => (first.startDate || "").localeCompare(second.startDate || ""))
      .map((operation) => {
        const forecastStart = operation.startDate || "";
        const forecastEnd = operation.forecastEndDate || operation.startDate || "";
        const actualStart = operation.actualStartDate || forecastStart;
        const actualEnd = operation.actualEndDate || forecastEnd;

        return {
          sourceId: operation.id,
          sourceCollection: "exceptionalOperations",
          title: operation.title || exportTitle,
          exportTitle,
          initiatorName: operation.initiatorName || "",
          operationManagerName: operation.operationManagerName || "",
          forecastStartDate: forecastStart,
          forecastEndDate: forecastEnd,
          actualStartDate: actualStart,
          actualEndDate: actualEnd,
          plannedUsers: (operation.plannedUsers || []).map((user) => ({
            name: user.displayName || user.email,
            startDate: user.startDate || forecastStart,
            endDate: user.endDate || forecastEnd,
            visa: user.visa || createEmptyVisa(),
          })),
          actualUsers: (operation.actualUsers || []).map((user) => ({
            name: user.displayName || user.email,
            startDate: user.startDate || actualStart,
            endDate: user.endDate || actualEnd,
            visa: user.visa || createEmptyVisa(),
          })),
          interventions: (operation.interventions || []).map((intervention) => ({
            userName: intervention.userName || intervention.userEmail,
            startDate: intervention.startDate || intervention.date || "",
            endDate: intervention.endDate || "",
            wasOnSite: Boolean(intervention.wasOnSite),
            comment: intervention.comment || intervention.label || "",
            visa: intervention.agentVisa || createEmptyVisa(),
          })),
          initiatorVisa: operation.visas?.initiatorGlobal || operation.visas?.actualInitiator || operation.visas?.plannedInitiator || createEmptyVisa(),
          directorVisa: operation.visas?.directorGlobal || operation.visas?.actualDirector || operation.visas?.plannedDirector || createEmptyVisa(),
          sentToRhAt: operation.sentToRhAt,
        };
      });
  }

  private buildWordHtml(template: WordExportTemplate, operations: ExportOperation[], templateId: ExportTemplateId): string {
    return `
      <!doctype html>
      <html>
        <head>
          <meta charset="utf-8" />
          <title>${this.escape(template.label)}</title>
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
            .calculation-detail { font-size: 9pt; }
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
        <body>${operations.map((operation) => this.operationHtml(operation, templateId)).join("")}</body>
      </html>
    `;
  }

  private buildExcelHtml(templateId: ExportTemplateId, operation: ExportOperation): string {
    const isWork = templateId === "exceptionalWork";
    const onCallRows = this.onCallCompensationRows(operation);
    const interventionRows = this.interventionCompensationRows(operation, isWork);

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
            <tr><td class="title" colspan="8">${this.escape(operation.title)}</td></tr>
            <tr><th>Type</th><td colspan="7">${this.escape(operation.exportTitle)}</td></tr>
            <tr><th>Initiateur</th><td colspan="7">${this.escape(operation.initiatorName)}</td></tr>
            <tr><th>Responsable</th><td colspan="7">${this.escape(operation.operationManagerName)}</td></tr>
            <tr><th>Période prévisionnelle</th><td colspan="7">${this.formatRange(operation.forecastStartDate, operation.forecastEndDate)}</td></tr>
            <tr><th>Période réelle</th><td colspan="7">${this.formatRange(operation.actualStartDate, operation.actualEndDate)}</td></tr>
          </table>
          <br />
          <table>
            <tr><td class="title" colspan="7">Astreinte</td></tr>
            <tr><th>Utilisateur</th><th>Début</th><th>Fin</th><th>Type indemnisation</th><th>Détail calcul</th><th>Heures</th><th>Coefficient</th></tr>
            ${onCallRows
              .map(
                (row) => `<tr><td>${this.escape(row.name)}</td><td>${this.formatRange(row.startDate, row.startDate)}</td><td>${this.formatRange(row.endDate, row.endDate)}</td><td>${this.escape(row.label)}</td><td>${this.escape(this.segmentDetails(row.segments))}</td><td>${row.hours}</td><td>${row.coefficient}</td></tr>`,
              )
              .join("")}
          </table>
          <br />
          <table>
            <tr><td class="title" colspan="9">Interventions / travaux</td></tr>
            <tr><th>Utilisateur</th><th>Début</th><th>Fin</th><th>Plage</th><th>Détail calcul</th><th>Heures</th><th>Coefficient</th><th>Repos compensatoire</th><th>Commentaire</th></tr>
            ${interventionRows
              .map(
                (row) => `<tr><td>${this.escape(row.userName)}</td><td>${this.formatRange(row.startDate, row.startDate)}</td><td>${this.formatRange(row.endDate, row.endDate)}</td><td>${this.escape(row.label)}</td><td>${this.escape(this.segmentDetails(row.segments))}</td><td>${row.hours}</td><td>${row.coefficient}</td><td>${row.restCoefficient}</td><td>${this.escape(row.comment)}</td></tr>`,
              )
              .join("")}
          </table>
        </body>
      </html>
    `;
  }

  private operationHtml(operation: ExportOperation, templateId: ExportTemplateId): string {
    return `
      <section class="operation">
        <h1>${this.escape(operation.exportTitle)}</h1>
        <h2>Autorisation</h2>
        <table class="meta">
          <tr><th>Objet des Astreintes</th><td>${this.escape(operation.title)}</td></tr>
          <tr><th>Initiateur de l'opération</th><td>${this.escape(operation.initiatorName)}</td></tr>
          <tr><th>Responsable de l'opération</th><td>${this.escape(operation.operationManagerName)}</td></tr>
          <tr><th>Date & horaires prévus</th><td>${this.formatRange(operation.forecastStartDate, operation.forecastEndDate)}</td></tr>
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
        <h3>Détail des calculs RH</h3>
        ${this.compensationDetailsHtml(operation, templateId)}
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
            .map((row) => `<tr><td>${this.escape(row.name)}</td><td>${this.formatDate(row.startDate)}</td><td>${this.formatTime(row.startDate)}</td><td>${this.formatDate(row.endDate)}</td><td>${this.formatTime(row.endDate)}</td><td>${this.visaHtml(row.visa, "line")}</td></tr>`)
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
            .map((row) => `<tr><td>${this.escape(row.userName)}${row.comment ? `<br><span class="muted">${this.escape(row.comment)}</span>` : ""}</td><td>${this.formatDate(row.startDate)}</td><td>${this.formatTime(row.startDate)}</td><td>${this.formatDate(row.endDate)}</td><td>${this.formatTime(row.endDate)}</td><td>${row.wasOnSite ? "X" : ""}</td><td>${this.visaHtml(row.visa, "line")}</td></tr>`)
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

    const date = visa.signedAt ? `<div class="visa-date">${this.formatDate(visa.signedAt)} ${this.formatTime(visa.signedAt)}</div>` : "";

    if ((visa.signatureMode === "image" || visa.signatureMode === "draw") && visa.signatureValue) {
      const size = variant === "global" ? { width: 130, height: 34, className: "visa-image global-visa-image" } : { width: 95, height: 26, className: "visa-image" };
      return `<img class="${size.className}" src="${this.escapeAttribute(visa.signatureValue)}" alt="Signature de ${this.escapeAttribute(visa.signedByName || "l'agent")}" width="${size.width}" height="${size.height}" />${date}`;
    }

    const name = visa.signedByName || visa.signatureValue || "Signé";
    return `${this.escape(name)}${date}`;
  }

  private compensationDetailsHtml(operation: ExportOperation, templateId: ExportTemplateId): string {
    const isWork = templateId === "exceptionalWork";
    const onCallRows = this.onCallCompensationRows(operation);
    const interventionRows = this.interventionCompensationRows(operation, isWork);

    return `
      <table class="calculation-detail">
        <thead><tr><th>Type</th><th>Agent</th><th>Règle</th><th>Calcul retenu</th><th>Total heures</th><th>Coefficient</th><th>Repos</th></tr></thead>
        <tbody>
          ${
            onCallRows.length
              ? onCallRows
                  .map((row) => `<tr><td>Astreinte</td><td>${this.escape(row.name)}</td><td>${this.escape(row.label)}</td><td>${this.escape(this.segmentDetails(row.segments))}</td><td>${row.hours}</td><td>${row.coefficient}</td><td></td></tr>`)
                  .join("")
              : `<tr><td>Astreinte</td><td colspan="6" class="muted">Aucun segment calculé.</td></tr>`
          }
          ${
            interventionRows.length
              ? interventionRows
                  .map((row) => `<tr><td>${isWork ? "Travaux" : "Intervention"}</td><td>${this.escape(row.userName)}</td><td>${this.escape(row.label)}</td><td>${this.escape(this.segmentDetails(row.segments))}</td><td>${row.hours}</td><td>${row.coefficient}</td><td>${row.restCoefficient}</td></tr>`)
                  .join("")
              : `<tr><td>${isWork ? "Travaux" : "Intervention"}</td><td colspan="6" class="muted">Aucun segment calculé.</td></tr>`
          }
        </tbody>
      </table>
      <p class="muted">Le calcul est effectué par pas de 15 minutes, puis les pas consécutifs retenus sont regroupés pour faciliter le contrôle.</p>
    `;
  }

  private onCallCompensationRows(operation: ExportOperation): Array<{ name: string; startDate: string; endDate: string; label: string; hours: number; coefficient: number; segments: CalculationSegment[] }> {
    return operation.actualUsers.flatMap((user) => {
      const weekSegments = this.splitHourSegmentsByPredicate(user.startDate, user.endDate, (date) => !this.isWeekendOrHoliday(date));
      const weekendHolidaySegments = this.splitHourSegmentsByPredicate(user.startDate, user.endDate, (date) => this.isWeekendOrHoliday(date));
      const weekRule = this.onCallCompensationRules.find((rule) => rule.id === "week");
      const weekendRule = this.onCallCompensationRules.find((rule) => rule.id === "weekendHoliday");

      return [
        { name: user.name, startDate: user.startDate, endDate: user.endDate, label: weekRule?.label || "Semaine", hours: this.totalHours(weekSegments), coefficient: weekRule?.coefficient || 0, segments: weekSegments },
        { name: user.name, startDate: user.startDate, endDate: user.endDate, label: weekendRule?.label || "Samedi / Dimanche / Jour férié", hours: this.totalHours(weekendHolidaySegments), coefficient: weekendRule?.coefficient || 0, segments: weekendHolidaySegments },
      ].filter((row) => row.hours > 0);
    });
  }

  private interventionCompensationRows(operation: ExportOperation, isWork: boolean): Array<{ userName: string; startDate: string; endDate: string; label: string; hours: number; coefficient: number; restCoefficient: number; comment: string; segments: CalculationSegment[] }> {
    return operation.interventions.flatMap((intervention) =>
      this.periodCompensationRules
        .map((rule) => {
          const segments = this.segmentsForPeriodRule(intervention.startDate, intervention.endDate, rule.id);

          return {
            userName: intervention.userName,
            startDate: intervention.startDate,
            endDate: intervention.endDate,
            label: rule.label,
            hours: this.totalHours(segments),
            coefficient: isWork ? rule.workCoefficient : rule.interventionCoefficient,
            restCoefficient: rule.restCoefficient,
            comment: intervention.comment,
            segments,
          };
        })
        .filter((row) => row.hours > 0),
    );
  }

  private hoursForPeriodRule(startValue: string, endValue: string, ruleId: string): number {
    return this.totalHours(this.segmentsForPeriodRule(startValue, endValue, ruleId));
  }

  private segmentsForPeriodRule(startValue: string, endValue: string, ruleId: string): CalculationSegment[] {
    return this.splitHourSegmentsByPredicate(startValue, endValue, (date) => {
      const hour = date.getHours() + date.getMinutes() / 60;
      const day = date.getDay();
      const isHoliday = this.isPublicHoliday(date);

      if (ruleId === "week_18_21") return day >= 1 && day <= 5 && !isHoliday && hour >= 18 && hour < 21;
      if (ruleId === "night_21_7") return hour >= 21 || hour < 7;
      if (ruleId === "week_7_8") return day >= 1 && day <= 5 && !isHoliday && hour >= 7 && hour < 8;
      if (ruleId === "saturday_7_21") return day === 6 && !isHoliday && hour >= 7 && hour < 21;
      if (ruleId === "sunday_holiday_7_21") return (day === 0 || isHoliday) && hour >= 7 && hour < 21;
      return false;
    });
  }

  private splitHoursByPredicate(startValue: string, endValue: string, predicate: (date: Date) => boolean): number {
    return this.totalHours(this.splitHourSegmentsByPredicate(startValue, endValue, predicate));
  }

  private splitHourSegmentsByPredicate(startValue: string, endValue: string, predicate: (date: Date) => boolean): CalculationSegment[] {
    if (!startValue || !endValue) return [];
    const end = new Date(endValue);
    const segments: CalculationSegment[] = [];
    let cursor = new Date(startValue);

    while (cursor < end) {
      const next = new Date(cursor);
      next.setMinutes(cursor.getMinutes() + 15, 0, 0);
      const segmentEnd = next < end ? next : end;

      if (predicate(cursor)) {
        const lastSegment = segments.at(-1);
        const segmentHours = (segmentEnd.getTime() - cursor.getTime()) / 36e5;

        if (lastSegment && new Date(lastSegment.endDate).getTime() === cursor.getTime()) {
          lastSegment.endDate = segmentEnd.toISOString();
          lastSegment.hours = this.roundHours(lastSegment.hours + segmentHours);
        } else {
          segments.push({
            startDate: cursor.toISOString(),
            endDate: segmentEnd.toISOString(),
            hours: this.roundHours(segmentHours),
          });
        }
      }

      cursor = segmentEnd;
    }

    return segments;
  }

  private totalHours(segments: CalculationSegment[]): number {
    return this.roundHours(segments.reduce((total, segment) => total + segment.hours, 0));
  }

  private roundHours(value: number): number {
    return Math.round(value * 100) / 100;
  }

  private segmentDetails(segments: CalculationSegment[]): string {
    if (!segments.length) {
      return "Aucun segment retenu";
    }

    return segments
      .map((segment) => `${this.formatRange(segment.startDate, segment.endDate)} = ${segment.hours} h`)
      .join(" ; ");
  }

  private overlapsSelectedMonth(startValue: string, endValue: string): boolean {
    const { start, end } = this.monthRange(this.selectedMonth);
    const itemStart = new Date(startValue);
    const itemEnd = new Date(endValue || startValue);
    return itemStart < end && itemEnd >= start;
  }

  private monthRange(monthKey: string): { start: Date; end: Date } {
    const [year, month] = monthKey.split("-").map(Number);
    return { start: new Date(year, month - 1, 1), end: new Date(year, month, 1) };
  }

  private formatDate(value: string): string {
    return value ? new Intl.DateTimeFormat("fr-FR").format(new Date(value)) : "";
  }

  private formatTime(value: string): string {
    return value ? new Intl.DateTimeFormat("fr-FR", { hour: "2-digit", minute: "2-digit" }).format(new Date(value)) : "";
  }

  private toMonthKey(date: Date): string {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
  }

  private isWeekendOrHoliday(date: Date): boolean {
    return date.getDay() === 0 || date.getDay() === 6 || this.isPublicHoliday(date);
  }

  private isPublicHoliday(date: Date): boolean {
    return this.publicHolidays.some((holiday) => holiday.date === this.toDateKey(date));
  }

  private toDateKey(date: Date): string {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  }

  private mergeRows<T extends { id: string }>(defaults: T[], savedRows: Partial<T>[]): T[] {
    return defaults.map((defaultRow) => ({ ...defaultRow, ...(savedRows.find((row) => row.id === defaultRow.id) || {}) }));
  }

  private downloadFile(fileName: string, type: string, content: string): void {
    const blob = new Blob(["\ufeff", content], { type });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  private escape(value: string): string {
    return String(value || "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;");
  }

  private escapeAttribute(value: string): string {
    return this.escape(value).replaceAll("'", "&#39;");
  }

  private slug(value: string): string {
    return value
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .toLowerCase();
  }
}
