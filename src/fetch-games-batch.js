import { readdir, readFile, unlink, mkdir } from 'fs/promises';
import { join, extname } from 'path';
import { FetchGamesCommand } from './commands/fetchGames.js';
import { Logger } from './services/logger.js';
import { config } from './config/index.js';

async function cleanExistingSpiele(logger) {
    try {
        logger.info('🧹 Cleaning existing spiele files...');
        
        // Ensure output directory exists
        await mkdir(config.paths.outputDir, { recursive: true });
        
        // Read all files in the spiele output directory
        const files = await readdir(config.paths.outputDir);
        
        // Filter for .ics files
        const icsFiles = files.filter(file => extname(file) === '.ics');
        
        if (icsFiles.length === 0) {
            logger.info('No existing spiele files to clean');
            return;
        }
        
        // Remove each .ics file
        for (const file of icsFiles) {
            const filePath = join(config.paths.outputDir, file);
            await unlink(filePath);
            logger.debug(`Removed: ${file}`);
        }
        
        logger.info(`✅ Cleaned ${icsFiles.length} existing spiele files`);
        
    } catch (error) {
        // If directory doesn't exist, that's fine - no files to clean
        if (error.code === 'ENOENT') {
            logger.debug('Spiele directory does not exist - nothing to clean');
            return;
        }
        
        logger.error('Failed to clean existing spiele files:', error.message);
        throw error;
    }
}

async function main() {
    const logger = new Logger(config.logging.level);
    const fetchCommand = new FetchGamesCommand({ logger });

    try {
        logger.info('🏀 BC Lions Moabit - Fetch All Teams');
        logger.info('Starting batch fetch for all teams');

        // Clean existing spiele files to avoid stale content
        await cleanExistingSpiele(logger);

        // Read all team configuration files
        const teamFiles = await readdir(config.paths.teamsDir);
        const jsonFiles = teamFiles.filter(file => file.endsWith('.json'));

        if (jsonFiles.length === 0) {
            logger.warn(`No team configuration files found in ${config.paths.teamsDir}`);
            logger.info('Create JSON config files like u11.json, u12.json with the required structure.');
            return;
        }

        logger.info(`📋 Found ${jsonFiles.length} team configuration files`);

        // Log team configurations
        for (const file of jsonFiles) {
            try {
                const filePath = join(config.paths.teamsDir, file);
                const teamConfig = JSON.parse(await readFile(filePath, 'utf8'));
                logger.info(`  - ${file}: ${teamConfig.teamName} (League ${teamConfig.competitionId})`);
            } catch (error) {
                logger.warn(`  - ${file}: ❌ Error reading config - ${error.message}`);
            }
        }

        const results = [];

        // Process each team
        for (const file of jsonFiles) {
            try {
                const filePath = join(config.paths.teamsDir, file);
                const teamConfig = JSON.parse(await readFile(filePath, 'utf8'));
                
                logger.info(`\n🔄 Processing ${file}...`);
                
                const result = await fetchCommand.execute(teamConfig);
                results.push({ file, ...result });
                
                if (result.success) {
                    logger.info(`✅ ${file}: ${result.gamesFound} games found`);
                } else {
                    logger.error(`❌ ${file}: ${result.error}`);
                }
                
            } catch (error) {
                logger.error(`❌ Failed to process ${file}:`, error.message);
                results.push({ 
                    file, 
                    success: false, 
                    error: error.message,
                    gamesFound: 0
                });
            }
        }

        // Summary
        const successful = results.filter(r => r.success).length;
        const failed = results.length - successful;
        const totalGames = results.reduce((sum, r) => sum + (r.gamesFound || 0), 0);
        
        logger.info(`\n📊 Batch processing complete:`);
        logger.info(`  ✅ Success: ${successful}`);
        logger.info(`  ❌ Failed: ${failed}`);
        logger.info(`  🏀 Total games: ${totalGames}`);
        
        if (failed > 0) {
            logger.warn('Failed teams:', results.filter(r => !r.success).map(r => r.file));
        }

        // Exit with error code if any failed
        if (failed > 0) {
            process.exit(1);
        }

    } catch (error) {
        logger.error('Batch processing failed:', error.message);
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

export { main };