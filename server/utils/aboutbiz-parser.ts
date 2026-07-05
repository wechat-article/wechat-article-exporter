import * as cheerio from 'cheerio';
import { extractBalancedJsLiteral, parseWechatJSObject } from '#shared/utils/js-literal';

export function extractAboutBizInfo(rawHTML: string): Record<string, any> {
  const $ = cheerio.load(rawHTML);
  let $itemInfo = $('.about-page > .item-info:first');

  const result: Record<string, any> = {};

  while ($itemInfo.length > 0) {
    const title = $itemInfo.find('.item-title').text().trim();

    if (['公众号简介', '服务号简介'].includes(title)) {
      result.intro = $itemInfo.find('.item-desc').text().trim();
    } else if (title === '基础信息') {
      // nop
    } else if (title === '微信号') {
      result.wechat = $itemInfo.find('.item-desc').text().trim();
    } else if (['账号类型', '认证类型', '主体类型'].includes(title)) {
      result.type = $itemInfo.find('.item-desc').text().trim();
    } else if (['账号主体', '认证主体'].includes(title)) {
      result.org = $itemInfo.find('.item-desc').text().trim();
    } else if (title === 'IP属地') {
      // ip属地需要从 js 中获取
    } else if (title === '授权第三方服务') {
      result.auth_3rd_list = $itemInfo
        .extract({
          name: ['.principal-data'],
        })
        .name.map(item => item.trim());
    } else if (title === '名称记录') {
      result.name_records = $itemInfo
        .extract({
          name: ['.js_item'],
        })
        .name.map(item => item.trim());
    } else if (title === '客服电话') {
      result.phone = $itemInfo.find('.item-desc').text().trim();
    } else {
      console.log(`title: <${title}>`);
      console.log($itemInfo.text());
    }

    $itemInfo = $itemInfo.next('.item-info');
  }

  Object.assign(result, extractAboutBizScriptData(rawHTML));
  return result;
}

export function extractAboutBizScriptData(rawHTML: string): Record<string, any> {
  const result: Record<string, any> = {};
  const auth3rdList = extractAuth3rdList(rawHTML);
  if (auth3rdList.length > 0) {
    result.auth_3rd_list = auth3rdList;
  }

  const ipWording = extractWindowObjectAssignment(rawHTML, 'window.ip_wording');
  if (ipWording) {
    result.ip_wording = ipWording;
  }

  return result;
}

function extractAuth3rdList(source: string): any[] {
  const result: any[] = [];
  const marker = 'window.cgiData.auth_3rd_list.push';
  let searchIndex = 0;

  while (searchIndex < source.length) {
    const pushIndex = source.indexOf(marker, searchIndex);
    if (pushIndex < 0) break;

    const callStart = source.indexOf('(', pushIndex + marker.length);
    const objectStart = callStart >= 0 ? source.indexOf('{', callStart) : -1;
    if (objectStart < 0) break;

    const literal = extractBalancedJsLiteral(source, objectStart);
    if (!literal) {
      searchIndex = objectStart + 1;
      continue;
    }

    try {
      result.push(parseWechatJSObject(literal));
    } catch {
      // Ignore one malformed authorization entry and keep parsing later entries.
    }
    searchIndex = objectStart + literal.length;
  }

  return result;
}

function extractWindowObjectAssignment(source: string, marker: string): any | null {
  const markerIndex = source.indexOf(marker);
  if (markerIndex < 0) return null;

  const assignIndex = source.indexOf('=', markerIndex + marker.length);
  const objectStart = assignIndex >= 0 ? source.indexOf('{', assignIndex) : -1;
  if (objectStart < 0) return null;

  const literal = extractBalancedJsLiteral(source, objectStart);
  if (!literal) return null;

  try {
    return parseWechatJSObject(literal);
  } catch {
    return null;
  }
}
