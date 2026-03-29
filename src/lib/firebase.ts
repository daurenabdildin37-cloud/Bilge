import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, browserLocalPersistence, setPersistence } from "firebase/auth";
import { 
  initializeFirestore, 
  persistentLocalCache, 
  persistentMultipleTabManager,
  getFirestore,
  doc,
  getDocFromServer
} from "firebase/firestore";

// Import the Firebase configuration
import firebaseAppletConfig from '../../firebase-applet-config.json';

console.log("Firebase Config Check:", {
  projectId: firebaseAppletConfig.projectId,
  databaseId: firebaseAppletConfig.firestoreDatabaseId,
  hasApiKey: !!firebaseAppletConfig.apiKey
});

// Support environment variables for standalone deployment (Vercel/Netlify)
// Helper to get non-empty env var or fallback
const getEnv = (key: string, fallback: string) => {
  const val = import.meta.env[key];
  return (val && val !== '' && val !== 'undefined') ? val : fallback;
};

const firebaseConfig = {
  apiKey: getEnv('VITE_FIREBASE_API_KEY', firebaseAppletConfig.apiKey),
  authDomain: getEnv('VITE_FIREBASE_AUTH_DOMAIN', firebaseAppletConfig.authDomain),
  projectId: getEnv('VITE_FIREBASE_PROJECT_ID', firebaseAppletConfig.projectId),
  storageBucket: getEnv('VITE_FIREBASE_STORAGE_BUCKET', firebaseAppletConfig.storageBucket),
  messagingSenderId: getEnv('VITE_FIREBASE_MESSAGING_SENDER_ID', firebaseAppletConfig.messagingSenderId),
  appId: getEnv('VITE_FIREBASE_APP_ID', firebaseAppletConfig.appId),
  firestoreDatabaseId: getEnv('VITE_FIREBASE_DATABASE_ID', firebaseAppletConfig.firestoreDatabaseId)
};

// Check if Firebase is configured
export let isFirebaseConfigured = !!firebaseConfig.apiKey && 
                                  firebaseConfig.apiKey !== 'remixed-api-key' && 
                                  firebaseConfig.apiKey !== 'TODO_KEYHERE' &&
                                  firebaseConfig.apiKey !== '';

let app: any;
let auth: any;
let db: any;
let googleProvider: any;

if (isFirebaseConfigured) {
  try {
    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    
    // Use initializeFirestore with explicit settings
    // experimentalForceLongPolling is often required in this environment
    const dbId = firebaseConfig.firestoreDatabaseId || '(default)';
    console.log("Initializing Firestore with database:", dbId);
    
    const firestoreSettings = {
      localCache: persistentLocalCache({
        tabManager: persistentMultipleTabManager()
      }),
      experimentalForceLongPolling: true
    };

    db = initializeFirestore(app, firestoreSettings, dbId);

    googleProvider = new GoogleAuthProvider();
    googleProvider.setCustomParameters({ prompt: 'select_account' });

    // Set persistence to local
    setPersistence(auth, browserLocalPersistence).catch((err) => {
      console.error("Persistence error:", err);
    });

    // Validate connection to Firestore
    const testConnection = async (retryCount = 0) => {
      try {
        console.log(`Testing Firestore connection (attempt ${retryCount + 1})...`);
        // Use getDocFromServer to force a network request
        await getDocFromServer(doc(db, 'test', 'connection'));
        console.log("Firestore connection successful!");
      } catch (error: any) {
        console.error("Firestore connection error:", {
          code: error.code,
          message: error.message,
          database: dbId
        });
        
        if (error.code === 'permission-denied') {
          console.log("Firestore reached, but permission denied (this confirms connectivity).");
          return;
        }

        if (retryCount < 3) {
          const delay = Math.pow(2, retryCount) * 1000;
          console.log(`Retrying in ${delay}ms...`);
          setTimeout(() => testConnection(retryCount + 1), delay);
        }
      }
    };
    testConnection();
  } catch (err) {
    console.error("Firebase initialization error:", err);
    isFirebaseConfigured = false;
  }
}

if (!isFirebaseConfigured) {
  // Provide dummy objects to prevent crashes
  auth = { 
    onAuthStateChanged: (callback: any) => {
      // Immediately call with null to stop loading
      setTimeout(() => callback(null), 0);
      return () => {};
    },
    currentUser: null
  };
  db = {};
  googleProvider = {};
}

export { auth, db, googleProvider };
