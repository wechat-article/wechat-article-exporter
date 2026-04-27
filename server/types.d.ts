import { H3Event } from 'h3';

type Method = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export interface RequestOptions {
  event: H3Event;
  endpoint: string;
  method: Method;
  query?: Record<string, string | number | undefined>;
  body?: Record<string, string | number | undefined>;
  parseJson?: boolean;
  cookie?: string;
  referer?: string;
  redirect?: RequestRedirect;
  action?: 'start_login' | 'login' | 'switch_account';
}
