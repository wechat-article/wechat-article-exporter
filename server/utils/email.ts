import nodemailer from 'nodemailer';

interface EmailOptions {
  subject: string;
  html: string;
}

function getSmtpConfig() {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT) || 465;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const to = process.env.SMTP_TO;

  if (!host || !user || !pass || !to) {
    return null;
  }

  return { host, port, user, pass, to };
}

export async function sendEmail(options: EmailOptions): Promise<boolean> {
  const config = getSmtpConfig();
  if (!config) {
    console.warn('[email] SMTP 未配置，跳过邮件发送');
    return false;
  }

  const transporter = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.port === 465,
    auth: {
      user: config.user,
      pass: config.pass,
    },
  });

  try {
    await transporter.sendMail({
      from: `"WAE 定时任务" <${config.user}>`,
      to: config.to,
      subject: options.subject,
      html: options.html,
    });
    console.log(`[email] 邮件发送成功: ${options.subject}`);
    return true;
  } catch (e) {
    console.error('[email] 邮件发送失败:', e);
    return false;
  }
}

export function sendCookieExpiryWarning(expiryDetails: string): Promise<boolean> {
  const now = new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai', hour12: false });
  return sendEmail({
    subject: '⚠️ 微信公众号 Cookie 即将过期，请重新登录',
    html: `
      <div style="font-family: sans-serif; padding: 20px; max-width: 600px;">
        <h2 style="color: #e65100;">⚠️ Cookie 即将过期提醒</h2>
        <p>检测到微信公众号平台的登录 Cookie 即将过期（剩余时间不足 24 小时），请尽快重新扫码登录以保证定时同步正常运行。</p>
        <div style="background: #fff3e0; padding: 12px 16px; border-radius: 6px; margin: 16px 0;">
          <p style="margin: 0; font-size: 14px; color: #333;"><strong>过期详情：</strong></p>
          <pre style="margin: 8px 0 0; font-size: 13px; white-space: pre-wrap; color: #555;">${expiryDetails}</pre>
        </div>
        <p style="color: #999; font-size: 12px;">检测时间：${now}</p>
        <p style="color: #999; font-size: 12px;">此邮件由 wechat-article-exporter 定时任务自动发送。</p>
      </div>
    `,
  });
}

export function sendSyncReport(report: { total: number; success: number; failed: number; details: string }): Promise<boolean> {
  const now = new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai', hour12: false });
  const statusColor = report.failed > 0 ? '#e65100' : '#2e7d32';
  const statusIcon = report.failed > 0 ? '⚠️' : '✅';
  return sendEmail({
    subject: `${statusIcon} 定时同步报告：成功 ${report.success}，失败 ${report.failed}`,
    html: `
      <div style="font-family: sans-serif; padding: 20px; max-width: 600px;">
        <h2 style="color: ${statusColor};">${statusIcon} 定时同步完成</h2>
        <p>共 <strong>${report.total}</strong> 个公众号，成功 <strong>${report.success}</strong>，失败 <strong>${report.failed}</strong>。</p>
        <div style="background: #f5f5f5; padding: 12px 16px; border-radius: 6px; margin: 16px 0;">
          <pre style="margin: 0; font-size: 13px; white-space: pre-wrap; color: #333;">${report.details}</pre>
        </div>
        <p style="color: #999; font-size: 12px;">执行时间：${now}</p>
      </div>
    `,
  });
}
