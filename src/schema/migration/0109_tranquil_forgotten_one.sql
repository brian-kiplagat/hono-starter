CREATE TABLE `lobby_telemetry` (
	`id` serial AUTO_INCREMENT NOT NULL,
	`event_id` int NOT NULL,
	`lead_id` int NOT NULL,
	`session_id` varchar(255) NOT NULL,
	`joined_at` timestamp DEFAULT (now()),
	`left_at` timestamp,
	`duration` int,
	`exit_reason` enum('event_started','left','timeout') DEFAULT 'left',
	`created_at` timestamp DEFAULT (now()),
	CONSTRAINT `lobby_telemetry_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `lobby_telemetry` ADD CONSTRAINT `lobby_telemetry_event_id_events_id_fk` FOREIGN KEY (`event_id`) REFERENCES `events`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `lobby_telemetry` ADD CONSTRAINT `lobby_telemetry_lead_id_leads_id_fk` FOREIGN KEY (`lead_id`) REFERENCES `leads`(`id`) ON DELETE no action ON UPDATE no action;