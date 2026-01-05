import { writeFile, mkdir, rm } from 'fs/promises';
import { join } from 'path';
import { HttpClient } from '../services/httpClient.js';
import { CrawlService } from '../services/crawlService.js';
import { TeamDiscoveryService } from '../services/teamDiscoveryService.js';
import { Logger } from '../services/logger.js';
import { config } from '../config/index.js';

export class CrawlCommand {
    constructor(dependencies = {}) {
        this.logger = dependencies.logger || new Logger(config.logging.level);
        this.httpClient = dependencies.httpClient || new HttpClient(
            'https://www.basketball-bund.net',
            config.api.timeout,
            this.logger
        );
        this.teamDiscoveryService = dependencies.teamDiscoveryService || new TeamDiscoveryService(this.logger);
        this.crawlService = dependencies.crawlService || new CrawlService(
            this.httpClient,
            this.teamDiscoveryService,
            this.logger
        );
    }

    async execute(options = {}) {
        const {
            verbandId = 3, // Berlin
            teamNameToSearch = "BC Lions",
            outputDir = "spiele"
        } = options;

        try {
            this.logger.info('🏀 Starting BC Lions team discovery crawl...');

            // Discover teams
            const teams = await this.crawlService.discoverTeams(verbandId, teamNameToSearch);

            if (teams.length === 0) {
                this.logger.warn("⚠️  No teams found. Exiting without creating files.");
                return {
                    success: true,
                    teamsFound: 0,
                    filesCreated: 0,
                    errors: 0,
                    teams: []
                };
            }

            // Ensure output directory exists and is empty
            await rm(outputDir, { recursive: true, force: true });
            await mkdir(outputDir, { recursive: true });

            this.logger.info("📝 Creating configuration files...");
            let createdFiles = 0;
            let errors = 0;
            const createdConfigs = [];

            for (const team of teams) {
                try {
                    const teamConfig = this.teamDiscoveryService.createTeamConfig(
                        { teamname: team.teamName },
                        team.competitionId,
                        team.competitionName
                    );

                    const filename = join(outputDir, `${teamConfig.teamId}.json`);
                    await writeFile(filename, JSON.stringify(teamConfig, null, 2), 'utf8');

                    this.logger.info(`✅ Created: ${filename} (${team.teamName})`);
                    createdFiles++;
                    createdConfigs.push({
                        filename,
                        teamConfig,
                        teamName: team.teamName
                    });

                } catch (error) {
                    this.logger.error(`❌ Failed to create config for ${team.teamName}:`, error.message);
                    errors++;
                }
            }

            const result = {
                success: true,
                teamsFound: teams.length,
                filesCreated: createdFiles,
                errors: errors,
                teams: createdConfigs
            };

            this.logger.info(`🎉 Crawl completed successfully!`);
            this.logger.info(`📊 Summary: ${createdFiles} files created, ${errors} errors`);

            return result;

        } catch (error) {
            this.logger.error('Crawl process failed:', error.message);
            throw error;
        }
    }
}

// Convenience function for backward compatibility
export async function crawlTeams(dependencies = {}, options = {}) {
    const command = new CrawlCommand(dependencies);
    return await command.execute(options);
}