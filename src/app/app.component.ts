import { CommonModule } from "@angular/common";
import { Component } from "@angular/core";
import { FormsModule, NgForm } from "@angular/forms";
import {
  Auth,
  User,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
} from "firebase/auth";
import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";
import { auth, db, googleProvider } from "./firebase";
import { ProfilePageComponent } from "./pages/profile-page.component";
import { SettingsPageComponent } from "./pages/settings-page.component";
import { EmptyViewComponent } from "./shared/empty-view.component";
import { ModalComponent } from "./shared/modal.component";

const tabs = ["Régulier", "Exceptionnel", "Validation", "RH"] as const;
type TabName = (typeof tabs)[number];
type ModalView = "profile" | "settings";

@Component({
  selector: "app-root",
  standalone: true,
  imports: [
    CommonModule,
    EmptyViewComponent,
    FormsModule,
    ModalComponent,
    ProfilePageComponent,
    SettingsPageComponent,
  ],
  templateUrl: "./app.component.html",
  styleUrl: "./app.component.css",
})
export class AppComponent {
  private readonly auth: Auth = auth;

  readonly tabs = tabs;
  activeTab: TabName = "Régulier";
  email = "";
  error = "";
  isCreatingAccount = false;
  isSubmitting = false;
  loadingSession = true;
  modalView: ModalView | null = null;
  password = "";
  user: User | null = null;

  get displayName(): string {
    return this.user?.displayName || this.user?.email || "Utilisateur";
  }

  constructor() {
    onAuthStateChanged(this.auth, (currentUser) => {
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
        await createUserWithEmailAndPassword(this.auth, this.email, this.password);
      } else {
        await signInWithEmailAndPassword(this.auth, this.email, this.password);
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
      await signInWithPopup(this.auth, googleProvider);
    } catch {
      this.error = "Connexion Google impossible pour le moment.";
    } finally {
      this.isSubmitting = false;
    }
  }

  async logout(): Promise<void> {
    await signOut(this.auth);
  }

  toggleAccountMode(): void {
    this.isCreatingAccount = !this.isCreatingAccount;
    this.error = "";
  }

  private async registerAuthenticatedUser(currentUser: User): Promise<void> {
    const userReference = doc(db, "users", currentUser.uid);
    const snapshot = await getDoc(userReference);
    const userPayload = {
      uid: currentUser.uid,
      email: currentUser.email || "",
      displayName: currentUser.displayName || "",
      lastLoginAt: serverTimestamp(),
    };

    if (snapshot.exists()) {
      await setDoc(userReference, userPayload, { merge: true });
      return;
    }

    await setDoc(userReference, {
      ...userPayload,
      role: 1,
    });
  }
}
