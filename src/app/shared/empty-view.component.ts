import { Component, Input } from "@angular/core";

@Component({
  selector: "app-empty-view",
  standalone: true,
  templateUrl: "./empty-view.component.html",
})
export class EmptyViewComponent {
  @Input({ required: true }) title = "";
}
