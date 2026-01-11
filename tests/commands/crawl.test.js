import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CrawlCommand, crawlTeams } from '../../src/commands/crawl.js';

// Mock fs/promises
vi.mock('fs/promises', () => ({
    writeFile: vi.fn(),
    mkdir: vi.fn(),
    rm: vi.fn()
}));

// Mock path
vi.mock('path', () => ({
    join: vi.fn((...args) => args.join('/'))
}));

// Mock dependencies
vi.mock('../../src/services/httpClient.js', () => ({
    HttpClient: vi.fn()
}));

vi.mock('../../src/services/crawlService.js', () => ({
    CrawlService: vi.fn()
}));

vi.mock('../../src/services/teamDiscoveryService.js', () => ({
    TeamDiscoveryService: vi.fn()
}));

vi.mock('../../src/services/logger.js', () => ({
    Logger: vi.fn()
}));

vi.mock('../../src/config/index.js', () => ({
    config: {
        logging: { level: 'info' },
        api: { timeout: 10000 }
    }
}));

import { writeFile, mkdir } from 'fs/promises';

describe('CrawlCommand', () => {
    let crawlCommand;
    let mockLogger;
    let mockHttpClient;
    let mockTeamDiscoveryService;
    let mockCrawlService;

    beforeEach(() => {
        mockLogger = {
            info: vi.fn(),
            error: vi.fn(),
            warn: vi.fn(),
            debug: vi.fn()
        };

        mockHttpClient = {
            getWithRetry: vi.fn()
        };

        mockTeamDiscoveryService = {
            createTeamConfig: vi.fn()
        };

        mockCrawlService = {
            discoverTeams: vi.fn()
        };

        const dependencies = {
            logger: mockLogger,
            httpClient: mockHttpClient,
            teamDiscoveryService: mockTeamDiscoveryService,
            crawlService: mockCrawlService
        };

        crawlCommand = new CrawlCommand(dependencies);

        // Reset fs mocks
        mkdir.mockResolvedValue();
        writeFile.mockResolvedValue();

        vi.clearAllMocks();
    });

    describe('constructor', () => {
        it('should initialize with provided dependencies', () => {
            expect(crawlCommand.logger).toBe(mockLogger);
            expect(crawlCommand.httpClient).toBe(mockHttpClient);
            expect(crawlCommand.teamDiscoveryService).toBe(mockTeamDiscoveryService);
            expect(crawlCommand.crawlService).toBe(mockCrawlService);
        });

        it('should create default dependencies when none provided', () => {
            const command = new CrawlCommand();
            expect(command.logger).toBeDefined();
            expect(command.httpClient).toBeDefined();
            expect(command.teamDiscoveryService).toBeDefined();
            expect(command.crawlService).toBeDefined();
        });
    });

    describe('execute', () => {
        const mockDiscoveredTeams = [
            {
                teamName: 'BC Lions Moabit 1',
                competitionId: '12345',
                competitionName: 'Herren Bezirksliga A'
            },
            {
                teamName: 'BC Lions Moabit 2',
                competitionId: '67890',
                competitionName: 'Damen Oberliga'
            }
        ];

        const mockTeamConfig1 = {
            competitionId: '12345',
            teamName: 'BC Lions Moabit 1',
            teamId: 'he-bl-a'
        };

        const mockTeamConfig2 = {
            competitionId: '67890',
            teamName: 'BC Lions Moabit 2',
            teamId: 'da-ol'
        };

        beforeEach(() => {
            mockCrawlService.discoverTeams.mockResolvedValue(mockDiscoveredTeams);
            mockTeamDiscoveryService.createTeamConfig
                .mockReturnValueOnce(mockTeamConfig1)
                .mockReturnValueOnce(mockTeamConfig2);
        });

        it('should execute crawl successfully with default options', async () => {
            const result = await crawlCommand.execute();

            expect(mockCrawlService.discoverTeams).toHaveBeenCalledWith(3, 'BC Lions');
            expect(mkdir).toHaveBeenCalledWith('spiele', { recursive: true });
            expect(writeFile).toHaveBeenCalledTimes(2);
            expect(writeFile).toHaveBeenCalledWith(
                'spiele/he-bl-a.json',
                JSON.stringify(mockTeamConfig1, null, 2),
                'utf8'
            );

            expect(result).toEqual({
                success: true,
                teamsFound: 2,
                filesCreated: 2,
                errors: 0,
                teams: [
                    {
                        filename: 'spiele/he-bl-a.json',
                        teamConfig: mockTeamConfig1,
                        teamName: 'BC Lions Moabit 1'
                    },
                    {
                        filename: 'spiele/da-ol.json',
                        teamConfig: mockTeamConfig2,
                        teamName: 'BC Lions Moabit 2'
                    }
                ]
            });
        });

        it('should execute crawl with custom options', async () => {
            const options = {
                verbandId: 5,
                teamNameToSearch: 'Custom Team',
                outputDir: 'custom-teams'
            };

            await crawlCommand.execute(options);

            expect(mockCrawlService.discoverTeams).toHaveBeenCalledWith(5, 'Custom Team');
            expect(mkdir).toHaveBeenCalledWith('custom-teams', { recursive: true });
        });

        it('should handle no teams found', async () => {
            mockCrawlService.discoverTeams.mockResolvedValue([]);

            const result = await crawlCommand.execute();

            expect(result).toEqual({
                success: true,
                teamsFound: 0,
                filesCreated: 0,
                errors: 0,
                teams: []
            });

            expect(mockLogger.warn).toHaveBeenCalledWith('⚠️  No teams found. Exiting without creating files.');
            expect(writeFile).not.toHaveBeenCalled();
        });

        it('should handle file write errors gracefully', async () => {
            const writeError = new Error('Permission denied');
            writeFile.mockRejectedValueOnce(writeError).mockResolvedValueOnce();

            const result = await crawlCommand.execute();

            expect(result).toEqual({
                success: true,
                teamsFound: 2,
                filesCreated: 1,
                errors: 1,
                teams: [
                    {
                        filename: 'spiele/da-ol.json',
                        teamConfig: mockTeamConfig2,
                        teamName: 'BC Lions Moabit 2'
                    }
                ]
            });

            expect(mockLogger.error).toHaveBeenCalledWith(
                '❌ Failed to create config for BC Lions Moabit 1:',
                'Permission denied'
            );
        });

        it('should log appropriate progress messages', async () => {
            await crawlCommand.execute();

            expect(mockLogger.info).toHaveBeenCalledWith('🏀 Starting BC Lions team discovery crawl...');
            expect(mockLogger.info).toHaveBeenCalledWith('📝 Creating configuration files...');
            expect(mockLogger.info).toHaveBeenCalledWith('✅ Created: spiele/he-bl-a.json (BC Lions Moabit 1)');
            expect(mockLogger.info).toHaveBeenCalledWith('🎉 Crawl completed successfully!');
            expect(mockLogger.info).toHaveBeenCalledWith('📊 Summary: 2 files created, 0 errors');
        });

        it('should handle discovery service errors', async () => {
            const discoveryError = new Error('Network timeout');
            mockCrawlService.discoverTeams.mockRejectedValue(discoveryError);

            await expect(crawlCommand.execute()).rejects.toThrow('Network timeout');
            expect(mockLogger.error).toHaveBeenCalledWith('Crawl process failed:', 'Network timeout');
        });

        it('should handle directory creation errors', async () => {
            const mkdirError = new Error('Cannot create directory');
            mkdir.mockRejectedValue(mkdirError);

            await expect(crawlCommand.execute()).rejects.toThrow('Cannot create directory');
        });

        it('should create team configurations with correct parameters', async () => {
            await crawlCommand.execute();

            expect(mockTeamDiscoveryService.createTeamConfig).toHaveBeenCalledWith(
                { teamname: 'BC Lions Moabit 1' },
                '12345',
                'Herren Bezirksliga A'
            );

            expect(mockTeamDiscoveryService.createTeamConfig).toHaveBeenCalledWith(
                { teamname: 'BC Lions Moabit 2' },
                '67890',
                'Damen Oberliga'
            );
        });

        it('should preserve team discovery results in output', async () => {
            const result = await crawlCommand.execute();

            expect(result.teams).toHaveLength(2);
            expect(result.teams[0].teamName).toBe('BC Lions Moabit 1');
            expect(result.teams[1].teamName).toBe('BC Lions Moabit 2');
        });

        it('should handle partial failures correctly', async () => {
            const configError = new Error('Invalid team data');

            // Reset the mock to have fresh state
            mockTeamDiscoveryService.createTeamConfig.mockReset();
            mockTeamDiscoveryService.createTeamConfig
                .mockImplementationOnce(() => { throw configError; })
                .mockReturnValueOnce(mockTeamConfig2);

            const result = await crawlCommand.execute();

            expect(result.filesCreated).toBe(1);
            expect(result.errors).toBe(1);
            expect(result.teams).toHaveLength(1);
        });
    });

    describe('crawlTeams function', () => {
        it('should create CrawlCommand and execute it', async () => {
            const dependencies = {
                logger: mockLogger,
                crawlService: mockCrawlService
            };

            const options = { verbandId: 3, teamNameToSearch: 'BC Lions Moabit' };

            mockCrawlService.discoverTeams.mockResolvedValue([]);

            const result = await crawlTeams(dependencies, options);

            expect(result.success).toBe(true);
            expect(result.teamsFound).toBe(0);
        });
    });
});