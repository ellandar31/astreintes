import { CommonModule } from "@angular/common";
import { Component, OnDestroy } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { Unsubscribe, collection, deleteField, doc, onSnapshot, serverTimestamp, updateDoc } from "firebase/firestore";
import { db } from "../../firebase";
import { SignatureVisa, createEmptyVisa } from "../../shared/visa.models";
import { RhExceptionalOperation, RhRegularPeriod } from "./rh.models";
import { RhExcelExportLibrary } from "./export-libraries/rh-excel-export.lib";
import {
  ExportOperation,
  ExportTemplateId,
  OnCallCompensationRule,
  PeriodCompensationRule,
  RhExportContext,
  WordExportTemplate,
} from "./export-libraries/rh-export.models";
import { formatRange } from "./export-libraries/rh-export-utils";
import { RhWordPdfExportLibrary } from "./export-libraries/rh-word-pdf-export.lib";

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

  private readonly wordPdfExportLibrary = new RhWordPdfExportLibrary();
  private readonly excelExportLibrary = new RhExcelExportLibrary();

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
      this.wordPdfExportLibrary.buildWordHtml(template, [operation], templateId, this.exportContext()),
    );
    this.exportMessage = `Export Word généré pour ${operation.title}.`;
  }

  exportExcelOperation(templateId: ExportTemplateId, operation: ExportOperation): void {
    this.exportMessage = "";
    this.downloadFile(
      `${this.slug(operation.title)}_${this.selectedMonth}.xls`,
      "application/vnd.ms-excel;charset=utf-8",
      this.excelExportLibrary.buildExcelHtml(templateId, operation, this.exportContext()),
    );
    this.exportMessage = `Export Excel généré pour ${operation.title}.`;
  }

  async exportPdfOperation(templateId: ExportTemplateId, operation: ExportOperation): Promise<void> {
    this.exportMessage = "";
    const template = this.templateFor(templateId);

    if (!template.fileName) {
      this.exportMessage = "Aucun modèle Word n'est configuré pour cet export dans les paramètres RH.";
      return;
    }

    this.downloadBlob(
      `${this.slug(operation.title)}_${this.selectedMonth}.pdf`,
      await this.wordPdfExportLibrary.buildPdfBlob(template, [operation]),
    );
    this.exportMessage = `Export PDF généré pour ${operation.title}.`;
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
    return formatRange(startValue, endValue);
  }

  private exportContext(): RhExportContext {
    return {
      publicHolidays: this.publicHolidays,
      onCallCompensationRules: this.onCallCompensationRules,
      periodCompensationRules: this.periodCompensationRules,
    };
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

  private toMonthKey(date: Date): string {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
  }

  private mergeRows<T extends { id: string }>(defaults: T[], savedRows: Partial<T>[]): T[] {
    return defaults.map((defaultRow) => {
      const savedRow = savedRows.find((row) => row.id === defaultRow.id);
      return savedRow ? { ...defaultRow, ...savedRow } : defaultRow;
    });
  }

  private downloadFile(fileName: string, type: string, content: string): void {
    const blob = new Blob(["\ufeff", content], { type });
    this.downloadBlob(fileName, blob);
  }

  private downloadBlob(fileName: string, blob: Blob): void {
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
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
