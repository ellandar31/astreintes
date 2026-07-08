import { Injectable } from "@angular/core";
import { FirebaseError } from "firebase/app";
import {
  User,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
} from "firebase/auth";
import {
  Unsubscribe,
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  serverTimestamp,
  setDoc,
  updateDoc,
} from "firebase/firestore";
import { auth, db, googleProvider } from "../firebase";

type DocumentPayload = Record<string, any>;
export type AuthenticatedUser = User;
export type StoreUnsubscribe = Unsubscribe;

@Injectable({ providedIn: "root" })
export class FirebaseStore {
  onAuthStateChanged(callback: (user: User | null) => void): Unsubscribe {
    return onAuthStateChanged(auth, callback);
  }

  createUserWithEmailAndPassword(email: string, password: string): Promise<unknown> {
    return createUserWithEmailAndPassword(auth, email, password);
  }

  signInWithEmailAndPassword(email: string, password: string): Promise<unknown> {
    return signInWithEmailAndPassword(auth, email, password);
  }

  signInWithGoogle(): Promise<unknown> {
    return signInWithPopup(auth, googleProvider);
  }

  signOut(): Promise<void> {
    return signOut(auth);
  }

  watchCollection<T extends { id: string }>(
    collectionName: string,
    next: (items: T[]) => void,
    error?: (error: unknown) => void,
  ): Unsubscribe {
    return onSnapshot(
      collection(db, collectionName),
      (snapshot) => next(snapshot.docs.map((document) => ({ id: document.id, ...document.data() }) as T)),
      error,
    );
  }

  addDocument(collectionName: string, payload: DocumentPayload): Promise<unknown> {
    return addDoc(collection(db, collectionName), payload);
  }

  setDocument(collectionName: string, documentId: string, payload: DocumentPayload, options?: { merge: boolean }): Promise<void> {
    return options ? setDoc(doc(db, collectionName, documentId), payload, options) : setDoc(doc(db, collectionName, documentId), payload);
  }

  updateDocument(collectionName: string, documentId: string, payload: DocumentPayload): Promise<void> {
    return updateDoc(doc(db, collectionName, documentId), payload);
  }

  deleteDocument(collectionName: string, documentId: string): Promise<void> {
    return deleteDoc(doc(db, collectionName, documentId));
  }

  timestamp(): unknown {
    return serverTimestamp();
  }

  isFirebaseError(error: unknown): error is FirebaseError {
    return error instanceof FirebaseError;
  }

  firebaseErrorMessage(error: unknown, fallback: string): string {
    if (error instanceof FirebaseError) {
      return `Erreur Firebase (${error.code}) : ${error.message}`;
    }

    return fallback;
  }

  async registerAuthenticatedUser(currentUser: User): Promise<void> {
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
