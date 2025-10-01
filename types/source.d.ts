export interface SubscribeSourceConfig {
  id: string;
  name: string;
  enabled: boolean;
  cron: string;
  channels: SubscribeChannel[];
  accounts: SubscribeAccount[];
}

export interface SubscribeAccount {
  fakeid: string;
  name: string;
  avatar: string;
}

export interface SubscribeChannel {
  id: string;
  name: string;
  type: '邮箱' | 'webhook' | '钉钉群机器人';
}

export interface SaveSourceResponse {
  code: number;
  msg: string;
}

export interface GetSourceListResponse {
  code: number;
  data: SubscribeSourceConfig[];
  msg: string;
}
