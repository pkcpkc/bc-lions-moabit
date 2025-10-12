#!/usr/bin/env node

import { CrawlCommand } from './commands/crawl.js';

// Create and execute the crawl command
const crawlCommand = new CrawlCommand();

async function main() {
    try {
        await crawlCommand.execute();
        process.exit(0);
    } catch (error) {
        console.error('Crawl failed:', error.message);
        process.exit(1);
    }
}

main();