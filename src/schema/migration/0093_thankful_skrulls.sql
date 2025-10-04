CREATE TABLE `event_telemetry` (
	`id` serial AUTO_INCREMENT NOT NULL,
	`lead_id` int NOT NULL,
	`event_id` int NOT NULL,
	`session_id` varchar(255) NOT NULL,
	`joined_at` timestamp DEFAULT (now()),
	`left_at` timestamp,
	`total_watch_time` int,
	`device` varchar(255),
	`browser` varchar(255),
	`os` varchar(255),
	`ip_address` varchar(255),
	`created_at` timestamp DEFAULT (now()),
	CONSTRAINT `event_telemetry_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `event_telemetry` ADD CONSTRAINT `event_telemetry_lead_id_leads_id_fk` FOREIGN KEY (`lead_id`) REFERENCES `leads`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `event_telemetry` ADD CONSTRAINT `event_telemetry_event_id_events_id_fk` FOREIGN KEY (`event_id`) REFERENCES `events`(`id`) ON DELETE no action ON UPDATE no action;