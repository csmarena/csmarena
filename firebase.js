import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyB7Wms_wDuHzMfXjmasVW7AMm6TPZaKXh4",
  authDomain: "csm-arena.firebaseapp.com",
  projectId: "csm-arena",
  storageBucket: "csm-arena.firebasestorage.app",
  messagingSenderId: "288274431272",
  appId: "1:288274431272:web:77e90f0aa74748afc6641d",
  measurementId: "G-BY24D24PR6",
};

// Inicializa Firebase
const app = initializeApp(firebaseConfig);

// 🔥 Conecta ao banco (Firestore)
const db = getFirestore(app);

// Exporta para usar no app
export { db };
