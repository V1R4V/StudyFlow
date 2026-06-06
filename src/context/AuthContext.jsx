import { createContext, useContext, useEffect, useRef } from 'react';
import { useAuth } from '../hooks/useAuth';
import {
  syncUserDataOnLogin,
  clearLocalDataOnLogout,
} from '../services/firebaseService';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const auth = useAuth();
  const prevUidRef = useRef(null);

  // Watch user transitions and keep localStorage <-> Firestore in sync.
  // Runs on initial load (after Firebase resolves persisted auth), on manual
  // login, and on logout.
  useEffect(() => {
    if (auth.loading) return;

    const newUid = auth.user?.uid || null;
    const prevUid = prevUidRef.current;

    if (newUid && newUid !== prevUid) {
      // Signed in (or switched accounts), pull from Firestore, migrating
      // any guest data on first login.
      syncUserDataOnLogin(newUid, {
        displayName: auth.user.displayName,
        email: auth.user.email,
      });
    } else if (!newUid && prevUid) {
      // Signed out: DON'T clear localStorage. The user's data is safe in
      // Firestore. If they sign back in, syncUserDataOnLogin pulls it down
      // again (and overwrites the cache). If a different user signs in,
      // their sync will overwrite with their own data. The only edge case
      // is: after logout, a guest on the same browser sees the previous
      // user's data, an acceptable trade-off vs. blanking the UI on logout.
      void clearLocalDataOnLogout; // keep import; intentionally not called
    }

    prevUidRef.current = newUid;
  }, [auth.user, auth.loading]);

  return <AuthContext.Provider value={auth}>{children}</AuthContext.Provider>;
}

export function useAuthContext() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuthContext must be used inside <AuthProvider>');
  return ctx;
}
