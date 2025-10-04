CREATE TABLE `mail` (
	`id` serial AUTO_INCREMENT NOT NULL,
	`email` varchar(255) NOT NULL,
	`subject` varchar(255) NOT NULL,
	`title` varchar(255) NOT NULL,
	`subtitle` varchar(255) NOT NULL,
	`body` text NOT NULL,
	`buttonText` varchar(255) NOT NULL,
	`buttonLink` varchar(255) NOT NULL,
	`created_at` timestamp DEFAULT (now()),
	`host_id` int NOT NULL,
	`updated_at` timestamp DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `mail_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `mail` ADD CONSTRAINT `mail_host_id_user_id_fk` FOREIGN KEY (`host_id`) REFERENCES `user`(`id`) ON DELETE no action ON UPDATE no action;