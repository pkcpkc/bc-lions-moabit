#!/usr/bin/env node
import { readFile } from 'fs/promises';
import { join } from 'path';
import { FetchGamesCommand } from './commands/fetchGames.js';
import { Logger } from './services/logger.js';
import { config } from './config/index.js';

async function main() {
    // Read config file from command line argument
    if (process.argv.length < 3) {
        console.error("Usage: node src/fetch-games-single.js <config-file>");
        console.error("Example: node src/fetch-games-single.js u12.json");
        process.exit(1);
    }

    const configFileName = process.argv[2];
    const configFile = join(config.paths.teamsDir, configFileName);
    
    const logger = new Logger(config.logging.level);
    
    try {
        // Read and parse config
        const configContent = await readFile(configFile, 'utf8');
        const teamConfig = JSON.parse(configContent);
        
        logger.info(`🏀 Processing single team: ${teamConfig.teamName}`);
        
        // Execute fetch command
        const fetchCommand = new FetchGamesCommand({ logger });
        const result = await fetchCommand.execute(teamConfig);
        
        if (result.success) {
            console.log(`\n✅ Success: Generated calendar for ${result.teamName}`);
            console.log(`   Games found: ${result.gamesFound}`);
            console.log(`   File saved: ${result.filename}`);
        } else {
            console.error(`\n❌ Failed: ${result.error}`);
            process.exit(1);
        }
        
    } catch (error) {
        if (error.code === 'ENOENT') {
            logger.error(`Config file not found: ${configFile}`);
            logger.info('Available config files in teams/ directory:');
            
            try {
                const { readdir } = await import('fs/promises');
                const files = await readdir(config.paths.teamsDir);
                const jsonFiles = files.filter(f => f.endsWith('.json'));
                jsonFiles.forEach(file => logger.info(`  - ${file}`));
            } catch (dirError) {
                logger.error('Could not read teams directory');
            }
        } else if (error instanceof SyntaxError) {
            logger.error(`Invalid JSON in config file ${configFile}:`, error.message);
        } else {
            logger.error(`Error processing ${configFileName}:`, error.message);
        }
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