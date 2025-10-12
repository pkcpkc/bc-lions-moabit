import fetch from 'node-fetch';

export class HttpClient {
    constructor(baseUrl, timeout = 10000, logger = console) {
        this.baseUrl = baseUrl;
        this.timeout = timeout;
        this.logger = logger;
    }

    async get(url, options = {}) {
        const fullUrl = url.startsWith('http') ? url : `${this.baseUrl}${url}`;
        
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), this.timeout);
            
            const response = await fetch(fullUrl, {
                method: 'GET',
                signal: controller.signal,
                ...options
            });

            clearTimeout(timeoutId);

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            return await response.json();
        } catch (error) {
            this.logger.error(`HTTP request failed: ${fullUrl}`, error.message);
            throw error;
        }
    }

    async getWithRetry(url, options = {}, maxRetries = 3, delay = 1000) {
        let lastError;

        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                return await this.get(url, options);
            } catch (error) {
                lastError = error;
                
                if (attempt === maxRetries) {
                    break;
                }

                this.logger.warn(`Request failed (attempt ${attempt}/${maxRetries}): ${error.message}. Retrying in ${delay * attempt}ms...`);
                await new Promise(resolve => setTimeout(resolve, delay * attempt));
            }
        }

        throw lastError;
    }
}