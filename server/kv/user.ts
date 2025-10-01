export interface UserEntry {
  uuid: string;
  fakeid: string;
  originalID: string;
  nickname: string;
  avatar: string;
  createdAt: number;
  lastLoginAt?: number;
}

/**
 * 创建新用户
 * @param user
 */
export async function createUser(user: UserEntry): Promise<boolean> {
  const kv = useStorage('kv')
  await kv.set<UserEntry>(`users:${user.originalID}`, user)
  return true
}

export async function getUser(originalID: string): Promise<UserEntry | null> {
  const kv = useStorage('kv')
  return await kv.get<UserEntry>(`users:${originalID}`)
}
