import { CommonModule } from "@angular/common";
import { Component, EventEmitter, Output } from "@angular/core";

@Component({
  selector: "app-rh-controls-settings",
  standalone: true,
  imports: [CommonModule],
  templateUrl: "./rh-controls-settings.component.html",
  styleUrls: ["./settings-common.scss", "./rh-controls-settings.component.scss"],
})
export class RhControlsSettingsComponent {
  @Output() failure = new EventEmitter<string>();
  @Output() success = new EventEmitter<string>();
}
