export class UniqueIdGenerator {
  static generateId(length = 15, includeTimestamp = false) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';

    if (includeTimestamp) {
      const timestamp = Date.now().toString(36);
      result += timestamp;
    }

    // 填充到指定长度
    while (result.length < length) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }

    return result.substring(0, length);
  }

  // 生成短ID（8位）
  static generateShortId(includeTimestamp = false) {
    return this.generateId(8, includeTimestamp);
  }

  // 生成长ID（20位）
  static generateLongId(includeTimestamp = false) {
    return this.generateId(20, includeTimestamp);
  }
}
