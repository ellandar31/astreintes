import { CommonModule } from "@angular/common";
import { Component } from "@angular/core";
import { RhControlsComponent } from "./rh-controls.component";
import { RhExportsComponent } from "./rh-exports.component";
import { RhSection } from "./rh.models";

@Component({
  selector: "app-rh-page",
  standalone: true,
  imports: [CommonModule, RhControlsComponent, RhExportsComponent],
  templateUrl: "./rh-page.component.html",
  styleUrl: "./rh-page.component.css",
})
export class RhPageComponent {
  readonly sections: Array<{ id: RhSection; label: string }> = [
    { id: "controls", label: "Contrôles des données" },
    { id: "exports", label: "Exports des données" },
  ];

  activeSection: RhSection = "controls";

  setSection(section: RhSection): void {
    this.activeSection = section;
  }
}
