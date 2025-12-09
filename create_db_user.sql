-- 创建数据库
CREATE DATABASE IF NOT EXISTS `wechat-docs` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- 创建用户并设置密码（请将'your_password_here'替换为实际密码）
CREATE USER IF NOT EXISTS 'wechat-docs'@'%' IDENTIFIED BY 'your_password_here';

-- 为用户授予数据库的全部权限
GRANT ALL PRIVILEGES ON `wechat-docs`.* TO 'wechat-docs'@'%';

-- 刷新权限
FLUSH PRIVILEGES;

-- 查看用户权限（可选）
SHOW GRANTS FOR 'wechat-docs'@'%';
