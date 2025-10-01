export interface DailyRatio {
  date: string;
  ratio: string;
  label: string;
}

export interface ResultProxyStatus {
  name: string;
  currentStatus: string;
  dailyRatios: DailyRatio[];
}
