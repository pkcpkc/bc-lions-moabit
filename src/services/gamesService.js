export class GamesService {
    constructor(httpClient, logger = console) {
        this.httpClient = httpClient;
        this.logger = logger;
    }

    async fetchCompetition(competitionId) {
        this.logger.info(`Fetching competition data for ID: ${competitionId}`);
        
        try {
            const data = await this.httpClient.getWithRetry(
                `/competition/spielplan/id/${competitionId}`
            );
            
            this.logger.info(`Successfully fetched ${data.data?.matches?.length || 0} matches`);
            return data;
        } catch (error) {
            this.logger.error(`Failed to fetch competition ${competitionId}:`, error.message);
            throw error;
        }
    }

    async fetchMatchDetails(matchId) {
        this.logger.debug(`Fetching match details for ID: ${matchId}`);
        
        try {
            const data = await this.httpClient.getWithRetry(`/match/id/${matchId}/matchInfo`);
            this.logger.debug(`Successfully fetched match details for ${matchId}`);
            return data;
        } catch (error) {
            this.logger.warn(`Failed to fetch match ${matchId}:`, error.message);
            throw error;
        }
    }

    filterTeamGames(games, teamName) {
        if (!games || !Array.isArray(games)) {
            return [];
        }

        return games.filter(game => 
            game.homeTeam?.teamname?.includes(teamName) || 
            game.guestTeam?.teamname?.includes(teamName)
        );
    }

    async enrichGamesWithDetails(games) {
        const enrichedGames = [];
        
        this.logger.info(`Enriching ${games.length} games with venue details...`);
        
        // Process in parallel for better performance
        const gamePromises = games.map(async (game) => {
            if (!game.kickoffDate) {
                this.logger.warn(`Skipping match ${game.matchId}: no kickoffDate`);
                return null;
            }

            try {
                const details = await this.fetchMatchDetails(game.matchId);
                const spielfeld = details.data?.matchInfo?.spielfeld || {};
                const matchInfo = details.data?.matchInfo || {};
                
                // Extract score information if available - pass the full details.data which contains result
                const result = this.extractResult(matchInfo, details.data);

                return {
                    date: game.kickoffDate,
                    time: game.kickoffTime,
                    home: game.homeTeam.teamname,
                    guest: game.guestTeam.teamname,
                    matchId: game.matchId,
                    venue: {
                        name: spielfeld.bezeichnung || null,
                        street: spielfeld.strasse || null,
                        zip: spielfeld.plz || null,
                        city: spielfeld.ort || null,
                    },
                    result: result,
                };
            } catch (error) {
                this.logger.warn(`Could not fetch details for match ${game.matchId}:`, error.message);
                // Return basic match info without venue details
                return {
                    date: game.kickoffDate,
                    time: game.kickoffTime,
                    home: game.homeTeam.teamname,
                    guest: game.guestTeam.teamname,
                    matchId: game.matchId,
                    venue: {
                        name: null,
                        street: null,
                        zip: null,
                        city: null,
                    },
                    result: null,
                };
            }
        });

        const gameResults = await Promise.all(gamePromises);
        
        // Filter out null results (skipped games)
        const validGames = gameResults.filter(game => game !== null);
        
        const skippedCount = games.length - validGames.length;
        if (skippedCount > 0) {
            this.logger.info(`Processed ${validGames.length} games (${skippedCount} skipped)`);
        } else {
            this.logger.info(`Processed ${validGames.length} games`);
        }

        return validGames;
    }

    extractResult(matchInfo, game) {
        // Check for result in the main match data first (the actual API structure)
        let homeScore = null;
        let guestScore = null;

        // Parse result from the main game object (format: "71:92")
        if (game.result && typeof game.result === 'string' && game.result.includes(':')) {
            const scores = game.result.split(':');
            if (scores.length === 2) {
                const parsedHomeScore = parseInt(scores[0].trim());
                const parsedGuestScore = parseInt(scores[1].trim());
                if (!isNaN(parsedHomeScore) && !isNaN(parsedGuestScore)) {
                    homeScore = parsedHomeScore;
                    guestScore = parsedGuestScore;
                }
            }
        }

        // Fallback: Check various possible properties in matchInfo for score information
        if (homeScore === null || guestScore === null) {
            const matchInfoHomeScore = matchInfo.homeScore || 
                                      matchInfo.homeResult || 
                                      matchInfo.homePoints ||
                                      null;
                              
            const matchInfoGuestScore = matchInfo.guestScore || 
                                       matchInfo.guestResult || 
                                       matchInfo.guestPoints ||
                                       null;

            if (matchInfoHomeScore !== null && matchInfoHomeScore !== undefined && 
                matchInfoGuestScore !== null && matchInfoGuestScore !== undefined) {
                homeScore = parseInt(matchInfoHomeScore);
                guestScore = parseInt(matchInfoGuestScore);
            }
        }

        // Return result if both scores are available
        if (homeScore !== null && guestScore !== null) {
            return {
                homeScore: homeScore,
                guestScore: guestScore,
                isFinished: true
            };
        }

        // Check if the match is finished but no score available
        const isFinished = game.ergebnisbestaetigt === true ||
                          matchInfo.status === 'finished' || 
                          matchInfo.matchStatus === 'finished' ||
                          matchInfo.isFinished === true;

        if (isFinished) {
            return {
                homeScore: null,
                guestScore: null,
                isFinished: true
            };
        }

        return null;
    }
}