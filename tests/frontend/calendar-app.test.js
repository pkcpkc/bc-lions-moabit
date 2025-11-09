import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock DOM methods
global.document = {
    createElement: vi.fn(),
    getElementById: vi.fn(),
    querySelectorAll: vi.fn(),
    querySelector: vi.fn(),
    addEventListener: vi.fn(),
    body: {
        appendChild: vi.fn(),
        removeChild: vi.fn()
    }
};

global.window = {
    location: {
        pathname: '/',
        hash: '',
        href: 'http://localhost:8000/'
    },
    history: {
        pushState: vi.fn(),
        replaceState: vi.fn()
    },
    navigator: {
        clipboard: {
            writeText: vi.fn()
        }
    },
    CALENDAR_CONFIGS: [],
    SCHEDULE_CONFIGS: []
};

// Import functions to test (we'll need to extract them from calendar-app.js)
// For now, let's copy the functions we want to test here

// RANGE_TYPES with built-in filtering logic
const RANGE_TYPES = {
    ALL: (events) => events,
    FUTURE: (events) => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        return events.filter(event => event.startDate >= today);
    },
    PAST_WEEK: (events) => {
        const now = new Date();
        const oneWeekAgo = new Date();
        oneWeekAgo.setDate(now.getDate() - 7);
        return events.filter(event => {
            const eventDate = new Date(event.startDate);
            return eventDate >= oneWeekAgo && eventDate <= now;
        });
    },
    PAST_MONTH: (events) => {
        const now = new Date();
        const oneMonthAgo = new Date();
        oneMonthAgo.setDate(now.getDate() - 30);
        return events.filter(event => {
            const eventDate = new Date(event.startDate);
            return eventDate >= oneMonthAgo && eventDate <= now;
        });
    },
    NEXT_WEEK: (events) => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const endDate = new Date(today);
        endDate.setDate(today.getDate() + 7);
        endDate.setHours(23, 59, 59, 999);
        return events.filter(event =>
            event.startDate >= today && event.startDate <= endDate
        );
    },
    NEXT_MONTH: (events) => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const endDate = new Date(today);
        endDate.setMonth(today.getMonth() + 1);
        endDate.setHours(23, 59, 59, 999);
        return events.filter(event =>
            event.startDate >= today && event.startDate <= endDate
        );
    }
};

// Extract game result from structured JSON data
function extractGameResultFromData(gameData, title) {
    if (gameData.result && gameData.result.isFinished) {
        const result = gameData.result;

        if (result.homeScore !== null && result.guestScore !== null) {
            let isWin = null;
            const lionTeam = [gameData.home, gameData.guest].find(team =>
                team && team.toLowerCase().includes('bc lions moabit')
            );

            if (lionTeam) {
                if (lionTeam === gameData.home) {
                    isWin = result.homeScore > result.guestScore;
                } else {
                    isWin = result.guestScore > result.homeScore;
                }
            }

            return {
                hasResult: true,
                homeScore: result.homeScore,
                guestScore: result.guestScore,
                isWin,
                isFinished: true,
                scoreText: `${result.homeScore}:${result.guestScore}`,
                scoreDiff: Math.abs(result.homeScore - result.guestScore)
            };
        } else {
            return {
                hasResult: true,
                homeScore: null,
                guestScore: null,
                isWin: null,
                isFinished: true,
                scoreText: 'Beendet',
                scoreDiff: 0
            };
        }
    }

    return { hasResult: false };
}



// Format date function
function formatDate(date) {
    const options = {
        weekday: 'short',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
    };
    return date.toLocaleDateString('de-DE', options);
}

// Format date range function
function formatDateRange(startDate, endDate) {
    const startDateOnly = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate());
    const endDateOnly = new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate());

    if (startDateOnly.getTime() !== endDateOnly.getTime()) {
        const startOptions = {
            weekday: 'short',
            year: 'numeric',
            month: '2-digit',
            day: '2-digit'
        };
        const endOptions = {
            weekday: 'short',
            year: 'numeric',
            month: '2-digit',
            day: '2-digit'
        };

        const startFormatted = startDate.toLocaleDateString('de-DE', startOptions);
        const endFormatted = endDate.toLocaleDateString('de-DE', endOptions);

        return `${startFormatted} bis ${endFormatted}`;
    } else {
        return formatDate(startDate);
    }
}

// Helper function to check if an event is a full-day event
function isFullDayEvent(event) {
    // Full-day events typically start at 00:00 and either:
    // 1. End at 00:00 the next day, or
    // 2. Have the same start and end time at 00:00
    const startHours = event.startDate.getHours();
    const startMinutes = event.startDate.getMinutes();
    const endHours = event.endDate.getHours();
    const endMinutes = event.endDate.getMinutes();
    
    // Check if start time is 00:00
    if (startHours === 0 && startMinutes === 0) {
        // If end time is also 00:00, it's likely a full-day event
        if (endHours === 0 && endMinutes === 0) {
            return true;
        }
        
        // Also check if it spans exactly 24 hours (some calendar systems do this)
        const timeDiff = event.endDate.getTime() - event.startDate.getTime();
        const dayInMs = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
        if (timeDiff === dayInMs) {
            return true;
        }
    }
    
    return false;
}

// Helper function to format event time (handles full-day events)
function formatEventTime(event) {
    if (isFullDayEvent(event)) {
        return 'ganztägig';
    }
    
    return event.startDate.toLocaleTimeString('de-DE', {
        hour: '2-digit',
        minute: '2-digit'
    });
}

// Parse JSON data function
function parseJsonData(data, teamId = null) {
    try {
        if (!data || !data.events || !Array.isArray(data.events)) {
            console.warn('No events array found in JSON data');
            return [];
        }

        const events = data.events.map(event => {
            const startDate = new Date(event.startDate);
            const endDate = new Date(event.endDate);

            return {
                summary: event.summary,
                startDate: startDate,
                endDate: endDate,
                location: event.location || '',
                description: event.description || '',
                venueName: event.venueName || '',
                teamId: teamId ? teamId.toUpperCase() : null,
                gameData: event.game || null
            };
        });

        return events;
    } catch (error) {
        console.error('Error parsing JSON data:', error);
        return [];
    }
}

describe('Calendar App Functions', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('RANGE_TYPES', () => {
        const mockEvents = [
            { startDate: new Date('2025-10-10') }, // Past
            { startDate: new Date('2025-10-16') }, // Today (assuming current date is 2025-10-16)
            { startDate: new Date('2025-10-20') }, // Future
            { startDate: new Date('2025-10-25') }, // Next week
            { startDate: new Date('2025-11-15') }, // Next month
        ];

        it('ALL should return all events', () => {
            const result = RANGE_TYPES.ALL(mockEvents);
            expect(result).toHaveLength(5);
            expect(result).toEqual(mockEvents);
        });

        it('FUTURE should filter future events', () => {
            const result = RANGE_TYPES.FUTURE(mockEvents);
            // Should include today and future events
            expect(result.length).toBeGreaterThan(0);
            result.forEach(event => {
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                expect(event.startDate >= today).toBe(true);
            });
        });

        it('PAST_WEEK should filter past week events', () => {
            const now = new Date();
            const pastWeekEvent = { startDate: new Date(now.getTime() - (3 * 24 * 60 * 60 * 1000)) }; // 3 days ago
            const oldEvent = { startDate: new Date(now.getTime() - (10 * 24 * 60 * 60 * 1000)) }; // 10 days ago
            
            const testEvents = [pastWeekEvent, oldEvent];
            const result = RANGE_TYPES.PAST_WEEK(testEvents);
            
            expect(result).toContain(pastWeekEvent);
            expect(result).not.toContain(oldEvent);
        });

        it('NEXT_WEEK should filter next week events', () => {
            const today = new Date();
            const nextWeekEvent = { startDate: new Date(today.getTime() + (3 * 24 * 60 * 60 * 1000)) }; // 3 days from now
            const farFutureEvent = { startDate: new Date(today.getTime() + (10 * 24 * 60 * 60 * 1000)) }; // 10 days from now
            
            const testEvents = [nextWeekEvent, farFutureEvent];
            const result = RANGE_TYPES.NEXT_WEEK(testEvents);
            
            expect(result).toContain(nextWeekEvent);
        });
    });



    describe('extractGameResultFromData', () => {
        it('should extract result from structured game data - BC Lions home win', () => {
            const gameData = {
                home: 'BC Lions Moabit',
                guest: 'Team B',
                result: {
                    isFinished: true,
                    homeScore: 85,
                    guestScore: 78
                }
            };
            
            const result = extractGameResultFromData(gameData, 'Test Title');
            
            expect(result.hasResult).toBe(true);
            expect(result.homeScore).toBe(85);
            expect(result.guestScore).toBe(78);
            expect(result.isWin).toBe(true);
            expect(result.scoreText).toBe('85:78');
        });

        it('should extract result from structured game data - BC Lions guest win', () => {
            const gameData = {
                home: 'Team A',
                guest: 'BC Lions Moabit',
                result: {
                    isFinished: true,
                    homeScore: 70,
                    guestScore: 85
                }
            };
            
            const result = extractGameResultFromData(gameData, 'Test Title');
            
            expect(result.hasResult).toBe(true);
            expect(result.homeScore).toBe(70);
            expect(result.guestScore).toBe(85);
            expect(result.isWin).toBe(true);
            expect(result.scoreText).toBe('70:85');
        });

        it('should handle finished game without BC Lions', () => {
            const gameData = {
                home: 'Team A',
                guest: 'Team B',
                result: {
                    isFinished: true,
                    homeScore: 80,
                    guestScore: 75
                }
            };
            
            const result = extractGameResultFromData(gameData, 'Test Title');
            
            expect(result.hasResult).toBe(true);
            expect(result.isWin).toBe(null); // No BC Lions team found
        });

        it('should handle unfinished game', () => {
            const gameData = {
                home: 'BC Lions Moabit',
                guest: 'Team B',
                result: {
                    isFinished: false
                }
            };
            
            const result = extractGameResultFromData(gameData, 'Test Title');
            
            expect(result.hasResult).toBe(false);
        });

        it('should handle finished game without scores', () => {
            const gameData = {
                home: 'BC Lions Moabit',
                guest: 'Team B',
                result: {
                    isFinished: true,
                    homeScore: null,
                    guestScore: null
                }
            };
            
            const result = extractGameResultFromData(gameData, 'Test Title');
            
            expect(result.hasResult).toBe(true);
            expect(result.scoreText).toBe('Beendet');
            expect(result.isWin).toBe(null);
        });
    });

    describe('formatDate', () => {
        it('should format date in German locale', () => {
            const date = new Date('2025-10-16T19:30:00');
            const result = formatDate(date);
            
            // Should contain German weekday abbreviation and proper formatting
            expect(result).toMatch(/\w{2}\./); // Weekday abbreviation
            expect(result).toContain('2025');
            expect(result).toContain('10');
            expect(result).toContain('16');
            expect(result).toContain('19:30');
        });
    });

    describe('formatDateRange', () => {
        it('should format single day event', () => {
            const startDate = new Date('2025-10-16T19:30:00');
            const endDate = new Date('2025-10-16T21:30:00');
            const result = formatDateRange(startDate, endDate);
            
            // Should use single date format
            expect(result).toMatch(/\w{2}\./); // Weekday abbreviation
            expect(result).toContain('19:30');
        });

        it('should format multi-day event', () => {
            const startDate = new Date('2025-10-16T10:00:00');
            const endDate = new Date('2025-10-18T18:00:00');
            const result = formatDateRange(startDate, endDate);
            
            // Should contain "bis" (German "to")
            expect(result).toContain('bis');
            expect(result).toContain('16.10.2025');
            expect(result).toContain('18.10.2025');
        });
    });

    describe('isFullDayEvent', () => {
        it('should detect all-day events starting at local midnight', () => {
            const event = {
                startDate: new Date('2025-12-08T00:00:00'), // Local midnight
                endDate: new Date('2025-12-08T00:00:00')
            };
            
            expect(isFullDayEvent(event)).toBe(true);
        });

        it('should detect all-day events starting at UTC midnight', () => {
            const event = {
                startDate: new Date('2025-12-07T23:00:00.000Z'), // UTC 23:00 = local midnight (CET)
                endDate: new Date('2025-12-07T23:00:00.000Z')
            };
            
            expect(isFullDayEvent(event)).toBe(true);
        });

        it('should not detect timed events as all-day', () => {
            const event = {
                startDate: new Date('2025-11-13T16:00:00.000Z'), // 4 PM UTC
                endDate: new Date('2025-11-13T17:30:00.000Z') // 5:30 PM UTC
            };
            
            expect(isFullDayEvent(event)).toBe(false);
        });

        it('should detect 24-hour spanning events as full-day', () => {
            const startDate = new Date('2025-12-08T00:00:00');
            const endDate = new Date(startDate.getTime() + 24 * 60 * 60 * 1000); // Exactly 24 hours later
            const event = {
                startDate: startDate,
                endDate: endDate
            };
            
            expect(isFullDayEvent(event)).toBe(true);
        });
    });

    describe('formatEventTime', () => {
        it('should return "ganztägig" for full-day events', () => {
            const event = {
                startDate: new Date('2025-12-08T00:00:00'),
                endDate: new Date('2025-12-08T00:00:00')
            };
            
            expect(formatEventTime(event)).toBe('ganztägig');
        });

        it('should return formatted time for timed events', () => {
            const event = {
                startDate: new Date('2025-11-13T16:00:00.000Z'), // 4 PM UTC = 5 PM CET
                endDate: new Date('2025-11-13T17:30:00.000Z')
            };
            
            const result = formatEventTime(event);
            expect(result).toMatch(/^\d{2}:\d{2}$/); // Should match HH:MM format
        });

        it('should return "ganztägig" for UTC midnight events', () => {
            const event = {
                startDate: new Date('2025-12-07T23:00:00.000Z'), // UTC 23:00 = local midnight (CET)
                endDate: new Date('2025-12-07T23:00:00.000Z')
            };
            
            expect(formatEventTime(event)).toBe('ganztägig');
        });
    });

    describe('parseJsonData', () => {
        it('should parse valid JSON event data', () => {
            const data = {
                events: [
                    {
                        summary: 'Test Game',
                        startDate: '2025-10-16T19:30:00',
                        endDate: '2025-10-16T21:30:00',
                        location: 'Test Hall',
                        venueName: 'Test Venue'
                    }
                ]
            };
            
            const result = parseJsonData(data, 'test-team');
            
            expect(result).toHaveLength(1);
            expect(result[0].summary).toBe('Test Game');
            expect(result[0].startDate).toBeInstanceOf(Date);
            expect(result[0].endDate).toBeInstanceOf(Date);
            expect(result[0].location).toBe('Test Hall');
            expect(result[0].venueName).toBe('Test Venue');
            expect(result[0].teamId).toBe('TEST-TEAM');
        });

        it('should handle missing events array', () => {
            const data = { someOtherProperty: 'value' };
            const result = parseJsonData(data);
            
            expect(result).toHaveLength(0);
        });

        it('should handle malformed data gracefully', () => {
            const data = null;
            const result = parseJsonData(data);
            
            expect(result).toHaveLength(0);
        });

        it('should handle events with minimal data', () => {
            const data = {
                events: [
                    {
                        summary: 'Minimal Game',
                        startDate: '2025-10-16T19:30:00',
                        endDate: '2025-10-16T21:30:00'
                    }
                ]
            };
            
            const result = parseJsonData(data);
            
            expect(result).toHaveLength(1);
            expect(result[0].summary).toBe('Minimal Game');
            expect(result[0].location).toBe('');
            expect(result[0].venueName).toBe('');
            expect(result[0].teamId).toBe(null);
            expect(result[0].gameData).toBe(null);
        });
    });
});