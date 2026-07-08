import { CommonModule } from "@angular/common";
import { Component } from "@angular/core";
import { FormsModule, NgForm } from "@angular/forms";
import { ExceptionalOperationsComponent } from "./pages/exceptionnel/exceptional-operations.component";
import { ProfilePageComponent } from "./pages/profile-page.component";
import { RegularCalendarComponent } from "./pages/regular/regular-calendar.component";
import { SettingsPageComponent } from "./pages/settings-page.component";
import { EmptyViewComponent } from "./shared/empty-view.component";
import { ModalComponent } from "./shared/modal.component";
import { AuthenticatedUser, FirebaseStore } from "./store/firebase.store";

const tabs = ["Régulier", "Exceptionnel", "Validation", "RH"] as const;
type TabName = (typeof tabs)[number];
type ModalView = "profile" | "settings";

@Component({
  selector: "app-root",
  standalone: true,
  imports: [
    CommonModule,
    EmptyViewComponent,
    ExceptionalOperationsComponent,
    FormsModule,
    ModalComponent,
    ProfilePageComponent,
    RegularCalendarComponent,
    SettingsPageComponent,
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
  user: AuthenticatedUser | null = null;

  get displayName(): string {
    return this.user?.displayName || this.user?.email || "Utilisateur";
  }

  constructor(private readonly firebaseStore: FirebaseStore) {
    this.firebaseStore.onAuthStateChanged((currentUser) => {
      this.user = currentUser;
      this.loadingSession = false;

      if (currentUser) {
        void this.firebaseStore.registerAuthenticatedUser(currentUser);
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
        await this.firebaseStore.createUserWithEmailAndPassword(this.email, this.password);
      } else {
        await this.firebaseStore.signInWithEmailAndPassword(this.email, this.password);
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
      await this.firebaseStore.signInWithGoogle();
    } catch {
      this.error = "Connexion Google impossible pour le moment.";
    } finally {
      this.isSubmitting = false;
    }
  }

  async logout(): Promise<void> {
    await this.firebaseStore.signOut();
  }

  toggleAccountMode(): void {
    this.isCreatingAccount = !this.isCreatingAccount;
    this.error = "";
  }
}
