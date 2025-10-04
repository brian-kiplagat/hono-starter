ALTER TABLE `emails` ADD `checked` boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE `emails` ADD `starred` boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE `emails` ADD `flagged` boolean DEFAULT false;