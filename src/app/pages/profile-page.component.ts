import { Component, Input } from "@angular/core";
import { User } from "firebase/auth";

@Component({
  selector: "app-profile-page",
  standalone: true,
  templateUrl: "./profile-page.component.html",
})
export class ProfilePageComponent {
  @Input({ required: true }) user: User | null = null;

  get displayName(): string {
    return this.user?.displayName || "Non renseigné";
  }

  get email(): string {
    return this.user?.email || "Non renseigné";
  }
}
