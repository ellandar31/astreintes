import { initializeApp } from "firebase/app";
import { GoogleAuthProvider, getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyBqtqzAPEiedHrY5RDzuG2u9Lg_yf_0-rg",
  authDomain: "astreintes-et-travaux.firebaseapp.com",
  projectId: "astreintes-et-travaux",
  storageBucket: "astreintes-et-travaux.firebasestorage.app",
  messagingSenderId: "497580775943",
  appId: "1:497580775943:web:26b4dc0330610fb784a8a2",
};

export const firebaseApp = initializeApp(firebaseConfig);
export const auth = getAuth(firebaseApp);
export const googleProvider = new GoogleAuthProvider();
