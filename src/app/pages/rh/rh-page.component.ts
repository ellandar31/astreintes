import { RhPurgeComponent } from "./rh-purge.component";
import { Store } from "@ngrx/store";
import { selectCanExportRh } from "../../state/settings/settings.selectors";
import { CommonModule } from "@angular/common";
import { Component, Input, computed, inject } from "@angular/core";
import { ButtonModule } from "primeng/button";
import { CardModule } from "primeng/card";
import { APP_LABELS } from "../../i18n/labels";
import { StoreAuthUser } from "../../store/app-store";
import { RhExportsComponent } from "./rh-exports.component";
import { RhSection } from "./rh.models";

@Component({
  selector: "app-rh-page",
  standalone: true,
  imports: [ButtonModule, CardModule, CommonModule, RhExportsComponent, RhPurgeComponent],
  templateUrl: "./rh-page.component.html",
  styleUrl: "./rh-page.component.css",
})
export class RhPageComponent {
  @Input({ required: true }) user: StoreAuthUser | null = null;

  readonly labels = APP_LABELS;
  readonly sections: Array<{ id: RhSection; label: string }> = [
    { id: "periodExports", label: APP_LABELS.rh.menu.periodExports },
    { id: "exports", label: APP_LABELS.rh.menu.exports },
    { id: "userExports", label: APP_LABELS.rh.menu.userExports },
    { id: "purge", label: APP_LABELS.rh.menu.purge },
    { id: "userPurge", label: APP_LABELS.rh.menu.userPurge },
  ];

  private readonly store = inject(Store);
  readonly canExport = this.store.selectSignal(selectCanExportRh);
  readonly visibleSections = computed(() => this.canExport() ? this.sections : []);
  activeSection: RhSection = "periodExports";

  setSection(section: RhSection): void {
    if (!this.canExport()) return;
    this.activeSection = section;
  }
}
