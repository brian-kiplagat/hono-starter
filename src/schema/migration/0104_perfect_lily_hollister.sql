CREATE TABLE `click_analytics` (
	`id` serial AUTO_INCREMENT NOT NULL,
	`lead_id` int NOT NULL,
	`event_id` int NOT NULL,
	`link_url` varchar(255) NOT NULL,
	`clicked_at` timestamp DEFAULT (now()),
	`click_type` enum('schedule_callback','upgrade') DEFAULT 'schedule_callback',
	`created_at` timestamp DEFAULT (now()),
	`updated_at` timestamp DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `click_analytics_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `click_analytics` ADD CONSTRAINT `click_analytics_lead_id_leads_id_fk` FOREIGN KEY (`lead_id`) REFERENCES `leads`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `click_analytics` ADD CONSTRAINT `click_analytics_event_id_events_id_fk` FOREIGN KEY (`event_id`) REFERENCES `events`(`id`) ON DELETE no action ON UPDATE no action;