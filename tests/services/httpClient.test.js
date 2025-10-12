import { describe, it, expect, vi, beforeEach } from 'vitest';
import { HttpClient } from '../../src/services/httpClient.js';

// Mock node-fetch
vi.mock('node-fetch', () => ({
    default: vi.fn()
}));

import fetch from 'node-fetch';

describe('HttpClient', () => {
    let httpClient;
    let mockLogger;

    beforeEach(() => {
        mockLogger = {
            error: vi.fn(),
            warn: vi.fn(),
            info: vi.fn()
        };
        httpClient = new HttpClient('https://api.example.com', 5000, mockLogger);
        vi.clearAllMocks();
    });

    describe('constructor', () => {
        it('should initialize with default values', () => {
            const client = new HttpClient('https://api.test.com');
            expect(client.baseUrl).toBe('https://api.test.com');
            expect(client.timeout).toBe(10000);
        });

        it('should initialize with custom timeout and logger', () => {
            const customLogger = { log: vi.fn() };
            const client = new HttpClient('https://api.test.com', 15000, customLogger);
            expect(client.baseUrl).toBe('https://api.test.com');
            expect(client.timeout).toBe(15000);
            expect(client.logger).toBe(customLogger);
        });
    });

    describe('get', () => {
        it('should make successful GET request with relative URL', async () => {
            const mockResponse = { ok: true, json: vi.fn().mockResolvedValue({ data: 'test' }) };
            fetch.mockResolvedValue(mockResponse);

            const result = await httpClient.get('/endpoint');

            expect(fetch).toHaveBeenCalledWith('https://api.example.com/endpoint', {
                method: 'GET',
                signal: expect.any(AbortSignal)
            });
            expect(result).toEqual({ data: 'test' });
        });

        it('should make successful GET request with absolute URL', async () => {
            const mockResponse = { ok: true, json: vi.fn().mockResolvedValue({ data: 'test' }) };
            fetch.mockResolvedValue(mockResponse);

            const result = await httpClient.get('https://other.api.com/endpoint');

            expect(fetch).toHaveBeenCalledWith('https://other.api.com/endpoint', {
                method: 'GET',
                signal: expect.any(AbortSignal)
            });
            expect(result).toEqual({ data: 'test' });
        });

        it('should handle HTTP error responses', async () => {
            const mockResponse = { ok: false, status: 404, statusText: 'Not Found' };
            fetch.mockResolvedValue(mockResponse);

            await expect(httpClient.get('/notfound')).rejects.toThrow('HTTP 404: Not Found');
            expect(mockLogger.error).toHaveBeenCalledWith(
                'HTTP request failed: https://api.example.com/notfound',
                'HTTP 404: Not Found'
            );
        });

        it('should handle network errors', async () => {
            const networkError = new Error('Network error');
            fetch.mockRejectedValue(networkError);

            await expect(httpClient.get('/endpoint')).rejects.toThrow('Network error');
            expect(mockLogger.error).toHaveBeenCalledWith(
                'HTTP request failed: https://api.example.com/endpoint',
                'Network error'
            );
        });

        it('should pass additional options to fetch', async () => {
            const mockResponse = { ok: true, json: vi.fn().mockResolvedValue({}) };
            fetch.mockResolvedValue(mockResponse);

            await httpClient.get('/endpoint', { headers: { 'Accept': 'application/json' } });

            expect(fetch).toHaveBeenCalledWith('https://api.example.com/endpoint', {
                method: 'GET',
                signal: expect.any(AbortSignal),
                headers: { 'Accept': 'application/json' }
            });
        });
    });

    describe('getWithRetry', () => {
        it('should succeed on first attempt', async () => {
            const mockResponse = { ok: true, json: vi.fn().mockResolvedValue({ data: 'success' }) };
            fetch.mockResolvedValue(mockResponse);

            const result = await httpClient.getWithRetry('/endpoint');

            expect(fetch).toHaveBeenCalledTimes(1);
            expect(result).toEqual({ data: 'success' });
        });

        it('should retry on failure and eventually succeed', async () => {
            const errorResponse = { ok: false, status: 500, statusText: 'Server Error' };
            const successResponse = { ok: true, json: vi.fn().mockResolvedValue({ data: 'success' }) };
            
            fetch.mockResolvedValueOnce(errorResponse)
                 .mockResolvedValueOnce(successResponse);

            // Mock setTimeout to resolve immediately
            vi.spyOn(global, 'setTimeout').mockImplementation((cb) => {
                cb();
                return 123;
            });

            const result = await httpClient.getWithRetry('/endpoint', {}, 3, 100);

            expect(fetch).toHaveBeenCalledTimes(2);
            expect(result).toEqual({ data: 'success' });
            expect(mockLogger.warn).toHaveBeenCalledWith(
                expect.stringContaining('Request failed (attempt 1/3)')
            );

            global.setTimeout.mockRestore();
        });

        it('should fail after max retries', async () => {
            const errorResponse = { ok: false, status: 500, statusText: 'Server Error' };
            fetch.mockResolvedValue(errorResponse);

            // Mock setTimeout to resolve immediately
            vi.spyOn(global, 'setTimeout').mockImplementation((cb) => {
                cb();
                return 123;
            });

            await expect(httpClient.getWithRetry('/endpoint', {}, 2, 100)).rejects.toThrow('HTTP 500: Server Error');

            expect(fetch).toHaveBeenCalledTimes(2);
            expect(mockLogger.warn).toHaveBeenCalledTimes(1);

            global.setTimeout.mockRestore();
        });

        it('should use custom retry parameters', async () => {
            const errorResponse = { ok: false, status: 503, statusText: 'Service Unavailable' };
            fetch.mockResolvedValue(errorResponse);

            // Mock setTimeout to resolve immediately
            vi.spyOn(global, 'setTimeout').mockImplementation((cb) => {
                cb();
                return 123;
            });

            await expect(httpClient.getWithRetry('/endpoint', {}, 5, 200)).rejects.toThrow('HTTP 503: Service Unavailable');

            expect(fetch).toHaveBeenCalledTimes(5);
            expect(mockLogger.warn).toHaveBeenCalledTimes(4);

            global.setTimeout.mockRestore();
        });
    });
});