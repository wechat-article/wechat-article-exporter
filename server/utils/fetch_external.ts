interface FetchExternalOption {
  label: string;
  default: any;
}

export async function fetchExternal(url: string, option: FetchExternalOption): Promise<any> {
  try {
    const resp = await fetch(url, {
      signal: AbortSignal.timeout(30_000),
    });
    if (!resp.ok) {
      throw new Error(`${option.label}失败: ${resp.status}`);
    }

    return await resp.json();
  } catch (error) {
    // 记录日志，便于后期排查
    console.error(`${option.label}失败:`, error);

    return option.default;
  }
}
