ALTER TABLE `user` MODIFY COLUMN `role` enum('master','owner','host','user') DEFAULT 'user';