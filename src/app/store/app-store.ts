import { FirebaseError, initializeApp } from "firebase/app";
import {
  Auth,
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updateProfile,
} from "firebase/auth";
import {
  CollectionReference,
  DocumentData,
  DocumentReference,
  Query,
  QuerySnapshot,
  SetOptions,
  UpdateData,
  addDoc,
  collection,
  collectionGroup,
  deleteDoc,
  deleteField,
  doc,
  getDoc,
  getFirestore,
  onSnapshot,
  serverTimestamp,
  setDoc,
  updateDoc,
} from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyBqtqzAPEiedHrY5RDzuG2u9Lg_yf_0-rg",
  authDomain: "astreintes-et-travaux.firebaseapp.com",
  projectId: "astreintes-et-travaux",
  storageBucket: "astreintes-et-travaux.firebasestorage.app",
  messagingSenderId: "497580775943",
  appId: "1:497580775943:web:26b4dc0330610fb784a8a2",
};

export interface StoreAuthUser {
  displayName: string | null;
  email: string | null;
  uid: string;
}

export type StoreUnsubscribe = () => void;
export type StoreCollection = CollectionReference<DocumentData> | Query<DocumentData>;
export type StoreDocumentReference = DocumentReference<DocumentData>;

export interface StoreDocument<T = Record<string, unknown>> {
  id: string;
  data: T;
  parentId: string;
}

const firebaseApp = initializeApp(firebaseConfig);
const auth: Auth = getAuth(firebaseApp);
const db = getFirestore(firebaseApp);
const googleProvider = new GoogleAuthProvider();

function mapAuthUser(user: { displayName: string | null; email: string | null; uid: string } | null): StoreAuthUser | null {
  if (!user) {
    return null;
  }

  return {
    displayName: user.displayName,
    email: user.email,
    uid: user.uid,
  };
}

function mapSnapshot<T>(snapshot: QuerySnapshot<DocumentData>): StoreDocument<T>[] {
  return snapshot.docs.map((documentSnapshot) => ({
    id: documentSnapshot.id,
    data: documentSnapshot.data() as T,
    parentId: documentSnapshot.ref.parent.parent?.id || "",
  }));
}

export const appStore = {
  auth: {
    onSessionChanged(callback: (user: StoreAuthUser | null) => void): StoreUnsubscribe {
      return onAuthStateChanged(auth, (user) => callback(mapAuthUser(user)));
    },

    createWithEmail(email: string, password: string): Promise<unknown> {
      return createUserWithEmailAndPassword(auth, email, password);
    },

    signInWithEmail(email: string, password: string): Promise<unknown> {
      return signInWithEmailAndPassword(auth, email, password);
    },

    signInWithGoogle(): Promise<unknown> {
      return signInWithPopup(auth, googleProvider);
    },

    signOut(): Promise<void> {
      return signOut(auth);
    },

    updateProfile(_user: StoreAuthUser, profile: { displayName?: string }): Promise<void> {
      if (!auth.currentUser) {
        return Promise.resolve();
      }

      return updateProfile(auth.currentUser, profile);
    },
  },

  data: {
    observeCollection<T>(
      reference: StoreCollection,
      next: (documents: StoreDocument<T>[]) => void,
      error?: (error: unknown) => void,
    ): StoreUnsubscribe {
      return onSnapshot(reference, (snapshot) => next(mapSnapshot<T>(snapshot)), error);
    },

    observeDocument<T>(
      reference: StoreDocumentReference,
      next: (data: T | undefined) => void,
      error?: (error: unknown) => void,
    ): StoreUnsubscribe {
      return onSnapshot(reference, (snapshot) => next(snapshot.data() as T | undefined), error);
    },

    async getDocument<T>(reference: StoreDocumentReference): Promise<T | undefined> {
      const snapshot = await getDoc(reference);
      return snapshot.data() as T | undefined;
    },

    addDocument(reference: CollectionReference<DocumentData>, data: DocumentData): Promise<unknown> {
      return addDoc(reference, data);
    },

    setDocument(reference: StoreDocumentReference, data: DocumentData, options?: SetOptions): Promise<void> {
      return options ? setDoc(reference, data, options) : setDoc(reference, data);
    },

    updateDocument(reference: StoreDocumentReference, data: UpdateData<DocumentData>): Promise<void> {
      return updateDoc(reference, data);
    },

    deleteDocument(reference: StoreDocumentReference): Promise<void> {
      return deleteDoc(reference);
    },

    serverTimestamp(): unknown {
      return serverTimestamp();
    },

    deleteField(): unknown {
      return deleteField();
    },
  },

  paths: {
    users: () => collection(db, "settings", "users", "items"),
    user: (userId: string) => doc(db, "settings", "users", "items", userId),
    teams: () => collection(db, "settings", "teams", "items"),
    team: (teamId: string) => doc(db, "settings", "teams", "items", teamId),
    scheduleRules: () => collection(db, "settings", "scheduleRules", "items"),
    scheduleRule: (ruleId: string) => doc(db, "settings", "scheduleRules", "items", ruleId),
    publicHolidays: () => collection(db, "settings", "publicHolidays", "items"),
    publicHoliday: (holidayId: string) => doc(db, "settings", "publicHolidays", "items", holidayId),
    rhExportTemplates: () => doc(db, "settings", "rhExportTemplates"),
    rhCompensationRules: () => doc(db, "settings", "rhCompensationRules"),
    regularOnCallPeriods: () => collection(db, "regularOnCallPeriods"),
    regularOnCallPeriod: (periodId: string) => doc(db, "regularOnCallPeriods", periodId),
    regularInterventions: (periodId: string) => collection(db, "regularOnCallPeriods", periodId, "interventions"),
    regularIntervention: (periodId: string, interventionId: string) => doc(db, "regularOnCallPeriods", periodId, "interventions", interventionId),
    regularInterventionsGroup: () => collectionGroup(db, "interventions"),
    exceptionalOperations: () => collection(db, "exceptionalOperations"),
    exceptionalOperation: (operationId: string) => doc(db, "exceptionalOperations", operationId),
  },

  errors: {
    isError(error: unknown): error is FirebaseError {
      return error instanceof FirebaseError;
    },
  },
};
