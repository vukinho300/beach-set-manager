import type {
  AuthChangeEvent,
  Session,
  SupabaseClient,
  User,
} from '@supabase/supabase-js';
import { describe, expect, it, vi } from 'vitest';
import type { Database } from '../supabase/database.types';
import {
  createSupabaseAuthService,
  type AuthSessionState,
} from './authService';

type AuthListener = (event: AuthChangeEvent, session: Session | null) => void;
type SessionResponse = {
  data: { session: Session | null };
  error: { message: string } | null;
};
type SignInResponse = {
  data: { session: Session | null; user: User | null };
  error: { message: string } | null;
};
type SignOutResponse = {
  error: { message: string } | null;
};
type UsernameResolutionResponse = {
  data: string | null;
  error: { message: string } | null;
};

function session(userId = 'user-1', email = 'person@example.test'): Session {
  return {
    user: { id: userId, email } as User,
  } as Session;
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

async function flushPromises() {
  await Promise.resolve();
  await Promise.resolve();
}

class FakeAuthClient {
  listener: AuthListener | null = null;
  getSessionHandler: () => Promise<SessionResponse> = async () => ({
    data: { session: null },
    error: null,
  });
  signInHandler: () => Promise<SignInResponse> = async () => ({
    data: { session: null, user: null },
    error: { message: 'Invalid credentials' },
  });
  signOutHandler: () => Promise<SignOutResponse> = async () => ({ error: null });
  usernameResolutionHandler: () => Promise<UsernameResolutionResponse> = async () => ({
    data: null,
    error: null,
  });

  readonly unsubscribe = vi.fn();
  readonly getSession = vi.fn(() => this.getSessionHandler());
  readonly signInWithPassword = vi.fn((_credentials: { email: string; password: string }) =>
    this.signInHandler(),
  );
  readonly signOut = vi.fn((_options: { scope: 'local' }) => this.signOutHandler());
  readonly rpc = vi.fn((_functionName: string, _args: { p_username: string }) =>
    this.usernameResolutionHandler(),
  );
  readonly onAuthStateChange = vi.fn((listener: AuthListener) => {
    this.listener = listener;
    return { data: { subscription: { unsubscribe: this.unsubscribe } } };
  });

  emit(event: AuthChangeEvent, nextSession: Session | null) {
    this.listener?.(event, nextSession);
  }

  asClient(): SupabaseClient<Database> {
    return {
      auth: {
        getSession: this.getSession,
        signInWithPassword: this.signInWithPassword,
        signOut: this.signOut,
        onAuthStateChange: this.onAuthStateChange,
      },
      rpc: this.rpc,
    } as unknown as SupabaseClient<Database>;
  }
}

describe('Supabase browser auth service', () => {
  it('restores an existing authenticated browser session', async () => {
    const fake = new FakeAuthClient();
    fake.getSessionHandler = async () => ({
      data: { session: session('vuk-id', 'vuk@example.test') },
      error: null,
    });
    const states: AuthSessionState[] = [];

    createSupabaseAuthService(fake.asClient()).observe((state) => states.push(state));
    await flushPromises();

    expect(states).toEqual([
      {
        status: 'authenticated',
        user: { id: 'vuk-id', email: 'vuk@example.test' },
      },
    ]);
  });

  it('initializes as unauthenticated when no stored session exists', async () => {
    const fake = new FakeAuthClient();
    const states: AuthSessionState[] = [];

    createSupabaseAuthService(fake.asClient()).observe((state) => states.push(state));
    await flushPromises();

    expect(states).toEqual([{ status: 'unauthenticated' }]);
  });

  it('returns a controlled unavailable state when configuration is missing', () => {
    const states: AuthSessionState[] = [];

    const unsubscribe = createSupabaseAuthService(null).observe((state) => states.push(state));
    unsubscribe();

    expect(states).toEqual([
      {
        status: 'unavailable',
        message: 'Authentication is unavailable because the public service configuration is missing.',
      },
    ]);
  });

  it('maps session initialization failures without exposing provider errors', async () => {
    const fake = new FakeAuthClient();
    fake.getSessionHandler = async () => ({
      data: { session: null },
      error: { message: 'provider detail that must stay private' },
    });
    const states: AuthSessionState[] = [];

    createSupabaseAuthService(fake.asClient()).observe((state) => states.push(state));
    await flushPromises();

    expect(states).toEqual([
      {
        status: 'unavailable',
        message: 'Authentication is temporarily unavailable. Please reload and try again.',
      },
    ]);
    expect(JSON.stringify(states)).not.toContain('provider detail');
  });

  it('uses auth events and does not let a stale initial read overwrite SIGNED_IN', async () => {
    const fake = new FakeAuthClient();
    const initial = deferred<SessionResponse>();
    fake.getSessionHandler = () => initial.promise;
    const states: AuthSessionState[] = [];
    const service = createSupabaseAuthService(fake.asClient());

    service.observe((state) => states.push(state));
    fake.emit('SIGNED_IN', session('vito-id', 'vito@example.test'));
    initial.resolve({ data: { session: null }, error: null });
    await flushPromises();

    expect(states[states.length - 1]).toEqual({
      status: 'authenticated',
      user: { id: 'vito-id', email: 'vito@example.test' },
    });

    fake.emit('SIGNED_OUT', null);
    expect(states[states.length - 1]).toEqual({ status: 'unauthenticated' });
  });

  it('unsubscribes and ignores later events after cleanup', async () => {
    const fake = new FakeAuthClient();
    const states: AuthSessionState[] = [];
    const unsubscribe = createSupabaseAuthService(fake.asClient()).observe((state) =>
      states.push(state),
    );
    await flushPromises();
    const stateCount = states.length;

    unsubscribe();
    fake.emit('SIGNED_IN', session());

    expect(fake.unsubscribe).toHaveBeenCalledOnce();
    expect(states).toHaveLength(stateCount);
  });

  it('returns a normalized user after valid mocked email/password sign-in', async () => {
    const fake = new FakeAuthClient();
    const signedInSession = session('mark-id', 'mark@example.test');
    fake.signInHandler = async () => ({
      data: { session: signedInSession, user: signedInSession.user },
      error: null,
    });
    const service = createSupabaseAuthService(fake.asClient());

    await expect(service.signIn('  mark@example.test ', 'test-password')).resolves.toEqual({
      status: 'authenticated',
      user: { id: 'mark-id', email: 'mark@example.test' },
    });
    expect(fake.signInWithPassword).toHaveBeenCalledWith({
      email: 'mark@example.test',
      password: 'test-password',
    });
  });

  it('maps invalid credentials to one generic message', async () => {
    const fake = new FakeAuthClient();
    fake.signInHandler = async () => ({
      data: { session: null, user: null },
      error: { message: 'This exact account does not exist' },
    });

    const result = await createSupabaseAuthService(fake.asClient()).signIn(
      'unknown@example.test',
      'wrong-password',
    );

    expect(result).toEqual({
      status: 'failed',
      message: 'Unable to sign in. Check your email/username and password and try again.',
    });
    expect(JSON.stringify(result)).not.toContain('account does not exist');
  });

  it('resolves a normalized username then lets Supabase Auth validate the password', async () => {
    const fake = new FakeAuthClient();
    fake.usernameResolutionHandler = async () => ({
      data: 'operational-account@example.test',
      error: null,
    });
    const signedInSession = session('koversada-worker', 'operational-account@example.test');
    fake.signInHandler = async () => ({
      data: { session: signedInSession, user: signedInSession.user },
      error: null,
    });

    await expect(createSupabaseAuthService(fake.asClient()).signIn(
      '  Koversada-Radnik  ',
      'test-password',
    )).resolves.toEqual({
      status: 'authenticated',
      user: {
        id: 'koversada-worker',
        email: 'operational-account@example.test',
      },
    });
    expect(fake.rpc).toHaveBeenCalledWith('resolve_login_username', {
      p_username: 'koversada-radnik',
    });
    expect(fake.signInWithPassword).toHaveBeenCalledWith({
      email: 'operational-account@example.test',
      password: 'test-password',
    });
  });

  it('uses the same generic failure for an unknown username', async () => {
    const fake = new FakeAuthClient();
    const result = await createSupabaseAuthService(fake.asClient()).signIn(
      'unknown-worker',
      'wrong-password',
    );

    expect(result).toEqual({
      status: 'failed',
      message: 'Unable to sign in. Check your email/username and password and try again.',
    });
    expect(fake.signInWithPassword).not.toHaveBeenCalled();
  });

  it('uses the same generic failure when a known username has a wrong password', async () => {
    const fake = new FakeAuthClient();
    fake.usernameResolutionHandler = async () => ({
      data: 'operational-account@example.test',
      error: null,
    });

    const result = await createSupabaseAuthService(fake.asClient()).signIn(
      'koversada-radnik',
      'wrong-password',
    );

    expect(fake.signInWithPassword).toHaveBeenCalledWith({
      email: 'operational-account@example.test',
      password: 'wrong-password',
    });
    expect(result).toEqual({
      status: 'failed',
      message: 'Unable to sign in. Check your email/username and password and try again.',
    });
  });

  it('deduplicates simultaneous sign-in submissions', async () => {
    const fake = new FakeAuthClient();
    const response = deferred<SignInResponse>();
    fake.signInHandler = () => response.promise;
    const service = createSupabaseAuthService(fake.asClient());

    const first = service.signIn('person@example.test', 'test-password');
    const second = service.signIn('person@example.test', 'test-password');
    expect(fake.signInWithPassword).toHaveBeenCalledOnce();

    const signedInSession = session();
    response.resolve({
      data: { session: signedInSession, user: signedInSession.user },
      error: null,
    });

    await expect(Promise.all([first, second])).resolves.toEqual([
      { status: 'authenticated', user: { id: 'user-1', email: 'person@example.test' } },
      { status: 'authenticated', user: { id: 'user-1', email: 'person@example.test' } },
    ]);
  });

  it('signs out only the local Auth session and leaves application localStorage intact', async () => {
    const fake = new FakeAuthClient();
    const stored = new Map([['sunbed-beach-manager:v5', 'existing-local-app-data']]);
    const localStorage = {
      getItem: vi.fn((key: string) => stored.get(key) ?? null),
      setItem: vi.fn((key: string, value: string) => stored.set(key, value)),
      removeItem: vi.fn((key: string) => stored.delete(key)),
    } as unknown as Storage;
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      value: localStorage,
    });
    const states: AuthSessionState[] = [];
    const service = createSupabaseAuthService(fake.asClient());
    const unsubscribe = service.observe((state) => states.push(state));
    await flushPromises();

    try {
      await expect(service.signOut()).resolves.toEqual({ status: 'signed-out' });
      fake.emit('SIGNED_OUT', null);

      expect(fake.signOut).toHaveBeenCalledWith({ scope: 'local' });
      expect(states[states.length - 1]).toEqual({ status: 'unauthenticated' });
      expect(localStorage.getItem('sunbed-beach-manager:v5')).toBe(
        'existing-local-app-data',
      );
      expect(localStorage.removeItem).not.toHaveBeenCalled();
    } finally {
      unsubscribe();
      Reflect.deleteProperty(globalThis, 'localStorage');
    }
  });

  it('maps sign-out provider failures to a generic error', async () => {
    const fake = new FakeAuthClient();
    fake.signOutHandler = async () => ({
      error: { message: 'provider sign-out internals' },
    });

    const result = await createSupabaseAuthService(fake.asClient()).signOut();

    expect(result).toEqual({
      status: 'unavailable',
      message: 'Unable to sign out. Please try again.',
    });
    expect(JSON.stringify(result)).not.toContain('provider sign-out internals');
  });
});
