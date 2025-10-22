import { defineNitroPlugin } from '#imports';

let hasLogged = false; // 标志，避免重复打印

export default defineNitroPlugin(nitroApp => {
  if (hasLogged) return;
  hasLogged = true;

  const config = useRuntimeConfig();
  console.log('=== Server Runtime Config ===');
  console.log(JSON.stringify(config, null, 2)); // 美化 JSON 输出，便于阅读
  console.log('=== End Runtime Config ===');
});
