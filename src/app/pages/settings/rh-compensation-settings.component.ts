import { CommonModule } from "@angular/common";
import { Component, EventEmitter, Output } from "@angular/core";

@Component({
  selector: "app-rh-compensation-settings",
  standalone: true,
  imports: [CommonModule],
  templateUrl: "./rh-compensation-settings.component.html",
  styleUrls: ["./settings-common.scss", "./rh-compensation-settings.component.scss"],
})
export class RhCompensationSettingsComponent {
  @Output() error = new EventEmitter<string>();
  @Output() success = new EventEmitter<string>();
}