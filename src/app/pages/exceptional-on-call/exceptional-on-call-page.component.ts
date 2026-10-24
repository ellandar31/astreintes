import { Component, Input } from "@angular/core";
import { StoreAuthUser } from "../../store/app-store";
import { ExceptionalOperationsComponent } from "../exceptional-common/exceptional-operations.component";

/** Owns the on-call navigation entry while reusing the shared exceptional workflow. */
@Component({
  selector: "app-exceptional-on-call-page",
  standalone: true,
  imports: [ExceptionalOperationsComponent],
  template: '<app-exceptional-operations [user]="user" operationType="astreinte" />',
})
export class ExceptionalOnCallPageComponent {
  @Input({ required: true }) user: StoreAuthUser | null = null;
}
