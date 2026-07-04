import { Component } from "@angular/core";
import { EmptyViewComponent } from "../shared/empty-view.component";

@Component({
  selector: "app-settings-page",
  standalone: true,
  imports: [EmptyViewComponent],
  templateUrl: "./settings-page.component.html",
})
export class SettingsPageComponent {}
