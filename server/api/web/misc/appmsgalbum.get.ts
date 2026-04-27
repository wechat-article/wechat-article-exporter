/**
 * 获取合集数据接口
 */

import { fetchAppMsgAlbumResponse } from '~/server/services/api/mp-service';

interface AppMsgAlbumQuery {
  fakeid: string;
  album_id: string;
  is_reverse?: string;
  count?: number;
  begin_msgid?: string;
  begin_itemidx?: string;
}

export default defineEventHandler(async event => {
  const query = getQuery<AppMsgAlbumQuery>(event);
  const fakeid = query.fakeid;
  const album_id = query.album_id;
  const isReverse = query.is_reverse || '0';
  const begin_msgid = query.begin_msgid;
  const begin_itemidx = query.begin_itemidx;
  const count: number = query.count || 20;

  return fetchAppMsgAlbumResponse(event, {
    fakeid,
    album_id,
    is_reverse: isReverse,
    begin_msgid,
    begin_itemidx,
    count,
  }).catch(e => {
    return {
      base_resp: {
        ret: -1,
        err_msg: '获取合集接口失败，请重试',
      },
    };
  });
});
