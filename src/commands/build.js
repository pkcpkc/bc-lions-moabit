import { FetchGamesCommand } from './fetchGames.js';
import { DownloadTermineCommand } from './downloadTermine.js';
import { BuildHTMLCommand } from './buildHTML.js';
import { ConfigService } from '../services/configService.js';
import { Logger } from '../services/logger.js';
import { config } from '../config/index.js';

export class BuildCommand {
    constructor(dependencies = {}) {
        this.logger = dependencies.logger || new Logger(config.logging.level);
        this.configService = dependencies.configService || new ConfigService(this.logger);
        this.fetchGamesCommand = dependencies.fetchGamesCommand || new FetchGamesCommand({ logger: this.logger });
        this.downloadTermineCommand = dependencies.downloadTermineCommand || new DownloadTermineCommand({ logger: this.logger });
        this.buildHTMLCommand = dependencies.buildHTMLCommand || new BuildHTMLCommand({ logger: this.logger });
    }

    async execute() {
        try {
            this.logger.info('🏀 BC Lions Moabit - Build All');
            this.logger.info('==============================');

            const results = {
                teams: { successful: 0, failed: 0, totalGames: 0 },
                termine: { downloadedCount: 0, errorCount: 0, totalConfigs: 0 },
                html: { success: false, teamCount: 0, termineCount: 0 }
            };

            // Step 1: Fetch games for all configured teams
            this.logger.info('📥 Step 1: Fetching games for all teams...');
            
            const teamConfigs = await this.configService.readTeamConfigs(config.paths.teamsDir);
            
            for (const teamConfig of teamConfigs) {
                try {
                    const result = await this.fetchGamesCommand.execute(teamConfig);
                    if (result.success) {
                        results.teams.successful++;
                        results.teams.totalGames += result.gamesFound;
                        this.logger.info(`✅ ${teamConfig.teamId}: ${result.gamesFound} games`);
                    } else {
                        results.teams.failed++;
                        this.logger.error(`❌ ${teamConfig.teamId}: ${result.error}`);
                    }
                } catch (error) {
                    results.teams.failed++;
                    this.logger.error(`❌ ${teamConfig.teamId}: ${error.message}`);
                }
            }

            // Step 2: Download termine ICS files
            this.logger.info('🗓️  Step 2: Downloading termine ICS files...');
            
            try {
                const termineResult = await this.downloadTermineCommand.execute();
                results.termine = termineResult;
            } catch (error) {
                this.logger.error('Failed to download termine:', error.message);
            }

            // Step 3: Generate HTML with updated data
            this.logger.info('🔨 Step 3: Building HTML with fresh data...');
            
            try {
                const htmlResult = await this.buildHTMLCommand.execute();
                results.html = { ...htmlResult, success: true };
            } catch (error) {
                this.logger.error('Failed to generate HTML:', error.message);
                results.html.success = false;
            }

            // Summary
            this.logger.info('\n📊 Build Summary:');
            this.logger.info(`  Teams: ${results.teams.successful} successful, ${results.teams.failed} failed`);
            this.logger.info(`  Total games: ${results.teams.totalGames}`);
            this.logger.info(`  Termine: ${results.termine.downloadedCount} downloaded, ${results.termine.errorCount} failed`);
            this.logger.info(`  HTML: ${results.html.success ? 'Generated successfully' : 'Failed to generate'}`);

            if (results.teams.failed > 0 || results.termine.errorCount > 0 || !results.html.success) {
                this.logger.warn('Build completed with some errors');
                return { success: false, results };
            } else {
                this.logger.info('🎉 Build completed successfully!');
                this.logger.info('📄 Generated docs/index.html with latest data');
                return { success: true, results };
            }

        } catch (error) {
            this.logger.error('Build process failed:', error.message);
            throw error;
        }
    }
}

// Convenience function for backward compatibility
export async function buildAll(dependencies = {}) {
    const command = new BuildCommand(dependencies);
    return await command.execute();
}