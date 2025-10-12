import { readFile, writeFile } from 'fs/promises';

export class HTMLService {
    constructor(logger = console) {
        this.logger = logger;
    }

    async generateIndexHTML(teamConfigs, termineConfigs, templatePath = 'index.template.html', outputPath = 'docs/index.html') {
        try {
            this.logger.info('Reading HTML template...');
            const template = await readFile(templatePath, 'utf8');
            
            this.logger.info(`Generating HTML with ${teamConfigs.length} team configs and ${termineConfigs.length} termine configs`);
            
            // Process team configs for display
            const processedTeamConfigs = teamConfigs.map(config => {
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
                    icsFilename: config.icsFilename,
                    icsUrl: config.icsUrl,
                    webUrl: config.webUrl
                };
            });
            
            // Replace placeholders in template
            let html = template
                .replace(/\{\{\s*CALENDAR_CONFIGS\s*\}\}/g, JSON.stringify(processedTeamConfigs, null, 8))
                .replace(/\{\{\s*SCHEDULE_CONFIGS\s*\}\}/g, JSON.stringify(termineConfigs, null, 8));
            
            // Write the generated HTML
            await writeFile(outputPath, html, 'utf8');
            
            this.logger.info(`Successfully generated ${outputPath}`);
            
            return {
                outputPath,
                teamCount: teamConfigs.length,
                termineCount: termineConfigs.length
            };
            
        } catch (error) {
            this.logger.error('Failed to generate HTML:', error.message);
            throw error;
        }
    }
}