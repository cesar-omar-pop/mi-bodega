// firebase-config.js
// Importa las funciones modulares específicas de Firebase que necesitas
import { initializeApp } from 'https://www.gstatic.com/firebasejs/9.6.1/firebase-app.js';
import { getAuth } from 'https://www.gstatic.com/firebasejs/9.6.1/firebase-auth.js'; // Función modular para Auth
import { getFirestore } from 'https://www.gstatic.com/firebasejs/9.6.1/firebase-firestore.js'; // Función modular para Firestore

// Tu objeto de configuración de Firebase
const firebaseConfig = {
  apiKey: "AIzaSyDbInBgTWTWvQfjMZEr-ZfRDltLfTljfwI",
  authDomain: "mapstock-89668.firebaseapp.com",
  projectId: "mapstock-89668",
  storageBucket: "mapstock-89668.firebasestorage.app",
  messagingSenderId: "339631647637",
  appId: "1:339631647637:web:e482885d7a650cae74a49c",
  measurementId: "G-R6Q8CVQZQ6"
};
// Inicializa Firebase


// *** ESTA LÍNEA ES LA MÁS IMPORTANTE PARA RESOLVER EL ERROR ***
// Exporta la referencia a la base de datos para que otros módulos puedan usarla

// Inicializa Firebase con la función modular
const app = initializeApp(firebaseConfig);

// Obtén y exporta las instancias de Auth y Firestore de forma modular
export const auth = getAuth(app); // <<<--- ¡Así es como obtienes la instancia modular de Auth!
export const db = getFirestore(app); // <<<--- ¡Así es como obtienes la instancia modular de Firestore!

// Si tuvieras Storage u otros servicios, los importarías y exportarías de manera similar.