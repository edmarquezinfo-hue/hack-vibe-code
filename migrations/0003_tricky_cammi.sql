PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_apps` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`description` text,
	`slug` text,
	`icon_url` text,
	`original_prompt` text NOT NULL,
	`final_prompt` text,
	`blueprint` text,
	`framework` text,
	`user_id` text,
	`team_id` text,
	`session_token` text,
	`visibility` text DEFAULT 'private' NOT NULL,
	`board_id` text,
	`status` text DEFAULT 'generating' NOT NULL,
	`deployment_url` text,
	`cloudflare_account_id` text,
	`deployment_status` text DEFAULT 'none',
	`deployment_metadata` text DEFAULT '{}',
	`is_archived` integer DEFAULT false,
	`is_featured` integer DEFAULT false,
	`version` integer DEFAULT 1,
	`parent_app_id` text,
	`created_at` integer DEFAULT CURRENT_TIMESTAMP,
	`updated_at` integer DEFAULT CURRENT_TIMESTAMP,
	`last_deployed_at` integer,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`team_id`) REFERENCES `teams`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`board_id`) REFERENCES `boards`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_apps`("id", "title", "description", "slug", "icon_url", "original_prompt", "final_prompt", "blueprint", "framework", "user_id", "team_id", "session_token", "visibility", "board_id", "status", "deployment_url", "cloudflare_account_id", "deployment_status", "deployment_metadata", "is_archived", "is_featured", "version", "parent_app_id", "created_at", "updated_at", "last_deployed_at") 
SELECT "id", "title", "description", "slug", "icon_url", "original_prompt", "final_prompt", "blueprint", "framework", "user_id", "team_id", "session_token", "visibility", "board_id", 
CASE 
  WHEN "status" IN ('draft', 'error', 'failed') THEN 'generating'
  WHEN "status" IN ('deployed') THEN 'completed' 
  ELSE "status"
END as "status", 
"deployment_url", "cloudflare_account_id", "deployment_status", "deployment_metadata", "is_archived", "is_featured", "version", "parent_app_id", "created_at", "updated_at", "last_deployed_at" FROM `apps`;--> statement-breakpoint
DROP TABLE `apps`;--> statement-breakpoint
ALTER TABLE `__new_apps` RENAME TO `apps`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `apps_user_idx` ON `apps` (`user_id`);--> statement-breakpoint
CREATE INDEX `apps_team_idx` ON `apps` (`team_id`);--> statement-breakpoint
CREATE INDEX `apps_board_idx` ON `apps` (`board_id`);--> statement-breakpoint
CREATE INDEX `apps_status_idx` ON `apps` (`status`);--> statement-breakpoint
CREATE INDEX `apps_visibility_idx` ON `apps` (`visibility`);--> statement-breakpoint
CREATE INDEX `apps_slug_idx` ON `apps` (`slug`);--> statement-breakpoint
CREATE INDEX `apps_session_token_idx` ON `apps` (`session_token`);--> statement-breakpoint
CREATE INDEX `apps_parent_app_idx` ON `apps` (`parent_app_id`);--> statement-breakpoint
CREATE INDEX `apps_search_idx` ON `apps` (`title`,`description`);--> statement-breakpoint
CREATE INDEX `apps_framework_status_idx` ON `apps` (`framework`,`status`);--> statement-breakpoint
CREATE INDEX `apps_visibility_status_idx` ON `apps` (`visibility`,`status`);--> statement-breakpoint
CREATE INDEX `apps_created_at_idx` ON `apps` (`created_at`);--> statement-breakpoint
CREATE INDEX `apps_updated_at_idx` ON `apps` (`updated_at`);