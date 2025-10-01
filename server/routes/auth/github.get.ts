import { writeToFile } from '~/server/utils/file';

export default defineOAuthGitHubEventHandler({
  config: {
    emailRequired: true, // 要求 GitHub 返回用户邮箱
  },
  async onSuccess(event, { user, tokens }) {
    // 在认证成功后设置用户会话
    writeToFile({ user, tokens });
    await setUserSession(event, {
      user: {
        provider: 'GitHub',
        username: user.login,
        name: user.name,
        avatar: user.avatar_url,
        email: user.email,
        plan: 'pro',
      },
      loggedInAt: Date.now(),
    });
    // 重定向到首页
    return sendRedirect(event, '/dashboard/profile');
  },
  onError(event, error) {
    // 打印详细错误
    console.warn('GitHub OAuth full error:', error);
    console.warn(getRequestURL(event));

    return sendRedirect(event, `/error?error=${encodeURIComponent(error.message)}`);
  },
});
