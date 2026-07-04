import { Component, EventEmitter, Input, Output } from "@angular/core";

export type ModalSize = "small" | "large";

@Component({
  selector: "app-modal",
  standalone: true,
  templateUrl: "./modal.component.html",
})
export class ModalComponent {
  @Input({ required: true }) title = "";
  @Input() size: ModalSize = "small";
  @Output() closed = new EventEmitter<void>();
}
