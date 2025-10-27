import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DownloadTermineCommand, downloadTermineIcsFiles } from '../../src/commands/downloadTermine.js';

// Mock fs/promises
vi.mock('fs', () => ({
    promises: {
        mkdir: vi.fn(),
        writeFile: vi.fn(),
        readdir: vi.fn(),
        unlink: vi.fn()
    }
}));

// Mock dependencies
vi.mock('../../src/services/httpClient.js', () => ({
    HttpClient: vi.fn()
}));

vi.mock('../../src/services/termineService.js', () => ({
    TermineService: vi.fn()
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
        api: { timeout: 10000 },
        paths: { 
            termineOutputDir: 'docs/ics/termine',
            trainingOutputDir: 'docs/ics/training'
        }
    }
}));

import { promises as fs } from 'fs';

describe('DownloadTermineCommand', () => {
    let downloadTermineCommand;
    let mockLogger;
    let mockHttpClient;
    let mockTermineService;
    let mockConfigService;

    beforeEach(() => {
        mockLogger = {
            info: vi.fn(),
            error: vi.fn(),
            warn: vi.fn(),
            debug: vi.fn()
        };

        mockHttpClient = {
            get: vi.fn()
        };

        mockTermineService = {
            downloadCalendar: vi.fn()
        };

        mockConfigService = {
            readTermineConfigs: vi.fn(),
            readCalendarConfigs: vi.fn()
        };

        const dependencies = {
            logger: mockLogger,
            httpClient: mockHttpClient,
            termineService: mockTermineService,
            configService: mockConfigService
        };

        downloadTermineCommand = new DownloadTermineCommand(dependencies);

        // Reset fs mocks
        fs.mkdir.mockResolvedValue();
        fs.writeFile.mockResolvedValue();
        fs.readdir.mockResolvedValue([]);
        fs.unlink.mockResolvedValue();

        vi.clearAllMocks();
    });

    describe('constructor', () => {
        it('should initialize with provided dependencies', () => {
            expect(downloadTermineCommand.logger).toBe(mockLogger);
            expect(downloadTermineCommand.httpClient).toBe(mockHttpClient);
            expect(downloadTermineCommand.termineService).toBe(mockTermineService);
            expect(downloadTermineCommand.configService).toBe(mockConfigService);
        });

        it('should create default dependencies when none provided', () => {
            const command = new DownloadTermineCommand();
            expect(command.logger).toBeDefined();
            expect(command.httpClient).toBeDefined();
            expect(command.termineService).toBeDefined();
            expect(command.configService).toBeDefined();
        });
    });

    describe('execute', () => {
        const mockTermineConfigs = [
            {
                id: 'calendar1',
                label: 'Main Calendar',
                calId: 'main@example.com',
                icsFilename: 'docs/ics/termine/calendar1.ics'
            },
            {
                id: 'calendar2',
                label: 'Youth Calendar',
                calId: 'youth@example.com',
                icsFilename: 'docs/ics/termine/calendar2.ics'
            }
        ];

        const mockIcsContent1 = 'BEGIN:VCALENDAR\nVERSION:2.0\nEND:VCALENDAR';
        const mockIcsContent2 = 'BEGIN:VCALENDAR\nVERSION:2.0\nPRODID:Youth\nEND:VCALENDAR';

        beforeEach(() => {
            mockConfigService.readTermineConfigs.mockResolvedValue(mockTermineConfigs);
            mockConfigService.readCalendarConfigs.mockImplementation((dir, type) => {
                if (dir === 'training') return mockTermineConfigs;
                if (dir === 'termine') return [];
                return [];
            });
        });

        it('should successfully download all termine calendars', async () => {
            mockTermineService.downloadCalendar
                .mockResolvedValueOnce(mockIcsContent1)
                .mockResolvedValueOnce(mockIcsContent2);

            const result = await downloadTermineCommand.execute();

            expect(fs.mkdir).toHaveBeenCalledWith('docs/ics/training', { recursive: true });
            expect(fs.mkdir).toHaveBeenCalledWith('docs/ics/termine', { recursive: true });
            expect(fs.readdir).toHaveBeenCalledWith('docs/ics/training');  // cleanExistingFiles call
            expect(fs.readdir).toHaveBeenCalledWith('docs/ics/termine');  // cleanExistingFiles call
            expect(mockTermineService.downloadCalendar).toHaveBeenCalledWith('main@example.com');
            expect(mockTermineService.downloadCalendar).toHaveBeenCalledWith('youth@example.com');
            expect(fs.writeFile).toHaveBeenCalledWith('docs/ics/termine/calendar1.ics', mockIcsContent1, 'utf8');
            expect(fs.writeFile).toHaveBeenCalledWith('docs/ics/termine/calendar2.ics', mockIcsContent2, 'utf8');
            
            expect(result).toEqual({
                downloadedCount: 2,
                errorCount: 0,
                totalConfigs: 2
            });
        });

        it('should handle individual download failures gracefully', async () => {
            mockTermineService.downloadCalendar
                .mockResolvedValueOnce(mockIcsContent1)
                .mockRejectedValueOnce(new Error('Calendar not accessible'));

            const result = await downloadTermineCommand.execute();

            expect(result).toEqual({
                downloadedCount: 1,
                errorCount: 1,
                totalConfigs: 2
            });

            expect(mockLogger.error).toHaveBeenCalledWith(
                '❌ Failed to download Youth Calendar:',
                'Calendar not accessible'
            );
        });

        it('should handle file write errors', async () => {
            mockTermineService.downloadCalendar.mockResolvedValue(mockIcsContent1);
            fs.writeFile
                .mockRejectedValueOnce(new Error('Permission denied'))
                .mockRejectedValueOnce(new Error('Permission denied'));

            const result = await downloadTermineCommand.execute();

            expect(result).toEqual({
                downloadedCount: 0,
                errorCount: 2,
                totalConfigs: 2
            });

            expect(mockLogger.error).toHaveBeenCalledWith(
                '❌ Failed to download Main Calendar:',
                'Permission denied'
            );
        });

        it('should handle empty termine configs', async () => {
            mockConfigService.readTermineConfigs.mockResolvedValue([]);
            mockConfigService.readCalendarConfigs.mockResolvedValue([]);

            const result = await downloadTermineCommand.execute();

            expect(result).toEqual({
                downloadedCount: 0,
                errorCount: 0,
                totalConfigs: 0
            });

            expect(mockLogger.warn).toHaveBeenCalledWith('No training or termine configurations found');
            expect(mockTermineService.downloadCalendar).not.toHaveBeenCalled();
        });

        it('should log appropriate progress messages', async () => {
            mockTermineService.downloadCalendar.mockResolvedValue(mockIcsContent1);

            await downloadTermineCommand.execute();

            expect(mockLogger.info).toHaveBeenCalledWith('🗓️  Starting termine download process...');
            expect(mockLogger.info).toHaveBeenCalledWith('Downloading: Main Calendar');
            expect(mockLogger.info).toHaveBeenCalledWith('Downloading: Youth Calendar');
            expect(mockLogger.info).toHaveBeenCalledWith('✅ Downloaded: Main Calendar -> docs/ics/termine/calendar1.ics');
            expect(mockLogger.info).toHaveBeenCalledWith('📥 Download complete: 2 successful, 0 failed');
        });

        it('should handle config service errors', async () => {
            const configError = new Error('Failed to read configs');
            mockConfigService.readTermineConfigs.mockRejectedValue(configError);
            mockConfigService.readCalendarConfigs.mockRejectedValue(configError);

            await expect(downloadTermineCommand.execute()).rejects.toThrow('Failed to read configs');
            expect(mockLogger.error).toHaveBeenCalledWith('Failed to download termine:', 'Failed to read configs');
        });

        it('should handle directory creation errors', async () => {
            const mkdirError = new Error('Cannot create directory');
            fs.mkdir.mockRejectedValue(mkdirError);

            await expect(downloadTermineCommand.execute()).rejects.toThrow('Cannot create directory');
            expect(mockLogger.error).toHaveBeenCalledWith('Failed to download termine:', 'Cannot create directory');
        });

        it('should create output directory with correct path and options', async () => {
            mockTermineService.downloadCalendar.mockResolvedValue(mockIcsContent1);

            await downloadTermineCommand.execute();

            expect(fs.mkdir).toHaveBeenCalledWith('docs/ics/termine', { recursive: true });
        });

        it('should download calendars in sequence', async () => {
            let downloadOrder = [];
            mockTermineService.downloadCalendar.mockImplementation(async (calId) => {
                downloadOrder.push(calId);
                return mockIcsContent1;
            });

            await downloadTermineCommand.execute();

            expect(downloadOrder).toEqual(['main@example.com', 'youth@example.com']);
        });

        it('should continue processing after individual failures', async () => {
            mockTermineService.downloadCalendar
                .mockRejectedValueOnce(new Error('First calendar failed'))
                .mockResolvedValueOnce(mockIcsContent2);

            const result = await downloadTermineCommand.execute();

            expect(result.downloadedCount).toBe(1);
            expect(result.errorCount).toBe(1);
            expect(fs.writeFile).toHaveBeenCalledWith('docs/ics/termine/calendar2.ics', mockIcsContent2, 'utf8');
        });

        it('should preserve error count accuracy with mixed results', async () => {
            const configs = [
                { id: '1', label: 'Cal 1', calId: 'cal1@example.com', icsFilename: 'docs/ics/termine/1.ics' },
                { id: '2', label: 'Cal 2', calId: 'cal2@example.com', icsFilename: 'docs/ics/termine/2.ics' },
                { id: '3', label: 'Cal 3', calId: 'cal3@example.com', icsFilename: 'docs/ics/termine/3.ics' }
            ];
            mockConfigService.readTermineConfigs.mockResolvedValue(configs);
            mockConfigService.readCalendarConfigs.mockImplementation((dir, type) => {
                if (dir === 'training') return [configs[0]];
                if (dir === 'termine') return [configs[1], configs[2]];
                return [];
            });

            mockTermineService.downloadCalendar
                .mockResolvedValueOnce('content1')
                .mockRejectedValueOnce(new Error('Failed'))
                .mockResolvedValueOnce('content3');

            const result = await downloadTermineCommand.execute();

            expect(result).toEqual({
                downloadedCount: 2,
                errorCount: 1,
                totalConfigs: 3
            });
        });
    });

    describe('cleanExistingFiles', () => {
        it('should remove existing .ics files from termine directory', async () => {
            fs.readdir.mockResolvedValue(['calendar1.ics', 'calendar2.ics', 'other.txt', 'readme.md']);

            await downloadTermineCommand.cleanExistingFiles();

            expect(fs.readdir).toHaveBeenCalledWith('docs/ics/training');
            expect(fs.readdir).toHaveBeenCalledWith('docs/ics/termine');
            expect(fs.unlink).toHaveBeenCalledWith('docs/ics/training/calendar1.ics');
            expect(fs.unlink).toHaveBeenCalledWith('docs/ics/training/calendar2.ics');
            expect(fs.unlink).toHaveBeenCalledWith('docs/ics/termine/calendar1.ics');
            expect(fs.unlink).toHaveBeenCalledWith('docs/ics/termine/calendar2.ics');
            expect(fs.unlink).not.toHaveBeenCalledWith('docs/ics/training/other.txt');
            expect(fs.unlink).not.toHaveBeenCalledWith('docs/ics/termine/other.txt');
            expect(mockLogger.info).toHaveBeenCalledWith('🧹 Cleaning existing calendar files...');
            expect(mockLogger.info).toHaveBeenCalledWith('✅ Cleaned 4 existing calendar files');
        });

        it('should handle empty termine directory', async () => {
            fs.readdir.mockResolvedValue([]);

            await downloadTermineCommand.cleanExistingFiles();

            expect(fs.readdir).toHaveBeenCalledWith('docs/ics/training');
            expect(fs.readdir).toHaveBeenCalledWith('docs/ics/termine');
            expect(fs.unlink).not.toHaveBeenCalled();
            expect(mockLogger.info).toHaveBeenCalledWith('No existing calendar files to clean');
        });

        it('should handle directory with no .ics files', async () => {
            fs.readdir.mockResolvedValue(['readme.md', 'config.json']);

            await downloadTermineCommand.cleanExistingFiles();

            expect(fs.readdir).toHaveBeenCalledWith('docs/ics/training');
            expect(fs.readdir).toHaveBeenCalledWith('docs/ics/termine');
            expect(fs.unlink).not.toHaveBeenCalled();
            expect(mockLogger.info).toHaveBeenCalledWith('No existing calendar files to clean');
        });

        it('should handle non-existent directory gracefully', async () => {
            const error = new Error('Directory not found');
            error.code = 'ENOENT';
            fs.readdir.mockRejectedValue(error);

            await expect(downloadTermineCommand.cleanExistingFiles()).resolves.not.toThrow();
            expect(mockLogger.debug).toHaveBeenCalledWith('Directory docs/ics/training does not exist - nothing to clean');
        });

        it('should throw error for other fs errors', async () => {
            const error = new Error('Permission denied');
            error.code = 'EACCES';
            fs.readdir.mockRejectedValue(error);

            await expect(downloadTermineCommand.cleanExistingFiles()).rejects.toThrow('Permission denied');
            expect(mockLogger.error).toHaveBeenCalledWith('Failed to clean existing calendar files:', 'Permission denied');
        });
    });

    describe('execute - additional edge cases', () => {
        it('should handle empty calendar configurations gracefully', async () => {
            mockConfigService.readTermineConfigs.mockResolvedValue([]);
            mockConfigService.readCalendarConfigs.mockResolvedValue([]);

            const result = await downloadTermineCommand.execute();

            expect(result.downloadedCount).toBe(0);
            expect(result.errorCount).toBe(0);
        });


    });

    describe('downloadTermineIcsFiles function', () => {
        it('should create DownloadTermineCommand and execute it', async () => {
            const dependencies = {
                logger: mockLogger,
                configService: mockConfigService,
                termineService: mockTermineService
            };

            mockConfigService.readTermineConfigs.mockResolvedValue([]);
            mockConfigService.readCalendarConfigs.mockResolvedValue([]);

            const result = await downloadTermineIcsFiles(dependencies);
            expect(result.downloadedCount).toBe(0);
        });
    });
});