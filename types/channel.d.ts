export interface ChannelConfig {
  id: string;
  name: string;
  type: '邮箱' | 'webhook' | '钉钉群机器人';
  status: 'normal' | 'fatal';
  email?: string;
  webhookUrl?: string;
  secret?: string;
}

export interface SaveChannelResponse {
  code: number;
  msg: string;
}

export interface GetChannelListResponse {
  code: number;
  data: ChannelConfig[];
  msg: string;
}
