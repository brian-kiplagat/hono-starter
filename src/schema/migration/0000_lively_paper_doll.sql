CREATE TABLE `emails` (
	`id` serial AUTO_INCREMENT NOT NULL,
	`email` varchar(255) NOT NULL,
	`subject` varchar(255) NOT NULL,
	`title` varchar(255) NOT NULL,
	`subtitle` varchar(255) NOT NULL,
	`body` text NOT NULL,
	`button_text` varchar(255) NOT NULL,
	`button_link` varchar(255) NOT NULL,
	`created_at` timestamp DEFAULT (now()),
	`checked` boolean DEFAULT false,
	`starred` boolean DEFAULT false,
	`flagged` boolean DEFAULT false,
	`host_id` int NOT NULL,
	`status` enum('draft','sent','failed') DEFAULT 'draft',
	`updated_at` timestamp DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `emails_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `notifications` (
	`id` serial AUTO_INCREMENT NOT NULL,
	`user_id` int NOT NULL,
	`notification_type` enum('comment','like','system','new_lead','new_booking','new_payment','reminder') NOT NULL,
	`is_read` boolean DEFAULT false,
	`title` varchar(255),
	`message` text,
	`link` text,
	`metadata` json,
	`created_at` timestamp DEFAULT (now()),
	`updated_at` timestamp DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `notifications_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `user` (
	`id` serial AUTO_INCREMENT NOT NULL,
	`name` varchar(50) NOT NULL,
	`email` varchar(100) NOT NULL,
	`phone` varchar(100) NOT NULL DEFAULT '',
	`dial_code` varchar(10) NOT NULL DEFAULT '',
	`password` varchar(255) NOT NULL,
	`reset_token` varchar(255),
	`email_token` varchar(255),
	`created_at` timestamp DEFAULT (now()),
	`updated_at` timestamp DEFAULT (now()),
	`role` enum('user','role','admin') DEFAULT 'user',
	`profile_picture` text,
	`bio` varchar(255),
	`custom_id` varchar(255),
	`is_verified` boolean DEFAULT false,
	`is_banned` boolean DEFAULT false,
	`is_deleted` boolean DEFAULT false,
	`google_id` varchar(255),
	`google_access_token` varchar(255),
	`auth_provider` enum('local','google') DEFAULT 'local',
	CONSTRAINT `user_id` PRIMARY KEY(`id`),
	CONSTRAINT `user_email_unique` UNIQUE(`email`)
);
--> statement-breakpoint
ALTER TABLE `emails` ADD CONSTRAINT `emails_host_id_user_id_fk` FOREIGN KEY (`host_id`) REFERENCES `user`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `notifications` ADD CONSTRAINT `notifications_user_id_user_id_fk` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE no action ON UPDATE no action;