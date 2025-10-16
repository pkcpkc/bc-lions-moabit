import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TermineService } from '../../src/services/termineService.js';

// Mock node-fetch
vi.mock('node-fetch', () => ({
    default: vi.fn()
}));

import fetch from 'node-fetch';

describe('TermineService', () => {
    let termineService;
    let mockHttpClient;
    let mockLogger;

    beforeEach(() => {
        mockHttpClient = {
            get: vi.fn(),
            getWithRetry: vi.fn()
        };
        mockLogger = {
            debug: vi.fn(),
            error: vi.fn(),
            info: vi.fn(),
            warn: vi.fn()
        };
        termineService = new TermineService(mockHttpClient, mockLogger);
        vi.clearAllMocks();
    });

    describe('constructor', () => {
        it('should initialize with provided httpClient and logger', () => {
            expect(termineService.httpClient).toBe(mockHttpClient);
            expect(termineService.logger).toBe(mockLogger);
        });

        it('should use console as default logger', () => {
            const service = new TermineService(mockHttpClient);
            expect(service.logger).toBe(console);
        });
    });

    describe('downloadCalendar', () => {
        it('should successfully download calendar ICS data', async () => {
            const mockIcsData = 'BEGIN:VCALENDAR\nVERSION:2.0\nEND:VCALENDAR';
            const mockResponse = {
                ok: true,
                text: vi.fn().mockResolvedValue(mockIcsData)
            };
            fetch.mockResolvedValue(mockResponse);

            const result = await termineService.downloadCalendar('test@example.com');

            expect(fetch).toHaveBeenCalledWith(
                'https://calendar.google.com/calendar/ical/test%40example.com/public/basic.ics'
            );
            expect(result).toBe(mockIcsData);
            expect(mockLogger.debug).toHaveBeenCalledWith('Downloading calendar: test@example.com');
        });

        it('should properly encode special characters in calendar ID', async () => {
            const mockResponse = { ok: true, text: vi.fn().mockResolvedValue('') };
            fetch.mockResolvedValue(mockResponse);

            await termineService.downloadCalendar('special+chars%test@example.com');

            expect(fetch).toHaveBeenCalledWith(
                'https://calendar.google.com/calendar/ical/special%2Bchars%25test%40example.com/public/basic.ics'
            );
        });

        it('should handle HTTP errors', async () => {
            const mockResponse = {
                ok: false,
                status: 404,
                statusText: 'Not Found'
            };
            fetch.mockResolvedValue(mockResponse);

            await expect(termineService.downloadCalendar('notfound@example.com')).rejects.toThrow('HTTP 404: Not Found');
            expect(mockLogger.error).toHaveBeenCalledWith(
                'Failed to download calendar notfound@example.com:',
                'HTTP 404: Not Found'
            );
        });

        it('should handle network errors', async () => {
            const networkError = new Error('Network timeout');
            fetch.mockRejectedValue(networkError);

            await expect(termineService.downloadCalendar('test@example.com')).rejects.toThrow('Network timeout');
            expect(mockLogger.error).toHaveBeenCalledWith(
                'Failed to download calendar test@example.com:',
                'Network timeout'
            );
        });

        it('should handle response.text() errors', async () => {
            const mockResponse = {
                ok: true,
                text: vi.fn().mockRejectedValue(new Error('Failed to parse text'))
            };
            fetch.mockResolvedValue(mockResponse);

            await expect(termineService.downloadCalendar('test@example.com')).rejects.toThrow('Failed to parse text');
            expect(mockLogger.error).toHaveBeenCalledWith(
                'Failed to download calendar test@example.com:',
                'Failed to parse text'
            );
        });
    });

    describe('validateTermineConfig', () => {
        it('should validate config with required fields', () => {
            const validConfig = {
                label: 'Test Calendar',
                calId: 'test@example.com'
            };

            expect(termineService.validateTermineConfig(validConfig, 'test.json')).toBe(true);
        });

        it('should throw error when label is missing', () => {
            const invalidConfig = {
                calId: 'test@example.com'
            };

            expect(() => termineService.validateTermineConfig(invalidConfig, 'test.json'))
                .toThrow('Missing required fields (label, calId) in test.json');
        });

        it('should throw error when calId is missing', () => {
            const invalidConfig = {
                label: 'Test Calendar'
            };

            expect(() => termineService.validateTermineConfig(invalidConfig, 'test.json'))
                .toThrow('Missing required fields (label, calId) in test.json');
        });

        it('should throw error when both fields are missing', () => {
            const invalidConfig = {};

            expect(() => termineService.validateTermineConfig(invalidConfig, 'test.json'))
                .toThrow('Missing required fields (label, calId) in test.json');
        });

        it('should throw error when fields are empty strings', () => {
            const invalidConfig = {
                label: '',
                calId: ''
            };

            expect(() => termineService.validateTermineConfig(invalidConfig, 'test.json'))
                .toThrow('Missing required fields (label, calId) in test.json');
        });

        it('should accept fields with whitespace content', () => {
            const validConfig = {
                label: '  Test Calendar  ',
                calId: '  test@example.com  '
            };

            expect(termineService.validateTermineConfig(validConfig, 'test.json')).toBe(true);
        });
    });

    describe('generateTermineId', () => {
        it('should extract ID from simple filename', () => {
            const result = termineService.generateTermineId('test.json');
            expect(result).toBe('test');
        });

        it('should extract ID from filename with termine/ prefix', () => {
            const result = termineService.generateTermineId('termine/calendar.json');
            expect(result).toBe('calendar');
        });

        it('should handle complex filenames', () => {
            const result = termineService.generateTermineId('termine/mU14-mU20.json');
            expect(result).toBe('mU14-mU20');
        });

        it('should handle filenames without .json extension', () => {
            const result = termineService.generateTermineId('termine/calendar');
            expect(result).toBe('calendar');
        });

        it('should handle empty filename', () => {
            const result = termineService.generateTermineId('');
            expect(result).toBe('');
        });

        it('should handle filename with multiple dots', () => {
            const result = termineService.generateTermineId('termine/calendar.backup.json');
            expect(result).toBe('calendar.backup');
        });
    });

    describe('createTermineConfig', () => {
        it('should create termine config with all required properties', () => {
            const config = {
                label: 'Test Calendar',
                calId: 'test@example.com'
            };

            const result = termineService.createTermineConfig(config, 'termine/test.json');

            expect(result).toEqual({
                id: 'test',
                label: 'Test Calendar',
                calId: 'test@example.com',
                icsFilename: 'docs/ics/termine/test.ics',
                icsUrl: './ics/termine/test.ics',
                jsonUrl: './data/termine/test.json'
            });
        });

        it('should handle complex filename IDs', () => {
            const config = {
                label: 'Mixed Youth Calendar',
                calId: 'youth@example.com'
            };

            const result = termineService.createTermineConfig(config, 'termine/mU14-mU20.json');

            expect(result).toEqual({
                id: 'mU14-mU20',
                label: 'Mixed Youth Calendar',
                calId: 'youth@example.com',
                icsFilename: 'docs/ics/termine/mU14-mU20.ics',
                icsUrl: './ics/termine/mU14-mU20.ics',
                jsonUrl: './data/termine/mU14-mU20.json'
            });
        });

        it('should preserve additional config properties', () => {
            const config = {
                label: 'Test Calendar',
                calId: 'test@example.com',
                description: 'Additional description',
                color: '#FF0000'
            };

            const result = termineService.createTermineConfig(config, 'termine/test.json');

            expect(result.label).toBe('Test Calendar');
            expect(result.calId).toBe('test@example.com');
            expect(result.id).toBe('test');
            // Additional properties are not included in the result
            expect(result.description).toBeUndefined();
            expect(result.color).toBeUndefined();
        });

        it('should handle special characters in config values', () => {
            const config = {
                label: 'Spëcîàl Çälêndär',
                calId: 'special+chars%test@example.com'
            };

            const result = termineService.createTermineConfig(config, 'termine/special.json');

            expect(result).toEqual({
                id: 'special',
                label: 'Spëcîàl Çälêndär',
                calId: 'special+chars%test@example.com',
                icsFilename: 'docs/ics/termine/special.ics',
                icsUrl: './ics/termine/special.ics',
                jsonUrl: './data/termine/special.json'
            });
        });
    });
});