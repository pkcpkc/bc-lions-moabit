import { ConfigService } from '../services/configService.js';
import { HTMLService } from '../services/htmlService.js';
import { Logger } from '../services/logger.js';
import { config } from '../config/index.js';

export class BuildHTMLCommand {
    constructor(dependencies = {}) {
        this.logger = dependencies.logger || new Logger(config.logging.level);
        this.configService = dependencies.configService || new ConfigService(this.logger);
        this.htmlService = dependencies.htmlService || new HTMLService(this.logger);
    }

    async execute() {
        try {
            this.logger.info('🔨 Starting HTML generation process...');

            // Read team configurations
            const teamConfigs = await this.configService.readTeamConfigs(config.paths.teamsDir);

            // Read termine configurations
            const termineConfigs = await this.configService.readTermineConfigs('termine');

            // Generate HTML
            const result = await this.htmlService.generateIndexHTML(
                teamConfigs, 
                termineConfigs,
                'index.template.html',
                'docs/index.html'
            );

            this.logger.info('✅ HTML generation completed successfully!');

            return result;

        } catch (error) {
            this.logger.error('Failed to generate HTML:', error.message);
            throw error;
        }
    }
}

// Convenience function for backward compatibility
export async function generateIndexHTML(dependencies = {}) {
    const command = new BuildHTMLCommand(dependencies);
    return await command.execute();
}