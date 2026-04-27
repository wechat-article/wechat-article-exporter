import assert from 'node:assert/strict';

import {
  buildAppMsgPublishParams,
  buildSearchBizParams,
  extractPublishedArticles,
  filterSearchBizResponseByNickname,
} from '../../server/services/api/mp-core';

function run() {
  assert.deepEqual(buildSearchBizParams({ token: 't-1', keyword: 'rail', begin: 2, size: 8 }), {
    action: 'search_biz',
    begin: 2,
    count: 8,
    query: 'rail',
    token: 't-1',
    lang: 'zh_CN',
    f: 'json',
    ajax: '1',
  });

  assert.deepEqual(buildAppMsgPublishParams({ token: 't-1', fakeid: 'f-1', begin: 0, size: 5 }), {
    sub: 'list',
    search_field: 'null',
    begin: 0,
    count: 5,
    query: '',
    fakeid: 'f-1',
    type: '101_1',
    free_publish_type: 1,
    sub_action: 'list_ex',
    token: 't-1',
    lang: 'zh_CN',
    f: 'json',
    ajax: 1,
  });

  assert.equal(buildAppMsgPublishParams({ token: 't-1', fakeid: 'f-1', keyword: 'agent' }).sub, 'search');
  assert.equal(buildAppMsgPublishParams({ token: 't-1', fakeid: 'f-1', keyword: 'agent' }).search_field, '7');

  const articles = extractPublishedArticles({
    publish_page: JSON.stringify({
      publish_list: [
        { publish_info: JSON.stringify({ appmsgex: [{ title: 'A' }, { title: 'B' }] }) },
        { publish_info: '' },
        { publish_info: JSON.stringify({ appmsgex: [{ title: 'C' }] }) },
      ],
    }),
  });

  assert.deepEqual(articles, [{ title: 'A' }, { title: 'B' }, { title: 'C' }]);

  const originalResponse = {
    base_resp: { ret: 0, err_msg: 'ok' },
    total: 2,
    list: [{ nickname: 'A' }, { nickname: 'B' }],
  };

  const response = filterSearchBizResponseByNickname(originalResponse, 'C');
  assert.equal(response.base_resp.ret, -1);
  assert.equal(response.base_resp.err_msg, '根据解析的名称搜索公众号失败');
  assert.equal(response.total, 0);
  assert.equal(response.resolved_name, 'C');
  assert.deepEqual(response.original_resp, originalResponse);

  console.log('mp-core regression checks passed');
}

run();
