import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ICSService } from '../../src/services/icsService.js';

describe('ICSService', () => {
    let icsService;
    let mockLogger;

    beforeEach(() => {
        mockLogger = {
            info: vi.fn(),
            warn: vi.fn(),
            error: vi.fn()
        };
        icsService = new ICSService(mockLogger);
    });

    describe('formatDateForICS', () => {
        it('should format YYYY-MM-DD date correctly', () => {
            const result = icsService.formatDateForICS('2024-01-15', '18:00');
            expect(result).toBe('20240115T180000');
        });

        it('should format DD.MM.YYYY date correctly', () => {
            const result = icsService.formatDateForICS('15.01.2024', '18:00');
            expect(result).toBe('20240115T180000');
        });

        it('should handle TBD time (23:59)', () => {
            const result = icsService.formatDateForICS('2024-01-15', '23:59');
            expect(result).toBe('20240115T000000');
        });

        it('should throw error for invalid date format', () => {
            expect(() => icsService.formatDateForICS('invalid', '18:00')).toThrow();
        });

        it('should throw error for null date', () => {
            expect(() => icsService.formatDateForICS(null, '18:00')).toThrow();
        });
    });

    describe('addHoursToTime', () => {
        it('should add hours correctly', () => {
            const result = icsService.addHoursToTime('18:00', 2);
            expect(result).toBe('20:00');
        });

        it('should handle TBD time', () => {
            const result = icsService.addHoursToTime('23:59', 2);
            expect(result).toBe('23:59');
        });

        it('should cap at 23:59 for overflow', () => {
            const result = icsService.addHoursToTime('23:00', 2);
            expect(result).toBe('23:59');
        });
    });

    describe('createSummary', () => {
        it('should create basic summary', () => {
            const game = {
                home: 'BC Lions Moabit 1',
                guest: 'Team B',
                time: '18:00',
                venue: { name: 'Sporthalle' }
            };

            const result = icsService.createSummary(game);
            expect(result).toBe('BC Lions Moabit 1 vs Team B (Sporthalle)');
        });

        it('should add TBD indicator for placeholder time', () => {
            const game = {
                home: 'BC Lions Moabit 1',
                guest: 'Team B',
                time: '23:59',
                venue: { name: 'Sporthalle' }
            };

            const result = icsService.createSummary(game);
            expect(result).toBe('BC Lions Moabit 1 vs Team B (Zeit TBD) (Sporthalle)');
        });

        it('should work without venue name', () => {
            const game = {
                home: 'BC Lions Moabit 1',
                guest: 'Team B',
                time: '18:00',
                venue: {}
            };

            const result = icsService.createSummary(game);
            expect(result).toBe('BC Lions Moabit 1 vs Team B');
        });
    });

    describe('createLocation', () => {
        it('should create properly formatted location', () => {
            const game = {
                venue: {
                    street: 'Hauptstr. 1',
                    zip: '10115',
                    city: 'Berlin'
                }
            };

            const result = icsService.createLocation(game);
            expect(result).toBe('Hauptstr. 1\\, 10115 Berlin');
        });

        it('should return empty string for missing venue', () => {
            const game = { venue: null };
            const result = icsService.createLocation(game);
            expect(result).toBe('');
        });

        it('should return empty string for venue without street', () => {
            const game = { venue: { city: 'Berlin' } };
            const result = icsService.createLocation(game);
            expect(result).toBe('');
        });
    });

    describe('generateICS', () => {
        it('should generate valid ICS file', () => {
            const games = [{
                date: '2024-01-15',
                time: '18:00',
                home: 'BC Lions Moabit 1',
                guest: 'Team B',
                matchId: '12345',
                venue: {
                    name: 'Sporthalle',
                    street: 'Hauptstr. 1',
                    zip: '10115',
                    city: 'Berlin'
                }
            }];

            const result = icsService.generateICS(games, 'Test Calendar');
            
            expect(result).toContain('BEGIN:VCALENDAR');
            expect(result).toContain('END:VCALENDAR');
            expect(result).toContain('X-WR-CALNAME:Test Calendar');
            expect(result).toContain('BC Lions Moabit 1 vs Team B');
            expect(result).toContain('12345@bc-lions-moabit');
        });

        it('should handle empty games array', () => {
            const result = icsService.generateICS([], 'Empty Calendar');
            
            expect(result).toContain('BEGIN:VCALENDAR');
            expect(result).toContain('END:VCALENDAR');
            expect(result).toContain('X-WR-CALNAME:Empty Calendar');
            expect(mockLogger.warn).toHaveBeenCalledWith('No games provided for ICS generation');
        });
    });
});