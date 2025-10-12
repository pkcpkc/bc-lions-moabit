import { promises as fs } from 'fs';
import path from 'path';
import { HttpClient } from '../services/httpClient.js';
import { GamesService } from '../services/gamesService.js';
import { ICSService } from '../services/icsService.js';
import { Logger } from '../services/logger.js';
import { config } from '../config/index.js';

export class FetchGamesCommand {
    constructor(dependencies = {}) {
        this.logger = dependencies.logger || new Logger(config.logging.level);
        this.httpClient = dependencies.httpClient || new HttpClient(
            config.api.baseUrl, 
            config.api.timeout, 
            this.logger
        );
        this.gamesService = dependencies.gamesService || new GamesService(this.httpClient, this.logger);
        this.icsService = dependencies.icsService || new ICSService(this.logger);
    }

    async execute(teamConfig) {
        try {
            this.logger.info(`Starting fetch for team: ${teamConfig.teamName}`);

            // Validate required config fields
            if (!teamConfig.competitionId || !teamConfig.teamName || !teamConfig.teamId) {
                throw new Error("Config must contain: competitionId, teamName, teamId");
            }

            // Fetch competition data
            const competitionData = await this.gamesService.fetchCompetition(teamConfig.competitionId);
            
            if (!competitionData?.data?.matches) {
                this.logger.warn('No matches found in competition data');
                return this.createEmptyResult(teamConfig);
            }

            // Filter games for the specific team
            const teamMatches = this.gamesService.filterTeamGames(
                competitionData.data.matches, 
                teamConfig.teamName
            );

            if (teamMatches.length === 0) {
                this.logger.warn(`No games found for team: ${teamConfig.teamName}`);
                return this.createEmptyResult(teamConfig);
            }

            this.logger.info(`Found ${teamMatches.length} matches for ${teamConfig.teamName}`);

            // Enrich games with venue details
            const enrichedGames = await this.gamesService.enrichGamesWithDetails(teamMatches);

            // Generate ICS content
            const icsContent = this.icsService.generateICS(
                enrichedGames, 
                `${teamConfig.teamName} - Spielplan`
            );

            // Ensure output directory exists
            await fs.mkdir(config.paths.outputDir, { recursive: true });

            // Save ICS file
            const filename = path.join(config.paths.outputDir, `${teamConfig.teamId}.ics`);
            await this.icsService.saveICS(icsContent, filename);

            this.logger.info(`Successfully generated calendar for ${teamConfig.teamName}`);
            
            return {
                teamName: teamConfig.teamName,
                teamId: teamConfig.teamId,
                gamesFound: enrichedGames.length,
                filename,
                success: true
            };

        } catch (error) {
            this.logger.error(`Failed to fetch games for ${teamConfig.teamName}:`, error.message);
            return {
                teamName: teamConfig.teamName,
                teamId: teamConfig.teamId,
                gamesFound: 0,
                filename: null,
                success: false,
                error: error.message
            };
        }
    }

    createEmptyResult(teamConfig) {
        return {
            teamName: teamConfig.teamName,
            teamId: teamConfig.teamId,
            gamesFound: 0,
            filename: null,
            success: true
        };
    }
}

// Convenience function for backward compatibility and CLI usage
export async function fetchGamesCommand(teamConfig, dependencies = {}) {
    const command = new FetchGamesCommand(dependencies);
    return await command.execute(teamConfig);
}