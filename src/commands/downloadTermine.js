import { promises as fs } from 'fs';
import path from 'path';
import ICAL from 'ical.js';
import { HttpClient } from '../services/httpClient.js';
import { TermineService } from '../services/termineService.js';
import { ConfigService } from '../services/configService.js';
import { Logger } from '../services/logger.js';
import { config } from '../config/index.js';

// Constants for output paths
const TRAINING_JSON_DIR = 'docs/data/training';
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

    async cleanExistingFiles() {
        try {
            this.logger.info('🧹 Cleaning existing calendar files...');
            
            const directories = [config.paths.trainingOutputDir, 'docs/ics/termine'];
            let totalCleaned = 0;
            
            for (const dir of directories) {
                try {
                    // Read all files in the directory
                    const files = await fs.readdir(dir);
                    
                    // Filter for .ics files
                    const icsFiles = files.filter(file => path.extname(file) === '.ics');
                    
                    if (icsFiles.length > 0) {
                        // Remove each .ics file
                        for (const file of icsFiles) {
                            const filePath = path.join(dir, file);
                            await fs.unlink(filePath);
                            this.logger.debug(`Removed: ${file} from ${dir}`);
                        }
                        totalCleaned += icsFiles.length;
                    }
                } catch (error) {
                    if (error.code === 'ENOENT') {
                        this.logger.debug(`Directory ${dir} does not exist - nothing to clean`);
                    } else {
                        throw error;
                    }
                }
            }
            
            if (totalCleaned > 0) {
                this.logger.info(`✅ Cleaned ${totalCleaned} existing calendar files`);
            } else {
                this.logger.info('No existing calendar files to clean');
            }
            
        } catch (error) {
            this.logger.error('Failed to clean existing calendar files:', error.message);
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
                            
                            // Handle all-day events: DTEND is exclusive, so adjust for proper display
                            let adjustedEndTime = endTime;
                            if (event.startDate.isDate && event.endDate.isDate) {
                                // For all-day events, subtract one day from end date if it's different from start
                                const startDateOnly = new Date(eventDate.getFullYear(), eventDate.getMonth(), eventDate.getDate());
                                const endDateOnly = new Date(endTime.getFullYear(), endTime.getMonth(), endTime.getDate());
                                
                                if (endDateOnly.getTime() > startDateOnly.getTime()) {
                                    adjustedEndTime = new Date(endTime);
                                    adjustedEndTime.setDate(endTime.getDate() - 1);
                                }
                            }

                            allEvents.push({
                                summary: event.summary,
                                startDate: eventDate.toISOString(),
                                endDate: adjustedEndTime.toISOString(),
                                location: event.location || '',
                                description: event.description || ''
                            });
                        }
                    }
                } else {
                    // Non-recurring event
                    const eventDate = event.startDate.toJSDate();
                    let endDate = event.endDate.toJSDate();
                    
                    // Handle all-day events: DTEND is exclusive, so adjust for proper display
                    if (event.startDate.isDate && event.endDate.isDate) {
                        // For all-day events, subtract one day from end date if it's different from start
                        const startDateOnly = new Date(eventDate.getFullYear(), eventDate.getMonth(), eventDate.getDate());
                        const endDateOnly = new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate());
                        
                        if (endDateOnly.getTime() > startDateOnly.getTime()) {
                            endDate = new Date(endDate);
                            endDate.setDate(endDate.getDate() - 1);
                        }
                    }
                    
                    allEvents.push({
                        summary: event.summary,
                        startDate: eventDate.toISOString(),
                        endDate: endDate.toISOString(),
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

            // Read training configurations (was termine)
            const trainingConfigs = await this.configService.readCalendarConfigs('training', 'training');
            
            // Read termine configurations (was general)
            const termineConfigs = this.configService.readCalendarConfigs ? 
                await this.configService.readCalendarConfigs('termine', 'termine') : [];
            
            // Combine both types of configs
            const allConfigs = [...trainingConfigs, ...termineConfigs];

            if (allConfigs.length === 0) {
                this.logger.warn('No training or termine configurations found');
                return { downloadedCount: 0, errorCount: 0, totalConfigs: 0 };
            }
            
            this.logger.info(`Processing ${trainingConfigs.length} training configs and ${termineConfigs.length} termine configs`);

            // Ensure output directories exist
            await fs.mkdir(config.paths.trainingOutputDir, { recursive: true });
            await fs.mkdir('docs/ics/termine', { recursive: true });
            await fs.mkdir(TRAINING_JSON_DIR, { recursive: true });
            await fs.mkdir(TERMINE_JSON_DIR, { recursive: true });

            // Clean existing calendar files to avoid stale content
            await this.cleanExistingFiles();

            let downloadedCount = 0;
            let errorCount = 0;

            // Download each calendar
            for (const termineConfig of allConfigs) {
                try {
                    this.logger.info(`Downloading: ${termineConfig.label}`);
                    
                    const icsContent = await this.termineService.downloadCalendar(termineConfig.calId);
                    
                    // Save ICS file
                    await fs.writeFile(termineConfig.icsFilename, icsContent, 'utf8');
                    
                    // Parse ICS content to JSON and save JSON file
                    const jsonData = await this.parseIcsToJson(icsContent, termineConfig);
                    // Determine the correct JSON directory based on the config
                    const jsonDir = termineConfig.type === 'training' ? TRAINING_JSON_DIR : TERMINE_JSON_DIR;
                    const jsonFilename = path.join(jsonDir, `${termineConfig.id}.json`);
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
                totalConfigs: allConfigs.length
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