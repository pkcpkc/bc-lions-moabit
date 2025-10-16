import { promises as fs } from 'fs';
import path from 'path';
import ICAL from 'ical.js';
import { HttpClient } from '../services/httpClient.js';
import { TermineService } from '../services/termineService.js';
import { ConfigService } from '../services/configService.js';
import { Logger } from '../services/logger.js';
import { config } from '../config/index.js';

// Constants for output paths
const TERMINE_JSON_DIR = 'docs/data/termine';

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

    async parseIcsToJson(icsContent, termineConfig) {
        try {
            const jcalData = ICAL.parse(icsContent);
            const comp = new ICAL.Component(jcalData);
            const vevents = comp.getAllSubcomponents('vevent');

            const allEvents = [];
            const now = new Date();
            const oneMonthLater = new Date();
            oneMonthLater.setMonth(now.getMonth() + 1);

            vevents.forEach(vevent => {
                const event = new ICAL.Event(vevent);

                // Handle recurring events properly
                if (event.isRecurring()) {
                    const iterator = event.iterator();
                    let next;

                    // Get exception dates (deleted instances)
                    const exceptionDates = event.component.getAllProperties('exdate')
                        .map(exdate => exdate.getFirstValue().toJSDate().getTime());

                    // Expand recurring events within our date range (next month)
                    while ((next = iterator.next()) && next.toJSDate() <= oneMonthLater) {
                        const eventDate = next.toJSDate();
                        
                        // Skip if this date is an exception (deleted instance)
                        if (exceptionDates.includes(eventDate.getTime())) {
                            continue;
                        }
                        
                        if (eventDate >= now) {
                            const endTime = new Date(eventDate);
                            endTime.setTime(eventDate.getTime() + (event.endDate.toJSDate() - event.startDate.toJSDate()));

                            allEvents.push({
                                summary: event.summary,
                                startDate: eventDate.toISOString(),
                                endDate: endTime.toISOString(),
                                location: event.location || '',
                                description: event.description || ''
                            });
                        }
                    }
                } else {
                    // Non-recurring event
                    const eventDate = event.startDate.toJSDate();
                    allEvents.push({
                        summary: event.summary,
                        startDate: eventDate.toISOString(),
                        endDate: event.endDate.toJSDate().toISOString(),
                        location: event.location || '',
                        description: event.description || ''
                    });
                }
            });

            return {
                label: termineConfig.label,
                id: termineConfig.id,
                calId: termineConfig.calId,
                lastUpdated: new Date().toISOString(),
                events: allEvents
            };

        } catch (error) {
            this.logger.error(`Failed to parse ICS content for ${termineConfig.label}:`, error.message);
            return {
                label: termineConfig.label,
                id: termineConfig.id,
                calId: termineConfig.calId,
                lastUpdated: new Date().toISOString(),
                events: []
            };
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

            // Ensure output directories exist
            await fs.mkdir(config.paths.termineOutputDir, { recursive: true });
            await fs.mkdir(TERMINE_JSON_DIR, { recursive: true });

            // Clean existing termine files to avoid stale content
            await this.cleanExistingTermine();

            let downloadedCount = 0;
            let errorCount = 0;

            // Download each calendar
            for (const termineConfig of termineConfigs) {
                try {
                    this.logger.info(`Downloading: ${termineConfig.label}`);
                    
                    const icsContent = await this.termineService.downloadCalendar(termineConfig.calId);
                    
                    // Save ICS file
                    await fs.writeFile(termineConfig.icsFilename, icsContent, 'utf8');
                    
                    // Parse ICS content to JSON and save JSON file
                    const jsonData = await this.parseIcsToJson(icsContent, termineConfig);
                    const jsonFilename = path.join(TERMINE_JSON_DIR, `${termineConfig.id}.json`);
                    await fs.writeFile(jsonFilename, JSON.stringify(jsonData, null, 2), 'utf8');
                    
                    downloadedCount++;
                    this.logger.info(`✅ Downloaded: ${termineConfig.label} -> ${termineConfig.icsFilename}`);
                    this.logger.info(`✅ Created JSON: ${jsonFilename}`);
                    
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