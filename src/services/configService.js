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
                        icsFilename: `docs/ics/spiele/${config.teamId}.ics`,
                        icsUrl: `./ics/spiele/${config.teamId}.ics`,
                        jsonUrl: `./data/spiele/${config.teamId}.json`,
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
                    
                    configs.push({
                        id,
                        label: config.label,
                        calId: config.calId,
                        icsFilename: `docs/ics/termine/${id}.ics`,
                        icsUrl: `./ics/termine/${id}.ics`,
                        jsonUrl: `./data/termine/${id}.json`
                    });
                    
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
}