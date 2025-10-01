import { writeToFile } from '~/server/utils/file';

export default defineOAuthGoogleEventHandler({
  async onSuccess(event, { user, tokens }) {
    // 在认证成功后设置用户会话
    writeToFile({ user, tokens });
    await setUserSession(event, {
      user: {
        provider: 'Google',
        username: user.name,
        name: user.name,
        avatar: user.picture,
        email: user.email,
        plan: 'free',
      },
      loggedInAt: Date.now(),
    });
    // 重定向到首页
    return sendRedirect(event, '/dashboard/profile');
  },
  onError(event, error) {
    console.warn('Google OAuth error:', error);
    console.warn(getRequestURL(event));

    return sendRedirect(event, `/error?error=${encodeURIComponent(error.message)}`);
  },
});
