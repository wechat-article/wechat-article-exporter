-- ============================================
-- 清理 article 和 html 表重复数据
-- 基于 (owner_id, fakeid, title) 去重
-- ============================================

-- =====================
-- 1. 处理 article 表
-- =====================

-- 1.1 查看 article 表重复数据
SELECT 'article 表重复数据统计:' as info;
SELECT 
    owner_id, 
    fakeid,
    title,
    COUNT(*) as duplicate_count
FROM article 
GROUP BY owner_id, fakeid, title 
HAVING COUNT(*) > 1
LIMIT 10;

-- 1.2 删除 article 重复数据，保留最早的一条记录
DELETE a1 FROM article a1
INNER JOIN article a2 
WHERE a1.owner_id = a2.owner_id 
  AND a1.fakeid = a2.fakeid
  AND a1.title = a2.title 
  AND a1.create_time > a2.create_time;

-- 1.3 创建唯一索引（如果不存在）
-- 由于 title 可能很长，使用 title 的前 255 字符
ALTER TABLE article 
ADD UNIQUE INDEX idx_article_unique_title (owner_id, fakeid, title(255));


-- =====================
-- 2. 处理 html 表
-- =====================

-- 2.1 查看 html 表重复数据
SELECT 'html 表重复数据统计:' as info;
SELECT 
    owner_id, 
    fakeid,
    title,
    COUNT(*) as duplicate_count
FROM html 
GROUP BY owner_id, fakeid, title
HAVING COUNT(*) > 1
LIMIT 10;

-- 2.2 删除 html 重复数据，保留最早的一条
DELETE h1 FROM html h1
INNER JOIN html h2 
WHERE h1.owner_id = h2.owner_id 
  AND h1.fakeid = h2.fakeid
  AND h1.title = h2.title 
  AND h1.create_time > h2.create_time;

-- html 表已有 (owner_id, url_hash) 唯一索引


-- =====================
-- 3. 验证结果
-- =====================
SELECT 'article 表最终记录数:' as info;
SELECT COUNT(*) as total FROM article;

SELECT 'html 表最终记录数:' as info;
SELECT COUNT(*) as total FROM html;

SELECT '清理完成!' as status;
