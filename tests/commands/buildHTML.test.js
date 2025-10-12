import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BuildHTMLCommand, generateIndexHTML } from '../../src/commands/buildHTML.js';

// Mock dependencies
vi.mock('../../src/services/configService.js', () => ({
    ConfigService: vi.fn()
}));

vi.mock('../../src/services/htmlService.js', () => ({
    HTMLService: vi.fn()
}));

vi.mock('../../src/services/logger.js', () => ({
    Logger: vi.fn()
}));

vi.mock('../../src/config/index.js', () => ({
    config: {
        logging: { level: 'info' },
        paths: { teamsDir: 'teams' }
    }
}));

describe('BuildHTMLCommand', () => {
    let buildHTMLCommand;
    let mockLogger;
    let mockConfigService;
    let mockHTMLService;

    beforeEach(() => {
        mockLogger = {
            info: vi.fn(),
            error: vi.fn(),
            warn: vi.fn()
        };

        mockConfigService = {
            readTeamConfigs: vi.fn(),
            readTermineConfigs: vi.fn()
        };

        mockHTMLService = {
            generateIndexHTML: vi.fn()
        };

        const dependencies = {
            logger: mockLogger,
            configService: mockConfigService,
            htmlService: mockHTMLService
        };

        buildHTMLCommand = new BuildHTMLCommand(dependencies);
        vi.clearAllMocks();
    });

    describe('constructor', () => {
        it('should initialize with provided dependencies', () => {
            expect(buildHTMLCommand.logger).toBe(mockLogger);
            expect(buildHTMLCommand.configService).toBe(mockConfigService);
            expect(buildHTMLCommand.htmlService).toBe(mockHTMLService);
        });

        it('should create default dependencies when none provided', () => {
            const command = new BuildHTMLCommand();
            expect(command.logger).toBeDefined();
            expect(command.configService).toBeDefined();
            expect(command.htmlService).toBeDefined();
        });
    });

    describe('execute', () => {
        const mockTeamConfigs = [
            {
                teamId: 'mu12-team',
                competitionId: '12345',
                teamName: 'BC Lions U12',
                icsFilename: 'docs/ics/spiele/mu12-team.ics',
                icsUrl: 'https://example.com/ics/mu12-team.ics',
                webUrl: 'https://basketball-bund.net/liga/12345'
            },
            {
                teamId: 'wu16-team',
                competitionId: '67890',
                teamName: 'BC Lions W16',
                icsFilename: 'docs/ics/spiele/wu16-team.ics',
                icsUrl: 'https://example.com/ics/wu16-team.ics',
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

        const mockHTMLResult = {
            outputPath: 'docs/index.html',
            teamCount: 2,
            termineCount: 1
        };

        beforeEach(() => {
            mockConfigService.readTeamConfigs.mockResolvedValue(mockTeamConfigs);
            mockConfigService.readTermineConfigs.mockResolvedValue(mockTermineConfigs);
            mockHTMLService.generateIndexHTML.mockResolvedValue(mockHTMLResult);
        });

        it('should execute HTML generation successfully', async () => {
            const result = await buildHTMLCommand.execute();

            expect(mockConfigService.readTeamConfigs).toHaveBeenCalledWith('teams');
            expect(mockConfigService.readTermineConfigs).toHaveBeenCalledWith('termine');
            expect(mockHTMLService.generateIndexHTML).toHaveBeenCalledWith(
                mockTeamConfigs,
                mockTermineConfigs,
                'index.template.html',
                'docs/index.html'
            );
            expect(result).toEqual(mockHTMLResult);
        });

        it('should log appropriate messages during execution', async () => {
            await buildHTMLCommand.execute();

            expect(mockLogger.info).toHaveBeenCalledWith('🔨 Starting HTML generation process...');
            expect(mockLogger.info).toHaveBeenCalledWith('✅ HTML generation completed successfully!');
        });

        it('should handle team config read errors', async () => {
            const configError = new Error('Failed to read team configs');
            mockConfigService.readTeamConfigs.mockRejectedValue(configError);

            await expect(buildHTMLCommand.execute()).rejects.toThrow('Failed to read team configs');
            expect(mockLogger.error).toHaveBeenCalledWith('Failed to generate HTML:', 'Failed to read team configs');
        });

        it('should handle termine config read errors', async () => {
            const termineError = new Error('Failed to read termine configs');
            mockConfigService.readTermineConfigs.mockRejectedValue(termineError);

            await expect(buildHTMLCommand.execute()).rejects.toThrow('Failed to read termine configs');
            expect(mockLogger.error).toHaveBeenCalledWith('Failed to generate HTML:', 'Failed to read termine configs');
        });

        it('should handle HTML service errors', async () => {
            const htmlError = new Error('Template not found');
            mockHTMLService.generateIndexHTML.mockRejectedValue(htmlError);

            await expect(buildHTMLCommand.execute()).rejects.toThrow('Template not found');
            expect(mockLogger.error).toHaveBeenCalledWith('Failed to generate HTML:', 'Template not found');
        });

        it('should work with empty team configs', async () => {
            mockConfigService.readTeamConfigs.mockResolvedValue([]);
            mockHTMLService.generateIndexHTML.mockResolvedValue({
                outputPath: 'docs/index.html',
                teamCount: 0,
                termineCount: 1
            });

            const result = await buildHTMLCommand.execute();

            expect(mockHTMLService.generateIndexHTML).toHaveBeenCalledWith(
                [],
                mockTermineConfigs,
                'index.template.html',
                'docs/index.html'
            );
            expect(result.teamCount).toBe(0);
        });

        it('should work with empty termine configs', async () => {
            mockConfigService.readTermineConfigs.mockResolvedValue([]);
            mockHTMLService.generateIndexHTML.mockResolvedValue({
                outputPath: 'docs/index.html',
                teamCount: 2,
                termineCount: 0
            });

            const result = await buildHTMLCommand.execute();

            expect(mockHTMLService.generateIndexHTML).toHaveBeenCalledWith(
                mockTeamConfigs,
                [],
                'index.template.html',
                'docs/index.html'
            );
            expect(result.termineCount).toBe(0);
        });

        it('should pass correct parameters to HTMLService', async () => {
            await buildHTMLCommand.execute();

            const callArgs = mockHTMLService.generateIndexHTML.mock.calls[0];
            expect(callArgs[0]).toBe(mockTeamConfigs);
            expect(callArgs[1]).toBe(mockTermineConfigs);
            expect(callArgs[2]).toBe('index.template.html');
            expect(callArgs[3]).toBe('docs/index.html');
        });

        it('should return HTML service result unchanged', async () => {
            const customResult = {
                outputPath: 'custom/path.html',
                teamCount: 5,
                termineCount: 3,
                customProperty: 'test'
            };
            mockHTMLService.generateIndexHTML.mockResolvedValue(customResult);

            const result = await buildHTMLCommand.execute();

            expect(result).toEqual(customResult);
        });
    });

    describe('generateIndexHTML function', () => {
        it('should create BuildHTMLCommand and execute it', async () => {
            const dependencies = {
                logger: mockLogger,
                configService: mockConfigService,
                htmlService: mockHTMLService
            };

            mockConfigService.readTeamConfigs.mockResolvedValue([]);
            mockConfigService.readTermineConfigs.mockResolvedValue([]);
            mockHTMLService.generateIndexHTML.mockResolvedValue({ teamCount: 0, termineCount: 0 });

            const result = await generateIndexHTML(dependencies);
            expect(result.teamCount).toBe(0);
        });
    });
});