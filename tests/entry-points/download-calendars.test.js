import { describe, it, expect, vi, beforeEach } from 'vitest';

// These tests validate the integration between components used in entry point scripts
// Testing actual entry point execution is complex with ES modules and process.exit

describe('download-calendars.js entry point integration', () => {
    let DownloadTermineCommand;
    let Logger;
    let config;

    beforeEach(async () => {
        // Import actual modules to test integration
        ({ DownloadTermineCommand } = await import('../../src/commands/downloadTermine.js'));
        ({ Logger } = await import('../../src/services/logger.js'));
        ({ config } = await import('../../src/config/index.js'));
    });

    it('should create DownloadTermineCommand with logger successfully', () => {
        const logger = new Logger(config.logging.level);
        const command = new DownloadTermineCommand({ logger });

        expect(command).toBeInstanceOf(DownloadTermineCommand);
        expect(command.logger).toBe(logger);
    });

    it('should handle config loading', () => {
        expect(config).toBeDefined();
        expect(config.logging).toBeDefined();
        expect(config.logging.level).toBeDefined();
    });

    it('should create logger with config level', () => {
        const logger = new Logger(config.logging.level);
        expect(logger).toBeInstanceOf(Logger);
    });

    it('should create command with default dependencies', () => {
        const command = new DownloadTermineCommand();
        
        expect(command).toBeInstanceOf(DownloadTermineCommand);
        expect(command.logger).toBeDefined();
        expect(command.httpClient).toBeDefined();
        expect(command.termineService).toBeDefined();
        expect(command.configService).toBeDefined();
    });
});