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

        it('should include result score when available', () => {
            const game = {
                home: 'BC Lions Moabit 1',
                guest: 'Team B',
                time: '18:00',
                venue: { name: 'Sporthalle' },
                result: {
                    homeScore: 85,
                    guestScore: 78,
                    isFinished: true
                }
            };

            const result = icsService.createSummary(game);
            expect(result).toBe('BC Lions Moabit 1 vs Team B 85:78 (Sporthalle)');
        });

        it('should show finished indicator without scores', () => {
            const game = {
                home: 'BC Lions Moabit 1',
                guest: 'Team B',
                time: '18:00',
                venue: { name: 'Sporthalle' },
                result: {
                    homeScore: null,
                    guestScore: null,
                    isFinished: true
                }
            };

            const result = icsService.createSummary(game);
            expect(result).toBe('BC Lions Moabit 1 vs Team B (Beendet) (Sporthalle)');
        });

        it('should handle both result and TBD time', () => {
            const game = {
                home: 'BC Lions Moabit 1',
                guest: 'Team B',
                time: '23:59',
                venue: { name: 'Sporthalle' },
                result: {
                    homeScore: 92,
                    guestScore: 88,
                    isFinished: true
                }
            };

            const result = icsService.createSummary(game);
            expect(result).toBe('BC Lions Moabit 1 vs Team B 92:88 (Zeit TBD) (Sporthalle)');
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

        it('should include result scores in generated ICS', () => {
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
                },
                result: {
                    homeScore: 92,
                    guestScore: 85,
                    isFinished: true
                }
            }];

            const result = icsService.generateICS(games, 'Test Calendar');
            
            expect(result).toContain('SUMMARY:BC Lions Moabit 1 vs Team B 92:85 (Sporthalle)');
        });
    });

    describe('formatResult', () => {
        it('should format result with scores', () => {
            const result = {
                homeScore: 85,
                guestScore: 78,
                isFinished: true
            };

            const formatted = icsService.formatResult(result);
            expect(formatted).toBe(' 85:78');
        });

        it('should format finished game without scores', () => {
            const result = {
                homeScore: null,
                guestScore: null,
                isFinished: true
            };

            const formatted = icsService.formatResult(result);
            expect(formatted).toBe(' (Beendet)');
        });

        it('should return empty string for null result', () => {
            const formatted = icsService.formatResult(null);
            expect(formatted).toBe('');
        });

        it('should return empty string for undefined result', () => {
            const formatted = icsService.formatResult(undefined);
            expect(formatted).toBe('');
        });

        it('should handle zero scores', () => {
            const result = {
                homeScore: 0,
                guestScore: 0,
                isFinished: true
            };

            const formatted = icsService.formatResult(result);
            expect(formatted).toBe(' 0:0');
        });

        it('should handle partial result data', () => {
            const result = {
                homeScore: 85,
                guestScore: null,
                isFinished: true
            };

            const formatted = icsService.formatResult(result);
            expect(formatted).toBe(' (Beendet)');
        });
    });

    describe('addHoursToTime - edge cases', () => {
        it('should handle TBD time for any hour addition', () => {
            const result = icsService.addHoursToTime('23:59', 2);
            expect(result).toBe('23:59'); // TBD time remains unchanged
        });

        it('should handle zero hours addition', () => {
            const result = icsService.addHoursToTime('15:45', 0);
            expect(result).toBe('15:45');
        });
    });

    describe('formatResult - additional edge cases', () => {
        it('should handle results with zero scores', () => {
            const result = {
                homeScore: 0,
                guestScore: 0,
                isFinished: true
            };

            const formatted = icsService.formatResult(result);
            expect(formatted).toBe(' 0:0');
        });

        it('should handle unfinished games without scores', () => {
            const result = {
                homeScore: null,
                guestScore: null,
                isFinished: false
            };

            const formatted = icsService.formatResult(result);
            expect(formatted).toBe('');
        });
    });

    describe('createICSEvent - integration test', () => {
        it('should create a complete ICS event with all properties', () => {
            const game = {
                date: '2024-01-15',
                time: '18:00',
                home: 'Team A',
                guest: 'Team B',
                venue: { name: 'Sports Hall' },
                matchId: 'match123'
            };

            const event = icsService.createICSEvent(game);

            expect(event).toContain('BEGIN:VEVENT');
            expect(event).toContain('END:VEVENT');
            expect(event).toContain('DTSTART:20240115T180000');
            expect(event).toContain('DTEND:20240115T200000');
            expect(event).toContain('SUMMARY:Team A vs Team B (Sports Hall)');
            expect(event).toContain('UID:');
            expect(event).toContain('DTSTAMP:');
        });
    });
});