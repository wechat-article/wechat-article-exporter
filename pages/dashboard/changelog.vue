<template>
  <div class="flex flex-col h-full">
    <Teleport defer to="#title">
      <h1 class="text-[28px] leading-[34px] text-slate-12 dark:text-slate-50 font-bold">变更记录</h1>
    </Teleport>
    <div class="flex-1 px-6 overflow-scroll">
      <div v-for="(entry, idx) in changelog" :key="idx" class="flex py-3 flex-col md:flex-row">
        <div class="grow">
          <div class="md:sticky md:top-[0px]">
            <p class="font-semibold text-3xl sm:text-xl">{{ entry.date }}</p>
          </div>
        </div>
        <div class="md:basis-3/4">
          <div class="break-words">
            <p>{{ entry.description }}</p>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { websiteName } from '~/config';

useHead({
  title: `变更记录 | ${websiteName}`,
});

interface ChangeLogEntry {
  date: string;
  description: string;
}

const changelog: ChangeLogEntry[] = [
  {
    date: '2025-09-13',
    description: '增加公众号免扫码切换功能',
  },
  {
    date: '2025-09-11',
    description: '重构后端接口，使用 CookieStore 统一网站与API接口调用',
  },
  {
    date: '2025-09-05',
    description: '文章下载页面支持多公众号选择，支持按公众号分组显示',
  },
  {
    date: '2025-08-27',
    description: '增加同步时间范围设置项',
  },
  {
    date: '2025-07-31',
    description: '增加在线接口调试工具',
  },
  {
    date: '2025-07-28',
    description: '提供初步的 API 支持',
  },
  {
    date: '2025-07-24',
    description: '重构登录逻辑，去掉文章卡片页面',
  },
  {
    date: '2025-07-16',
    description: '增加公众号管理页面，支持批量获取文章链接，支持多公众号同时获取',
  },
  {
    date: '2025-07-13',
    description: '初步支持 docx 导出',
  },
  {
    date: '2025-07-12',
    description: '支持 markdown 导出',
  },
  {
    date: '2025-07-11',
    description: '优化文章下载页面的表格性能，支持大数据量的渲染；优化excel/json导出，可以配置导出文章内容和留言数据',
  },
  {
    date: '2025-07-09',
    description: '重构数据库，采用dexie库',
  },
  {
    date: '2025-07-01',
    description: '增加 websocket 方式获取 credentials',
  },
  {
    date: '2025-04-11',
    description: '支持抓取全量评论',
  },
  {
    date: '2025-04-10',
    description: '支持获取评论回复，增加文章预览',
  },
  {
    date: '2025-04-09',
    description: '支持导出txt',
  },
  {
    date: '2025-04-09',
    description: '更新文档站点域名，https://docs.champ.design 改为 https://docs.wxdown.online',
  },
  {
    date: '2025-04-01',
    description: '支持导出json，支持获取阅读量',
  },
  {
    date: '2025-03-28',
    description: '网站迁移到 Cloudflare 部署，不再使用 Deno Deploy',
  },
  {
    date: '2025-03-27',
    description: '项目开发转入私有仓库',
  },
  {
    date: '2025-02-22',
    description: '独立的文档站点上线',
  },
  {
    date: '2024-11-16',
    description: '增加技术支持与赞助页面',
  },
  {
    date: '2024-11-14',
    description: '支持配置私有代理节点',
  },
  {
    date: '2024-11-12',
    description: '增加网站统计(umami)',
  },
  {
    date: '2024-10-31',
    description: '支持获取评论',
  },
  {
    date: '2024-10-28',
    description: '支持导出 Excel',
  },
  {
    date: '2024-10-20',
    description: '支持视频分享消息',
  },
  {
    date: '2024-09-26',
    description: '支持下载内嵌音视频，增加文章类型字段，支持图片分享消息',
  },
  {
    date: '2024-09-22',
    description: '增加登录信息过期时间提示',
  },
  {
    date: '2024-09-19',
    description: '增加合集页面，UI改版(dashboard)',
  },
  {
    date: '2024-09-04',
    description: '增加私有部署文档',
  },
  {
    date: '2024-09-02',
    description: '引入代理池，修复图片防盗链',
  },
  {
    date: '2024-07-30',
    description: '增加接口调用统计，增加删除文章隐藏功能',
  },
  {
    date: '2024-07-25',
    description: '部署到 Deno Deploy',
  },
  {
    date: '2024-07-24',
    description: '增加批量下载功能',
  },
  {
    date: '2024-07-17',
    description: '实现最小可运行版本(MVP)',
  },
];
</script>
