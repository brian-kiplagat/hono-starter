RENAME TABLE `mail` TO `emails`;--> statement-breakpoint
ALTER TABLE `emails` DROP FOREIGN KEY `mail_host_id_user_id_fk`;
--> statement-breakpoint
ALTER TABLE `emails` DROP PRIMARY KEY;--> statement-breakpoint
ALTER TABLE `emails` ADD PRIMARY KEY(`id`);--> statement-breakpoint
ALTER TABLE `emails` ADD CONSTRAINT `emails_host_id_user_id_fk` FOREIGN KEY (`host_id`) REFERENCES `user`(`id`) ON DELETE no action ON UPDATE no action;