import { describe, it, expect } from 'vitest';
import { DownloadTermineCommand } from '../../src/commands/downloadTermine.js';
import { HttpClient } from '../../src/services/httpClient.js';

describe('DownloadTermineCommand - All-day Event Fix', () => {
    it('should correctly handle single-day all-day events with exclusive DTEND', async () => {
        // Mock ICS content for a single-day all-day event
        const mockIcsContent = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Test//Test//EN
BEGIN:VEVENT
UID:test-event@example.com
DTSTART;VALUE=DATE:20251208
DTEND;VALUE=DATE:20251209
SUMMARY:Elternabend: Turnierreise Pilsen Tschechien
CREATED:20251109T100000Z
LAST-MODIFIED:20251109T100000Z
STATUS:CONFIRMED
END:VEVENT
END:VCALENDAR`;

        const httpClient = new HttpClient();
        const command = new DownloadTermineCommand(httpClient);
        
        const termineConfig = {
            label: 'Test Calendar',
            id: 'test-cal',
            calId: 'test@example.com'
        };

        const result = await command.parseIcsToJson(mockIcsContent, termineConfig);
        
        expect(result.events).toHaveLength(1);
        
        const event = result.events[0];
        expect(event.summary).toBe('Elternabend: Turnierreise Pilsen Tschechien');
        
        // The start and end dates should be the same for a single-day all-day event
        const startDate = new Date(event.startDate);
        const endDate = new Date(event.endDate);
        
        expect(startDate.toISOString()).toBe(endDate.toISOString());
        // Due to timezone conversion, December 8th local becomes December 7th UTC
        expect(startDate.getUTCDate()).toBe(7); // December 7th UTC (8th local)
        expect(endDate.getUTCDate()).toBe(7); // Should be the same date
    });

    it('should correctly handle multi-day all-day events with exclusive DTEND', async () => {
        // Mock ICS content for a multi-day all-day event (Oct 20-23, 2025)
        const mockIcsContent = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Test//Test//EN
BEGIN:VEVENT
UID:test-multiday@example.com
DTSTART;VALUE=DATE:20251020
DTEND;VALUE=DATE:20251024
SUMMARY:Herbstcamp I
CREATED:20251109T100000Z
LAST-MODIFIED:20251109T100000Z
STATUS:CONFIRMED
END:VEVENT
END:VCALENDAR`;

        const httpClient = new HttpClient();
        const command = new DownloadTermineCommand(httpClient);
        
        const termineConfig = {
            label: 'Test Calendar',
            id: 'test-cal',
            calId: 'test@example.com'
        };

        const result = await command.parseIcsToJson(mockIcsContent, termineConfig);
        
        expect(result.events).toHaveLength(1);
        
        const event = result.events[0];
        expect(event.summary).toBe('Herbstcamp I');
        
        const startDate = new Date(event.startDate);
        const endDate = new Date(event.endDate);
        
        // Should span from Oct 20th to Oct 23rd (4 days), not Oct 24th
        // Due to timezone conversion, dates shift by one day
        expect(startDate.getUTCDate()).toBe(19); // Oct 19th UTC (20th local)
        expect(endDate.getUTCDate()).toBe(22); // Oct 22nd UTC (23rd local)
        
        // Calculate the difference in days
        const daysDiff = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24));
        expect(daysDiff).toBe(3); // 4-day event shows as 3 days difference
    });

    it('should not affect timed events', async () => {
        // Mock ICS content for a timed event (not all-day)
        const mockIcsContent = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Test//Test//EN
BEGIN:VEVENT
UID:test-timed@example.com
DTSTART:20251113T160000Z
DTEND:20251113T173000Z
SUMMARY:Juniors vs. Seniors U5 Mix
CREATED:20251109T100000Z
LAST-MODIFIED:20251109T100000Z
STATUS:CONFIRMED
END:VEVENT
END:VCALENDAR`;

        const httpClient = new HttpClient();
        const command = new DownloadTermineCommand(httpClient);
        
        const termineConfig = {
            label: 'Test Calendar',
            id: 'test-cal',
            calId: 'test@example.com'
        };

        const result = await command.parseIcsToJson(mockIcsContent, termineConfig);
        
        expect(result.events).toHaveLength(1);
        
        const event = result.events[0];
        expect(event.summary).toBe('Juniors vs. Seniors U5 Mix');
        
        // Timed events should preserve their original end times
        expect(event.startDate).toBe('2025-11-13T16:00:00.000Z');
        expect(event.endDate).toBe('2025-11-13T17:30:00.000Z');
    });
});