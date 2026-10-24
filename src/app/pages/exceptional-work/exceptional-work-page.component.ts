import { Component, Input } from "@angular/core";
import { StoreAuthUser } from "../../store/app-store";
import { ExceptionalOperationsComponent } from "../exceptional-common/exceptional-operations.component";

/** Owns the work navigation entry; shared forms and persistence remain a single implementation. */
@Component({
  selector: "app-exceptional-work-page",
  standalone: true,
  imports: [ExceptionalOperationsComponent],
  template: '<app-exceptional-operations [user]="user" operationType="travaux" />',
})
export class ExceptionalWorkPageComponent {
  @Input({ required: true }) user: StoreAuthUser | null = null;
}
