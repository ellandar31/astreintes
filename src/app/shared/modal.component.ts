import { Component, EventEmitter, Input, Output } from "@angular/core";
import { APP_LABELS } from "../i18n/labels";

export type ModalSize = "small" | "large";

@Component({
  selector: "app-modal",
  standalone: true,
  templateUrl: "./modal.component.html",
  styleUrl: "./modal.component.css",
})
export class ModalComponent {
  readonly labels = APP_LABELS;
  @Input({ required: true }) title = "";
  @Input() size: ModalSize = "small";
  @Output() closed = new EventEmitter<void>();
}
