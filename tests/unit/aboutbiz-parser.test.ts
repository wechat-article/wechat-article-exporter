import { describe, expect, it } from 'vitest';
import { extractAboutBizInfo, extractAboutBizScriptData } from '~/server/utils/aboutbiz-parser';

describe('aboutbiz parser', () => {
  const script = `
    <script type="text/javascript">
      var cgiData = {
        auth_3rd_list: []
      };
      window.cgiData.auth_3rd_list.push({
        principal: '抽奖助手',
        userName: 'gh_app@app',
        appId: 'wx-app',
        relativeURL: 'pages/profile/index?from=profile',
        category: [
          {
            id: '1' * 1,
            name: '消息管理',
            desc: '接收用户消息',
          },
        ],
      });
      window.ip_wording = {
        countryName: '中国',
        countryId: '156',
        provinceName: '广东',
        provinceId: '',
        cityName: '',
        cityId: ''
      };
      seajs.use('wxverify/info.js');
    </script>
  `;

  it('extracts script-only aboutbiz fields without executing the script', () => {
    const result = extractAboutBizScriptData(script);

    expect(result.ip_wording).toEqual({
      countryName: '中国',
      countryId: '156',
      provinceName: '广东',
      provinceId: '',
      cityName: '',
      cityId: '',
    });
    expect(result.auth_3rd_list).toHaveLength(1);
    expect(result.auth_3rd_list[0].principal).toBe('抽奖助手');
    expect(result.auth_3rd_list[0].category[0]).toEqual({
      id: 1,
      name: '消息管理',
      desc: '接收用户消息',
    });
  });

  it('combines DOM fields with script fields', () => {
    const html = `
      <div class="about-page">
        <div class="item-info">
          <div class="item-title">公众号简介</div>
          <div class="item-desc">用于文章归档</div>
        </div>
        <div class="item-info">
          <div class="item-title">微信号</div>
          <div class="item-desc">wechat_archive</div>
        </div>
        <div class="item-info">
          <div class="item-title">授权第三方服务</div>
          <div class="principal-data">DOM fallback</div>
        </div>
      </div>
      ${script}
    `;

    const result = extractAboutBizInfo(html);

    expect(result.intro).toBe('用于文章归档');
    expect(result.wechat).toBe('wechat_archive');
    expect(result.auth_3rd_list[0].principal).toBe('抽奖助手');
    expect(result.ip_wording.provinceName).toBe('广东');
  });
});
