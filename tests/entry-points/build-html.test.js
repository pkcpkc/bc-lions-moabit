import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// These tests validate the integration between components used in entry point scripts
// Testing actual entry point execution is complex with ES modules and process.exit

describe('build-html.js entry point integration', () => {
    let BuildHTMLCommand;
    let Logger;
    let config;

    beforeEach(async () => {
        // Import actual modules to test integration
        ({ BuildHTMLCommand } = await import('../../src/commands/buildHTML.js'));
        ({ Logger } = await import('../../src/services/logger.js'));
        ({ config } = await import('../../src/config/index.js'));
    });

    it('should create BuildHTMLCommand with logger successfully', () => {
        const logger = new Logger(config.logging.level);
        const command = new BuildHTMLCommand({ logger });

        expect(command).toBeInstanceOf(BuildHTMLCommand);
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
});