#!/usr/bin/env node
import { BuildHTMLCommand } from './commands/buildHTML.js';
import { Logger } from './services/logger.js';
import { config } from './config/index.js';

async function main() {
    const logger = new Logger(config.logging.level);
    
    try {
        logger.info('🔨 Generating index.html from available configurations...');
        
        const command = new BuildHTMLCommand({ logger });
        const result = await command.execute();
        
        logger.info(`✅ HTML generation completed successfully!`);
        logger.info(`   Teams: ${result.teamCount}, Termine: ${result.termineCount}`);
        logger.info(`   Output: ${result.outputPath}`);
        
    } catch (error) {
        console.error('❌ HTML generation failed:', error.message);
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