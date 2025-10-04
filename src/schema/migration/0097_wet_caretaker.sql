ALTER TABLE `leads` ADD `email_event_countdown` boolean DEFAULT false;
ALTER TABLE `leads` ADD `email_final_reminder` boolean DEFAULT false;
ALTER TABLE `leads` ADD `email_event_day_reminder` boolean DEFAULT false;
ALTER TABLE `leads` ADD `email_thank_you_follow_up` boolean DEFAULT false;
ALTER TABLE `leads` ADD `email_post_event_upsell` boolean DEFAULT false;