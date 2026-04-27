export interface ApiTokenKVValue {
  authKey: string;
  expiresAt: number;
}

export async function setApiToken(token: string, data: ApiTokenKVValue, ttlSeconds: number): Promise<boolean> {
  const kv = useStorage('kv');
  try {
    await kv.set<ApiTokenKVValue>(`api-token:${token}`, data, {
      expirationTtl: ttlSeconds,
    });
    return true;
  } catch (error) {
    console.error('setApiToken failed:', error);
    return false;
  }
}

export async function getApiToken(token: string): Promise<ApiTokenKVValue | null> {
  const kv = useStorage('kv');
  return await kv.get<ApiTokenKVValue>(`api-token:${token}`);
}

export async function deleteApiToken(token: string): Promise<void> {
  const kv = useStorage('kv');
  await kv.remove(`api-token:${token}`);
}

export async function setApiTokenByAuthKey(authKey: string, token: string, ttlSeconds: number): Promise<boolean> {
  const kv = useStorage('kv');
  try {
    await kv.set<string>(`api-token-by-auth:${authKey}`, token, {
      expirationTtl: ttlSeconds,
    });
    return true;
  } catch (error) {
    console.error('setApiTokenByAuthKey failed:', error);
    return false;
  }
}

export async function getApiTokenByAuthKey(authKey: string): Promise<string | null> {
  const kv = useStorage('kv');
  return await kv.get<string>(`api-token-by-auth:${authKey}`);
}

export async function deleteApiTokenByAuthKey(authKey: string): Promise<void> {
  const kv = useStorage('kv');
  await kv.remove(`api-token-by-auth:${authKey}`);
}
