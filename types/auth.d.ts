declare module '#auth-utils' {
  interface User {
    provider: string;
    username: string;
    name: string;
    avatar: string;
    email: string;
    plan: 'free' | 'pro';
  }
  interface UserSession {
    loggedInAt: number;
  }
  interface SecureSessionData {
    // Add your own fields
  }
}
export {};
