import { ExportOperation, ExportTemplateId, RhExportContext } from "./rh-export.models";
import { RhPeriodExcelExportLibrary } from "./rh-period-excel-export.lib";

/** Individual exports must contain real XLSX bytes, matching the downloaded extension. */
export class RhExcelExportLibrary {
  async buildWorkbook(templateId: ExportTemplateId, operation: ExportOperation, context: RhExportContext): Promise<Uint8Array> {
    return new RhPeriodExcelExportLibrary().buildOperationWorkbook(templateId, operation, context);
  }
}
