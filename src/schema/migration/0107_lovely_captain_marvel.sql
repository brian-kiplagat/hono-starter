ALTER TABLE `assets` ADD `mediaconvert_job_status` enum('pending','processing','completed','failed') DEFAULT 'pending';
ALTER TABLE `assets` ADD `mediaconvert_job_progress` int DEFAULT 0;
ALTER TABLE `assets` ADD `mediaconvert_job_current_phase` varchar(255);