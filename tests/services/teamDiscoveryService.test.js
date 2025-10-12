import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TeamDiscoveryService } from '../../src/services/teamDiscoveryService.js';

describe('TeamDiscoveryService', () => {
    let teamDiscoveryService;
    let mockLogger;

    beforeEach(() => {
        mockLogger = {
            info: vi.fn(),
            error: vi.fn(),
            warn: vi.fn(),
            debug: vi.fn()
        };
        teamDiscoveryService = new TeamDiscoveryService(mockLogger);
        vi.clearAllMocks();
    });

    describe('constructor', () => {
        it('should initialize with default logger', () => {
            const service = new TeamDiscoveryService();
            expect(service.logger).toBe(console);
        });

        it('should initialize with custom logger', () => {
            expect(teamDiscoveryService.logger).toBe(mockLogger);
        });
    });

    describe('findTeam', () => {
        const mockMatch = {
            homeTeam: { teamname: 'BC Lions Moabit 1' },
            guestTeam: { teamname: 'Other Team' }
        };

        it('should find team in home position', () => {
            const result = teamDiscoveryService.findTeam(mockMatch, 'BC Lions Moabit');
            expect(result).toEqual(mockMatch.homeTeam);
        });

        it('should find team in guest position', () => {
            const matchWithGuestTeam = {
                homeTeam: { teamname: 'Other Team' },
                guestTeam: { teamname: 'BC Lions Moabit 2' }
            };
            
            const result = teamDiscoveryService.findTeam(matchWithGuestTeam, 'BC Lions Moabit');
            expect(result).toEqual(matchWithGuestTeam.guestTeam);
        });

        it('should return null if team not found', () => {
            const result = teamDiscoveryService.findTeam(mockMatch, 'Different Team');
            expect(result).toBeNull();
        });

        it('should handle missing homeTeam', () => {
            const matchMissingHome = {
                guestTeam: { teamname: 'BC Lions Moabit 1' }
            };
            
            const result = teamDiscoveryService.findTeam(matchMissingHome, 'BC Lions Moabit');
            expect(result).toEqual(matchMissingHome.guestTeam);
        });

        it('should handle missing guestTeam', () => {
            const matchMissingGuest = {
                homeTeam: { teamname: 'BC Lions Moabit 1' }
            };
            
            const result = teamDiscoveryService.findTeam(matchMissingGuest, 'BC Lions Moabit');
            expect(result).toEqual(matchMissingGuest.homeTeam);
        });
    });

    describe('sanitizeForFilename', () => {
        it('should convert to lowercase', () => {
            expect(teamDiscoveryService.sanitizeForFilename('HERREN BEZIRKSLIGA')).toBe('herren-bezirksliga');
        });

        it('should replace German umlauts', () => {
            expect(teamDiscoveryService.sanitizeForFilename('Mädchen Ü12')).toBe('maedchen-ue12');
            expect(teamDiscoveryService.sanitizeForFilename('Jünglinge Ö-Liga')).toBe('juenglinge-oe-liga');
            expect(teamDiscoveryService.sanitizeForFilename('Weiß-Blau')).toBe('weiss-blau');
        });

        it('should replace special characters with dashes', () => {
            expect(teamDiscoveryService.sanitizeForFilename('Team A/B (Group)')).toBe('team-a-b-group');
        });

        it('should remove leading and trailing dashes', () => {
            expect(teamDiscoveryService.sanitizeForFilename('--Team Name--')).toBe('team-name');
        });

        it('should handle multiple consecutive special characters', () => {
            expect(teamDiscoveryService.sanitizeForFilename('Team!!!Name???')).toBe('team-name');
        });
    });

    describe('generateTeamId', () => {
        it('should handle damen leagues', () => {
            expect(teamDiscoveryService.generateTeamId('Damen Bezirksliga A')).toBe('da-bl-a');
        });

        it('should handle herren leagues', () => {
            expect(teamDiscoveryService.generateTeamId('Herren Kreisliga B')).toBe('he-kl-b');
        });

        it('should handle youth leagues with gender prefix', () => {
            expect(teamDiscoveryService.generateTeamId('mU14 Bezirksliga A')).toBe('mu14-bl-a');
            expect(teamDiscoveryService.generateTeamId('wU16 Landesliga')).toBe('wu16-ll');
        });

        it('should handle mini leagues', () => {
            expect(teamDiscoveryService.generateTeamId('Mini U11 Fortgeschrittene 1')).toBe('u11-f-1');
        });

        it('should handle pokal competitions', () => {
            expect(teamDiscoveryService.generateTeamId('BBV Pokal Herren')).toBe('pokal');
            expect(teamDiscoveryService.generateTeamId('Pokal Damen')).toBe('pokal');
        });

        it('should abbreviate league types correctly', () => {
            expect(teamDiscoveryService.generateTeamId('Herren Oberliga')).toBe('he-ol');
            expect(teamDiscoveryService.generateTeamId('Damen Landesliga')).toBe('da-ll');
            expect(teamDiscoveryService.generateTeamId('mU12 Kreisliga')).toBe('mu12-kl');
        });

        it('should handle complex league names', () => {
            expect(teamDiscoveryService.generateTeamId('Herren Bezirksliga C Staffel 1')).toBe('he-bl-c-staffel-1');
        });

        it('should handle empty or invalid input', () => {
            expect(teamDiscoveryService.generateTeamId('')).toBe('');
            expect(teamDiscoveryService.generateTeamId('   ')).toBe('');
        });
    });

    describe('createTeamConfig', () => {
        it('should create valid team configuration', () => {
            const mockTeam = { teamname: 'BC Lions Moabit 1' };
            const competitionId = '12345';
            const competitionName = 'Herren Bezirksliga A';

            const result = teamDiscoveryService.createTeamConfig(mockTeam, competitionId, competitionName);

            expect(result).toEqual({
                competitionId: '12345',
                teamName: 'BC Lions Moabit 1',
                teamId: 'he-bl-a'
            });
        });

        it('should handle special characters in team name', () => {
            const mockTeam = { teamname: 'BC Lions Moabit "Mixed" Team' };
            const result = teamDiscoveryService.createTeamConfig(mockTeam, '123', 'Test League');

            expect(result.teamName).toBe('BC Lions Moabit "Mixed" Team');
        });
    });

    describe('removeDuplicateTeams', () => {
        it('should remove duplicate teams based on composite key', () => {
            const teamResults = [
                [
                    {
                        teamName: 'BC Lions Moabit 1',
                        competitionId: '123',
                        competitionName: 'Herren BL A',
                        teamPermanentId: 'team1'
                    }
                ],
                [
                    {
                        teamName: 'BC Lions Moabit 1', // Same team
                        competitionId: '123',
                        competitionName: 'Herren BL A',
                        teamPermanentId: 'team1'
                    },
                    {
                        teamName: 'BC Lions Moabit 2', // Different team
                        competitionId: '456',
                        competitionName: 'Herren BL B',
                        teamPermanentId: 'team2'
                    }
                ]
            ];

            const result = teamDiscoveryService.removeDuplicateTeams(teamResults);

            expect(result).toHaveLength(2);
            expect(result[0].teamName).toBe('BC Lions Moabit 1');
            expect(result[1].teamName).toBe('BC Lions Moabit 2');
        });

        it('should handle empty team results', () => {
            const result = teamDiscoveryService.removeDuplicateTeams([]);
            expect(result).toEqual([]);
        });

        it('should preserve all unique teams', () => {
            const teamResults = [
                [
                    { teamName: 'Team A', competitionId: '1', competitionName: 'League 1', teamPermanentId: 'a' }
                ],
                [
                    { teamName: 'Team B', competitionId: '2', competitionName: 'League 2', teamPermanentId: 'b' }
                ]
            ];

            const result = teamDiscoveryService.removeDuplicateTeams(teamResults);
            expect(result).toHaveLength(2);
        });
    });

    describe('shouldSkipLeague', () => {
        it('should skip pokal leagues', () => {
            expect(teamDiscoveryService.shouldSkipLeague('BBV Pokal Herren')).toBe(true);
            expect(teamDiscoveryService.shouldSkipLeague('Damen Pokal')).toBe(true);
        });

        it('should skip testspiele leagues', () => {
            expect(teamDiscoveryService.shouldSkipLeague('Testspiele Herren')).toBe(true);
            expect(teamDiscoveryService.shouldSkipLeague('Freundschaftsspiele Testspiele')).toBe(true);
        });

        it('should not skip regular leagues', () => {
            expect(teamDiscoveryService.shouldSkipLeague('Herren Bezirksliga A')).toBe(false);
            expect(teamDiscoveryService.shouldSkipLeague('Damen Oberliga')).toBe(false);
        });

        it('should be case insensitive', () => {
            expect(teamDiscoveryService.shouldSkipLeague('POKAL HERREN')).toBe(true);
            expect(teamDiscoveryService.shouldSkipLeague('Testspiele')).toBe(true);
        });
    });
});