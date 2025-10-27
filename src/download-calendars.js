#!/usr/bin/env node
import { DownloadTermineCommand } from './commands/downloadTermine.js';
import { Logger } from './services/logger.js';
import { config } from './config/index.js';

async function main() {
    const logger = new Logger(config.logging.level);
    
    try {
        const command = new DownloadTermineCommand({ logger });
        const result = await command.execute();
        
        if (result.errorCount > 0) {
            logger.warn(`Completed with ${result.errorCount} errors`);
            process.exit(1);
        } else {
            logger.info('✅ All termine downloaded successfully!');
        }
        
    } catch (error) {
        console.error('❌ Download termine failed:', error.message);
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