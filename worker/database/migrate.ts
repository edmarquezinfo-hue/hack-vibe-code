import { drizzle } from 'drizzle-orm/d1';
import { migrate } from 'drizzle-orm/d1/migrator';
import * as schema from './schema';

/**
 * Database migration utility for Cloudflare D1
 * This script handles both local development and production migrations
 */

interface Env {
    DB: D1Database;
}

// Type definition for D1Database if not available from workers-types
declare global {
    interface D1Database {
        prepare(query: string): D1PreparedStatement;
        dump(): Promise<ArrayBuffer>;
        batch<T = unknown>(statements: D1PreparedStatement[]): Promise<D1Result<T>[]>;
        exec(query: string): Promise<D1ExecResult>;
    }
    
    interface D1PreparedStatement {
        bind(...values: unknown[]): D1PreparedStatement;
        first<T = unknown>(colName?: string): Promise<T | null>;
        run(): Promise<D1Result>;
        all<T = unknown>(): Promise<D1Result<T>>;
        raw<T = unknown>(): Promise<T[]>;
    }
    
    interface D1ExecResult {
        count: number;
        duration: number;
    }
}

/**
 * Run database migrations
 * @param env - Cloudflare environment with D1 database binding
 */
export async function runMigrations(env: Env) {
    try {
        console.log('Starting database migrations...');
        
        const db = drizzle(env.DB, { schema });
        
        // Run migrations from the migrations folder
        await migrate(db, { migrationsFolder: './drizzle/migrations' });
        
        console.log('✅ Database migrations completed successfully');
        return { success: true };
    } catch (error) {
        console.error('❌ Database migration failed:', error);
        throw error;
    }
}

/**
 * Initialize database with default system settings
 * @param env - Cloudflare environment with D1 database binding
 */
export async function initializeSystemDefaults(env: Env) {
    try {
        const db = drizzle(env.DB, { schema });
        
        // Insert default system settings
        const defaultSettings = [
            {
                id: 'default-cf-account',
                key: 'default_cloudflare_account_id',
                value: JSON.stringify(process.env.CLOUDFLARE_ACCOUNT_ID || ''),
                description: 'Default Cloudflare Account ID for deployments'
            },
            {
                id: 'default-cf-token',
                key: 'default_cloudflare_api_token_hash',
                value: JSON.stringify(process.env.CLOUDFLARE_API_TOKEN ? 'configured' : ''),
                description: 'Default Cloudflare API Token status'
            },
            {
                id: 'public-board',
                key: 'default_public_board_id',
                value: JSON.stringify('public'),
                description: 'Default public board ID for anonymous submissions'
            },
            {
                id: 'registration-enabled',
                key: 'allow_user_registration',
                value: JSON.stringify(true),
                description: 'Whether new user registration is enabled'
            },
            {
                id: 'anonymous-submissions',
                key: 'allow_anonymous_submissions',
                value: JSON.stringify(true),
                description: 'Whether anonymous users can submit to public boards'
            }
        ];
        
        // Insert default settings (ignore conflicts for existing settings)
        for (const setting of defaultSettings) {
            try {
                await db.insert(schema.systemSettings)
                    .values(setting)
                    .onConflictDoNothing();
            } catch (error) {
                console.log(`Setting ${setting.key} already exists, skipping...`);
            }
        }
        
        // Create default public board
        try {
            await db.insert(schema.boards)
                .values({
                    id: 'public',
                    name: 'Public Gallery',
                    slug: 'public',
                    description: 'Share your amazing generated apps with the community!',
                    visibility: 'public',
                    allowSubmissions: true,
                    requireApproval: false,
                })
                .onConflictDoNothing();
        } catch (error) {
            console.log('Default public board already exists, skipping...');
        }
        
        console.log('✅ System defaults initialized');
        return { success: true };
    } catch (error) {
        console.error('❌ Failed to initialize system defaults:', error);
        throw error;
    }
}

/**
 * Get database connection with schema
 * @param env - Cloudflare environment with D1 database binding
 * @returns Drizzle database instance with schema
 */
export function getDatabase(env: Env) {
    return drizzle(env.DB, { schema });
}

/**
 * Health check for database connection
 * @param env - Cloudflare environment with D1 database binding
 */
export async function healthCheck(env: Env) {
    try {
        const db = getDatabase(env);
        
        // Simple query to test connection
        await db.select().from(schema.systemSettings).limit(1);
        
        return {
            success: true,
            timestamp: new Date().toISOString(),
            tablesAccessible: true
        };
    } catch (error) {
        return {
            success: false,
            timestamp: new Date().toISOString(),
            error: error instanceof Error ? error.message : 'Unknown error',
            tablesAccessible: false
        };
    }
}
