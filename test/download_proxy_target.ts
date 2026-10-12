import assert from 'node:assert/strict';
import {
  buildDownloadProxyHeaders,
  normalizeDownloadTargetUrl,
  validateDownloadTargetUrl,
} from '../server/utils/download-proxy';

function run() {
  assert.equal(normalizeDownloadTargetUrl('//mmbiz.qpic.cn/demo.png').toString(), 'https://mmbiz.qpic.cn/demo.png');
  assert.equal(validateDownloadTargetUrl('https://mp.weixin.qq.com/s/demo').hostname, 'mp.weixin.qq.com');
  assert.equal(validateDownloadTargetUrl('https://mmbiz.qpic.cn/demo.png').hostname, 'mmbiz.qpic.cn');

  assert.throws(() => validateDownloadTargetUrl('http://127.0.0.1:3000/secret'), /不允许代理/);
  assert.throws(() => validateDownloadTargetUrl('ftp://mp.weixin.qq.com/demo'), /只支持/);

  const headers = buildDownloadProxyHeaders('{"cookie":"pass_ticket=a;wap_sid2=b"}');
  assert.equal(headers.get('Cookie'), 'pass_ticket=a;wap_sid2=b');
  assert.equal(headers.get('Referer'), 'https://mp.weixin.qq.com/');
}

run();
