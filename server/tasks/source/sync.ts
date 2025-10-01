import { getAllSource } from '~/server/kv/source';
import { SubscribeSourceConfig } from '~/types/source';

export default defineTask({
  meta: {
    name: 'source:sync',
    description: 'Run source sync',
  },
  async run({ payload, context }) {
    await handleTask();
    return { result: 'Success' };
  },
});

async function handleTask() {
  const sources = await getAllSource();
  formatLog(sources);
  sources.forEach(source => {
    handleSource(source);
  });
}

function formatLog(sources: SubscribeSourceConfig[]) {
  console.log('本次抓取的详情如下:');
  console.log();
  sources.forEach(source => {
    console.log(`订阅源名称: ${source.name}`);
    console.log('要抓取的公众号列表:');
    console.log(
      source.accounts.map(account => ({
        name: account.name,
        fakeid: account.fakeid,
      }))
    );
    console.log('推送渠道:');
    console.log(source.channels.map(channel => channel.type));
    console.log();
  });
}

function handleSource(source: SubscribeSourceConfig): void {
  console.log(`开始处理 ${source.name}(${source.id})`);

  // 根据用户邮箱获取当前有效的cookie

  // 使用 cookie 获取订阅的公众号文章列表

  // 判断这些文章是否属于新文章
  // 借助推送历史记录进行判断
  // history:email:fakeid:lastTime

  // 发送新文章的链接给配置的渠道
}
