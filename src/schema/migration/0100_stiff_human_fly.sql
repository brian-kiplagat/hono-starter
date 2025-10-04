ALTER TABLE `leads` RENAME COLUMN `registered_date` TO `date_id`;--> statement-breakpoint
ALTER TABLE `leads` MODIFY COLUMN `date_id` int NOT NULL;--> statement-breakpoint
ALTER TABLE `leads` ADD CONSTRAINT `leads_date_id_membership_dates_id_fk` FOREIGN KEY (`date_id`) REFERENCES `membership_dates`(`id`) ON DELETE no action ON UPDATE no action;