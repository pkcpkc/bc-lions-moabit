import { describe, it, expect, beforeEach } from 'vitest';

// Integration tests for entry point scripts - testing component compatibility

describe('Entry points integration', () => {
    let buildCommand, fetchCommand, crawlCommand;

    beforeEach(async () => {
        // Import commands for integration testing
        const { BuildCommand } = await import('../../src/commands/build.js');
        const { FetchGamesCommand } = await import('../../src/commands/fetchGames.js');
        const { CrawlCommand } = await import('../../src/commands/crawl.js');

        buildCommand = new BuildCommand();
        fetchCommand = new FetchGamesCommand();
        crawlCommand = new CrawlCommand();
    });

    it('should create BuildCommand with default dependencies', () => {
        expect(buildCommand).toBeDefined();
        expect(buildCommand.logger).toBeDefined();
    });

    it('should create FetchGamesCommand with default dependencies', () => {
        expect(fetchCommand).toBeDefined();
        expect(fetchCommand.logger).toBeDefined();
        expect(fetchCommand.gamesService).toBeDefined();
        expect(fetchCommand.icsService).toBeDefined();
    });

    it('should create CrawlCommand with default dependencies', () => {
        expect(crawlCommand).toBeDefined();
        expect(crawlCommand.logger).toBeDefined();
        expect(crawlCommand.crawlService).toBeDefined();
    });

    describe('fetch-all-games.js integration', () => {
        it('should import fetch-all-games module successfully', async () => {
            const module = await import('../../src/fetch-all-games.js');
            expect(module).toBeDefined();
            // The module exists and can be imported
        });
    });

    describe('fetch-games.js integration', () => {
        it('should import and create single team fetch command', async () => {
            const { fetchGamesCommand } = await import('../../src/commands/fetchGames.js');
            expect(fetchGamesCommand).toBeInstanceOf(Function);
        });
    });
});