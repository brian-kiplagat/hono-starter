ALTER TABLE `event_telemetry` ADD `left_scenario` varchar(255);
ALTER TABLE `event_telemetry` ADD `left_at` timestamp;
ALTER TABLE `event_telemetry` ADD `has_left` boolean DEFAULT false;