export interface SendDingMessageResponse {
  errcode: number;
  errmsg: string;
}

export async function sendDingMessage(data: any) {
  const resp = await $fetch<SendDingMessageResponse>('/api/web/channel/demo/send-ding-talk', {
    method: 'POST',
    body: JSON.stringify(data),
  });
  return resp;
}

export async function sendWebhookMessage(data: any) {
  const resp = await $fetch<SendDingMessageResponse>('/api/web/channel/demo/webhook', {
    method: 'POST',
    body: JSON.stringify(data),
  });
  return resp;
}
