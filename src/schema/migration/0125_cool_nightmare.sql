CREATE TABLE `follow_up_emails` (
	`id` serial AUTO_INCREMENT NOT NULL,
	`title` varchar(255) NOT NULL,
	`content` text NOT NULL,
	`created_at` timestamp DEFAULT (now()),
	`updated_at` timestamp DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`user_id` int NOT NULL,
	`follow_up_who_gets_it` json,
	`timeline` int NOT NULL,
	`enabled` boolean DEFAULT false,
	CONSTRAINT `follow_up_emails_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `follow_up_emails` ADD CONSTRAINT `follow_up_emails_user_id_user_id_fk` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE no action ON UPDATE no action;