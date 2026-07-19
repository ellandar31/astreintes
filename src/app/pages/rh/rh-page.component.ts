import { CommonModule } from "@angular/common";
import { Component, Input } from "@angular/core";
import { ButtonModule } from "primeng/button";
import { CardModule } from "primeng/card";
import { APP_LABELS } from "../../i18n/labels";
import { StoreAuthUser } from "../../store/app-store";
import { RhControlsComponent } from "./rh-controls.component";
import { RhExportsComponent } from "./rh-exports.component";
import { RhSection } from "./rh.models";

@Component({
  selector: "app-rh-page",
  standalone: true,
  imports: [ButtonModule, CardModule, CommonModule, RhControlsComponent, RhExportsComponent],
  templateUrl: "./rh-page.component.html",
  styleUrl: "./rh-page.component.css",
})
export class RhPageComponent {
  @Input({ required: true }) user: StoreAuthUser | null = null;

  readonly labels = APP_LABELS;
  readonly sections: Array<{ id: RhSection; label: string }> = [
    { id: "exports", label: APP_LABELS.rh.menu.exports },
    { id: "controls", label: APP_LABELS.rh.menu.controls },
  ];

  activeSection: RhSection = "exports";

  setSection(section: RhSection): void {
    this.activeSection = section;
  }
}
