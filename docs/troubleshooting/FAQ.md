# 常见问题解答 (FAQ)

## 登录相关

### Q: 重启服务器后需要重新登录？

**原因**：KV 存储使用了内存驱动，服务重启后会话数据丢失。

**解决**：
1. 检查 `.env` 文件，确保没有设置 `NITRO_KV_DRIVER=memory`
2. 开发环境会自动使用 `fs` 驱动，数据存储在 `.data/kv`
3. 修改配置后需要**重新登录一次**

---

### Q: 提示 "owner_id not found"？

**原因**：会话中没有 `ownerId` 信息。

**解决**：
1. 清除浏览器 Cookie
2. 重启服务器
3. 重新扫码登录

---

### Q: 开发环境 Cookie 不生效？

**原因**：Cookie 设置了 `Secure` 属性，但开发环境使用 HTTP。

**解决**：代码已自动处理，确保 `isDev` 配置正确。

---

## 数据库相关

### Q: "Data too long for column 'title'"？

**原因**：`title` 列长度不足。

**解决**：执行迁移脚本
```sql
ALTER TABLE `article` MODIFY COLUMN `title` VARCHAR(1000);
-- 其他表同理
```
完整脚本见 `server/db/migration_fix_title_length.sql`

---

### Q: "Bind parameters must not contain undefined"？

**原因**：传入 MySQL 的参数包含 `undefined`。

**解决**：代码层面使用 `?? null` 将 `undefined` 转换为 `null`。

---

### Q: 文章导出提示 "html 还未下载"？

**原因**：HTML 内容未正确保存或读取。

**排查**：
1. 检查 MySQL 中 `html` 表是否有数据
2. 检查 API 响应是否正常返回 `file` 字段
3. 确认 `file` 字段是 Base64 编码的字符串

---

## 性能相关

### Q: 抓取速度慢？

**建议**：
1. 调整并发数（默认 5）
2. 使用代理池
3. 避免频繁请求导致限流

---

### Q: 数据库查询慢？

**建议**：
1. 确保索引已创建（见 `schema.sql`）
2. 定期清理旧数据
3. 使用 `EXPLAIN` 分析慢查询

---

## 调试技巧

### 查看会话数据

```powershell
# 检查 KV 存储文件
Get-ChildItem ".data\kv" -Recurse
```

### 检查 Cookie

浏览器 DevTools → Application → Cookies → 查看 `auth-key`

### 查看服务端日志

```bash
# 开启调试日志
NUXT_DEBUG_MP_REQUEST=true pnpm dev
```
