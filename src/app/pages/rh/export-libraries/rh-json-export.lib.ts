import { SignatureVisa } from "../../../shared/visa.models";
import { ExportOperation, ExportTemplateId } from "./rh-export.models";

interface JsonVisa {
  signed?: boolean;
  signedAt?: string;
  signedByName?: string;
  signatureValue?: string;
}

interface JsonParticipant {
  displayName: string;
  userId?: string;
  startDate?: string;
  endDate?: string;
  startTime?: string;
  endTime?: string;
  visa: JsonVisa;
}

interface JsonIntervention {
  startDate: string;
  endDate: string;
  startTime: string;
  endTime: string;
  userName: string;
  wasOnSite: boolean;
  agentVisa: JsonVisa;
}

interface JsonExportPayload {
  exceptionalOperations: {
    global: {
      forecastStartDate: string;
      forecastEndDate: string;
      operationManagerName: string;
      initiatorName: string;
      title: string;
      initiatorGlobal: JsonVisa;
      directorGlobal: JsonVisa;
    };
    forecast: {
      plannedDirector: JsonVisa;
      plannedInitiator: JsonVisa;
      plannedUsers: JsonParticipant[];
    };
    actual?: {
      actualInitiator: JsonVisa;
      actualDirector: JsonVisa;
      actualUsers: JsonParticipant[];
    };
    interventions: JsonIntervention[];
  };
}

type VisaShape = "complete" | "signatureOnly";

/**
 * Produit le JSON attendu par les modèles RH déclaratifs.
 *
 * Les exports Word/PDF/Excel partent d'un même agrégat `ExportOperation`.
 * Cette librairie garde cette source commune, puis adapte uniquement la forme
 * JSON aux trois définitions de modèles. Cela évite qu'un futur correctif RH
 * doive être recopié dans plusieurs préparateurs de données.
 */
export class RhJsonExportLibrary {
  /**
   * Sérialise une opération dans la forme JSON du modèle cible.
   *
   * Les travaux exceptionnels n'ont pas de bloc `actual` dans le modèle fourni :
   * ils exportent les informations globales, le prévisionnel et les périodes
   * réelles sous la clé historique `interventions`. Cette clé est un contrat du
   * modèle documentaire, pas une entité de travaux en base. Les astreintes
   * régulières et exceptionnelles exportent aussi le bloc réel.
   */
  buildJson(templateId: ExportTemplateId, operation: ExportOperation): string {
    return JSON.stringify(this.buildPayload(templateId, operation), null, 2);
  }

  buildPayload(templateId: ExportTemplateId, operation: ExportOperation): JsonExportPayload {
    const includeActual = templateId !== "exceptionalWork";
    const visaShape: VisaShape = templateId === "exceptionalWork" ? "complete" : "signatureOnly";
    // Keep the supplied Word-model contract while using actual work participants as the source.
    const documentPeriods = templateId === "exceptionalWork"
      ? operation.actualUsers.map(user => ({
          userName: user.name, startDate: user.startDate, endDate: user.endDate, wasOnSite: false, visa: user.visa,
        }))
      : operation.interventions;

    return {
      exceptionalOperations: {
        global: {
          forecastStartDate: operation.forecastStartDate,
          forecastEndDate: operation.forecastEndDate,
          operationManagerName: operation.operationManagerName,
          initiatorName: operation.initiatorName,
          title: operation.title,
          initiatorGlobal: this.visa(operation.initiatorVisa, visaShape),
          directorGlobal: this.visa(operation.directorVisa, visaShape),
        },
        forecast: {
          plannedDirector: this.visa(operation.directorVisa, visaShape, true),
          plannedInitiator: this.visa(operation.initiatorVisa, visaShape, true),
          plannedUsers: operation.plannedUsers.map((user) => this.participant(user, templateId !== "exceptionalWork", visaShape)),
        },
        ...(includeActual
          ? {
              actual: {
                actualInitiator: this.visa(operation.initiatorVisa, visaShape),
                actualDirector: this.visa(operation.directorVisa, visaShape),
                actualUsers: operation.actualUsers.map((user) => this.participant(user, true, visaShape)),
              },
            }
          : {}),
        interventions: documentPeriods.map((intervention) => ({
          startDate: this.datePart(intervention.startDate),
          endDate: this.datePart(intervention.endDate),
          startTime: this.timePart(intervention.startDate),
          endTime: this.timePart(intervention.endDate),
          userName: intervention.userName,
          wasOnSite: intervention.wasOnSite,
          agentVisa: this.visa(intervention.visa, visaShape),
        })),
      },
    };
  }

  private participant(
    user: ExportOperation["plannedUsers"][number],
    includeDates: boolean,
    visaShape: VisaShape,
  ): JsonParticipant {
    return {
      displayName: user.name,
      userId: user.userId,
      ...(includeDates
        ? {
            startDate: this.datePart(user.startDate),
            endDate: this.datePart(user.endDate),
            startTime: this.timePart(user.startDate),
            endTime: this.timePart(user.endDate),
          }
        : {}),
      visa: this.visa(user.visa, visaShape),
    };
  }

  private visa(visa: SignatureVisa, shape: VisaShape, includeSigner = false): JsonVisa {
    return {
      ...(shape === "complete" ? { signed: visa.signed } : {}),
      signedAt: visa.signedAt,
      ...(includeSigner ? { signedByName: visa.signedByName } : {}),
      signatureValue: visa.signatureValue,
    };
  }

  private datePart(value: string): string {
    return value.includes("T") ? value.split("T")[0] : value.split(" ")[0] || "";
  }

  private timePart(value: string): string {
    const time = value.includes("T") ? value.split("T")[1] : value.split(" ")[1] || "";
    return time.split(/[.+-]/)[0] || "";
  }
}
