// 统一的账号相关事件，用于不同组件之间同步状态
export type AccountEvent =
  | {
      type: 'account-added';
      fakeid: string;
    }
  | {
      type: 'account-removed';
      fakeid: string;
    };
