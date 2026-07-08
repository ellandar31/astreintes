import { CommonModule } from "@angular/common";
import { Component, OnDestroy } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { Unsubscribe, collection, doc, onSnapshot } from "firebase/firestore";
import { db } from "../../firebase";
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

interface ExportOperation {
  title: string;
  exportTitle: string;
  initiatorName: string;
  operationManagerName: string;
  forecastStartDate: string;
  forecastEndDate: string;
  actualStartDate: string;
  actualEndDate: string;
  plannedUsers: Array<{ name: string; startDate: string; endDate: string }>;
  actualUsers: Array<{ name: string; startDate: string; endDate: string }>;
  interventions: Array<{
    userName: string;
    startDate: string;
    endDate: string;
    wasOnSite: boolean;
    comment: string;
  }>;
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
      this.buildWordHtml(template, [operation]),
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
            title: `Astreinte régulière - ${period.userName || period.userEmail}`,
            exportTitle: "Astreintes Régulières",
            initiatorName: "",
            operationManagerName: "",
            forecastStartDate: period.startDate,
            forecastEndDate: period.endDate,
            actualStartDate: period.startDate,
            actualEndDate: period.endDate,
            plannedUsers: [{ name: period.userName || period.userEmail, startDate: period.startDate, endDate: period.endDate }],
            actualUsers: [{ name: period.userName || period.userEmail, startDate: period.startDate, endDate: period.endDate }],
            interventions: interventions.map((intervention) => ({
              userName: intervention.userName || intervention.userEmail,
              startDate: intervention.startDate,
              endDate: intervention.endDate,
              wasOnSite: false,
              comment: intervention.comment || "",
            })),
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
            startDate: forecastStart,
            endDate: forecastEnd,
          })),
          actualUsers: (operation.actualUsers || []).map((user) => ({
            name: user.displayName || user.email,
            startDate: actualStart,
            endDate: actualEnd,
          })),
          interventions: (operation.interventions || []).map((intervention) => ({
            userName: intervention.userName || intervention.userEmail,
            startDate: intervention.startDate || intervention.date || "",
            endDate: intervention.endDate || "",
            wasOnSite: Boolean(intervention.wasOnSite),
            comment: intervention.comment || intervention.label || "",
          })),
        };
      });
  }

  private buildWordHtml(template: WordExportTemplate, operations: ExportOperation[]): string {
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
          </style>
        </head>
        <body>${operations.map((operation) => this.operationHtml(operation)).join("")}</body>
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
            <tr><td class="title" colspan="6">Astreinte</td></tr>
            <tr><th>Utilisateur</th><th>Début</th><th>Fin</th><th>Type indemnisation</th><th>Heures</th><th>Coefficient</th></tr>
            ${onCallRows
              .map(
                (row) => `<tr><td>${this.escape(row.name)}</td><td>${this.formatRange(row.startDate, row.startDate)}</td><td>${this.formatRange(row.endDate, row.endDate)}</td><td>${this.escape(row.label)}</td><td>${row.hours}</td><td>${row.coefficient}</td></tr>`,
              )
              .join("")}
          </table>
          <br />
          <table>
            <tr><td class="title" colspan="8">Interventions / travaux</td></tr>
            <tr><th>Utilisateur</th><th>Début</th><th>Fin</th><th>Plage</th><th>Heures</th><th>Coefficient</th><th>Repos compensatoire</th><th>Commentaire</th></tr>
            ${interventionRows
              .map(
                (row) => `<tr><td>${this.escape(row.userName)}</td><td>${this.formatRange(row.startDate, row.startDate)}</td><td>${this.formatRange(row.endDate, row.endDate)}</td><td>${this.escape(row.label)}</td><td>${row.hours}</td><td>${row.coefficient}</td><td>${row.restCoefficient}</td><td>${this.escape(row.comment)}</td></tr>`,
              )
              .join("")}
          </table>
        </body>
      </html>
    `;
  }

  private operationHtml(operation: ExportOperation): string {
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
        <h3>Dates réelles</h3>
        ${this.peopleTable(operation.actualUsers)}
        <p class="muted">Pensez à demander au Directeur de Garde l'autorisation d'accès aux bâtiments en dehors des heures ouvrables.</p>
        <h3>Interventions au cours de l'astreinte</h3>
        ${this.interventionsTable(operation.interventions)}
      </section>
    `;
  }

  private peopleTable(rows: Array<{ name: string; startDate: string; endDate: string }>): string {
    const normalizedRows = rows.length ? rows : [{ name: "", startDate: "", endDate: "" }];
    return `
      <table>
        <thead><tr><th>Nom & Prénom de l'Agent</th><th>Date Début</th><th>Heure Début</th><th>Date Fin</th><th>Heure Fin</th><th>Visa de l'Agent</th></tr></thead>
        <tbody>
          ${normalizedRows
            .map((row) => `<tr><td>${this.escape(row.name)}</td><td>${this.formatDate(row.startDate)}</td><td>${this.formatTime(row.startDate)}</td><td>${this.formatDate(row.endDate)}</td><td>${this.formatTime(row.endDate)}</td><td></td></tr>`)
            .join("")}
        </tbody>
      </table>
    `;
  }

  private interventionsTable(rows: ExportOperation["interventions"]): string {
    const normalizedRows = rows.length ? rows : [{ userName: "", startDate: "", endDate: "", wasOnSite: false, comment: "" }];
    return `
      <table>
        <thead><tr><th>Nom & Prénom de l'Agent</th><th>Date Début</th><th>Heure Début</th><th>Date Fin</th><th>Heure Fin</th><th>* Int Site</th><th>Visa de l'Agent</th></tr></thead>
        <tbody>
          ${normalizedRows
            .map((row) => `<tr><td>${this.escape(row.userName)}${row.comment ? `<br><span class="muted">${this.escape(row.comment)}</span>` : ""}</td><td>${this.formatDate(row.startDate)}</td><td>${this.formatTime(row.startDate)}</td><td>${this.formatDate(row.endDate)}</td><td>${this.formatTime(row.endDate)}</td><td>${row.wasOnSite ? "X" : ""}</td><td></td></tr>`)
            .join("")}
        </tbody>
      </table>
      <p class="muted">* Cocher la case si intervention avec déplacement.</p>
    `;
  }

  private onCallCompensationRows(operation: ExportOperation): Array<{ name: string; startDate: string; endDate: string; label: string; hours: number; coefficient: number }> {
    return operation.actualUsers.flatMap((user) => {
      const weekHours = this.splitHoursByPredicate(user.startDate, user.endDate, (date) => !this.isWeekendOrHoliday(date));
      const weekendHolidayHours = this.splitHoursByPredicate(user.startDate, user.endDate, (date) => this.isWeekendOrHoliday(date));
      const weekRule = this.onCallCompensationRules.find((rule) => rule.id === "week");
      const weekendRule = this.onCallCompensationRules.find((rule) => rule.id === "weekendHoliday");

      return [
        { name: user.name, startDate: user.startDate, endDate: user.endDate, label: weekRule?.label || "Semaine", hours: weekHours, coefficient: weekRule?.coefficient || 0 },
        { name: user.name, startDate: user.startDate, endDate: user.endDate, label: weekendRule?.label || "Samedi / Dimanche / Jour férié", hours: weekendHolidayHours, coefficient: weekendRule?.coefficient || 0 },
      ].filter((row) => row.hours > 0);
    });
  }

  private interventionCompensationRows(operation: ExportOperation, isWork: boolean): Array<{ userName: string; startDate: string; endDate: string; label: string; hours: number; coefficient: number; restCoefficient: number; comment: string }> {
    return operation.interventions.flatMap((intervention) =>
      this.periodCompensationRules
        .map((rule) => ({
          userName: intervention.userName,
          startDate: intervention.startDate,
          endDate: intervention.endDate,
          label: rule.label,
          hours: this.hoursForPeriodRule(intervention.startDate, intervention.endDate, rule.id),
          coefficient: isWork ? rule.workCoefficient : rule.interventionCoefficient,
          restCoefficient: rule.restCoefficient,
          comment: intervention.comment,
        }))
        .filter((row) => row.hours > 0),
    );
  }

  private hoursForPeriodRule(startValue: string, endValue: string, ruleId: string): number {
    return this.splitHoursByPredicate(startValue, endValue, (date) => {
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
    if (!startValue || !endValue) return 0;
    const end = new Date(endValue);
    let total = 0;
    let cursor = new Date(startValue);

    while (cursor < end) {
      const next = new Date(cursor);
      next.setMinutes(cursor.getMinutes() + 15, 0, 0);
      const segmentEnd = next < end ? next : end;
      if (predicate(cursor)) total += (segmentEnd.getTime() - cursor.getTime()) / 36e5;
      cursor = segmentEnd;
    }

    return Math.round(total * 100) / 100;
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

  private slug(value: string): string {
    return value
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .toLowerCase();
  }
}
