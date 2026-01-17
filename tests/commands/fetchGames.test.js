import { describe, it, expect, vi, beforeEach } from 'vitest';
import { FetchGamesCommand } from '../../src/commands/fetchGames.js';

// Mock fs to prevent writing to real files
vi.mock('fs', () => ({
    promises: {
        mkdir: vi.fn().mockResolvedValue(undefined),
        writeFile: vi.fn().mockResolvedValue(undefined)
    }
}));

describe('FetchGamesCommand', () => {
    let fetchCommand;
    let mockLogger;
    let mockGamesService;
    let mockICSService;

    beforeEach(() => {
        mockLogger = {
            info: vi.fn(),
            warn: vi.fn(),
            error: vi.fn()
        };

        mockGamesService = {
            fetchCompetition: vi.fn(),
            filterTeamGames: vi.fn(),
            enrichGamesWithDetails: vi.fn()
        };

        mockICSService = {
            generateICS: vi.fn(),
            saveICS: vi.fn()
        };

        fetchCommand = new FetchGamesCommand({
            logger: mockLogger,
            gamesService: mockGamesService,
            icsService: mockICSService
        });
    });

    describe('execute', () => {
        const validTeamConfig = {
            competitionId: '50422',
            teamName: 'BC Lions Moabit 1',
            teamId: 'he-bl-a'
        };

        it('should execute successfully with games found', async () => {
            const mockCompetitionData = {
                data: {
                    matches: [
                        { matchId: '1', homeTeam: { teamname: 'BC Lions Moabit 1' } },
                        { matchId: '2', homeTeam: { teamname: 'Team B' } }
                    ]
                }
            };

            const mockFilteredGames = [mockCompetitionData.data.matches[0]];
            const mockEnrichedGames = [{
                date: '2024-01-15',
                time: '18:00',
                home: 'BC Lions Moabit 1',
                guest: 'Team B',
                matchId: '1',
                venue: { name: 'Sporthalle' }
            }];

            mockGamesService.fetchCompetition.mockResolvedValue(mockCompetitionData);
            mockGamesService.filterTeamGames.mockReturnValue(mockFilteredGames);
            mockGamesService.enrichGamesWithDetails.mockResolvedValue(mockEnrichedGames);
            mockICSService.generateICS.mockReturnValue('ICS content');
            mockICSService.saveICS.mockResolvedValue();

            const result = await fetchCommand.execute(validTeamConfig);

            expect(result.success).toBe(true);
            expect(result.teamName).toBe('BC Lions Moabit 1');
            expect(result.gamesFound).toBe(1);
            expect(result.filename).toContain('he-bl-a.ics');

            expect(mockGamesService.fetchCompetition).toHaveBeenCalledWith('50422');
            expect(mockGamesService.filterTeamGames).toHaveBeenCalledWith(
                mockCompetitionData.data.matches,
                'BC Lions Moabit 1'
            );
            expect(mockICSService.generateICS).toHaveBeenCalledWith(
                mockEnrichedGames,
                'BC Lions Moabit 1 - Spielplan'
            );
        });

        it('should handle missing required config fields', async () => {
            const invalidConfig = {
                teamName: 'BC Lions Moabit 1'
                // Missing competitionId and teamId
            };

            const result = await fetchCommand.execute(invalidConfig);

            expect(result.success).toBe(false);
            expect(result.error).toContain('Config must contain: competitionId, teamName, teamId');
        });

        it('should handle no competition data', async () => {
            mockGamesService.fetchCompetition.mockResolvedValue({ data: null });

            const result = await fetchCommand.execute(validTeamConfig);

            expect(result.success).toBe(true);
            expect(result.gamesFound).toBe(0);
            expect(mockLogger.warn).toHaveBeenCalledWith('No matches found in competition data');
        });

        it('should handle no team games found', async () => {
            const mockCompetitionData = {
                data: {
                    matches: [
                        { matchId: '1', homeTeam: { teamname: 'Other Team' } }
                    ]
                }
            };

            mockGamesService.fetchCompetition.mockResolvedValue(mockCompetitionData);
            mockGamesService.filterTeamGames.mockReturnValue([]);

            const result = await fetchCommand.execute(validTeamConfig);

            expect(result.success).toBe(true);
            expect(result.gamesFound).toBe(0);
            expect(mockLogger.warn).toHaveBeenCalledWith('No games found for team: BC Lions Moabit 1');
        });

        it('should handle fetch competition error', async () => {
            const error = new Error('Network error');
            mockGamesService.fetchCompetition.mockRejectedValue(error);

            const result = await fetchCommand.execute(validTeamConfig);

            expect(result.success).toBe(false);
            expect(result.error).toBe('Network error');
            expect(mockLogger.error).toHaveBeenCalledWith(
                'Failed to fetch games for BC Lions Moabit 1:',
                'Network error'
            );
        });

        it('should handle ICS generation error', async () => {
            const mockCompetitionData = {
                data: { matches: [{ matchId: '1', homeTeam: { teamname: 'BC Lions Moabit 1' } }] }
            };
            const mockFilteredGames = [mockCompetitionData.data.matches[0]];
            const mockEnrichedGames = [{ matchId: '1' }];

            mockGamesService.fetchCompetition.mockResolvedValue(mockCompetitionData);
            mockGamesService.filterTeamGames.mockReturnValue(mockFilteredGames);
            mockGamesService.enrichGamesWithDetails.mockResolvedValue(mockEnrichedGames);
            mockICSService.generateICS.mockReturnValue('ICS content');
            mockICSService.saveICS.mockRejectedValue(new Error('File write error'));

            const result = await fetchCommand.execute(validTeamConfig);

            expect(result.success).toBe(false);
            expect(result.error).toBe('File write error');
        });
    });

    describe('createEmptyResult', () => {
        it('should create proper empty result', async () => {
            const teamConfig = {
                teamName: 'BC Lions Moabit 1',
                teamId: 'he-bl-a'
            };

            const result = await fetchCommand.createEmptyResult(teamConfig);

            expect(result).toEqual({
                teamName: 'BC Lions Moabit 1',
                teamId: 'he-bl-a',
                gamesFound: 0,
                filename: null,
                jsonFilename: expect.stringContaining('he-bl-a.json'),
                success: true
            });
        });
    });

    describe('execute - additional error scenarios', () => {
        it('should handle empty competition data gracefully', async () => {
            const teamConfig = {
                competitionId: '50422',
                teamName: 'BC Lions Moabit 1',
                teamId: 'he-bl-a'
            };

            mockGamesService.fetchCompetition.mockResolvedValue({ data: null });

            const result = await fetchCommand.execute(teamConfig);

            expect(result.success).toBe(true);
            expect(result.gamesFound).toBe(0);
        });

        it('should handle missing matches array in competition data', async () => {
            const teamConfig = {
                competitionId: '50422',
                teamName: 'BC Lions Moabit 1',
                teamId: 'he-bl-a'
            };

            mockGamesService.fetchCompetition.mockResolvedValue({ 
                data: { someOtherProperty: 'value' } 
            });

            const result = await fetchCommand.execute(teamConfig);

            expect(result.success).toBe(true);
            expect(result.gamesFound).toBe(0);
        });
    });

    describe('fetchGamesCommand convenience function', () => {
        it('should execute command and return result', async () => {
            // Import the convenience function
            const { fetchGamesCommand } = await import('../../src/commands/fetchGames.js');
            
            // Mock the dependencies
            const mockDeps = {
                logger: mockLogger,
                gamesService: mockGamesService,
                icsService: mockICSService
            };

            const teamConfig = {
                competitionId: '50422',
                teamName: 'BC Lions Moabit 1',
                teamId: 'he-bl-a'
            };

            mockGamesService.fetchCompetition.mockResolvedValue({ data: { matches: [] } });
            mockGamesService.filterTeamGames.mockReturnValue([]);
            mockGamesService.enrichGamesWithDetails.mockResolvedValue([]);

            const result = await fetchGamesCommand(teamConfig, mockDeps);

            expect(result.success).toBe(true);
            expect(result.gamesFound).toBe(0);
        });
    });

    describe('parseBerlinTime', () => {
        it('should parse winter time (CET) dates correctly with UTC+1 offset', () => {
            // January is winter time (CET = UTC+1)
            const date = fetchCommand.parseBerlinTime('2025-01-15', '14:00');
            // 14:00 Berlin (UTC+1) = 13:00 UTC
            expect(date.toISOString()).toBe('2025-01-15T13:00:00.000Z');
        });

        it('should parse summer time (CEST) dates correctly with UTC+2 offset', () => {
            // July is summer time (CEST = UTC+2)
            const date = fetchCommand.parseBerlinTime('2025-07-15', '14:00');
            // 14:00 Berlin (UTC+2) = 12:00 UTC
            expect(date.toISOString()).toBe('2025-07-15T12:00:00.000Z');
        });

        it('should handle DST transition in March correctly', () => {
            // Last Sunday of March 2025 is March 30 - after this date it's CEST
            const beforeDST = fetchCommand.parseBerlinTime('2025-03-29', '14:00');
            const afterDST = fetchCommand.parseBerlinTime('2025-03-30', '14:00');
            
            // Before DST: 14:00 CET (UTC+1) = 13:00 UTC
            expect(beforeDST.toISOString()).toBe('2025-03-29T13:00:00.000Z');
            // After DST: 14:00 CEST (UTC+2) = 12:00 UTC
            expect(afterDST.toISOString()).toBe('2025-03-30T12:00:00.000Z');
        });

        it('should handle DST transition in October correctly', () => {
            // Last Sunday of October 2025 is October 26 - before this date it's CEST
            const beforeEnd = fetchCommand.parseBerlinTime('2025-10-25', '14:00');
            const afterEnd = fetchCommand.parseBerlinTime('2025-10-26', '14:00');
            
            // Before end: 14:00 CEST (UTC+2) = 12:00 UTC
            expect(beforeEnd.toISOString()).toBe('2025-10-25T12:00:00.000Z');
            // After end: 14:00 CET (UTC+1) = 13:00 UTC
            expect(afterEnd.toISOString()).toBe('2025-10-26T13:00:00.000Z');
        });
    });
});