import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BuildCommand, buildAll } from '../../src/commands/build.js';

// Mock all dependencies
vi.mock('../../src/commands/fetchGames.js', () => ({
    FetchGamesCommand: vi.fn()
}));

vi.mock('../../src/commands/downloadTermine.js', () => ({
    DownloadTermineCommand: vi.fn()
}));

vi.mock('../../src/commands/buildHTML.js', () => ({
    BuildHTMLCommand: vi.fn()
}));

vi.mock('../../src/services/configService.js', () => ({
    ConfigService: vi.fn()
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

describe('BuildCommand', () => {
    let buildCommand;
    let mockLogger;
    let mockConfigService;
    let mockFetchGamesCommand;
    let mockDownloadTermineCommand;
    let mockBuildHTMLCommand;

    beforeEach(() => {
        mockLogger = {
            info: vi.fn(),
            error: vi.fn(),
            warn: vi.fn()
        };

        mockConfigService = {
            readTeamConfigs: vi.fn()
        };

        mockFetchGamesCommand = {
            execute: vi.fn()
        };

        mockDownloadTermineCommand = {
            execute: vi.fn()
        };

        mockBuildHTMLCommand = {
            execute: vi.fn()
        };

        const dependencies = {
            logger: mockLogger,
            configService: mockConfigService,
            fetchGamesCommand: mockFetchGamesCommand,
            downloadTermineCommand: mockDownloadTermineCommand,
            buildHTMLCommand: mockBuildHTMLCommand
        };

        buildCommand = new BuildCommand(dependencies);
        vi.clearAllMocks();
    });

    describe('constructor', () => {
        it('should initialize with provided dependencies', () => {
            expect(buildCommand.logger).toBe(mockLogger);
            expect(buildCommand.configService).toBe(mockConfigService);
            expect(buildCommand.fetchGamesCommand).toBe(mockFetchGamesCommand);
        });

        it('should create default dependencies when none provided', () => {
            const command = new BuildCommand();
            expect(command.logger).toBeDefined();
            expect(command.configService).toBeDefined();
        });
    });

    describe('execute', () => {
        const mockTeamConfigs = [
            { teamId: 'team-1', teamName: 'Team 1' },
            { teamId: 'team-2', teamName: 'Team 2' }
        ];

        beforeEach(() => {
            mockConfigService.readTeamConfigs.mockResolvedValue(mockTeamConfigs);
        });

        it('should execute all steps successfully', async () => {
            // Mock successful responses
            mockFetchGamesCommand.execute
                .mockResolvedValueOnce({ success: true, gamesFound: 15 })
                .mockResolvedValueOnce({ success: true, gamesFound: 12 });

            mockDownloadTermineCommand.execute.mockResolvedValue({
                downloadedCount: 5,
                errorCount: 0,
                totalConfigs: 5
            });

            mockBuildHTMLCommand.execute.mockResolvedValue({
                teamCount: 2,
                termineCount: 5
            });

            const result = await buildCommand.execute();

            expect(result.success).toBe(true);
            expect(result.results.teams.successful).toBe(2);
            expect(result.results.teams.failed).toBe(0);
            expect(result.results.teams.totalGames).toBe(27);
            expect(result.results.termine.downloadedCount).toBe(5);
            expect(result.results.html.success).toBe(true);
        });

        it('should handle team fetch failures gracefully', async () => {
            mockFetchGamesCommand.execute
                .mockResolvedValueOnce({ success: true, gamesFound: 15 })
                .mockResolvedValueOnce({ success: false, error: 'Network error' });

            mockDownloadTermineCommand.execute.mockResolvedValue({
                downloadedCount: 5,
                errorCount: 0,
                totalConfigs: 5
            });

            mockBuildHTMLCommand.execute.mockResolvedValue({
                teamCount: 1,
                termineCount: 5
            });

            const result = await buildCommand.execute();

            expect(result.success).toBe(false); // Should fail due to team failure
            expect(result.results.teams.successful).toBe(1);
            expect(result.results.teams.failed).toBe(1);
            expect(mockLogger.error).toHaveBeenCalledWith('❌ team-2: Network error');
        });

        it('should handle team fetch exceptions', async () => {
            mockFetchGamesCommand.execute
                .mockResolvedValueOnce({ success: true, gamesFound: 15 })
                .mockRejectedValueOnce(new Error('Connection timeout'));

            mockDownloadTermineCommand.execute.mockResolvedValue({
                downloadedCount: 5,
                errorCount: 0,
                totalConfigs: 5
            });

            mockBuildHTMLCommand.execute.mockResolvedValue({
                teamCount: 1,
                termineCount: 5
            });

            const result = await buildCommand.execute();

            expect(result.success).toBe(false);
            expect(result.results.teams.failed).toBe(1);
            expect(mockLogger.error).toHaveBeenCalledWith('❌ team-2: Connection timeout');
        });

        it('should handle termine download failures', async () => {
            mockFetchGamesCommand.execute.mockResolvedValue({ success: true, gamesFound: 15 });

            mockDownloadTermineCommand.execute.mockRejectedValue(new Error('Termine download failed'));

            mockBuildHTMLCommand.execute.mockResolvedValue({
                teamCount: 2,
                termineCount: 0
            });

            const result = await buildCommand.execute();

            expect(result.success).toBe(true); // Should continue despite termine failure
            expect(mockLogger.error).toHaveBeenCalledWith('Failed to download termine:', 'Termine download failed');
        });

        it('should handle HTML build failures', async () => {
            mockFetchGamesCommand.execute.mockResolvedValue({ success: true, gamesFound: 15 });

            mockDownloadTermineCommand.execute.mockResolvedValue({
                downloadedCount: 5,
                errorCount: 0,
                totalConfigs: 5
            });

            mockBuildHTMLCommand.execute.mockRejectedValue(new Error('HTML generation failed'));

            const result = await buildCommand.execute();

            expect(result.success).toBe(false);
            expect(result.results.html.success).toBe(false);
            expect(mockLogger.error).toHaveBeenCalledWith('Failed to generate HTML:', 'HTML generation failed');
        });

        it('should log appropriate progress messages', async () => {
            mockFetchGamesCommand.execute.mockResolvedValue({ success: true, gamesFound: 15 });
            mockDownloadTermineCommand.execute.mockResolvedValue({ downloadedCount: 5, errorCount: 0, totalConfigs: 5 });
            mockBuildHTMLCommand.execute.mockResolvedValue({ teamCount: 2, termineCount: 5 });

            await buildCommand.execute();

            expect(mockLogger.info).toHaveBeenCalledWith('🏀 BC Lions Moabit - Build All');
            expect(mockLogger.info).toHaveBeenCalledWith('📥 Step 1: Fetching games for all teams...');
            expect(mockLogger.info).toHaveBeenCalledWith('🗓️  Step 2: Downloading termine ICS files...');
            expect(mockLogger.info).toHaveBeenCalledWith('🔨 Step 3: Building HTML with fresh data...');
            expect(mockLogger.info).toHaveBeenCalledWith('🎉 Build completed successfully!');
        });

        it('should log build summary', async () => {
            mockFetchGamesCommand.execute
                .mockResolvedValueOnce({ success: true, gamesFound: 15 })
                .mockResolvedValueOnce({ success: false, error: 'Failed' });

            mockDownloadTermineCommand.execute.mockResolvedValue({
                downloadedCount: 4,
                errorCount: 1,
                totalConfigs: 5
            });

            mockBuildHTMLCommand.execute.mockResolvedValue({ teamCount: 1, termineCount: 4 });

            const result = await buildCommand.execute();

            expect(mockLogger.info).toHaveBeenCalledWith('\n📊 Build Summary:');
            expect(mockLogger.info).toHaveBeenCalledWith('  Teams: 1 successful, 1 failed');
            expect(mockLogger.info).toHaveBeenCalledWith('  Total games: 15');
            expect(mockLogger.info).toHaveBeenCalledWith('  Termine: 4 downloaded, 1 failed');
            expect(mockLogger.info).toHaveBeenCalledWith('  HTML: Generated successfully');
            expect(mockLogger.warn).toHaveBeenCalledWith('Build completed with some errors');
        });

        it('should handle empty team configs', async () => {
            mockConfigService.readTeamConfigs.mockResolvedValue([]);
            mockDownloadTermineCommand.execute.mockResolvedValue({ downloadedCount: 0, errorCount: 0, totalConfigs: 0 });
            mockBuildHTMLCommand.execute.mockResolvedValue({ teamCount: 0, termineCount: 0 });

            const result = await buildCommand.execute();

            expect(result.success).toBe(true);
            expect(result.results.teams.successful).toBe(0);
            expect(result.results.teams.failed).toBe(0);
            expect(mockFetchGamesCommand.execute).not.toHaveBeenCalled();
        });

        it('should handle critical errors and rethrow', async () => {
            const criticalError = new Error('Critical system error');
            mockConfigService.readTeamConfigs.mockRejectedValue(criticalError);

            await expect(buildCommand.execute()).rejects.toThrow('Critical system error');
            expect(mockLogger.error).toHaveBeenCalledWith('Build process failed:', 'Critical system error');
        });
    });

    describe('buildAll function', () => {
        it('should create BuildCommand and execute it', async () => {
            const dependencies = { 
                logger: mockLogger,
                configService: mockConfigService,
                fetchGamesCommand: mockFetchGamesCommand,
                downloadTermineCommand: mockDownloadTermineCommand,
                buildHTMLCommand: mockBuildHTMLCommand
            };

            // Setup mock responses for the convenience function test
            mockConfigService.readTeamConfigs.mockResolvedValue([]);
            mockDownloadTermineCommand.execute.mockResolvedValue({ downloadedCount: 0, errorCount: 0, totalConfigs: 0 });
            mockBuildHTMLCommand.execute.mockResolvedValue({ teamCount: 0, termineCount: 0 });

            const result = await buildAll(dependencies);
            expect(result.success).toBe(true);
        });
    });
});