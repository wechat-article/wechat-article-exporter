-- ============================================
-- 修复 title 列长度问题
-- 将所有表的 title 列扩展到 VARCHAR(1000)
-- ============================================

-- 文章表
ALTER TABLE `article` MODIFY COLUMN `title` VARCHAR(1000) DEFAULT NULL COMMENT '文章标题';

-- 元数据表
ALTER TABLE `metadata` MODIFY COLUMN `title` VARCHAR(1000) DEFAULT NULL COMMENT '文章标题';

-- HTML内容表
ALTER TABLE `html` MODIFY COLUMN `title` VARCHAR(1000) DEFAULT NULL COMMENT '文章标题';

-- 评论表
ALTER TABLE `comment` MODIFY COLUMN `title` VARCHAR(1000) DEFAULT NULL COMMENT '文章标题';

-- 评论回复表
ALTER TABLE `comment_reply` MODIFY COLUMN `title` VARCHAR(1000) DEFAULT NULL COMMENT '文章标题';

-- 调试数据表
ALTER TABLE `debug` MODIFY COLUMN `title` VARCHAR(1000) DEFAULT NULL COMMENT '标题';
