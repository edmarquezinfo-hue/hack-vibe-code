CREATE TABLE `verification_otps` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`otp` text NOT NULL,
	`expires_at` integer NOT NULL,
	`used` integer DEFAULT false,
	`used_at` integer,
	`created_at` integer DEFAULT CURRENT_TIMESTAMP
);
--> statement-breakpoint
CREATE INDEX `verification_otps_email_idx` ON `verification_otps` (`email`);--> statement-breakpoint
CREATE INDEX `verification_otps_expires_at_idx` ON `verification_otps` (`expires_at`);--> statement-breakpoint
CREATE INDEX `verification_otps_used_idx` ON `verification_otps` (`used`);