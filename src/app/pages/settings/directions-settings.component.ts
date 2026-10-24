import { Component, EventEmitter, Output, effect, inject } from "@angular/core";
import { FormsModule, NgForm } from "@angular/forms";
import { Store } from "@ngrx/store";
import { ButtonModule } from "primeng/button";
import { InputTextModule } from "primeng/inputtext";
import { TableModule } from "primeng/table";
import { APP_LABELS } from "../../i18n/labels";
import { SettingsActions } from "../../state/settings/settings.actions";
import { selectCanManageUsers, selectSettingsDirections, selectSettingsMessage } from "../../state/settings/settings.selectors";
import { Direction } from "../../types";

/** Only administrators maintain this reference; existing associations prevent deletion in SQL. */
@Component({
  selector: "app-directions-settings", standalone: true,
  imports: [FormsModule, ButtonModule, InputTextModule, TableModule],
  templateUrl: "./directions-settings.component.html", styleUrls: ["./settings-common.scss"],
})
export class DirectionsSettingsComponent {
  @Output() failure = new EventEmitter<string>();
  @Output() success = new EventEmitter<string>();
  readonly labels = APP_LABELS;
  private readonly store = inject(Store);
  readonly directions = this.store.selectSignal(selectSettingsDirections);
  readonly canManage = this.store.selectSignal(selectCanManageUsers);
  private readonly message = this.store.selectSignal(selectSettingsMessage);
  private handled: number | null = null;
  editingId: string | null = null;
  name = "";

  constructor() {
    effect(() => {
      const message = this.message();
      if (message?.source !== "directions" || message.completedAt === this.handled) return;
      this.handled = message.completedAt;
      if (message.kind === "success") {
        this.name = ""; this.editingId = null;
        this.success.emit(message.message);
      } else this.failure.emit(message.message);
    });
  }

  save(form: NgForm): void {
    if (!this.canManage() || form.invalid || !this.name.trim()) return;
    this.store.dispatch(SettingsActions.directionSaveRequested({ directionId: this.editingId, name: this.name.trim() }));
  }

  edit(direction: Direction): void {
    if (!this.canManage()) return;
    this.editingId = direction.id; this.name = direction.name;
  }

  remove(direction: Direction): void {
    if (!this.canManage()) return;
    this.store.dispatch(SettingsActions.directionDeleteRequested({ directionId: direction.id }));
  }
}
