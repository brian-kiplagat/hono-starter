ALTER TABLE `bookings` ADD `membership_id` int NOT NULL;
ALTER TABLE `bookings` ADD `metadata` json;
ALTER TABLE `bookings` ADD CONSTRAINT `bookings_membership_id_memberships_id_fk` FOREIGN KEY (`membership_id`) REFERENCES `memberships`(`id`) ON DELETE no action ON UPDATE no action;