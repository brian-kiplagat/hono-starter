ALTER TABLE `leads` ADD `dial_code` varchar(10);--> statement-breakpoint
ALTER TABLE `payments` ADD `beneficiary_id` int NOT NULL;--> statement-breakpoint
ALTER TABLE `payments` ADD CONSTRAINT `payments_beneficiary_id_user_id_fk` FOREIGN KEY (`beneficiary_id`) REFERENCES `user`(`id`) ON DELETE no action ON UPDATE no action;