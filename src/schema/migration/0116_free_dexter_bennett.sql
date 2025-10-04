ALTER TABLE `user` ADD `follow_up_template` text;--> statement-breakpoint
ALTER TABLE `user` ADD `post_event_template` text;--> statement-breakpoint
ALTER TABLE `user` ADD `is_follow_up_emails_enabled` boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE `user` ADD `is_post_event_emails_enabled` boolean DEFAULT false;