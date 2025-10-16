import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ConfigService } from '../../src/services/configService.js';

// Mock fs/promises
vi.mock('fs/promises', () => ({
    readFile: vi.fn(),
    readdir: vi.fn()
}));

import { readFile, readdir } from 'fs/promises';

describe('ConfigService', () => {
    let configService;
    let mockLogger;

    beforeEach(() => {
        mockLogger = {
            info: vi.fn(),
            warn: vi.fn(),
            error: vi.fn()
        };
        configService = new ConfigService(mockLogger);
        vi.clearAllMocks();
    });

    describe('constructor', () => {
        it('should initialize with default logger', () => {
            const service = new ConfigService();
            expect(service.logger).toBe(console);
        });

        it('should initialize with custom logger', () => {
            const customLogger = { log: vi.fn() };
            const service = new ConfigService(customLogger);
            expect(service.logger).toBe(customLogger);
        });
    });

    describe('readTeamConfigs', () => {
        it('should successfully read and parse team configurations', async () => {
            const mockFiles = ['team1.json', 'team2.json', 'other.txt'];
            const mockTeamConfig1 = {
                competitionId: '12345',
                teamName: 'Team One',
                teamId: 'team-1'
            };
            const mockTeamConfig2 = {
                competitionId: '67890',
                teamName: 'Team Two',
                teamId: 'team-2'
            };

            readdir.mockResolvedValue(mockFiles);
            readFile.mockResolvedValueOnce(JSON.stringify(mockTeamConfig1))
                   .mockResolvedValueOnce(JSON.stringify(mockTeamConfig2));

            const result = await configService.readTeamConfigs('test-teams');

            expect(readdir).toHaveBeenCalledWith('test-teams');
            expect(readFile).toHaveBeenCalledTimes(2);
            expect(result).toHaveLength(2);
            expect(result[0]).toEqual({
                file: 'team1.json',
                competitionId: '12345',
                teamName: 'Team One',
                teamId: 'team-1',
                icsFilename: 'docs/ics/spiele/team-1.ics',
                icsUrl: './ics/spiele/team-1.ics',
                jsonUrl: './data/spiele/team-1.json',
                webUrl: 'https://www.basketball-bund.net/static/#/liga/12345'
            });
        });

        it('should sort teams alphabetically by teamId', async () => {
            const mockFiles = ['z-team.json', 'a-team.json', 'm-team.json'];
            const mockConfigs = [
                { competitionId: '1', teamName: 'Z Team', teamId: 'z-team' },
                { competitionId: '2', teamName: 'A Team', teamId: 'a-team' },
                { competitionId: '3', teamName: 'M Team', teamId: 'm-team' }
            ];

            readdir.mockResolvedValue(mockFiles);
            readFile.mockResolvedValueOnce(JSON.stringify(mockConfigs[0]))
                   .mockResolvedValueOnce(JSON.stringify(mockConfigs[1]))
                   .mockResolvedValueOnce(JSON.stringify(mockConfigs[2]));

            const result = await configService.readTeamConfigs();

            expect(result[0].teamId).toBe('a-team');
            expect(result[1].teamId).toBe('m-team');
            expect(result[2].teamId).toBe('z-team');
        });

        it('should skip files with missing required fields', async () => {
            const mockFiles = ['valid.json', 'invalid.json'];
            const validConfig = { competitionId: '123', teamName: 'Valid Team', teamId: 'valid' };
            const invalidConfig = { teamName: 'Invalid Team' }; // Missing competitionId and teamId

            readdir.mockResolvedValue(mockFiles);
            readFile.mockResolvedValueOnce(JSON.stringify(validConfig))
                   .mockResolvedValueOnce(JSON.stringify(invalidConfig));

            const result = await configService.readTeamConfigs();

            expect(result).toHaveLength(1);
            expect(result[0].teamId).toBe('valid');
            expect(mockLogger.warn).toHaveBeenCalledWith(
                'Skipping invalid.json: Missing required fields (competitionId, teamName, teamId)'
            );
        });

        it('should handle JSON parse errors gracefully', async () => {
            const mockFiles = ['valid.json', 'corrupt.json'];
            const validConfig = { competitionId: '123', teamName: 'Valid Team', teamId: 'valid' };

            readdir.mockResolvedValue(mockFiles);
            readFile.mockResolvedValueOnce(JSON.stringify(validConfig))
                   .mockResolvedValueOnce('{ invalid json');

            const result = await configService.readTeamConfigs();

            expect(result).toHaveLength(1);
            expect(mockLogger.warn).toHaveBeenCalledWith(
                'Error processing corrupt.json:',
                expect.stringContaining('JSON at position')
            );
        });

        it('should handle directory read errors', async () => {
            const dirError = new Error('Directory not found');
            readdir.mockRejectedValue(dirError);

            await expect(configService.readTeamConfigs()).rejects.toThrow('Directory not found');
            expect(mockLogger.error).toHaveBeenCalledWith(
                'Failed to read team configs from teams:',
                'Directory not found'
            );
        });

        it('should filter only JSON files', async () => {
            const mockFiles = ['team1.json', 'team2.txt', 'team3.json', 'readme.md'];
            const mockConfig = { competitionId: '123', teamName: 'Team', teamId: 'team' };

            readdir.mockResolvedValue(mockFiles);
            readFile.mockResolvedValue(JSON.stringify(mockConfig));

            await configService.readTeamConfigs();

            expect(readFile).toHaveBeenCalledTimes(2); // Only called for .json files
            expect(mockLogger.info).toHaveBeenCalledWith('Found 2 team configuration files');
        });
    });

    describe('readTermineConfigs', () => {
        it('should successfully read and parse termine configurations', async () => {
            const mockFiles = ['calendar1.json', 'calendar2.json'];
            const mockConfig1 = { label: 'Calendar One', calId: 'cal1@example.com' };
            const mockConfig2 = { label: 'Calendar Two', calId: 'cal2@example.com' };

            readdir.mockResolvedValue(mockFiles);
            readFile.mockResolvedValueOnce(JSON.stringify(mockConfig1))
                   .mockResolvedValueOnce(JSON.stringify(mockConfig2));

            const result = await configService.readTermineConfigs('test-termine');

            expect(result).toHaveLength(2);
            expect(result[0]).toEqual({
                id: 'calendar1',
                label: 'Calendar One',
                calId: 'cal1@example.com',
                icsFilename: 'docs/ics/termine/calendar1.ics',
                icsUrl: './ics/termine/calendar1.ics',
                jsonUrl: './data/termine/calendar1.json'
            });
        });

        it('should sort termine alphabetically by label', async () => {
            const mockFiles = ['z.json', 'a.json', 'm.json'];
            const mockConfigs = [
                { label: 'Z Calendar', calId: 'z@example.com' },
                { label: 'A Calendar', calId: 'a@example.com' },
                { label: 'M Calendar', calId: 'm@example.com' }
            ];

            readdir.mockResolvedValue(mockFiles);
            readFile.mockResolvedValueOnce(JSON.stringify(mockConfigs[0]))
                   .mockResolvedValueOnce(JSON.stringify(mockConfigs[1]))
                   .mockResolvedValueOnce(JSON.stringify(mockConfigs[2]));

            const result = await configService.readTermineConfigs();

            expect(result[0].label).toBe('A Calendar');
            expect(result[1].label).toBe('M Calendar');
            expect(result[2].label).toBe('Z Calendar');
        });

        it('should skip files with missing required fields', async () => {
            const mockFiles = ['valid.json', 'invalid.json'];
            const validConfig = { label: 'Valid Calendar', calId: 'valid@example.com' };
            const invalidConfig = { label: 'Invalid Calendar' }; // Missing calId

            readdir.mockResolvedValue(mockFiles);
            readFile.mockResolvedValueOnce(JSON.stringify(validConfig))
                   .mockResolvedValueOnce(JSON.stringify(invalidConfig));

            const result = await configService.readTermineConfigs();

            expect(result).toHaveLength(1);
            expect(result[0].label).toBe('Valid Calendar');
            expect(mockLogger.warn).toHaveBeenCalledWith(
                'Skipping invalid.json: Missing required fields (label, calId)'
            );
        });

        it('should handle directory read errors', async () => {
            const dirError = new Error('Termine directory not found');
            readdir.mockRejectedValue(dirError);

            await expect(configService.readTermineConfigs()).rejects.toThrow('Termine directory not found');
            expect(mockLogger.error).toHaveBeenCalledWith(
                'Failed to read termine configs from termine:',
                'Termine directory not found'
            );
        });
    });
});