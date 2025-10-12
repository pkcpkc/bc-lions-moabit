#!/usr/bin/env node
import { BuildCommand } from './commands/build.js';
import { Logger } from './services/logger.js';
import { config } from './config/index.js';

async function main() {
    const logger = new Logger(config.logging.level);
    
    try {
        const command = new BuildCommand({ logger });
        const result = await command.execute();
        
        if (!result.success) {
            process.exit(1);
        }
        
    } catch (error) {
        console.error('❌ Build process failed:', error.message);
        process.exit(1);
    }
}

// Run if this is the main module
if (import.meta.url === `file://${process.argv[1]}`) {
    main().catch(error => {
        console.error('Unhandled error:', error);
        process.exit(1);
    });
}