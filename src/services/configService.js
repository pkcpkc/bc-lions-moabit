import { readFile, readdir } from 'fs/promises';
import { join } from 'path';

export class ConfigService {
    constructor(logger = console) {
        this.logger = logger;
    }

    async readTeamConfigs(teamsDir = 'teams') {
        const configs = [];
        
        try {
            const files = await readdir(teamsDir);
            const jsonFiles = files.filter(file => file.endsWith('.json'));
            
            this.logger.info(`Found ${jsonFiles.length} team configuration files`);
            
            for (const file of jsonFiles) {
                try {
                    const filePath = join(teamsDir, file);
                    const content = await readFile(filePath, 'utf8');
                    const config = JSON.parse(content);
                    
                    // Validate required fields
                    if (!config.competitionId || !config.teamName || !config.teamId) {
                        this.logger.warn(`Skipping ${file}: Missing required fields (competitionId, teamName, teamId)`);
                        continue;
                    }
                    
                    configs.push({
                        file,
                        ...config,
                        icsFilename: `docs/ics/${teamsDir}/${config.teamId}.ics`,
                        icsUrl: `./ics/${teamsDir}/${config.teamId}.ics`,
                        jsonUrl: `./data/${teamsDir}/${config.teamId}.json`,
                        webUrl: `https://www.basketball-bund.net/static/#/liga/${config.competitionId}`
                    });
                    
                } catch (error) {
                    this.logger.warn(`Error processing ${file}:`, error.message);
                }
            }
            
            // Sort teams alphabetically by teamId
            configs.sort((a, b) => a.teamId.localeCompare(b.teamId));
            
            this.logger.info(`Successfully loaded ${configs.length} team configurations`);
            return configs;
            
        } catch (error) {
            this.logger.error(`Failed to read team configs from ${teamsDir}:`, error.message);
            throw error;
        }
    }

    async readTermineConfigs(termineDir = 'termine') {
        const configs = [];
        
        try {
            const files = await readdir(termineDir);
            const jsonFiles = files.filter(file => file.endsWith('.json'));
            
            this.logger.info(`Found ${jsonFiles.length} termine configuration files`);
            
            for (const file of jsonFiles) {
                try {
                    const filePath = join(termineDir, file);
                    const content = await readFile(filePath, 'utf8');
                    const config = JSON.parse(content);
                    
                    // Validate required fields
                    if (!config.label || !config.calId) {
                        this.logger.warn(`Skipping ${file}: Missing required fields (label, calId)`);
                        continue;
                    }
                    
                    const id = file.replace('.json', '');
                    
                    const termineConfig = {
                        id,
                        label: config.label,
                        calId: config.calId,
                        icsFilename: `docs/ics/${termineDir}/${id}.ics`,
                        icsUrl: `./ics/${termineDir}/${id}.ics`,
                        jsonUrl: `./data/${termineDir}/${id}.json`
                    };
                    
                    // Include teams array if present
                    if (config.teams) {
                        termineConfig.teams = config.teams;
                    }
                    
                    configs.push(termineConfig);
                    
                } catch (error) {
                    this.logger.warn(`Error processing ${file}:`, error.message);
                }
            }
            
            // Sort termine alphabetically by label
            configs.sort((a, b) => a.label.localeCompare(b.label));
            
            this.logger.info(`Successfully loaded ${configs.length} termine configurations`);
            return configs;
            
        } catch (error) {
            this.logger.error(`Failed to read termine configs from ${termineDir}:`, error.message);
            throw error;
        }
    }

    async readCalendarConfigs(sourceDir, outputType = 'termine') {
        const configs = [];
        
        try {
            const files = await readdir(sourceDir);
            const jsonFiles = files.filter(file => file.endsWith('.json'));
            
            this.logger.info(`Found ${jsonFiles.length} calendar configuration files in ${sourceDir}`);
            
            for (const file of jsonFiles) {
                try {
                    const filePath = join(sourceDir, file);
                    const content = await readFile(filePath, 'utf8');
                    const config = JSON.parse(content);
                    
                    // Validate required fields
                    if (!config.label || !config.calId) {
                        this.logger.warn(`Skipping ${file}: Missing required fields (label, calId)`);
                        continue;
                    }
                    
                    const id = file.replace('.json', '').toLowerCase().replace(/[^a-z0-9]/g, '-');
                    
                    const calendarConfig = {
                        id,
                        label: config.label,
                        calId: config.calId,
                        icsFilename: `docs/ics/${sourceDir}/${id}.ics`,
                        icsUrl: `./ics/${sourceDir}/${id}.ics`,
                        jsonUrl: `./data/${sourceDir}/${id}.json`,
                        type: outputType
                    };
                    
                    // Include teams array if present
                    if (config.teams) {
                        calendarConfig.teams = config.teams;
                    }
                    
                    configs.push(calendarConfig);
                    
                } catch (error) {
                    this.logger.warn(`Error processing ${file}:`, error.message);
                }
            }
            
            // Sort calendar configs alphabetically by label
            configs.sort((a, b) => a.label.localeCompare(b.label));
            
            this.logger.info(`Successfully loaded ${configs.length} calendar configurations from ${sourceDir}`);
            return configs;
            
        } catch (error) {
            this.logger.error(`Failed to read calendar configs from ${sourceDir}:`, error.message);
            throw error;
        }
    }
}