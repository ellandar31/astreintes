import { CommonModule } from "@angular/common";
import { Component, Input } from "@angular/core";
import { StoreAuthUser } from "../../store/app-store";
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
  @Input({ required: true }) user: StoreAuthUser | null = null;

  readonly sections: Array<{ id: RhSection; label: string }> = [
    { id: "exports", label: "Exports des données" },
    { id: "controls", label: "Contrôles des données" },
  ];

  activeSection: RhSection = "exports";

  setSection(section: RhSection): void {
    this.activeSection = section;
  }
}
