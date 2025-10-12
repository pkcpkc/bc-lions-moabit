import fetch from 'node-fetch';

export class TermineService {
    constructor(httpClient, logger = console) {
        this.httpClient = httpClient;
        this.logger = logger;
    }

    async downloadCalendar(calId, retries = 3) {
        const icsUrl = `https://calendar.google.com/calendar/ical/${encodeURIComponent(calId)}/public/basic.ics`;
        
        this.logger.debug(`Downloading calendar: ${calId}`);
        
        try {
            // Use direct fetch for text content since HttpClient expects JSON
            const response = await fetch(icsUrl);
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            return await response.text();
        } catch (error) {
            this.logger.error(`Failed to download calendar ${calId}:`, error.message);
            throw error;
        }
    }

    validateTermineConfig(config, filename) {
        if (!config.label || !config.calId) {
            throw new Error(`Missing required fields (label, calId) in ${filename}`);
        }
        return true;
    }

    generateTermineId(filename) {
        return filename.replace('termine/', '').replace('.json', '');
    }

    createTermineConfig(config, filename) {
        const id = this.generateTermineId(filename);
        
        return {
            id,
            label: config.label,
            calId: config.calId,
            icsFilename: `docs/ics/termine/${id}.ics`,
            icsUrl: `https://pkcpkc.github.io/bc-lions-moabit/ics/termine/${id}.ics`
        };
    }
}