export const config = {
    api: {
        baseUrl: process.env.API_BASE_URL || 'https://www.basketball-bund.net/rest',
        timeout: parseInt(process.env.API_TIMEOUT) || 10000,
        maxRetries: parseInt(process.env.MAX_RETRIES) || 3,
        retryDelay: parseInt(process.env.RETRY_DELAY) || 1000
    },
    paths: {
        teamsDir: process.env.TEAMS_DIR || 'teams',
        outputDir: process.env.OUTPUT_DIR || 'docs/ics/spiele',
        termineOutputDir: process.env.TERMINE_OUTPUT_DIR || 'docs/ics/termine'
    },
    logging: {
        level: process.env.LOG_LEVEL || 'info'
    }
};