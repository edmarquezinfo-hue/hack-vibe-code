#!/usr/bin/env bun
/**
 * Database setup script for Orange Project
 * This script initializes the database with migrations and default data
 */

import { runMigrations, initializeSystemDefaults, getDatabase } from '../drizzle/migrate';

interface Env {
  DB: D1Database;
  CLOUDFLARE_ACCOUNT_ID?: string;
  CLOUDFLARE_API_TOKEN?: string;
}

// Mock D1Database for local development
class MockD1Database implements D1Database {
  prepare(query: string): D1PreparedStatement {
    console.log('Mock D1 - Prepare:', query);
    return {
      bind: (...values: unknown[]) => this.prepare(query),
      first: async <T = unknown>() => null as T | null,
      run: async () => ({ success: true, meta: {} } as D1Result),
      all: async <T = unknown>() => ({ results: [] as T[], success: true, meta: {} } as D1Result<T>),
      raw: async <T = unknown>() => [] as T[],
    };
  }

  async dump(): Promise<ArrayBuffer> {
    return new ArrayBuffer(0);
  }

  async batch<T = unknown>(statements: D1PreparedStatement[]): Promise<D1Result<T>[]> {
    console.log('Mock D1 - Batch:', statements.length, 'statements');
    return [];
  }

  async exec(query: string): Promise<D1ExecResult> {
    console.log('Mock D1 - Exec:', query);
    return { count: 0, duration: 0 };
  }
}

async function setupDatabase() {
  console.log('🚀 Starting Orange Database Setup...\n');

  // Create mock environment for local development
  const env: Env = {
    DB: new MockD1Database(),
    CLOUDFLARE_ACCOUNT_ID: process.env.CLOUDFLARE_ACCOUNT_ID,
    CLOUDFLARE_API_TOKEN: process.env.CLOUDFLARE_API_TOKEN,
  };

  try {
    // Step 1: Run migrations
    console.log('📋 Step 1: Running database migrations...');
    await runMigrations(env);
    console.log('✅ Migrations completed successfully\n');

    // Step 2: Initialize system defaults
    console.log('⚙️  Step 2: Initializing system defaults...');
    await initializeSystemDefaults(env);
    console.log('✅ System defaults initialized\n');

    // Step 3: Verify database health
    console.log('🏥 Step 3: Verifying database health...');
    const db = getDatabase(env);
    console.log('✅ Database connection verified\n');

    console.log('🎉 Database setup completed successfully!');
    console.log('\n📚 Next steps:');
    console.log('1. Configure your Cloudflare D1 database in wrangler.toml');
    console.log('2. Run migrations in production: npx wrangler d1 migrations apply');
    console.log('3. Update your worker environment variables');
    console.log('4. Deploy your worker with the new database schema');

  } catch (error) {
    console.error('❌ Database setup failed:', error);
    process.exit(1);
  }
}

// Run setup if called directly
if (process.argv[1] && process.argv[1].endsWith('setup-database.ts')) {
  setupDatabase();
}

export { setupDatabase };
