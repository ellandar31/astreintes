import { CommonModule } from "@angular/common";
import { Component } from "@angular/core";
import { FormsModule, NgForm } from "@angular/forms";
import { bootstrapApplication } from "@angular/platform-browser";
import { initializeApp } from "firebase/app";
import {
  Auth,
  GoogleAuthProvider,
  User,
  createUserWithEmailAndPassword,
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
} from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyBqtqzAPEiedHrY5RDzuG2u9Lg_yf_0-rg",
  authDomain: "astreintes-et-travaux.firebaseapp.com",
  projectId: "astreintes-et-travaux",
  storageBucket: "astreintes-et-travaux.firebasestorage.app",
  messagingSenderId: "497580775943",
  appId: "1:497580775943:web:26b4dc0330610fb784a8a2",
};

const firebaseApp = initializeApp(firebaseConfig);
const firebaseAuth = getAuth(firebaseApp);
const googleProvider = new GoogleAuthProvider();
const tabs = ["Régulier", "Exceptionnel", "Validation", "RH"] as const;
type TabName = (typeof tabs)[number];

@Component({
  selector: "app-root",
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    @if (loadingSession) {
      <main class="center-screen">
        <div class="loader" aria-label="Chargement"></div>
      </main>
    } @else if (user) {
      <main class="app-shell">
        <header class="top-bar">
          <div>
            <p class="eyebrow">Astreintes et travaux</p>
            <h1>Suivi des astreintes</h1>
          </div>

          <div class="top-actions" aria-label="Actions utilisateur">
            <button class="icon-button" [title]="'Profil - ' + displayName" type="button">
              <span class="button-icon" aria-hidden="true">P</span>
              <span>Profil</span>
            </button>
            <button class="icon-button" title="Paramétrage" type="button">
              <span class="button-icon" aria-hidden="true">S</span>
              <span>Paramétrage</span>
            </button>
            <button class="icon-button danger" (click)="logout()" title="Déconnexion" type="button">
              <span class="button-icon" aria-hidden="true">X</span>
              <span>Déconnexion</span>
            </button>
          </div>
        </header>

        <nav class="tabs" aria-label="Sections de l'application">
          @for (tab of tabs; track tab) {
            <button
              [attr.aria-current]="activeTab === tab ? 'page' : null"
              [class.active]="activeTab === tab"
              class="tab"
              (click)="activeTab = tab"
              type="button"
            >
              {{ tab }}
            </button>
          }
        </nav>

        <section class="empty-view" aria-labelledby="active-tab-title">
          <h2 id="active-tab-title">{{ activeTab }}</h2>
        </section>
      </main>
    } @else {
      <main class="auth-layout">
        <section class="auth-panel" aria-labelledby="auth-title">
          <div>
            <p class="eyebrow">Astreintes et travaux</p>
            <h1 id="auth-title">Connexion</h1>
            <p class="muted">Accédez au suivi des astreintes avec votre compte.</p>
          </div>

          <form class="auth-form" #authForm="ngForm" (ngSubmit)="loginWithEmail(authForm)">
            <label>
              Email
              <input
                autocomplete="email"
                inputmode="email"
                name="email"
                [(ngModel)]="email"
                placeholder="nom@entreprise.fr"
                required
                type="email"
              />
            </label>

            <label>
              Mot de passe
              <input
                [autocomplete]="isCreatingAccount ? 'new-password' : 'current-password'"
                minlength="6"
                name="password"
                [(ngModel)]="password"
                placeholder="6 caracteres minimum"
                required
                type="password"
              />
            </label>

            @if (error) {
              <p class="error-message">{{ error }}</p>
            }

            <button class="primary-button" [disabled]="isSubmitting || authForm.invalid" type="submit">
              {{ isCreatingAccount ? "Créer le compte" : "Se connecter" }}
            </button>
          </form>

          <button class="google-button" [disabled]="isSubmitting" (click)="loginWithGoogle()" type="button">
            Continuer avec Google
          </button>

          <button class="text-button" (click)="toggleAccountMode()" type="button">
            {{ isCreatingAccount ? "J'ai déjà un compte" : "Créer un compte email" }}
          </button>
        </section>
      </main>
    }
  `,
})
class AppComponent {
  private readonly auth: Auth = firebaseAuth;

  readonly tabs = tabs;
  activeTab: TabName = "Régulier";
  email = "";
  error = "";
  isCreatingAccount = false;
  isSubmitting = false;
  loadingSession = true;
  password = "";
  user: User | null = null;

  get displayName(): string {
    return this.user?.displayName || this.user?.email || "Utilisateur";
  }

  constructor() {
    onAuthStateChanged(this.auth, (currentUser) => {
      this.user = currentUser;
      this.loadingSession = false;
    });
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
}

bootstrapApplication(AppComponent).catch((error: unknown) => console.error(error));
