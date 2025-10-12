import { promises as fs } from 'fs';
import path from 'path';
import { HttpClient } from '../services/httpClient.js';
import { TermineService } from '../services/termineService.js';
import { ConfigService } from '../services/configService.js';
import { Logger } from '../services/logger.js';
import { config } from '../config/index.js';

export class DownloadTermineCommand {
    constructor(dependencies = {}) {
        this.logger = dependencies.logger || new Logger(config.logging.level);
        this.httpClient = dependencies.httpClient || new HttpClient(
            'https://calendar.google.com', 
            config.api.timeout, 
            this.logger
        );
        this.termineService = dependencies.termineService || new TermineService(this.httpClient, this.logger);
        this.configService = dependencies.configService || new ConfigService(this.logger);
    }

    async cleanExistingTermine() {
        try {
            this.logger.info('🧹 Cleaning existing termine files...');
            
            // Read all files in the termine output directory
            const files = await fs.readdir(config.paths.termineOutputDir);
            
            // Filter for .ics files
            const icsFiles = files.filter(file => path.extname(file) === '.ics');
            
            if (icsFiles.length === 0) {
                this.logger.info('No existing termine files to clean');
                return;
            }
            
            // Remove each .ics file
            for (const file of icsFiles) {
                const filePath = path.join(config.paths.termineOutputDir, file);
                await fs.unlink(filePath);
                this.logger.debug(`Removed: ${file}`);
            }
            
            this.logger.info(`✅ Cleaned ${icsFiles.length} existing termine files`);
            
        } catch (error) {
            // If directory doesn't exist, that's fine - no files to clean
            if (error.code === 'ENOENT') {
                this.logger.debug('Termine directory does not exist - nothing to clean');
                return;
            }
            
            this.logger.error('Failed to clean existing termine files:', error.message);
            throw error;
        }
    }

    async execute() {
        try {
            this.logger.info('🗓️  Starting termine download process...');

            // Read termine configurations
            const termineConfigs = await this.configService.readTermineConfigs('termine');

            if (termineConfigs.length === 0) {
                this.logger.warn('No termine configurations found');
                return { downloadedCount: 0, errorCount: 0, totalConfigs: 0 };
            }

            // Ensure output directory exists
            await fs.mkdir(config.paths.termineOutputDir, { recursive: true });

            // Clean existing termine files to avoid stale content
            await this.cleanExistingTermine();

            let downloadedCount = 0;
            let errorCount = 0;

            // Download each calendar
            for (const termineConfig of termineConfigs) {
                try {
                    this.logger.info(`Downloading: ${termineConfig.label}`);
                    
                    const icsContent = await this.termineService.downloadCalendar(termineConfig.calId);
                    
                    // Save to file (HttpClient returns text for calendar URLs)
                    await fs.writeFile(termineConfig.icsFilename, icsContent, 'utf8');
                    
                    downloadedCount++;
                    this.logger.info(`✅ Downloaded: ${termineConfig.label} -> ${termineConfig.icsFilename}`);
                    
                } catch (error) {
                    errorCount++;
                    this.logger.error(`❌ Failed to download ${termineConfig.label}:`, error.message);
                }
            }

            const result = {
                downloadedCount,
                errorCount,
                totalConfigs: termineConfigs.length
            };

            this.logger.info(`📥 Download complete: ${downloadedCount} successful, ${errorCount} failed`);

            return result;

        } catch (error) {
            this.logger.error('Failed to download termine:', error.message);
            throw error;
        }
    }
}

// Convenience function for backward compatibility
export async function downloadTermineIcsFiles(dependencies = {}) {
    const command = new DownloadTermineCommand(dependencies);
    return await command.execute();
}