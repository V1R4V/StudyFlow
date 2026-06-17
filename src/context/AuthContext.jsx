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
      // Signed out: wipe the cached copy so the previous user's data stops
      // showing. Their data is safe in Firestore and syncUserDataOnLogin
      // pulls it back down on next sign-in. This also fires
      // 'studyflow:data-changed' so the contexts re-render to an empty state.
      clearLocalDataOnLogout();
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
