import { CommonModule } from "@angular/common";
import { Component } from "@angular/core";
import { FormsModule, NgForm } from "@angular/forms";
import { ExceptionalOperationsComponent } from "./pages/exceptionnel/exceptional-operations.component";
import { ProfilePageComponent } from "./pages/profile/profile-page.component";
import { RegularCalendarComponent } from "./pages/regular/regular-calendar.component";
import { RhPageComponent } from "./pages/rh/rh-page.component";
import { SettingsPageComponent } from "./pages/settings/settings-page.component";
import { ValidationPageComponent } from "./pages/validation/validation-page.component";
import { ModalComponent } from "./shared/modal.component";
import { StoreAuthUser, appStore } from "./store/app-store";

const tabs = ["Régulier", "Exceptionnel", "Validation", "RH"] as const;
type TabName = (typeof tabs)[number];
type ModalView = "profile" | "settings";

@Component({
  selector: "app-root",
  standalone: true,
  imports: [
    CommonModule,
    ExceptionalOperationsComponent,
    FormsModule,
    ModalComponent,
    ProfilePageComponent,
    RegularCalendarComponent,
    RhPageComponent,
    SettingsPageComponent,
    ValidationPageComponent,
  ],
  templateUrl: "./app.component.html",
  styleUrl: "./app.component.css",
})
export class AppComponent {
  readonly tabs = tabs;
  activeTab: TabName = "Régulier";
  email = "";
  error = "";
  isCreatingAccount = false;
  isSubmitting = false;
  loadingSession = true;
  modalView: ModalView | null = null;
  password = "";
  user: StoreAuthUser | null = null;

  get displayName(): string {
    return this.user?.displayName || this.user?.email || "Utilisateur";
  }

  constructor() {
    appStore.auth.onSessionChanged((currentUser) => {
      this.user = currentUser;
      this.loadingSession = false;

      if (currentUser) {
        void this.registerAuthenticatedUser(currentUser);
      }
    });
  }

  selectTab(tab: TabName): void {
    this.activeTab = tab;
  }

  showProfile(): void {
    this.modalView = "profile";
  }

  showSettings(): void {
    this.modalView = "settings";
  }

  closeModal(): void {
    this.modalView = null;
  }

  async loginWithEmail(form: NgForm): Promise<void> {
    if (form.invalid) {
      return;
    }

    this.error = "";
    this.isSubmitting = true;

    try {
      if (this.isCreatingAccount) {
        await appStore.auth.createWithEmail(this.email, this.password);
      } else {
        await appStore.auth.signInWithEmail(this.email, this.password);
      }
    } catch {
      this.error = "Connexion impossible. Vérifiez l'adresse email et le mot de passe.";
    } finally {
      this.isSubmitting = false;
    }
  }

  async loginWithGoogle(): Promise<void> {
    this.error = "";
    this.isSubmitting = true;

    try {
      await appStore.auth.signInWithGoogle();
    } catch {
      this.error = "Connexion Google impossible pour le moment.";
    } finally {
      this.isSubmitting = false;
    }
  }

  async logout(): Promise<void> {
    await appStore.auth.signOut();
  }

  toggleAccountMode(): void {
    this.isCreatingAccount = !this.isCreatingAccount;
    this.error = "";
  }

  private async registerAuthenticatedUser(currentUser: StoreAuthUser): Promise<void> {
    const userReference = appStore.paths.user(currentUser.uid);
    const savedUser = await appStore.data.getDocument(userReference);
    const userPayload = {
      uid: currentUser.uid,
      email: currentUser.email || "",
      displayName: currentUser.displayName || "",
      lastLoginAt: appStore.data.serverTimestamp(),
    };

    if (savedUser) {
      await appStore.data.setDocument(userReference, userPayload, { merge: true });
      return;
    }

    await appStore.data.setDocument(userReference, {
      ...userPayload,
      role: 1,
    });
  }
}
