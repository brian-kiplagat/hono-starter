ALTER TABLE `user` MODIFY COLUMN `is_follow_up_emails_enabled` boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE `user` MODIFY COLUMN `is_post_event_emails_enabled` boolean DEFAULT false;