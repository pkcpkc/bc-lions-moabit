import { describe, it, expect, vi, beforeEach } from 'vitest';
import { HTMLService } from '../../src/services/htmlService.js';

// Mock fs/promises
vi.mock('fs/promises', () => ({
    readFile: vi.fn(),
    writeFile: vi.fn()
}));

import { readFile, writeFile } from 'fs/promises';

describe('HTMLService', () => {
    let htmlService;
    let mockLogger;

    beforeEach(() => {
        mockLogger = {
            info: vi.fn(),
            error: vi.fn(),
            warn: vi.fn()
        };
        htmlService = new HTMLService(mockLogger);
        vi.clearAllMocks();
    });

    describe('constructor', () => {
        it('should initialize with default logger', () => {
            const service = new HTMLService();
            expect(service.logger).toBe(console);
        });

        it('should initialize with custom logger', () => {
            const customLogger = { log: vi.fn() };
            const service = new HTMLService(customLogger);
            expect(service.logger).toBe(customLogger);
        });
    });

    describe('generateIndexHTML', () => {
        const mockTemplate = `
<!DOCTYPE html>
<html>
<head><title>Test</title></head>
<body>
    <div id="calendar-data" data-configs='{{ CALENDAR_CONFIGS }}'></div>
    <div id="schedule-data" data-configs='{{ SCHEDULE_CONFIGS }}'></div>
</body>
</html>`;

        const mockTeamConfigs = [
            {
                teamId: 'mu12-team-a',
                competitionId: '12345',
                teamName: 'BC Lions U12 A',
                icsFilename: 'docs/ics/spiele/mu12-team-a.ics',
                icsUrl: 'https://example.com/ics/mu12-team-a.ics',
                webUrl: 'https://basketball-bund.net/liga/12345'
            },
            {
                teamId: 'wu16-team-b',
                competitionId: '67890',
                teamName: 'BC Lions W16 B',
                icsFilename: 'docs/ics/spiele/wu16-team-b.ics',
                icsUrl: 'https://example.com/ics/wu16-team-b.ics',
                webUrl: 'https://basketball-bund.net/liga/67890'
            }
        ];

        const mockTermineConfigs = [
            {
                id: 'calendar1',
                label: 'Main Calendar',
                calId: 'cal1@example.com',
                icsFilename: 'docs/ics/termine/calendar1.ics',
                icsUrl: 'https://example.com/ics/termine/calendar1.ics'
            }
        ];

        beforeEach(() => {
            readFile.mockResolvedValue(mockTemplate);
            writeFile.mockResolvedValue();
        });

        it('should successfully generate HTML with team and termine configs', async () => {
            const result = await htmlService.generateIndexHTML(mockTeamConfigs, mockTermineConfigs);

            expect(readFile).toHaveBeenCalledWith('index.template.html', 'utf8');
            expect(writeFile).toHaveBeenCalledWith('docs/index.html', expect.any(String), 'utf8');
            expect(result).toEqual({
                outputPath: 'docs/index.html',
                spieleCount: 2,
                trainingCount: 1,
                termineCount: 0
            });
        });

        it('should use custom template and output paths', async () => {
            const customTemplate = 'custom.template.html';
            const customOutput = 'custom/output.html';

            await htmlService.generateIndexHTML(
                mockTeamConfigs, 
                mockTermineConfigs, 
                [], 
                customTemplate, 
                customOutput
            );

            expect(readFile).toHaveBeenCalledWith(customTemplate, 'utf8');
            expect(writeFile).toHaveBeenCalledWith(customOutput, expect.any(String), 'utf8');
        });

        it('should process team display names correctly', async () => {
            const teamConfigs = [
                { teamId: 'mu12-team', competitionId: '1', teamName: 'U12 Team', icsFilename: 'test.ics', icsUrl: 'test', webUrl: 'test' },
                { teamId: 'wu16-team', competitionId: '2', teamName: 'W16 Team', icsFilename: 'test.ics', icsUrl: 'test', webUrl: 'test' },
                { teamId: 'senior-team', competitionId: '3', teamName: 'Senior Team', icsFilename: 'test.ics', icsUrl: 'test', webUrl: 'test' }
            ];

            await htmlService.generateIndexHTML(teamConfigs, [], []);

            const writtenContent = writeFile.mock.calls[0][1];
            expect(writtenContent).toContain('"name": "mU12-TEAM"'); // M prefix converted to lowercase
            expect(writtenContent).toContain('"name": "wU16-TEAM"'); // W prefix converted to lowercase  
            expect(writtenContent).toContain('"name": "SENIOR-TEAM"'); // No prefix, remains uppercase
        });

        it('should replace template placeholders correctly', async () => {
            await htmlService.generateIndexHTML(mockTeamConfigs, mockTermineConfigs, []);

            const writtenContent = writeFile.mock.calls[0][1];
            
            // Should contain processed team configs
            expect(writtenContent).toContain('"id": "mu12-team-a"');
            expect(writtenContent).toContain('"name": "mU12-TEAM-A"');
            expect(writtenContent).toContain('"competitionId": "12345"');
            
            // Should contain termine configs
            expect(writtenContent).toContain('"id": "calendar1"');
            expect(writtenContent).toContain('"label": "Main Calendar"');
            expect(writtenContent).toContain('"calId": "cal1@example.com"');
        });

        it('should handle empty configs arrays', async () => {
            const result = await htmlService.generateIndexHTML([], [], []);

            expect(result).toEqual({
                outputPath: 'docs/index.html',
                spieleCount: 0,
                trainingCount: 0,
                termineCount: 0
            });

            const writtenContent = writeFile.mock.calls[0][1];
            expect(writtenContent).toContain('[]'); // Empty arrays in JSON
        });

        it('should log appropriate messages', async () => {
            await htmlService.generateIndexHTML(mockTeamConfigs, mockTermineConfigs, []);

            expect(mockLogger.info).toHaveBeenCalledWith('Reading HTML template...');
            expect(mockLogger.info).toHaveBeenCalledWith('Generating HTML with 2 spiele configs, 1 training configs, and 0 termine configs');
            expect(mockLogger.info).toHaveBeenCalledWith('Successfully generated docs/index.html');
        });

        it('should handle template read errors', async () => {
            const readError = new Error('Template file not found');
            readFile.mockRejectedValue(readError);

            await expect(htmlService.generateIndexHTML(mockTeamConfigs, mockTermineConfigs)).rejects.toThrow('Template file not found');
            expect(mockLogger.error).toHaveBeenCalledWith('Failed to generate HTML:', 'Template file not found');
        });

        it('should handle file write errors', async () => {
            const writeError = new Error('Permission denied');
            writeFile.mockRejectedValue(writeError);

            await expect(htmlService.generateIndexHTML(mockTeamConfigs, mockTermineConfigs)).rejects.toThrow('Permission denied');
            expect(mockLogger.error).toHaveBeenCalledWith('Failed to generate HTML:', 'Permission denied');
        });

        it('should handle template with multiple placeholder occurrences', async () => {
            const multiPlaceholderTemplate = `
                <div>{{ CALENDAR_CONFIGS }}</div>
                <script>const configs = {{ CALENDAR_CONFIGS }};</script>
                <div>{{ SCHEDULE_CONFIGS }}</div>
            `;
            readFile.mockResolvedValue(multiPlaceholderTemplate);

            await htmlService.generateIndexHTML(mockTeamConfigs, mockTermineConfigs, []);

            const writtenContent = writeFile.mock.calls[0][1];
            const configMatches = (writtenContent.match(/"id": "mu12-team-a"/g) || []).length;
            const scheduleMatches = (writtenContent.match(/"id": "calendar1"/g) || []).length;
            
            expect(configMatches).toBe(2); // Should replace both occurrences
            expect(scheduleMatches).toBe(1); // Should replace the schedule placeholder
        });

        it('should preserve team config properties in processed output', async () => {
            await htmlService.generateIndexHTML(mockTeamConfigs, mockTermineConfigs, []);

            const writtenContent = writeFile.mock.calls[0][1];
            const parsedContent = writtenContent.match(/data-configs='(\[.*?\])'/s);
            
            if (parsedContent) {
                const configs = JSON.parse(parsedContent[1]);
                expect(configs[0]).toHaveProperty('id', 'mu12-team-a');
                expect(configs[0]).toHaveProperty('competitionId', '12345');
                expect(configs[0]).toHaveProperty('teamName', 'BC Lions U12 A');
                expect(configs[0]).toHaveProperty('icsFilename', 'docs/ics/spiele/mu12-team-a.ics');
                expect(configs[0]).toHaveProperty('icsUrl', 'https://example.com/ics/mu12-team-a.ics');
                expect(configs[0]).toHaveProperty('webUrl', 'https://basketball-bund.net/liga/12345');
            }
        });

        it('should handle empty arrays gracefully', async () => {
            await htmlService.generateIndexHTML([], [], []);

            expect(writeFile).toHaveBeenCalledWith('docs/index.html', expect.any(String), 'utf8');
            const writtenContent = writeFile.mock.calls[0][1];
            expect(writtenContent).toContain("data-configs='[]'");
        });

        it('should handle template read errors', async () => {
            const readError = new Error('Template not found');
            readFile.mockRejectedValue(readError);

            await expect(htmlService.generateIndexHTML(mockTeamConfigs, mockTermineConfigs, []))
                .rejects.toThrow('Template not found');
        });

        it('should handle write errors', async () => {
            readFile.mockResolvedValue(mockTemplate);
            const writeError = new Error('Permission denied');
            writeFile.mockRejectedValue(writeError);

            await expect(htmlService.generateIndexHTML(mockTeamConfigs, mockTermineConfigs, []))
                .rejects.toThrow('Permission denied');
        });
    });


});