import { CommonModule } from "@angular/common";
import { Component, EventEmitter, OnDestroy, Output } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { onSnapshot, setDoc, Unsubscribe } from "firebase/firestore";
import { rhExportTemplatesDoc } from "../../firebase-paths";

interface RhExportTemplateSetting {
  id: "regular" | "exceptionalOnCall" | "exceptionalWork";
  label: string;
  fileName: string;
}

@Component({
  selector: "app-rh-export-templates-settings",
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: "./rh-export-templates-settings.component.html",
  styleUrls: ["./settings-common.scss", "./rh-export-templates-settings.component.scss"],
})
export class RhExportTemplatesSettingsComponent implements OnDestroy {
  @Output() failure = new EventEmitter<string>();
  @Output() success = new EventEmitter<string>();

  templates: RhExportTemplateSetting[] = [
    { id: "regular", label: "Astreintes régulières", fileName: "" },
    { id: "exceptionalOnCall", label: "Astreintes exceptionnelles", fileName: "" },
    { id: "exceptionalWork", label: "Travaux exceptionnels", fileName: "" },
  ];

  private readonly settingsRef = rhExportTemplatesDoc();
  private readonly unsubscribe: Unsubscribe = onSnapshot(this.settingsRef, (snapshot) => {
    const data = snapshot.data();
    const savedTemplates = Array.isArray(data?.["templates"]) ? (data["templates"] as Partial<RhExportTemplateSetting>[]) : [];

    this.templates = this.templates.map((template) => {
      const savedTemplate = savedTemplates.find((item) => item.id === template.id);
      return savedTemplate ? { ...template, ...savedTemplate } : template;
    });
  });

  ngOnDestroy(): void {
    this.unsubscribe();
  }

  setTemplateFile(template: RhExportTemplateSetting, event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    template.fileName = file?.name || template.fileName;
  }

  async saveTemplates(): Promise<void> {
    try {
      await setDoc(this.settingsRef, {
        templates: this.templates,
        updatedAt: new Date().toISOString(),
      });
      this.success.emit("Modèles Word RH enregistrés.");
    } catch {
      this.failure.emit("Erreur pendant l'enregistrement des modèles Word RH.");
    }
  }
}
