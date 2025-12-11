-- ============================================
-- WeChat Article Exporter - 数据库迁移脚本
-- 迁移到多账号支持版本 (添加 owner_id)
-- ============================================

-- 注意: 此脚本用于将现有数据库升级到支持多账号的版本
-- 对于新安装，请直接使用 schema.sql

-- 1. 为 info 表添加 owner_id
ALTER TABLE `info` 
  ADD COLUMN `owner_id` VARCHAR(64) NOT NULL DEFAULT '' COMMENT '登录账号标识' FIRST;

-- 重建 info 表主键
ALTER TABLE `info` DROP PRIMARY KEY;
ALTER TABLE `info` ADD PRIMARY KEY (`owner_id`, `fakeid`);
ALTER TABLE `info` ADD INDEX `idx_owner` (`owner_id`);

-- 2. 为 article 表添加 owner_id
ALTER TABLE `article` 
  ADD COLUMN `owner_id` VARCHAR(64) NOT NULL DEFAULT '' COMMENT '登录账号标识' FIRST;

ALTER TABLE `article` DROP PRIMARY KEY;
ALTER TABLE `article` ADD PRIMARY KEY (`owner_id`, `id`);
ALTER TABLE `article` ADD INDEX `idx_owner` (`owner_id`);
ALTER TABLE `article` DROP INDEX `idx_fakeid`;
ALTER TABLE `article` ADD INDEX `idx_fakeid` (`owner_id`, `fakeid`);
ALTER TABLE `article` DROP INDEX `idx_create_time`;
ALTER TABLE `article` ADD INDEX `idx_create_time` (`owner_id`, `fakeid`, `create_time`);

-- 3. 为 metadata 表添加 owner_id
ALTER TABLE `metadata` 
  ADD COLUMN `owner_id` VARCHAR(64) NOT NULL DEFAULT '' COMMENT '登录账号标识' FIRST;

ALTER TABLE `metadata` DROP PRIMARY KEY;
ALTER TABLE `metadata` ADD PRIMARY KEY (`owner_id`, `url_hash`);
ALTER TABLE `metadata` ADD INDEX `idx_owner` (`owner_id`);
ALTER TABLE `metadata` DROP INDEX `idx_fakeid`;
ALTER TABLE `metadata` ADD INDEX `idx_fakeid` (`owner_id`, `fakeid`);

-- 4. 为 html 表添加 owner_id
ALTER TABLE `html` 
  ADD COLUMN `owner_id` VARCHAR(64) NOT NULL DEFAULT '' COMMENT '登录账号标识' FIRST;

ALTER TABLE `html` DROP PRIMARY KEY;
ALTER TABLE `html` ADD PRIMARY KEY (`owner_id`, `url_hash`);
ALTER TABLE `html` ADD INDEX `idx_owner` (`owner_id`);
ALTER TABLE `html` DROP INDEX `idx_fakeid`;
ALTER TABLE `html` ADD INDEX `idx_fakeid` (`owner_id`, `fakeid`);

-- 5. 为 asset 表添加 owner_id
ALTER TABLE `asset` 
  ADD COLUMN `owner_id` VARCHAR(64) NOT NULL DEFAULT '' COMMENT '登录账号标识' FIRST;

ALTER TABLE `asset` DROP PRIMARY KEY;
ALTER TABLE `asset` ADD PRIMARY KEY (`owner_id`, `url_hash`);
ALTER TABLE `asset` ADD INDEX `idx_owner` (`owner_id`);
ALTER TABLE `asset` DROP INDEX `idx_fakeid`;
ALTER TABLE `asset` ADD INDEX `idx_fakeid` (`owner_id`, `fakeid`);

-- 6. 为 resource 表添加 owner_id
ALTER TABLE `resource` 
  ADD COLUMN `owner_id` VARCHAR(64) NOT NULL DEFAULT '' COMMENT '登录账号标识' FIRST;

ALTER TABLE `resource` DROP PRIMARY KEY;
ALTER TABLE `resource` ADD PRIMARY KEY (`owner_id`, `url_hash`);
ALTER TABLE `resource` ADD INDEX `idx_owner` (`owner_id`);
ALTER TABLE `resource` DROP INDEX `idx_fakeid`;
ALTER TABLE `resource` ADD INDEX `idx_fakeid` (`owner_id`, `fakeid`);

-- 7. 为 resource_map 表添加 owner_id
ALTER TABLE `resource_map` 
  ADD COLUMN `owner_id` VARCHAR(64) NOT NULL DEFAULT '' COMMENT '登录账号标识' FIRST;

ALTER TABLE `resource_map` DROP PRIMARY KEY;
ALTER TABLE `resource_map` ADD PRIMARY KEY (`owner_id`, `url_hash`);
ALTER TABLE `resource_map` ADD INDEX `idx_owner` (`owner_id`);
ALTER TABLE `resource_map` DROP INDEX `idx_fakeid`;
ALTER TABLE `resource_map` ADD INDEX `idx_fakeid` (`owner_id`, `fakeid`);

-- 8. 为 comment 表添加 owner_id
ALTER TABLE `comment` 
  ADD COLUMN `owner_id` VARCHAR(64) NOT NULL DEFAULT '' COMMENT '登录账号标识' FIRST;

ALTER TABLE `comment` DROP PRIMARY KEY;
ALTER TABLE `comment` ADD PRIMARY KEY (`owner_id`, `url_hash`);
ALTER TABLE `comment` ADD INDEX `idx_owner` (`owner_id`);
ALTER TABLE `comment` DROP INDEX `idx_fakeid`;
ALTER TABLE `comment` ADD INDEX `idx_fakeid` (`owner_id`, `fakeid`);

-- 9. 为 comment_reply 表添加 owner_id
ALTER TABLE `comment_reply` 
  ADD COLUMN `owner_id` VARCHAR(64) NOT NULL DEFAULT '' COMMENT '登录账号标识' FIRST;

ALTER TABLE `comment_reply` DROP PRIMARY KEY;
ALTER TABLE `comment_reply` ADD PRIMARY KEY (`owner_id`, `id`);
ALTER TABLE `comment_reply` ADD INDEX `idx_owner` (`owner_id`);
ALTER TABLE `comment_reply` DROP INDEX `idx_fakeid`;
ALTER TABLE `comment_reply` ADD INDEX `idx_fakeid` (`owner_id`, `fakeid`);

-- 10. 为 debug 表添加 owner_id
ALTER TABLE `debug` 
  ADD COLUMN `owner_id` VARCHAR(64) NOT NULL DEFAULT '' COMMENT '登录账号标识' FIRST;

ALTER TABLE `debug` DROP PRIMARY KEY;
ALTER TABLE `debug` ADD PRIMARY KEY (`owner_id`, `url_hash`);
ALTER TABLE `debug` ADD INDEX `idx_owner` (`owner_id`);
ALTER TABLE `debug` DROP INDEX `idx_fakeid`;
ALTER TABLE `debug` ADD INDEX `idx_fakeid` (`owner_id`, `fakeid`);

-- 11. 为 api_call 表添加 owner_id
ALTER TABLE `api_call` 
  ADD COLUMN `owner_id` VARCHAR(64) NOT NULL DEFAULT '' COMMENT '登录账号标识' AFTER `id`;

ALTER TABLE `api_call` ADD INDEX `idx_owner` (`owner_id`);
ALTER TABLE `api_call` DROP INDEX `idx_call_time`;
ALTER TABLE `api_call` ADD INDEX `idx_call_time` (`owner_id`, `account`, `call_time`);

-- 迁移完成
SELECT 'Migration completed successfully!' AS status;
