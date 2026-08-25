import type { Session, SupabaseClient, User } from '@supabase/supabase-js';
import type { Database } from '../supabase/database.types';
import { getSupabaseClient } from '../supabase/client';

export type AuthenticatedUser = {
  id: string;
  email: string;
};

export type AuthSessionState =
  | { status: 'initializing' }
  | { status: 'authenticated'; user: AuthenticatedUser }
  | { status: 'unauthenticated' }
  | { status: 'unavailable'; message: string };

export type AuthSignInResult =
  | { status: 'authenticated'; user: AuthenticatedUser }
  | { status: 'failed'; message: string }
  | { status: 'unavailable'; message: string };

export type AuthSignOutResult =
  | { status: 'signed-out' }
  | { status: 'unavailable'; message: string };

export type AuthStateListener = (state: AuthSessionState) => void;
export type UnsubscribeAuth = () => void;

export interface AuthService {
  observe(listener: AuthStateListener): UnsubscribeAuth;
  signIn(email: string, password: string): Promise<AuthSignInResult>;
  signOut(): Promise<AuthSignOutResult>;
}

const CONFIGURATION_UNAVAILABLE_MESSAGE =
  'Authentication is unavailable because the public service configuration is missing.';
const INITIALIZATION_UNAVAILABLE_MESSAGE =
  'Authentication is temporarily unavailable. Please reload and try again.';
const SIGN_IN_FAILED_MESSAGE =
  'Unable to sign in. Check your email and password and try again.';
const SIGN_OUT_FAILED_MESSAGE = 'Unable to sign out. Please try again.';

function normalizeUser(user: User | null | undefined): AuthenticatedUser | null {
  if (!user) {
    return null;
  }

  return {
    id: user.id,
    email: user.email ?? '',
  };
}

function stateFromSession(session: Session | null): AuthSessionState {
  const user = normalizeUser(session?.user);
  return user ? { status: 'authenticated', user } : { status: 'unauthenticated' };
}

class SupabaseAuthService implements AuthService {
  private signInInFlight: Promise<AuthSignInResult> | null = null;

  constructor(private readonly client: SupabaseClient<Database> | null) {}

  observe(listener: AuthStateListener): UnsubscribeAuth {
    if (!this.client) {
      listener({ status: 'unavailable', message: CONFIGURATION_UNAVAILABLE_MESSAGE });
      return () => undefined;
    }

    let active = true;
    let authEventSeen = false;
    let unsubscribe: UnsubscribeAuth = () => undefined;

    try {
      const { data } = this.client.auth.onAuthStateChange((_event, session) => {
        if (!active) {
          return;
        }

        authEventSeen = true;
        listener(stateFromSession(session));
      });
      unsubscribe = () => data.subscription.unsubscribe();
    } catch {
      listener({ status: 'unavailable', message: INITIALIZATION_UNAVAILABLE_MESSAGE });
      return () => undefined;
    }

    void this.client.auth
      .getSession()
      .then(({ data, error }) => {
        if (!active || authEventSeen) {
          return;
        }

        listener(
          error
            ? { status: 'unavailable', message: INITIALIZATION_UNAVAILABLE_MESSAGE }
            : stateFromSession(data.session),
        );
      })
      .catch(() => {
        if (active && !authEventSeen) {
          listener({ status: 'unavailable', message: INITIALIZATION_UNAVAILABLE_MESSAGE });
        }
      });

    return () => {
      active = false;
      unsubscribe();
    };
  }

  signIn(email: string, password: string): Promise<AuthSignInResult> {
    if (this.signInInFlight) {
      return this.signInInFlight;
    }

    const request = this.performSignIn(email, password);
    this.signInInFlight = request;
    void request.finally(() => {
      if (this.signInInFlight === request) {
        this.signInInFlight = null;
      }
    });
    return request;
  }

  async signOut(): Promise<AuthSignOutResult> {
    if (!this.client) {
      return { status: 'unavailable', message: CONFIGURATION_UNAVAILABLE_MESSAGE };
    }

    try {
      const { error } = await this.client.auth.signOut({ scope: 'local' });
      return error
        ? { status: 'unavailable', message: SIGN_OUT_FAILED_MESSAGE }
        : { status: 'signed-out' };
    } catch {
      return { status: 'unavailable', message: SIGN_OUT_FAILED_MESSAGE };
    }
  }

  private async performSignIn(
    email: string,
    password: string,
  ): Promise<AuthSignInResult> {
    if (!this.client) {
      return { status: 'unavailable', message: CONFIGURATION_UNAVAILABLE_MESSAGE };
    }

    try {
      const { data, error } = await this.client.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      const user = normalizeUser(data.session?.user ?? data.user);

      if (error || !data.session || !user) {
        return { status: 'failed', message: SIGN_IN_FAILED_MESSAGE };
      }

      return { status: 'authenticated', user };
    } catch {
      return { status: 'failed', message: SIGN_IN_FAILED_MESSAGE };
    }
  }
}

export function createSupabaseAuthService(
  client: SupabaseClient<Database> | null = getSupabaseClient(),
): AuthService {
  return new SupabaseAuthService(client);
}
