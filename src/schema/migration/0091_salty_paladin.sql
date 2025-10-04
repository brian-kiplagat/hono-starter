ALTER TABLE `assets` MODIFY COLUMN `processing_status` enum('pending','processing','completed') DEFAULT 'pending';--> statement-breakpoint
ALTER TABLE `assets` ADD `upload_id` varchar(255);--> statement-breakpoint
ALTER TABLE `assets` ADD `upload_status` enum('pending','completed','failed') DEFAULT 'pending';