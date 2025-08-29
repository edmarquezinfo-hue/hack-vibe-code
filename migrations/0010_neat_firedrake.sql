CREATE TABLE `github_integrations` (
	`id` text PRIMARY KEY NOT NULL,
	`github_user_id` text NOT NULL,
	`github_username` text NOT NULL,
	`access_token_hash` text NOT NULL,
	`refresh_token_hash` text,
	`user_id` text,
	`team_id` text,
	`default_organization` text,
	`is_active` integer DEFAULT true,
	`scopes` text DEFAULT '[]',
	`last_validated` integer,
	`created_at` integer DEFAULT CURRENT_TIMESTAMP,
	`updated_at` integer DEFAULT CURRENT_TIMESTAMP,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`team_id`) REFERENCES `teams`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `github_integrations_user_idx` ON `github_integrations` (`user_id`);--> statement-breakpoint
CREATE INDEX `github_integrations_team_idx` ON `github_integrations` (`team_id`);--> statement-breakpoint
CREATE INDEX `github_integrations_github_user_idx` ON `github_integrations` (`github_user_id`);