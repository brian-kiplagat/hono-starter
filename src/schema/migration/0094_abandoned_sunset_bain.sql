ALTER TABLE `event_telemetry` ADD `updated_at` timestamp DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP;--> statement-breakpoint
ALTER TABLE `event_telemetry` DROP COLUMN `left_at`;