import { readFile, writeFile } from 'fs/promises';

export class HTMLService {
    constructor(logger = console) {
        this.logger = logger;
    }

    async generateIndexHTML(spieleConfigs, trainingConfigs, termineConfigs = [], templatePath = 'index.template.html', outputPath = 'docs/index.html') {
        try {
            this.logger.info('Reading HTML template...');
            const template = await readFile(templatePath, 'utf8');
            
            this.logger.info(`Generating HTML with ${spieleConfigs.length} spiele configs, ${trainingConfigs.length} training configs, and ${termineConfigs.length} termine configs`);
            
            // Process spiele configs for display
            const processedSpieleConfigs = spieleConfigs.map(config => {
                let displayName = config.teamId.toUpperCase();
                
                // Convert M or W prefix to lowercase for display
                if (displayName.startsWith('M') || displayName.startsWith('W')) {
                    displayName = displayName.charAt(0).toLowerCase() + displayName.slice(1);
                }
                
                return {
                    id: config.teamId,
                    name: displayName,
                    competitionId: config.competitionId,
                    teamName: config.teamName,
                    jsonUrl: config.jsonUrl,
                    icsFilename: config.icsFilename,
                    icsUrl: config.icsUrl,
                    webUrl: config.webUrl
                };
            });
            
            // Replace placeholders in template
            let html = template
                .replace(/\{\{\s*CALENDAR_CONFIGS\s*\}\}/g, JSON.stringify(processedSpieleConfigs, null, 8))
                .replace(/\{\{\s*SCHEDULE_CONFIGS\s*\}\}/g, JSON.stringify(trainingConfigs, null, 8))
                .replace(/\{\{\s*GENERAL_CONFIGS\s*\}\}/g, JSON.stringify(termineConfigs, null, 8));
            
            // Write the generated HTML
            await writeFile(outputPath, html, 'utf8');
            
            this.logger.info(`Successfully generated ${outputPath}`);
            
            return {
                outputPath,
                spieleCount: spieleConfigs.length,
                trainingCount: trainingConfigs.length,
                termineCount: termineConfigs.length
            };
            
        } catch (error) {
            this.logger.error('Failed to generate HTML:', error.message);
            throw error;
        }
    }
}