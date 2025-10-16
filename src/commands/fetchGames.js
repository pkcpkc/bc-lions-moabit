import { promises as fs } from 'fs';
import path from 'path';
import { HttpClient } from '../services/httpClient.js';
import { GamesService } from '../services/gamesService.js';
import { ICSService } from '../services/icsService.js';
import { Logger } from '../services/logger.js';
import { config } from '../config/index.js';

// Constants for output paths
const SPIELE_JSON_DIR = 'docs/data/spiele';

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
                return await this.createEmptyResult(teamConfig);
            }

            // Filter games for the specific team
            const teamMatches = this.gamesService.filterTeamGames(
                competitionData.data.matches,
                teamConfig.teamName
            );

            if (teamMatches.length === 0) {
                this.logger.warn(`No games found for team: ${teamConfig.teamName}`);
                return await this.createEmptyResult(teamConfig);
            }

            this.logger.info(`Found ${teamMatches.length} matches for ${teamConfig.teamName}`);

            // Enrich games with venue details
            const enrichedGames = await this.gamesService.enrichGamesWithDetails(teamMatches);

            // Generate ICS content
            const icsContent = this.icsService.generateICS(
                enrichedGames,
                `${teamConfig.teamName} - Spielplan`
            );

            // Ensure output directories exist
            await fs.mkdir(config.paths.outputDir, { recursive: true });
            await fs.mkdir(SPIELE_JSON_DIR, { recursive: true });

            // Save ICS file
            const filename = path.join(config.paths.outputDir, `${teamConfig.teamId}.ics`);
            await this.icsService.saveICS(icsContent, filename);

            // Save JSON file with harmonized event format
            const jsonFilename = path.join(SPIELE_JSON_DIR, `${teamConfig.teamId}.json`);
            const harmonizedEvents = this.transformGamesToEvents(enrichedGames);
            const jsonData = {
                teamName: teamConfig.teamName,
                teamId: teamConfig.teamId,
                competitionId: teamConfig.competitionId,
                lastUpdated: new Date().toISOString(),
                events: harmonizedEvents
            };
            await fs.writeFile(jsonFilename, JSON.stringify(jsonData, null, 2), 'utf-8');

            this.logger.info(`Saved JSON data to: ${jsonFilename}`);

            this.logger.info(`Successfully generated calendar and JSON data for ${teamConfig.teamName}`);

            return {
                teamName: teamConfig.teamName,
                teamId: teamConfig.teamId,
                gamesFound: enrichedGames.length,
                filename,
                jsonFilename,
                success: true
            };

        } catch (error) {
            this.logger.error(`Failed to fetch games for ${teamConfig.teamName}:`, error.message);
            return {
                teamName: teamConfig.teamName,
                teamId: teamConfig.teamId,
                gamesFound: 0,
                filename: null,
                jsonFilename: null,
                success: false,
                error: error.message
            };
        }
    }

    transformGamesToEvents(games) {
        return games.map(game => {
            // Create game date from date and time
            const gameDate = new Date(`${game.date}T${game.time}:00`);
            const endDate = new Date(gameDate);
            endDate.setHours(gameDate.getHours() + 2); // Assume 2-hour duration

            // Create summary from home vs guest
            const summary = `${game.home} vs ${game.guest}`;

            // Transform to harmonized event format
            const event = {
                summary,
                startDate: gameDate.toISOString(),
                endDate: endDate.toISOString()
            };

            // Add location from street, zip, city (excluding venue name)
            if (game.venue) {
                event.venueName = game.venue.name;
                const locationParts = [
                    game.venue.street,
                    game.venue.zip,
                    game.venue.city
                ].filter(part => part && part.trim()); // Remove empty parts

                if (locationParts.length > 0) {
                    event.location = locationParts.join(', ');
                }
            }

            // Add game-specific information
            event.game = {
                home: game.home,
                guest: game.guest,
                matchId: game.matchId
            };

            // Add result if available
            if (game.result) {
                event.game.result = {
                    homeScore: game.result.homeScore,
                    guestScore: game.result.guestScore,
                    isFinished: game.result.isFinished
                };
            }

            return event;
        });
    }

    async createEmptyResult(teamConfig) {
        // Create empty JSON file for teams with no games
        await fs.mkdir(SPIELE_JSON_DIR, { recursive: true });
        const jsonFilename = path.join(SPIELE_JSON_DIR, `${teamConfig.teamId}.json`);
        const jsonData = {
            teamName: teamConfig.teamName,
            teamId: teamConfig.teamId,
            competitionId: teamConfig.competitionId,
            lastUpdated: new Date().toISOString(),
            events: []
        };
        await fs.writeFile(jsonFilename, JSON.stringify(jsonData, null, 2), 'utf-8');

        return {
            teamName: teamConfig.teamName,
            teamId: teamConfig.teamId,
            gamesFound: 0,
            filename: null,
            jsonFilename,
            success: true
        };
    }
}

// Convenience function for backward compatibility and CLI usage
export async function fetchGamesCommand(teamConfig, dependencies = {}) {
    const command = new FetchGamesCommand(dependencies);
    return await command.execute(teamConfig);
}