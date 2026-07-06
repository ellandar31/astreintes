import { CommonModule } from "@angular/common";
import { Component, EventEmitter, OnDestroy, Output } from "@angular/core";
import { FormsModule, NgForm } from "@angular/forms";
import { FirebaseError } from "firebase/app";
import { Unsubscribe, addDoc, collection, deleteDoc, doc, onSnapshot, setDoc } from "firebase/firestore";
import { db } from "../../firebase";


@Component({
  selector: "app-rh-compensation-settings",
  standalone: true,
  templateUrl: "./rh-compensation-settings.component.html",
  styleUrls: ["./settings-common.scss", "./rh-compensation-settings.component.scss"],
})
export class RhCompensationSettingsComponent  implements OnDestroy {
  @Output() error = new EventEmitter<string>();
  @Output() success = new EventEmitter<string>();


  constructor() {
  }

  private readonly unsubscribe: Unsubscribe = onSnapshot();

  ngOnDestroy(): void {
    this.unsubscribe();
  }

  private emitError(error: unknown): void {
    this.error.emit(
      error instanceof FirebaseError
        ? `Erreur Firebase (${error.code}) : ${error.message}`
        : "Erreur pendant l'enregistrement.",
    );
  }

}
