CREATE TABLE `membership_id` (
	`id` serial AUTO_INCREMENT NOT NULL,
	`name` varchar(50) NOT NULL,
	`created_at` timestamp DEFAULT (now()),
	CONSTRAINT `membership_id_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `leads` MODIFY COLUMN `lead_status` int NOT NULL DEFAULT 1;--> statement-breakpoint
ALTER TABLE `leads` ADD CONSTRAINT `leads_lead_status_membership_id_id_fk` FOREIGN KEY (`lead_status`) REFERENCES `membership_id`(`id`) ON DELETE no action ON UPDATE no action;