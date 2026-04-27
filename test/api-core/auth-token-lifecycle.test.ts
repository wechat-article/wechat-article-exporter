import assert from 'node:assert/strict';

type StorageMap = Map<string, any>;

function createStorageRegistry() {
  const stores = new Map<string, StorageMap>();

  return (name: string) => {
    let store = stores.get(name);
    if (!store) {
      store = new Map<string, any>();
      stores.set(name, store);
    }

    return {
      async get<T>(key: string): Promise<T | null> {
        return store!.has(key) ? (store!.get(key) as T) : null;
      },
      async set<T>(key: string, value: T): Promise<void> {
        store!.set(key, value);
      },
      async remove(key: string): Promise<void> {
        store!.delete(key);
      },
    };
  };
}

function createEvent(headers: Record<string, string>) {
  return {
    node: {
      req: {
        headers,
      },
      res: {},
    },
  } as any;
}

async function run() {
  (globalThis as any).useStorage = createStorageRegistry();
  (globalThis as any).getRequestHeader = (event: any, name: string) => {
    return event?.node?.req?.headers?.[name.toLowerCase()];
  };

  const {
    getTokenFromEvent,
    issueApiTokenForAuthKey,
    persistSession,
    resolveAuthKeyFromEvent,
    revokeSessionFromEvent,
  } = await import('../../server/services/api/auth-session');

  const authKey = 'auth-key-1';
  await persistSession(authKey, 'wechat-token-1', ['sessionid=abc; Path=/', 'uuid=EXPIRED; Path=/'], 1000);

  const apiToken = await issueApiTokenForAuthKey(authKey, 1000);
  assert.ok(apiToken);

  const tokenEvent = createEvent({
    'x-auth-key': apiToken!,
  });

  assert.equal(await resolveAuthKeyFromEvent(tokenEvent, 1000), authKey);
  assert.equal(await getTokenFromEvent(tokenEvent, 1000), 'wechat-token-1');

  await revokeSessionFromEvent(tokenEvent, 1000);

  assert.equal(await resolveAuthKeyFromEvent(tokenEvent, 1000), null);
  assert.equal(await getTokenFromEvent(tokenEvent, 1000), null);

  console.log('auth-token lifecycle regression checks passed');
}

run();
