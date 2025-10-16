import { writeFile } from 'fs/promises';

export class ICSService {
    constructor(logger = console) {
        this.logger = logger;
    }

    generateICS(games, calendarName = 'Basketball Games') {
        if (!Array.isArray(games) || games.length === 0) {
            this.logger.warn('No games provided for ICS generation');
            return this.createEmptyCalendar(calendarName);
        }

        const events = games.map(game => this.createICSEvent(game)).join('');
        
        return [
            'BEGIN:VCALENDAR',
            'VERSION:2.0',
            'PRODID:-//BC Lions Moabit//Basketball Calendar//DE',
            `X-WR-CALNAME:${calendarName}`,
            'CALSCALE:GREGORIAN',
            events,
            'END:VCALENDAR'
        ].join('\r\n');
    }

    createICSEvent(game) {
        const dtStart = this.formatDateForICS(game.date, game.time);
        const endTime = this.addHoursToTime(game.time, 2);
        const dtEnd = this.formatDateForICS(game.date, endTime);
        
        const uid = this.generateUID(game);
        const summary = this.createSummary(game);
        const location = this.createLocation(game);
        const description = this.createDescription(game);

        return [
            'BEGIN:VEVENT',
            `UID:${uid}`,
            `DTSTART:${dtStart}`,
            `DTEND:${dtEnd}`,
            `SUMMARY:${summary}`,
            `LOCATION:${location}`,
            `DESCRIPTION:${description}`,
            `DTSTAMP:${this.getCurrentTimestamp()}`,
            'STATUS:CONFIRMED',
            'END:VEVENT'
        ].join('\r\n') + '\r\n';
    }

    createEmptyCalendar(calendarName) {
        return [
            'BEGIN:VCALENDAR',
            'VERSION:2.0',
            'PRODID:-//BC Lions Moabit//Basketball Calendar//DE',
            `X-WR-CALNAME:${calendarName}`,
            'CALSCALE:GREGORIAN',
            'METHOD:PUBLISH',
            'END:VCALENDAR'
        ].join('\r\n');
    }

    formatDateForICS(dateStr, timeStr) {
        let day, month, year;

        // Check if dateStr is null or undefined
        if (!dateStr) {
            throw new Error('Date string is null or undefined');
        }

        // Check if date is in YYYY-MM-DD format or DD.MM.YYYY format
        if (dateStr.includes('-')) {
            // YYYY-MM-DD format
            [year, month, day] = dateStr.split('-');
        } else if (dateStr.includes('.')) {
            // DD.MM.YYYY format
            [day, month, year] = dateStr.split('.');
        } else {
            throw new Error(`Unsupported date format: ${dateStr}`);
        }

        // Handle placeholder times like 23:59 (TBD)
        if (timeStr === '23:59') {
            // Set to 00:00 for TBD games - return local time format
            return `${year}${month.padStart(2, '0')}${day.padStart(2, '0')}T000000`;
        }

        const [hours, minutes] = timeStr.split(':');
        
        // Format as YYYYMMDDTHHMMSS for ICS (local time, no timezone conversion)
        const formattedDate = `${year}${month.padStart(2, '0')}${day.padStart(2, '0')}`;
        const formattedTime = `${hours.padStart(2, '0')}${minutes.padStart(2, '0')}00`;

        return `${formattedDate}T${formattedTime}`;
    }

    addHoursToTime(timeStr, hoursToAdd) {
        // Handle placeholder times
        if (timeStr === '23:59') {
            return '23:59'; // Keep as is for TBD games
        }

        const [hours, minutes] = timeStr.split(':').map(Number);
        const newHours = hours + hoursToAdd;

        // Handle overflow past 24 hours
        if (newHours >= 24) {
            return '23:59'; // Cap at 23:59 for same day
        }

        return `${String(newHours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
    }

    generateUID(game) {
        return `${game.matchId}@bc-lions-moabit`;
    }

    createSummary(game) {
        // Add TBD indicator for games with placeholder times
        const timeIndicator = game.time === '23:59' ? ' (Zeit TBD)' : '';
        
        // Add venue name in brackets to the title
        const venueInTitle = game.venue?.name ? ` (${game.venue.name})` : '';
        
        // Add result if available
        const resultText = this.formatResult(game.result);
        
        return `${game.home} vs ${game.guest}${resultText}${timeIndicator}${venueInTitle}`;
    }

    createLocation(game) {
        if (!game.venue || !game.venue.street) {
            return '';
        }
        
        // Location: format as "Street\, ZIP City" following Apple/iCalendar standards (RFC 5545)
        return `${game.venue.street}\\, ${game.venue.zip} ${game.venue.city}`;
    }

    createDescription(game) {
        if (!game.venue) {
            return '';
        }

        // Create a description with venue name and full address (keep semicolon format for description)
        const descriptionAddress = `${game.venue.street || 'TBD'}; ${game.venue.zip || ''} ${game.venue.city || ''}`.trim();
        return `Venue: ${game.venue.name || 'TBD'}\\nAddress: ${descriptionAddress}`;
    }

    getCurrentTimestamp() {
        return new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
    }

    formatResult(result) {
        if (!result) {
            return '';
        }

        if (result.homeScore !== null && result.guestScore !== null) {
            return ` ${result.homeScore}:${result.guestScore}`;
        }

        if (result.isFinished) {
            return ' (Beendet)';
        }

        return '';
    }

    async saveICS(content, filename) {
        try {
            await writeFile(filename, content, 'utf8');
            this.logger.info(`Successfully saved ICS file: ${filename}`);
        } catch (error) {
            this.logger.error(`Failed to save ICS file ${filename}:`, error.message);
            throw error;
        }
    }
}