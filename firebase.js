/* ═══════════════════════════════════════════════════════════════
   firebase-config.js  —  Firebase Firestore integration
   
   This file is loaded as <script type="module"> so it can use
   ES module imports from the Firebase CDN.

   It exposes 3 global functions onto window so that app.js
   (a classic script) can call them:

     window.__fbSave(data)   → adds a document to Firestore
     window.__fbLoad()       → fetches the 20 most recent runs
     window.__fbDelete(id)   → deletes a document by ID
     window.__fbReady        → true | false (checked by app.js)

   HOW TO SET UP:
     1. Go to https://console.firebase.google.com
     2. Create a project (or open an existing one)
     3. Click "Firestore Database" → Create database → Start in test mode
     4. Go to Project Settings → Your Apps → Web App → Config
     5. Copy the config object and paste it below
     6. In Firestore → Rules tab, set:
          allow read, write: if true;
        then click Publish
═══════════════════════════════════════════════════════════════ */

/* ── Firebase SDK imports (from Firebase CDN, no npm needed) ── */
import { initializeApp }
  from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";

import {
  getFirestore,   /* initialise Firestore instance              */
  collection,     /* reference to a Firestore collection        */
  addDoc,         /* add a new document (auto-generated ID)     */
  getDocs,        /* fetch all documents matching a query       */
  deleteDoc,      /* delete a specific document                 */
  doc,            /* reference to a specific document by ID     */
  query,          /* build a Firestore query                    */
  orderBy,        /* sort query results                         */
  limit           /* cap number of results returned             */
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";


/* ══════════════════════════════════════════════════════════════
   ▼▼▼  YOUR FIREBASE CONFIG  ▼▼▼
══════════════════════════════════════════════════════════════ */
const firebaseConfig = {
  apiKey: "AIzaSyBBZNZaR1WXG4SoudJ0E99UQFxItO-BT4U",
  authDomain: "os-simulator-7024d.firebaseapp.com",
  projectId: "os-simulator-7024d",
  storageBucket: "os-simulator-7024d.firebasestorage.app",
  messagingSenderId: "884608095206",
  appId: "1:884608095206:web:dbff90b97391b2c4cf3c27",
  measurementId: "G-86BLKP2L2V"
};
/* ▲▲▲  YOUR FIREBASE CONFIG  ▲▲▲ */


/* ── Initialise Firebase and wire up global functions ── */
try {

  /* Connect to Firebase project */
  const app = initializeApp(firebaseConfig);

  /* Get a reference to the Firestore database */
  const db = getFirestore(app);

  /* ── SAVE ──────────────────────────────────────────────
     Adds a new simulation document to the "simulations"
     collection. Firestore auto-generates a unique ID.
     Returns the new document ID on success.
  ─────────────────────────────────────────────────────── */
  window.__fbSave = async (data) => {
    const ref = await addDoc(collection(db, "simulations"), {
      ...data,
      timestamp: new Date().toISOString()  /* ISO string for easy sorting */
    });
    return ref.id;
  };

  /* ── LOAD ──────────────────────────────────────────────
     Fetches the 20 most recent simulation documents,
     sorted newest-first by their timestamp field.
     Returns an array of plain objects (id + data).
  ─────────────────────────────────────────────────────── */
  window.__fbLoad = async () => {
    const q    = query(
      collection(db, "simulations"),
      orderBy("timestamp", "desc"),  /* newest first  */
      limit(20)                      /* cap at 20     */
    );
    const snap = await getDocs(q);
    /* Map each Firestore document to a plain JS object */
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  };

  /* ── DELETE ─────────────────────────────────────────────
     Deletes a specific document by its Firestore ID.
     Called when user clicks the ✕ on a history item.
  ─────────────────────────────────────────────────────── */
  window.__fbDelete = async (id) => {
    await deleteDoc(doc(db, "simulations", id));
  };

  /* Signal to app.js that Firebase is ready */
  window.__fbReady = true;
  console.log("✅ Firebase connected");

} catch (e) {
  /* Config is likely missing or wrong — app still works, just no cloud save */
  console.warn("⚠️ Firebase failed to initialise:", e.message);
  window.__fbReady = false;
}