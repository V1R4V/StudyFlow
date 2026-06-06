// Firebase Configuration
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { initializeAppCheck, ReCaptchaV3Provider } from "firebase/app-check";
import { getAnalytics, isSupported, logEvent } from "firebase/analytics";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
};

// Initialize Firebase
export const app = initializeApp(firebaseConfig);

// Optional: enable App Check when a site key is provided.
//
// We wrap init in try/catch because reCAPTCHA can fail to load for reasons
// outside our control: ad/script blockers, offline first paint, or browsers
// that don't support the APIs reCAPTCHA needs. A thrown init would otherwise
// take down the whole app at boot. If it fails, App Check simply isn't
// attached; Firestore requests will be rejected by enforcement (fail-closed),
// which is the safe outcome, and the rest of the app still renders.
const appCheckSiteKey = import.meta.env.VITE_FIREBASE_APPCHECK_SITE_KEY;
if (appCheckSiteKey) {
  // In local development, set a debug token so App Check issues tokens for
  // localhost/preview without a real reCAPTCHA challenge. Register the printed
  // token in Firebase Console → App Check → Apps → Manage debug tokens.
  // Never enabled in production builds.
  if (import.meta.env.DEV) {
    self.FIREBASE_APPCHECK_DEBUG_TOKEN = true;
  }

  try {
    initializeAppCheck(app, {
      provider: new ReCaptchaV3Provider(appCheckSiteKey),
      isTokenAutoRefreshEnabled: true,
    });
  } catch (err) {
    console.error('App Check initialization failed; continuing without it:', err);
  }
}

// Initialize Firebase Authentication
export const auth = getAuth(app);

// Initialize Firestore
export const db = getFirestore(app);

// ---------------------------------------------------------------------------
// Google Analytics 4 (via Firebase). Powers the GA4 dashboards: traffic
// volume, acquisition/traffic-source channels, geography, devices, real-time.
// Gated on a measurementId being present AND the browser supporting analytics
// (isSupported() rules out unsupported/SSR contexts). Skipped in dev so local
// browsing doesn't pollute production metrics. Use GA4 DebugView to test.
// ---------------------------------------------------------------------------
let analytics = null;

if (firebaseConfig.measurementId && import.meta.env.PROD) {
  isSupported()
    .then(ok => {
      if (ok) analytics = getAnalytics(app);
    })
    .catch(() => {
      // Analytics is best-effort; never let it break app startup.
    });
}

// Log a page view. Safe to call before analytics finishes initializing (it
// no-ops until ready). Used for SPA route changes, which GA4 doesn't capture
// automatically.
export function trackPageView(path) {
  if (!analytics) return;
  logEvent(analytics, 'page_view', {
    page_path: path,
    page_location: window.location.href,
    page_title: document.title,
  });
}

export default app;
