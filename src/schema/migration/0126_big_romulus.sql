ALTER TABLE `leads` MODIFY COLUMN `status_identifier` enum('manual','landing_page') DEFAULT 'manual';--> statement-breakpoint
ALTER TABLE `user` DROP COLUMN `follow_up_template`;--> statement-breakpoint
ALTER TABLE `user` DROP COLUMN `post_event_template`;--> statement-breakpoint
ALTER TABLE `user` DROP COLUMN `is_follow_up_emails_enabled`;--> statement-breakpoint
ALTER TABLE `user` DROP COLUMN `is_post_event_emails_enabled`;--> statement-breakpoint
ALTER TABLE `user` DROP COLUMN `follow_up_who_gets_it`;--> statement-breakpoint
ALTER TABLE `user` DROP COLUMN `post_event_who_gets_it`;