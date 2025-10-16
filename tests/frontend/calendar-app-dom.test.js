import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock DOM and browser APIs
const mockElement = {
    addEventListener: vi.fn(),
    classList: {
        add: vi.fn(),
        remove: vi.fn(),
        contains: vi.fn()
    },
    textContent: '',
    innerHTML: '',
    style: {},
    appendChild: vi.fn(),
    querySelector: vi.fn(),
    querySelectorAll: vi.fn(() => []),
    scrollIntoView: vi.fn()
};

global.document = {
    createElement: vi.fn(() => mockElement),
    getElementById: vi.fn(() => mockElement),
    querySelectorAll: vi.fn(() => [mockElement]),
    querySelector: vi.fn(() => mockElement),
    addEventListener: vi.fn(),
    body: {
        appendChild: vi.fn(),
        removeChild: vi.fn()
    },
    execCommand: vi.fn()
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
    addEventListener: vi.fn(),
    CALENDAR_CONFIGS: [
        { id: 'he1', name: 'Herren 1', icsUrl: 'test.ics', webUrl: 'test.html' }
    ],
    SCHEDULE_CONFIGS: [
        { id: 'boys', label: 'Boys Schedule', calId: 'test@calendar.com', icsUrl: 'test.ics', file: 'boys.json' }
    ]
};

// Helper functions to test
function createNavLink(href, className, textContent, clickHandler) {
    const navLink = document.createElement('a');
    navLink.href = href;
    navLink.className = className;
    navLink.textContent = textContent;
    navLink.addEventListener('click', clickHandler);
    return navLink;
}

function createCalendarActionsHTML(icsUrl, additionalUrl, additionalText) {
    const webcalUrl = `webcal://${icsUrl.replace('https://', '')}`;
    return `
        <div class="calendar-actions">
            <button class="copy-button"
                onclick="copyToClipboard('${icsUrl}', event)">iCal-URL
                kopieren</button>
            <span class="calendar-separator">|</span>
            <a href="${webcalUrl}">Abonnieren</a>
            <span class="calendar-separator">|</span>
            <a href="${additionalUrl}" target="_blank" rel="noopener noreferrer">${additionalText}</a>
        </div>
    `;
}

function formatTitleWithResult(title, gameResult) {
    if (gameResult.homeScore !== null && gameResult.guestScore !== null) {
        const scorePattern = new RegExp(`\\s${gameResult.scoreText}(\\s|$)`);
        return title.replace(scorePattern, ' ').trim();
    } else if (gameResult.isFinished) {
        return title.replace(/\s*\(Beendet\)\s*/, ' ').trim();
    }
    return title;
}

function formatResultBadge(gameResult) {
    if (gameResult.homeScore != null && gameResult.guestScore != null) {
        const resultClass = gameResult.isWin ? 'result-win' : 'result-loss';
        let resultText;

        if (gameResult.isWin === null) {
            resultText = gameResult.scoreText;
            return `<span class="result-badge result-finished">${resultText}</span>`;
        } else {
            const winLossText = gameResult.isWin ? 'SIEG' : 'NIEDERLAGE';
            resultText = `${winLossText} ${gameResult.scoreText}`;
        }

        return `<span class="result-badge ${resultClass}">${resultText}</span>`;
    } else if (gameResult.isFinished) {
        return `<span class="result-badge result-finished">Beendet</span>`;
    } else {
        return '';
    }
}

function formatLastModifiedDate(date) {
    const options = {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'Europe/Berlin'
    };
    return date.toLocaleDateString('de-DE', options);
}

// Mock copyToClipboard function
async function copyToClipboard(text, event) {
    try {
        await window.navigator.clipboard.writeText(text);
        return true;
    } catch (error) {
        // Fallback for older browsers
        const textArea = document.createElement('textarea');
        textArea.value = text;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
        return true;
    }
}

describe('Calendar App DOM Functions', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('createNavLink', () => {
        it('should create navigation link with correct properties', () => {
            const mockClickHandler = vi.fn();
            const navLink = createNavLink('#test', 'nav-link', 'Test Link', mockClickHandler);
            
            expect(document.createElement).toHaveBeenCalledWith('a');
            expect(navLink.href).toBe('#test');
            expect(navLink.className).toBe('nav-link');
            expect(navLink.textContent).toBe('Test Link');
            expect(navLink.addEventListener).toHaveBeenCalledWith('click', mockClickHandler);
        });
    });

    describe('createCalendarActionsHTML', () => {
        it('should create calendar actions HTML with correct URLs', () => {
            const icsUrl = 'https://example.com/calendar.ics';
            const additionalUrl = 'https://example.com/web';
            const additionalText = 'Web View';
            
            const result = createCalendarActionsHTML(icsUrl, additionalUrl, additionalText);
            
            expect(result).toContain('webcal://example.com/calendar.ics');
            expect(result).toContain('https://example.com/web');
            expect(result).toContain('Web View');
            expect(result).toContain('iCal-URL\n                kopieren');
            expect(result).toContain('Abonnieren');
        });

        it('should handle HTTPS URLs correctly for webcal', () => {
            const icsUrl = 'https://secure.example.com/calendar.ics';
            const result = createCalendarActionsHTML(icsUrl, 'http://test.com', 'Test');
            
            expect(result).toContain('webcal://secure.example.com/calendar.ics');
        });
    });

    describe('formatTitleWithResult', () => {
        it('should remove score from title when game has result', () => {
            const title = 'BC Lions Moabit vs Team B 85:78';
            const gameResult = {
                homeScore: 85,
                guestScore: 78,
                scoreText: '85:78',
                isFinished: true
            };
            
            const result = formatTitleWithResult(title, gameResult);
            expect(result).toBe('BC Lions Moabit vs Team B');
        });

        it('should remove "Beendet" from title when game is finished without score', () => {
            const title = 'BC Lions Moabit vs Team B (Beendet)';
            const gameResult = {
                homeScore: null,
                guestScore: null,
                isFinished: true
            };
            
            const result = formatTitleWithResult(title, gameResult);
            expect(result).toBe('BC Lions Moabit vs Team B');
        });

        it('should return original title when no result', () => {
            const title = 'BC Lions Moabit vs Team B';
            const gameResult = {
                homeScore: null,
                guestScore: null,
                isFinished: false
            };
            
            const result = formatTitleWithResult(title, gameResult);
            expect(result).toBe('BC Lions Moabit vs Team B');
        });
    });

    describe('formatResultBadge', () => {
        it('should format win badge correctly', () => {
            const gameResult = {
                homeScore: 85,
                guestScore: 78,
                isWin: true,
                scoreText: '85:78'
            };
            
            const result = formatResultBadge(gameResult);
            expect(result).toContain('result-badge result-win');
            expect(result).toContain('SIEG 85:78');
        });

        it('should format loss badge correctly', () => {
            const gameResult = {
                homeScore: 75,
                guestScore: 80,
                isWin: false,
                scoreText: '75:80'
            };
            
            const result = formatResultBadge(gameResult);
            expect(result).toContain('result-badge result-loss');
            expect(result).toContain('NIEDERLAGE 75:80');
        });

        it('should format finished badge for games without BC Lions', () => {
            const gameResult = {
                homeScore: 80,
                guestScore: 75,
                isWin: null,
                scoreText: '80:75'
            };
            
            const result = formatResultBadge(gameResult);
            expect(result).toContain('result-badge result-finished');
            expect(result).toContain('80:75');
        });

        it('should format finished badge for games without score', () => {
            const gameResult = {
                homeScore: null,
                guestScore: null,
                isWin: null,
                isFinished: true
            };
            
            const result = formatResultBadge(gameResult);
            expect(result).toContain('result-badge result-finished');
            expect(result).toContain('Beendet');
        });

        it('should return empty string for games without results', () => {
            const gameResult = {
                hasResult: false,
                isFinished: false
            };
            
            const result = formatResultBadge(gameResult);
            expect(result).toBe('');
        });
    });

    describe('formatLastModifiedDate', () => {
        it('should format date in German locale with full format', () => {
            const date = new Date('2025-10-16T19:30:00Z');
            const result = formatLastModifiedDate(date);
            
            // Should contain German weekday and month names
            expect(result).toMatch(/\w+tag/); // Should contain weekday ending in 'tag'
            expect(result).toContain('2025');
            // Time might be adjusted for timezone, so just check it contains time format
            expect(result).toMatch(/\d{2}:\d{2}/);
        });
    });

    describe('copyToClipboard', () => {
        beforeEach(() => {
            // Reset clipboard mock
            window.navigator.clipboard.writeText = vi.fn().mockResolvedValue(undefined);
        });

        it('should use modern clipboard API when available', async () => {
            const mockEvent = { target: mockElement };
            const text = 'https://example.com/calendar.ics';
            
            const result = await copyToClipboard(text, mockEvent);
            
            expect(window.navigator.clipboard.writeText).toHaveBeenCalledWith(text);
            expect(result).toBe(true);
        });

        it('should fallback to execCommand when clipboard API fails', async () => {
            window.navigator.clipboard.writeText = vi.fn().mockRejectedValue(new Error('Not supported'));
            const mockEvent = { target: mockElement };
            const text = 'https://example.com/calendar.ics';
            
            // Mock textarea element with select method
            const mockTextArea = {
                value: '',
                select: vi.fn()
            };
            document.createElement = vi.fn(() => mockTextArea);
            
            const result = await copyToClipboard(text, mockEvent);
            
            expect(document.createElement).toHaveBeenCalledWith('textarea');
            expect(mockTextArea.select).toHaveBeenCalled();
            expect(document.body.appendChild).toHaveBeenCalled();
            expect(document.execCommand).toHaveBeenCalledWith('copy');
            expect(document.body.removeChild).toHaveBeenCalled();
            expect(result).toBe(true);
        });
    });
});