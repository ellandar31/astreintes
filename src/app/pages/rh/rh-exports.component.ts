import { CommonModule } from "@angular/common";
import { Component } from "@angular/core";
import { FormsModule } from "@angular/forms";

interface WordExportTemplate {
  id: "regular" | "exceptionalOnCall" | "exceptionalWork";
  label: string;
  fileName: string;
}

@Component({
  selector: "app-rh-exports",
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: "./rh-exports.component.html",
  styleUrl: "./rh-exports.component.css",
})
export class RhExportsComponent {
  readonly templates: WordExportTemplate[] = [
    { id: "regular", label: "Astreintes régulières", fileName: "" },
    { id: "exceptionalOnCall", label: "Astreintes exceptionnelles", fileName: "" },
    { id: "exceptionalWork", label: "Travaux exceptionnels", fileName: "" },
  ];

  selectedMonth = this.toMonthKey(new Date());
  exportMessage = "";

  setTemplateFile(template: WordExportTemplate, event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    template.fileName = file?.name || "";
    this.exportMessage = "";
  }

  prepareExport(template: WordExportTemplate): void {
    if (!template.fileName) {
      this.exportMessage = "Sélectionnez un modèle Word avant de préparer l'export.";
      return;
    }

    this.exportMessage = `Modèle "${template.fileName}" prêt pour ${template.label}.`;
  }

  private toMonthKey(date: Date): string {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
  }
}
