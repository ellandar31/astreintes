import { Component, Input } from "@angular/core";
import { AuthenticatedUser } from "../store/firebase.store";

@Component({
  selector: "app-profile-page",
  standalone: true,
  templateUrl: "./profile-page.component.html",
  styleUrl: "./profile-page.component.css",
})
export class ProfilePageComponent {
  @Input({ required: true }) user: AuthenticatedUser | null = null;

  get displayName(): string {
    return this.user?.displayName || "Non renseigné";
  }

  get email(): string {
    return this.user?.email || "Non renseigné";
  }
}
