import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GamesService } from '../../src/services/gamesService.js';

describe('GamesService', () => {
    let gamesService;
    let mockHttpClient;
    let mockLogger;

    beforeEach(() => {
        mockHttpClient = {
            getWithRetry: vi.fn()
        };
        mockLogger = {
            info: vi.fn(),
            warn: vi.fn(),
            error: vi.fn(),
            debug: vi.fn()
        };
        gamesService = new GamesService(mockHttpClient, mockLogger);
    });

    describe('fetchCompetition', () => {
        it('should fetch competition data successfully', async () => {
            const competitionId = '50422';
            const mockResponse = { 
                data: { 
                    matches: [
                        { matchId: '1', homeTeam: { teamname: 'Team A' } },
                        { matchId: '2', homeTeam: { teamname: 'Team B' } }
                    ] 
                } 
            };
            mockHttpClient.getWithRetry.mockResolvedValue(mockResponse);

            const result = await gamesService.fetchCompetition(competitionId);

            expect(result).toEqual(mockResponse);
            expect(mockHttpClient.getWithRetry).toHaveBeenCalledWith(
                `/competition/spielplan/id/${competitionId}`
            );
            expect(mockLogger.info).toHaveBeenCalledWith(`Successfully fetched 2 matches`);
        });

        it('should handle fetch errors', async () => {
            const competitionId = '50422';
            const error = new Error('Network error');
            mockHttpClient.getWithRetry.mockRejectedValue(error);

            await expect(gamesService.fetchCompetition(competitionId)).rejects.toThrow('Network error');
            expect(mockLogger.error).toHaveBeenCalledWith(
                `Failed to fetch competition ${competitionId}:`,
                'Network error'
            );
        });
    });

    describe('fetchMatchDetails', () => {
        it('should fetch match details successfully', async () => {
            const matchId = '12345';
            const mockResponse = { 
                data: { 
                    matchInfo: { 
                        spielfeld: { 
                            bezeichnung: 'Sporthalle',
                            strasse: 'Hauptstr. 1' 
                        } 
                    } 
                } 
            };
            mockHttpClient.getWithRetry.mockResolvedValue(mockResponse);

            const result = await gamesService.fetchMatchDetails(matchId);

            expect(result).toEqual(mockResponse);
            expect(mockHttpClient.getWithRetry).toHaveBeenCalledWith(`/match/id/${matchId}/matchInfo`);
        });

        it('should handle match details fetch errors', async () => {
            const matchId = '12345';
            const error = new Error('Match not found');
            mockHttpClient.getWithRetry.mockRejectedValue(error);

            await expect(gamesService.fetchMatchDetails(matchId)).rejects.toThrow('Match not found');
            expect(mockLogger.warn).toHaveBeenCalledWith(
                `Failed to fetch match ${matchId}:`,
                'Match not found'
            );
        });
    });

    describe('filterTeamGames', () => {
        it('should filter games for home team', () => {
            const games = [
                { homeTeam: { teamname: 'BC Lions Moabit 1' }, guestTeam: { teamname: 'Team A' } },
                { homeTeam: { teamname: 'Team B' }, guestTeam: { teamname: 'Team C' } },
                { homeTeam: { teamname: 'Team D' }, guestTeam: { teamname: 'BC Lions Moabit 1' } }
            ];

            const result = gamesService.filterTeamGames(games, 'BC Lions Moabit 1');

            expect(result).toHaveLength(2);
            expect(result[0].homeTeam.teamname).toBe('BC Lions Moabit 1');
            expect(result[1].guestTeam.teamname).toBe('BC Lions Moabit 1');
        });

        it('should filter games for guest team', () => {
            const games = [
                { homeTeam: { teamname: 'Team A' }, guestTeam: { teamname: 'BC Lions Moabit 1' } },
                { homeTeam: { teamname: 'Team B' }, guestTeam: { teamname: 'Team C' } }
            ];

            const result = gamesService.filterTeamGames(games, 'BC Lions Moabit 1');

            expect(result).toHaveLength(1);
            expect(result[0].guestTeam.teamname).toBe('BC Lions Moabit 1');
        });

        it('should return empty array for null/undefined games', () => {
            expect(gamesService.filterTeamGames(null, 'Team')).toEqual([]);
            expect(gamesService.filterTeamGames(undefined, 'Team')).toEqual([]);
            expect(gamesService.filterTeamGames('not-array', 'Team')).toEqual([]);
        });

        it('should return empty array when no matches found', () => {
            const games = [
                { homeTeam: { teamname: 'Team A' }, guestTeam: { teamname: 'Team B' } }
            ];

            const result = gamesService.filterTeamGames(games, 'BC Lions Moabit 1');
            expect(result).toEqual([]);
        });
    });

    describe('enrichGamesWithDetails', () => {
        it('should enrich games with venue details', async () => {
            const games = [{
                matchId: '12345',
                kickoffDate: '2024-01-15',
                kickoffTime: '18:00',
                homeTeam: { teamname: 'BC Lions Moabit 1' },
                guestTeam: { teamname: 'Team B' }
            }];

            const mockMatchDetails = {
                data: {
                    matchInfo: {
                        spielfeld: {
                            bezeichnung: 'Sporthalle',
                            strasse: 'Hauptstr. 1',
                            plz: '10115',
                            ort: 'Berlin'
                        }
                    }
                }
            };

            mockHttpClient.getWithRetry.mockResolvedValue(mockMatchDetails);

            const result = await gamesService.enrichGamesWithDetails(games);

            expect(result).toHaveLength(1);
            expect(result[0]).toEqual({
                date: '2024-01-15',
                time: '18:00',
                home: 'BC Lions Moabit 1',
                guest: 'Team B',
                matchId: '12345',
                venue: {
                    name: 'Sporthalle',
                    street: 'Hauptstr. 1',
                    zip: '10115',
                    city: 'Berlin'
                }
            });
        });

        it('should skip games without kickoffDate', async () => {
            const games = [{
                matchId: '12345',
                kickoffDate: null,
                kickoffTime: '18:00',
                homeTeam: { teamname: 'BC Lions Moabit 1' },
                guestTeam: { teamname: 'Team B' }
            }];

            const result = await gamesService.enrichGamesWithDetails(games);

            expect(result).toHaveLength(0);
            expect(mockLogger.warn).toHaveBeenCalledWith('Skipping match 12345: no kickoffDate');
        });

        it('should handle fetch errors gracefully', async () => {
            const games = [{
                matchId: '12345',
                kickoffDate: '2024-01-15',
                kickoffTime: '18:00',
                homeTeam: { teamname: 'BC Lions Moabit 1' },
                guestTeam: { teamname: 'Team B' }
            }];

            mockHttpClient.getWithRetry.mockRejectedValue(new Error('Network error'));

            const result = await gamesService.enrichGamesWithDetails(games);

            expect(result).toHaveLength(1);
            expect(result[0].venue).toEqual({
                name: null,
                street: null,
                zip: null,
                city: null
            });
            expect(mockLogger.warn).toHaveBeenCalledWith(
                'Could not fetch details for match 12345:',
                'Network error'
            );
        });
    });
});