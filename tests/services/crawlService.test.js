import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CrawlService } from '../../src/services/crawlService.js';

// Mock node-fetch
vi.mock('node-fetch', () => ({
    default: vi.fn()
}));

import fetch from 'node-fetch';

describe('CrawlService', () => {
    let crawlService;
    let mockHttpClient;
    let mockTeamDiscoveryService;
    let mockLogger;

    beforeEach(() => {
        mockHttpClient = {
            getWithRetry: vi.fn()
        };

        mockTeamDiscoveryService = {
            findTeam: vi.fn(),
            removeDuplicateTeams: vi.fn(),
            shouldSkipLeague: vi.fn()
        };

        mockLogger = {
            info: vi.fn(),
            error: vi.fn(),
            warn: vi.fn(),
            debug: vi.fn()
        };

        crawlService = new CrawlService(mockHttpClient, mockTeamDiscoveryService, mockLogger);
        vi.clearAllMocks();
    });

    describe('constructor', () => {
        it('should initialize with provided dependencies', () => {
            expect(crawlService.httpClient).toBe(mockHttpClient);
            expect(crawlService.teamDiscoveryService).toBe(mockTeamDiscoveryService);
            expect(crawlService.logger).toBe(mockLogger);
        });

        it('should set correct API URLs', () => {
            expect(crawlService.apiUrl).toBe('https://www.basketball-bund.net/rest/wam/liga/list');
            expect(crawlService.competitionUrl).toBe('https://www.basketball-bund.net/rest/competition/spielplan/id');
        });
    });

    describe('fetchLeagues', () => {
        const mockLeaguesResponse = {
            data: {
                ligen: [
                    { ligaId: '123', liganame: 'Herren Bezirksliga A' },
                    { ligaId: '456', liganame: 'Damen Oberliga' }
                ],
                hasMoreData: false
            }
        };

        beforeEach(() => {
            const mockResponse = {
                ok: true,
                json: vi.fn().mockResolvedValue(mockLeaguesResponse)
            };
            fetch.mockResolvedValue(mockResponse);
        });

        it('should fetch leagues for given verband ID', async () => {
            const result = await crawlService.fetchLeagues(3);

            expect(fetch).toHaveBeenCalledWith(
                'https://www.basketball-bund.net/rest/wam/liga/list?startAtIndex=0',
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ "wam": { "verbandIds": [3] } })
                }
            );

            expect(result).toEqual(mockLeaguesResponse.data.ligen);
        });

        it('should handle pagination correctly', async () => {
            const mockResponsePage1 = {
                ok: true,
                json: vi.fn().mockResolvedValue({
                    data: {
                        ligen: [{ ligaId: '123', liganame: 'League 1' }],
                        hasMoreData: true
                    }
                })
            };

            const mockResponsePage2 = {
                ok: true,
                json: vi.fn().mockResolvedValue({
                    data: {
                        ligen: [{ ligaId: '456', liganame: 'League 2' }],
                        hasMoreData: false
                    }
                })
            };

            fetch.mockResolvedValueOnce(mockResponsePage1)
                 .mockResolvedValueOnce(mockResponsePage2);

            const result = await crawlService.fetchLeagues(3);

            expect(fetch).toHaveBeenCalledTimes(2);
            expect(fetch).toHaveBeenCalledWith(
                'https://www.basketball-bund.net/rest/wam/liga/list?startAtIndex=0',
                expect.any(Object)
            );
            expect(fetch).toHaveBeenCalledWith(
                'https://www.basketball-bund.net/rest/wam/liga/list?startAtIndex=1',
                expect.any(Object)
            );

            expect(result).toHaveLength(2);
        });

        it('should handle HTTP errors', async () => {
            const mockErrorResponse = {
                ok: false,
                status: 500,
                statusText: 'Internal Server Error'
            };
            fetch.mockResolvedValue(mockErrorResponse);

            await expect(crawlService.fetchLeagues(3)).rejects.toThrow('HTTP 500: Internal Server Error');
            expect(mockLogger.error).toHaveBeenCalledWith(
                'Failed to fetch leagues for verband 3:',
                'HTTP 500: Internal Server Error'
            );
        });
    });

    describe('fetchCompetition', () => {
        it('should fetch competition data successfully', async () => {
            const mockCompetitionData = {
                data: {
                    matches: [
                        { homeTeam: { teamname: 'BC Lions Moabit 1' } }
                    ]
                }
            };

            const mockResponse = {
                ok: true,
                json: vi.fn().mockResolvedValue(mockCompetitionData)
            };
            fetch.mockResolvedValue(mockResponse);

            const result = await crawlService.fetchCompetition('12345');

            expect(fetch).toHaveBeenCalledWith(
                'https://www.basketball-bund.net/rest/competition/spielplan/id/12345'
            );
            expect(result).toEqual(mockCompetitionData.data);
        });

        it('should handle 404 responses gracefully', async () => {
            const mockResponse = {
                ok: false,
                status: 404,
                statusText: 'Not Found'
            };
            fetch.mockResolvedValue(mockResponse);

            const result = await crawlService.fetchCompetition('12345');

            expect(result).toBeNull();
            expect(mockLogger.debug).toHaveBeenCalledWith('League 12345 has no schedule yet (404)');
        });

        it('should handle other HTTP errors', async () => {
            const mockResponse = {
                ok: false,
                status: 500,
                statusText: 'Internal Server Error'
            };
            fetch.mockResolvedValue(mockResponse);

            await expect(crawlService.fetchCompetition('12345')).rejects.toThrow('HTTP 500: Internal Server Error');
            expect(mockLogger.warn).toHaveBeenCalledWith(
                'Competition fetch failed for league 12345:',
                'HTTP 500: Internal Server Error'
            );
        });
    });

    describe('investigateLeague', () => {
        const mockLeague = {
            ligaId: '12345',
            liganame: 'Herren Bezirksliga A'
        };

        const mockCompetition = {
            matches: [
                {
                    homeTeam: { teamname: 'BC Lions Moabit 1', teamPermanentId: 'team1' },
                    guestTeam: { teamname: 'Other Team', teamPermanentId: 'team2' }
                }
            ]
        };

        beforeEach(() => {
            mockTeamDiscoveryService.shouldSkipLeague.mockReturnValue(false);
        });

        it('should investigate league and find teams', async () => {
            vi.spyOn(crawlService, 'fetchCompetition').mockResolvedValue(mockCompetition);
            mockTeamDiscoveryService.findTeam.mockReturnValue({
                teamname: 'BC Lions Moabit 1',
                teamPermanentId: 'team1'
            });

            const result = await crawlService.investigateLeague(mockLeague, 'BC Lions Moabit', 0, 1);

            expect(result).toEqual([{
                teamName: 'BC Lions Moabit 1',
                competitionId: '12345',
                competitionName: 'Herren Bezirksliga A',
                teamPermanentId: 'team1'
            }]);
        });

        it('should skip leagues marked for skipping', async () => {
            mockTeamDiscoveryService.shouldSkipLeague.mockReturnValue(true);

            const result = await crawlService.investigateLeague(mockLeague, 'BC Lions Moabit', 0, 1);

            expect(result).toEqual([]);
            expect(mockLogger.debug).toHaveBeenCalledWith('Skipping league: Herren Bezirksliga A');
        });

        it('should handle leagues with no competition data', async () => {
            vi.spyOn(crawlService, 'fetchCompetition').mockResolvedValue(null);

            const result = await crawlService.investigateLeague(mockLeague, 'BC Lions Moabit', 0, 1);

            expect(result).toEqual([]);
        });

        it('should handle errors gracefully', async () => {
            vi.spyOn(crawlService, 'fetchCompetition').mockRejectedValue(new Error('Network error'));

            const result = await crawlService.investigateLeague(mockLeague, 'BC Lions Moabit', 0, 1);

            expect(result).toEqual([]);
            expect(mockLogger.warn).toHaveBeenCalledWith(
                'Failed to process league Herren Bezirksliga A (ID: 12345):',
                'Network error'
            );
        });

        it('should log progress at intervals', async () => {
            vi.spyOn(crawlService, 'fetchCompetition').mockResolvedValue(mockCompetition);

            // Test progress logging at 50th league
            await crawlService.investigateLeague(mockLeague, 'BC Lions Moabit', 49, 100);
            expect(mockLogger.info).toHaveBeenCalledWith('Processed 50/100 leagues...');

            // Test progress logging at final league
            await crawlService.investigateLeague(mockLeague, 'BC Lions Moabit', 99, 100);
            expect(mockLogger.info).toHaveBeenCalledWith('Processed 100/100 leagues...');
        });
    });

    describe('discoverTeams', () => {
        const mockLeagues = [
            { ligaId: '123', liganame: 'Herren BL A' },
            { ligaId: '456', liganame: 'Damen OL' }
        ];

        const mockTeams = [
            { teamName: 'BC Lions Moabit 1', competitionId: '123', competitionName: 'Herren BL A' }
        ];

        beforeEach(() => {
            vi.spyOn(crawlService, 'fetchLeagues').mockResolvedValue(mockLeagues);
            vi.spyOn(crawlService, 'investigateLeague').mockResolvedValue([mockTeams[0]]);
            mockTeamDiscoveryService.removeDuplicateTeams.mockReturnValue(mockTeams);
        });

        it('should discover teams successfully', async () => {
            const result = await crawlService.discoverTeams(3, 'BC Lions Moabit');

            expect(crawlService.fetchLeagues).toHaveBeenCalledWith(3);
            expect(crawlService.investigateLeague).toHaveBeenCalledTimes(2);
            expect(mockTeamDiscoveryService.removeDuplicateTeams).toHaveBeenCalled();
            expect(result).toEqual(mockTeams);
        });

        it('should log appropriate progress messages', async () => {
            await crawlService.discoverTeams(3, 'BC Lions Moabit');

            expect(mockLogger.info).toHaveBeenCalledWith('Starting team discovery for "BC Lions Moabit" in verband 3');
            expect(mockLogger.info).toHaveBeenCalledWith('📥 Fetching all leagues...');
            expect(mockLogger.info).toHaveBeenCalledWith('📋 Found 2 leagues');
            expect(mockLogger.info).toHaveBeenCalledWith('🔍 Investigating all leagues for teams...');
            expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining('Investigation complete in'));
        });

        it('should handle parallel investigation correctly', async () => {
            const investigateSpy = vi.spyOn(crawlService, 'investigateLeague');
            
            await crawlService.discoverTeams(3, 'BC Lions Moabit');

            // Should call investigateLeague for each league with correct parameters
            expect(investigateSpy).toHaveBeenCalledWith(mockLeagues[0], 'BC Lions Moabit', 0, 2);
            expect(investigateSpy).toHaveBeenCalledWith(mockLeagues[1], 'BC Lions Moabit', 1, 2);
        });
    });
});