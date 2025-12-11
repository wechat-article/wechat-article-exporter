-- ============================================
-- WeChat Article Exporter - MySQL Schema
-- 从 IndexedDB (Dexie) 迁移的完整表结构
-- 支持多账号数据隔离 (owner_id)
-- ============================================

-- 公众号信息表
CREATE TABLE IF NOT EXISTS `info` (
  `owner_id` VARCHAR(64) NOT NULL COMMENT '登录账号标识(nick_name的MD5哈希)',
  `fakeid` VARCHAR(64) NOT NULL COMMENT '公众号唯一标识',
  `completed` TINYINT(1) DEFAULT 0 COMMENT '是否已完成同步',
  `count` INT DEFAULT 0 COMMENT '已同步的消息数',
  `articles` INT DEFAULT 0 COMMENT '已同步的文章数',
  `nickname` VARCHAR(255) DEFAULT NULL COMMENT '公众号昵称',
  `round_head_img` TEXT COMMENT '公众号头像URL',
  `total_count` INT DEFAULT 0 COMMENT '文章总数',
  `create_time` INT UNSIGNED DEFAULT NULL COMMENT '创建时间戳',
  `update_time` INT UNSIGNED DEFAULT NULL COMMENT '更新时间戳',
  `last_update_time` INT UNSIGNED DEFAULT NULL COMMENT '最后更新时间戳',
  PRIMARY KEY (`owner_id`, `fakeid`),
  INDEX `idx_owner` (`owner_id`),
  INDEX `idx_nickname` (`nickname`),
  INDEX `idx_update_time` (`update_time`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='公众号信息表';

-- 文章表
CREATE TABLE IF NOT EXISTS `article` (
  `owner_id` VARCHAR(64) NOT NULL COMMENT '登录账号标识',
  `id` VARCHAR(128) NOT NULL COMMENT '主键: fakeid:aid',
  `fakeid` VARCHAR(64) NOT NULL COMMENT '公众号标识',
  `aid` VARCHAR(64) DEFAULT NULL COMMENT '文章ID',
  `title` VARCHAR(500) DEFAULT NULL COMMENT '文章标题',
  `link` TEXT COMMENT '文章链接',
  `cover` TEXT COMMENT '封面图URL',
  `digest` TEXT COMMENT '文章摘要',
  `author_name` VARCHAR(255) DEFAULT NULL COMMENT '作者名称',
  `create_time` INT UNSIGNED DEFAULT NULL COMMENT '创建时间戳',
  `update_time` INT UNSIGNED DEFAULT NULL COMMENT '更新时间戳',
  `is_deleted` TINYINT(1) DEFAULT 0 COMMENT '是否已删除',
  `data` JSON COMMENT '完整的 AppMsgEx 对象数据',
  PRIMARY KEY (`owner_id`, `id`),
  INDEX `idx_owner` (`owner_id`),
  INDEX `idx_fakeid` (`owner_id`, `fakeid`),
  INDEX `idx_create_time` (`owner_id`, `fakeid`, `create_time`),
  INDEX `idx_link` (`link`(255))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='文章表';

-- 元数据表
CREATE TABLE IF NOT EXISTS `metadata` (
  `owner_id` VARCHAR(64) NOT NULL COMMENT '登录账号标识',
  `url` VARCHAR(2048) NOT NULL COMMENT '文章URL',
  `url_hash` VARCHAR(64) NOT NULL COMMENT 'URL的MD5哈希值',
  `fakeid` VARCHAR(64) DEFAULT NULL COMMENT '公众号标识',
  `title` VARCHAR(500) DEFAULT NULL COMMENT '文章标题',
  `read_num` INT DEFAULT 0 COMMENT '阅读数',
  `old_like_num` INT DEFAULT 0 COMMENT '点赞数(旧)',
  `share_num` INT DEFAULT 0 COMMENT '分享数',
  `like_num` INT DEFAULT 0 COMMENT '喜欢数',
  `comment_num` INT DEFAULT 0 COMMENT '评论数',
  `create_time` INT UNSIGNED DEFAULT NULL COMMENT '创建时间戳',
  `update_time` INT UNSIGNED DEFAULT NULL COMMENT '更新时间戳',
  PRIMARY KEY (`owner_id`, `url_hash`),
  INDEX `idx_owner` (`owner_id`),
  INDEX `idx_fakeid` (`owner_id`, `fakeid`),
  INDEX `idx_url` (`url`(255))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='文章元数据表';

-- HTML内容表
CREATE TABLE IF NOT EXISTS `html` (
  `owner_id` VARCHAR(64) NOT NULL COMMENT '登录账号标识',
  `url` VARCHAR(2048) NOT NULL COMMENT '文章URL',
  `url_hash` VARCHAR(64) NOT NULL COMMENT 'URL的MD5哈希值',
  `fakeid` VARCHAR(64) DEFAULT NULL COMMENT '公众号标识',
  `title` VARCHAR(500) DEFAULT NULL COMMENT '文章标题',
  `comment_id` VARCHAR(64) DEFAULT NULL COMMENT '评论ID',
  `file` LONGBLOB COMMENT 'HTML内容(Blob)',
  `create_time` INT UNSIGNED DEFAULT NULL COMMENT '创建时间戳',
  PRIMARY KEY (`owner_id`, `url_hash`),
  INDEX `idx_owner` (`owner_id`),
  INDEX `idx_fakeid` (`owner_id`, `fakeid`),
  INDEX `idx_url` (`url`(255))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='HTML内容表';

-- 资源表(asset)
CREATE TABLE IF NOT EXISTS `asset` (
  `owner_id` VARCHAR(64) NOT NULL COMMENT '登录账号标识',
  `url` VARCHAR(2048) NOT NULL COMMENT '资源URL',
  `url_hash` VARCHAR(64) NOT NULL COMMENT 'URL的MD5哈希值',
  `fakeid` VARCHAR(64) DEFAULT NULL COMMENT '公众号标识',
  `file` LONGBLOB COMMENT '资源文件(Blob)',
  `create_time` INT UNSIGNED DEFAULT NULL COMMENT '创建时间戳',
  PRIMARY KEY (`owner_id`, `url_hash`),
  INDEX `idx_owner` (`owner_id`),
  INDEX `idx_fakeid` (`owner_id`, `fakeid`),
  INDEX `idx_url` (`url`(255))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='资源表';

-- 资源文件表(resource)
CREATE TABLE IF NOT EXISTS `resource` (
  `owner_id` VARCHAR(64) NOT NULL COMMENT '登录账号标识',
  `url` VARCHAR(2048) NOT NULL COMMENT '资源URL',
  `url_hash` VARCHAR(64) NOT NULL COMMENT 'URL的MD5哈希值',
  `fakeid` VARCHAR(64) DEFAULT NULL COMMENT '公众号标识',
  `file` LONGBLOB COMMENT '资源文件(Blob)',
  `create_time` INT UNSIGNED DEFAULT NULL COMMENT '创建时间戳',
  PRIMARY KEY (`owner_id`, `url_hash`),
  INDEX `idx_owner` (`owner_id`),
  INDEX `idx_fakeid` (`owner_id`, `fakeid`),
  INDEX `idx_url` (`url`(255))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='资源文件表';

-- 资源映射表
CREATE TABLE IF NOT EXISTS `resource_map` (
  `owner_id` VARCHAR(64) NOT NULL COMMENT '登录账号标识',
  `url` VARCHAR(2048) NOT NULL COMMENT '文章URL',
  `url_hash` VARCHAR(64) NOT NULL COMMENT 'URL的MD5哈希值',
  `fakeid` VARCHAR(64) DEFAULT NULL COMMENT '公众号标识',
  `resources` JSON COMMENT '资源URL列表',
  `create_time` INT UNSIGNED DEFAULT NULL COMMENT '创建时间戳',
  PRIMARY KEY (`owner_id`, `url_hash`),
  INDEX `idx_owner` (`owner_id`),
  INDEX `idx_fakeid` (`owner_id`, `fakeid`),
  INDEX `idx_url` (`url`(255))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='资源映射表';

-- 评论表
CREATE TABLE IF NOT EXISTS `comment` (
  `owner_id` VARCHAR(64) NOT NULL COMMENT '登录账号标识',
  `url` VARCHAR(2048) NOT NULL COMMENT '文章URL',
  `url_hash` VARCHAR(64) NOT NULL COMMENT 'URL的MD5哈希值',
  `fakeid` VARCHAR(64) DEFAULT NULL COMMENT '公众号标识',
  `title` VARCHAR(500) DEFAULT NULL COMMENT '文章标题',
  `data` JSON COMMENT '评论数据',
  `create_time` INT UNSIGNED DEFAULT NULL COMMENT '创建时间戳',
  PRIMARY KEY (`owner_id`, `url_hash`),
  INDEX `idx_owner` (`owner_id`),
  INDEX `idx_fakeid` (`owner_id`, `fakeid`),
  INDEX `idx_url` (`url`(255))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='评论表';

-- 评论回复表
CREATE TABLE IF NOT EXISTS `comment_reply` (
  `owner_id` VARCHAR(64) NOT NULL COMMENT '登录账号标识',
  `id` VARCHAR(256) NOT NULL COMMENT '主键: url_hash:contentID',
  `url` VARCHAR(2048) NOT NULL COMMENT '文章URL',
  `url_hash` VARCHAR(64) NOT NULL COMMENT 'URL的MD5哈希值',
  `fakeid` VARCHAR(64) DEFAULT NULL COMMENT '公众号标识',
  `title` VARCHAR(500) DEFAULT NULL COMMENT '文章标题',
  `content_id` VARCHAR(64) NOT NULL COMMENT '评论内容ID',
  `data` JSON COMMENT '回复数据',
  `create_time` INT UNSIGNED DEFAULT NULL COMMENT '创建时间戳',
  PRIMARY KEY (`owner_id`, `id`),
  INDEX `idx_owner` (`owner_id`),
  INDEX `idx_fakeid` (`owner_id`, `fakeid`),
  INDEX `idx_url` (`url_hash`),
  INDEX `idx_content_id` (`content_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='评论回复表';

-- 调试数据表
CREATE TABLE IF NOT EXISTS `debug` (
  `owner_id` VARCHAR(64) NOT NULL COMMENT '登录账号标识',
  `url` VARCHAR(2048) NOT NULL COMMENT '调试URL',
  `url_hash` VARCHAR(64) NOT NULL COMMENT 'URL的MD5哈希值',
  `fakeid` VARCHAR(64) DEFAULT NULL COMMENT '公众号标识',
  `type` VARCHAR(64) DEFAULT NULL COMMENT '类型',
  `title` VARCHAR(500) DEFAULT NULL COMMENT '标题',
  `file` LONGBLOB COMMENT '调试文件(Blob)',
  `create_time` INT UNSIGNED DEFAULT NULL COMMENT '创建时间戳',
  PRIMARY KEY (`owner_id`, `url_hash`),
  INDEX `idx_owner` (`owner_id`),
  INDEX `idx_fakeid` (`owner_id`, `fakeid`),
  INDEX `idx_url` (`url`(255))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='调试数据表';

-- API调用记录表
CREATE TABLE IF NOT EXISTS `api_call` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY COMMENT '自增ID',
  `owner_id` VARCHAR(64) NOT NULL COMMENT '登录账号标识',
  `name` VARCHAR(64) NOT NULL COMMENT 'API名称: searchbiz/appmsgpublish',
  `account` VARCHAR(64) NOT NULL COMMENT '账号标识',
  `call_time` BIGINT UNSIGNED NOT NULL COMMENT '调用时间戳(毫秒)',
  `is_normal` TINYINT(1) DEFAULT 1 COMMENT '是否正常调用',
  `payload` JSON COMMENT '调用参数',
  INDEX `idx_owner` (`owner_id`),
  INDEX `idx_name` (`name`),
  INDEX `idx_account` (`account`),
  INDEX `idx_call_time` (`owner_id`, `account`, `call_time`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='API调用记录表';
