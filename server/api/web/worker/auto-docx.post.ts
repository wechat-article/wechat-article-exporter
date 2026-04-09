import { generateDocxForAccount, getDocxOutputDir, getAutoExportFormats } from '~/server/utils/docx-generator';

/**
 * POST /api/web/worker/auto-docx
 *
 * 为指定公众号自动生成增量导出文件（格式由 AUTO_EXPORT_FORMATS 环境变量配置）
 * 请求体: { fakeid: string }
 * 响应: { total, generated, skipped, failed, formats, errors }
 */
export default defineEventHandler(async (event) => {
  const outputDir = getDocxOutputDir();
  if (!outputDir) {
    console.warn('[auto-export] AUTO_EXPORT_DIR 环境变量未配置，跳过自动导出');
    throw createError({
      statusCode: 500,
      message: 'AUTO_EXPORT_DIR 环境变量未配置，无法自动导出文件',
    });
  }

  const formats = getAutoExportFormats();
  if (formats.length === 0) {
    console.warn('[auto-export] AUTO_EXPORT_FORMATS 未配置有效格式');
    throw createError({
      statusCode: 500,
      message: 'AUTO_EXPORT_FORMATS 未配置有效格式（支持: html,txt,markdown,word,json,excel）',
    });
  }

  const body = await readBody(event);
  const fakeid = body?.fakeid;
  const syncToTimestamp = body?.syncToTimestamp ? Number(body.syncToTimestamp) : undefined;
  if (!fakeid || typeof fakeid !== 'string') {
    console.error('[auto-export] 请求参数错误: 缺少 fakeid');
    throw createError({
      statusCode: 400,
      message: '缺少 fakeid 参数',
    });
  }

  const syncInfo = syncToTimestamp ? `，同步截止时间: ${new Date(syncToTimestamp * 1000).toLocaleDateString()}` : '';
  console.log(`[auto-export] 收到请求，fakeid: ${fakeid}，格式: [${formats.join(',')}]，输出目录: ${outputDir}${syncInfo}`);

  try {
    const result = await generateDocxForAccount(fakeid, syncToTimestamp);
    console.log(`[auto-export] 请求完成，fakeid: ${fakeid}，格式: [${result.formats.join(',')}]，结果: 生成=${result.generated} 跳过=${result.skipped} 失败=${result.failed}`);
    return result;
  } catch (e: any) {
    console.error('[auto-export] 生成失败:', e);
    throw createError({
      statusCode: 500,
      message: e.message || '导出文件时发生错误',
    });
  }
});
