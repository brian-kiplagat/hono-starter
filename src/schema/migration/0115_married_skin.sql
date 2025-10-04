ALTER TABLE `leads` DROP FOREIGN KEY `leads_lead_status_memberships_id_fk`;
--> statement-breakpoint
ALTER TABLE `leads` MODIFY COLUMN `lead_status` enum('new_lead','call_back','registered_for_event','attended_event') NOT NULL DEFAULT 'new_lead';