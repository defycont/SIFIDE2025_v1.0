// Import the functions you need from the SDKs you need
// Make sure to install firebase: npm install firebase or use CDN
// For CDN, you might not need these imports if firebase is global
// import { initializeApp } from "firebase/app";
// import { getAuth } from "firebase/auth";
// import { getFirestore } from "firebase/firestore";

// =======================================================================================
// !! CRITICAL !! ¡POR FAVOR REEMPLACE CON LA CONFIGURACIÓN REAL DE SU PROYECTO FIREBASE!
// =======================================================================================
// Los valores a continuación (apiKey, authDomain, projectId, etc.) DEBEN ser reemplazados
// con las credenciales de SU proyecto Firebase. Si estos son incorrectos o son placeholders,
// Firebase NO se conectará y la aplicación no guardará ni cargará datos de la nube.
//
// Cómo encontrar su configuración de Firebase:
// 1. Vaya a su proyecto Firebase en la consola de Firebase (console.firebase.google.com).
// 2. En la descripción general del proyecto, haga clic en el ícono "</>" (Web) para agregar o ver la configuración de su aplicación web.
// 3. Copie el objeto firebaseConfig y péguelo aquí.
// Asegúrese de que todas las claves (apiKey, authDomain, etc.) estén correctamente llenadas.
// NO DEJE VALORES DE EJEMPLO O PLACEHOLDERS.
// =======================================================================================
const firebaseConfig = {
  apiKey: "AIzaSyBq_Iw86Ge-0Gievt1DoafQsoiT3B2oAt8", // <--- ¡REEMPLACE ESTO CON SU API KEY REAL!
  authDomain: "sentinela-fiscal.firebaseapp.com", // <--- ¡REEMPLACE ESTO CON SU AUTH DOMAIN REAL!
  databaseURL: "https://sentinela-fiscal-default-rtdb.firebaseio.com", // <--- ¡REEMPLACE ESTO (opcional para Firestore)!
  projectId: "sentinela-fiscal", // <--- ¡REEMPLACE ESTO CON SU PROJECT ID REAL!
  storageBucket: "sentinela-fiscal.firebasestorage.app", // <--- ¡REEMPLACE ESTO (opcional si no usa Storage)!
  messagingSenderId: "123953826167", // <--- ¡REEMPLACE ESTO (opcional si no usa Messaging)!
  appId: "1:123953826167:web:c2f86e441f56e1405eb972" // <--- ¡REEMPLACE ESTO CON SU APP ID REAL!
};

// Declare firebase as a global variable for TypeScript
declare var firebase: any;

// Initialize Firebase
// Using compat libraries for easier integration with existing structure (window.firebase)
let app: any; // Use 'any' or more specific Firebase types if available globally
let auth: any;
let db: any;

if (firebaseConfig.apiKey.startsWith("AIzaSy") || firebaseConfig.apiKey === "YOUR_API_KEY_HERE" || firebaseConfig.projectId === "YOUR_PROJECT_ID" || firebaseConfig.projectId === "sentinela-fiscal") {
    console.warn(
        "ADVERTENCIA CRÍTICA: La configuración de Firebase parece estar utilizando valores de placeholder o ejemplo. " +
        "Por favor, reemplace estos con la configuración real de su proyecto Firebase en firebaseConfig.ts " +
        "para que la aplicación pueda conectarse a Firebase correctamente. " +
        "Si no lo hace, la aplicación NO funcionará como se espera (no guardará ni cargará datos)."
    );
}

// Check if Firebase is available (loaded from CDN)
if (typeof firebase !== 'undefined' && typeof firebase.initializeApp === 'function') {
  try {
    app = firebase.initializeApp(firebaseConfig);
    if (typeof firebase.auth === 'function') {
      auth = firebase.auth();
    } else {
      console.error("Firebase Auth SDK not loaded or firebase.auth is not a function. Ensure it's included in index.html if needed.");
    }
    if (typeof firebase.firestore === 'function') {
      db = firebase.firestore();
    } else {
      console.error("Firebase Firestore SDK not loaded or firebase.firestore is not a function. Ensure it's included in index.html.");
    }
  } catch (error: any) {
    console.error("Error initializing Firebase:", error);
    if (error.message && error.message.includes("apiKey")) {
        console.error("Este error puede deberse a una API key inválida o una configuración incorrecta del proyecto Firebase en firebaseConfig.ts.");
    }
  }
} else {
  console.error("Firebase SDK not loaded. Ensure Firebase scripts are in index.html and loaded correctly, or firebase.initializeApp is not available.");
}

export { app, auth, db };