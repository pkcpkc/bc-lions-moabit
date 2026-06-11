export const config = {
    api: {
        baseUrl: process.env.API_BASE_URL || 'https://www.basketball-bund.net/rest',
        timeout: parseInt(process.env.API_TIMEOUT) || 10000,
        maxRetries: parseInt(process.env.MAX_RETRIES) || 3,
        retryDelay: parseInt(process.env.RETRY_DELAY) || 1000
    },
    paths: {
        teamsDir: process.env.TEAMS_DIR || 'spiele',
        outputDir: process.env.OUTPUT_DIR || 'dist/ics/spiele',
        trainingOutputDir: process.env.TRAINING_OUTPUT_DIR || 'dist/ics/training',
        termineOutputDir: process.env.TERMINE_OUTPUT_DIR || 'dist/ics/termine',
        spieleJsonDir: process.env.SPIELE_JSON_DIR || 'dist/data/spiele',
        trainingJsonDir: process.env.TRAINING_JSON_DIR || 'dist/data/training',
        termineJsonDir: process.env.TERMINE_JSON_DIR || 'dist/data/termine',
        indexTemplatePath: process.env.INDEX_TEMPLATE_PATH || 'index.template.html',
        indexOutputPath: process.env.INDEX_OUTPUT_PATH || 'dist/index.html',
        publicDir: process.env.PUBLIC_DIR || 'public',
        distDir: process.env.DIST_DIR || 'dist',
        pathPrefix: process.env.PATH_PREFIX || 'dist'
    },
    logging: {
        level: process.env.LOG_LEVEL || 'info'
    }
};