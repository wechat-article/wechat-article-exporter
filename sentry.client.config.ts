import * as Sentry from '@sentry/nuxt';
import { useRuntimeConfig } from '#imports';

const dsn = useRuntimeConfig().public.sentry.dsn;

// 记录已上报的风控错误，避免同类错误重复上报导致 Sentry 配额耗尽
const reportedDownloadErrors = new Set<string>();

if (process.env.NODE_ENV === 'production' && dsn) {
  Sentry.init({
    dsn: dsn,
    environment: process.env.NODE_ENV || 'development',

    // Adds request headers and IP for users, for more info visit:
    // https://docs.sentry.io/platforms/javascript/guides/nuxt/configuration/options/#sendDefaultPii
    sendDefaultPii: true,

    integrations: [
      Sentry.browserTracingIntegration({ router: useRouter() }), // 路由追踪
      Sentry.replayIntegration(),
      // Sentry.feedbackIntegration({
      //   colorScheme: 'system',
      // }),

      // send console.log, console.warn, and console.error calls as logs to Sentry
      Sentry.consoleLoggingIntegration({ levels: ['warn', 'error'] }),
    ],

    // Set tracesSampleRate to 1.0 to capture 100%
    // of transactions for tracing.
    // We recommend adjusting this value in production
    // Learn more at
    // https://docs.sentry.io/platforms/javascript/configuration/options/#traces-sample-rate
    tracesSampleRate: 0.5,

    // Capture Replay for 10% of all sessions,
    // plus for 100% of sessions with an error
    // Learn more at
    // https://docs.sentry.io/platforms/javascript/session-replay/configuration/#general-integration-configuration
    replaysSessionSampleRate: 0.1,
    replaysOnErrorSampleRate: 1.0,

    // Enable logs to be sent to Sentry
    enableLogs: true,

    beforeSendLog(log) {
      const message = typeof log.message === 'string' ? log.message : '';
      if (message.includes('下载失败') || message.includes('解析失败') || message.includes('Attempt')) {
        return null; // 丢弃所有下载失败相关的 console 日志
      }
      return log;
    },

    beforeSend(event) {
      const message = event.exception?.values?.[0]?.value || '';
      // 风控导致的下载失败，按域名去重，每个域名只上报一次
      if (message.includes('下载失败') || message.includes('解析失败')) {
        const urlMatch = message.match(/url:\s*(https?:\/\/[^\s)]+)/);
        const domain = urlMatch ? new URL(urlMatch[1]).hostname : 'unknown';
        const key = `${domain}:${event.exception?.values?.[0]?.type}`;
        if (reportedDownloadErrors.has(key)) {
          return null; // 丢弃重复事件
        }
        reportedDownloadErrors.add(key);
      }
      return event;
    },
  });
}
