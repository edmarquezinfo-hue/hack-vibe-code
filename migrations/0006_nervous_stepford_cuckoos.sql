CREATE TABLE `user_model_providers` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`name` text NOT NULL,
	`base_url` text NOT NULL,
	`secret_id` text,
	`is_active` integer DEFAULT true,
	`created_at` integer DEFAULT CURRENT_TIMESTAMP,
	`updated_at` integer DEFAULT CURRENT_TIMESTAMP,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`secret_id`) REFERENCES `user_secrets`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `user_model_providers_user_name_idx` ON `user_model_providers` (`user_id`,`name`);--> statement-breakpoint
CREATE INDEX `user_model_providers_user_idx` ON `user_model_providers` (`user_id`);--> statement-breakpoint
CREATE INDEX `user_model_providers_is_active_idx` ON `user_model_providers` (`is_active`);