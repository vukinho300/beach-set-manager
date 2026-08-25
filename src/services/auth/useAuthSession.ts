import { useCallback, useEffect, useRef, useState } from 'react';
import {
  createSupabaseAuthService,
  type AuthService,
  type AuthSessionState,
} from './authService';

export type AuthSessionController = {
  state: AuthSessionState;
  actionError: string | null;
  signingIn: boolean;
  signingOut: boolean;
  signIn(email: string, password: string): Promise<void>;
  signOut(): Promise<void>;
};

export function useAuthSession(service?: AuthService): AuthSessionController {
  const [authService] = useState(() => service ?? createSupabaseAuthService());
  const [state, setState] = useState<AuthSessionState>({ status: 'initializing' });
  const [actionError, setActionError] = useState<string | null>(null);
  const [signingIn, setSigningIn] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const signInActive = useRef(false);
  const signOutActive = useRef(false);

  useEffect(() => {
    return authService.observe((nextState) => {
      setState(nextState);
      if (nextState.status === 'authenticated' || nextState.status === 'unauthenticated') {
        setActionError(null);
      }
    });
  }, [authService]);

  const signIn = useCallback(
    async (email: string, password: string) => {
      if (signInActive.current) {
        return;
      }

      signInActive.current = true;
      setSigningIn(true);
      setActionError(null);

      try {
        const result = await authService.signIn(email, password);
        if (result.status === 'authenticated') {
          setState(result);
        } else {
          setActionError(result.message);
        }
      } finally {
        signInActive.current = false;
        setSigningIn(false);
      }
    },
    [authService],
  );

  const signOut = useCallback(async () => {
    if (signOutActive.current) {
      return;
    }

    signOutActive.current = true;
    setSigningOut(true);
    setActionError(null);

    try {
      const result = await authService.signOut();
      if (result.status === 'signed-out') {
        setState({ status: 'unauthenticated' });
      } else {
        setActionError(result.message);
      }
    } finally {
      signOutActive.current = false;
      setSigningOut(false);
    }
  }, [authService]);

  return { state, actionError, signingIn, signingOut, signIn, signOut };
}
