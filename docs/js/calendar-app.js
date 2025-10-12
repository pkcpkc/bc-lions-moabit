// Team configuration data - will be dynamically populated
const CALENDAR_CONFIGS = window.CALENDAR_CONFIGS || [];
const SCHEDULE_CONFIGS = window.SCHEDULE_CONFIGS || [];

// Constants
const DATE_RANGES = {
    NEXT_MONTH: 1,
    NEXT_WEEK: 7
};

const ERROR_MESSAGES = {
    PARSE_ERROR: 'Fehler beim Laden der Termine',
    FETCH_ERROR: 'Fehler beim Laden der Termine',
    GAMES_ERROR: 'Fehler beim Laden der Spiele',
    HOME_GAMES_ERROR: 'Fehler beim Laden der Heimspiele',
    UPCOMING_ERROR: 'Fehler beim Laden der kommenden Termine'
};

const UI_FEEDBACK = {
    COPY_SUCCESS: 'Kopiert!',
    COPY_SUCCESS_COLOR: '#28a745',
    COPY_DEFAULT_COLOR: '#007bff',
    COPY_TIMEOUT: 2000
};

// Helper function to create navigation links
function createNavLink(href, className, textContent, clickHandler) {
    const navLink = document.createElement('a');
    navLink.href = href;
    navLink.className = className;
    navLink.textContent = textContent;
    navLink.addEventListener('click', clickHandler);
    return navLink;
}

// Helper function to create calendar actions HTML
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

function generateTeamSections() {
    const navContainer = document.getElementById('team-nav-row');
    const calendarContainer = document.getElementById('team-calendars-container');

    // Clear existing dynamic content
    navContainer.innerHTML = '';
    calendarContainer.innerHTML = '';

    // Generate navigation links and calendar sections for each team
    CALENDAR_CONFIGS.forEach(config => {
        // Create navigation link
        const navLink = createNavLink(
            `#${config.id}`,
            'nav-link team-nav-link',
            config.name,
            (e) => {
                e.preventDefault();
                showCalendarSection(`${config.id}-section`);
            }
        );
        navContainer.appendChild(navLink);

        // Create calendar section
        const calendarSection = document.createElement('div');
        calendarSection.className = 'calendar-section';
        calendarSection.id = `${config.id}-section`;
        calendarSection.innerHTML = `
            <div class="calendar-link" id="spielplan_${config.id}">
                <h3>Spielplan: ${config.name}</h3>
                ${createCalendarActionsHTML(config.icsUrl, config.webUrl, 'DBB Webseite')}
            </div>

            <div class="events-container">
                <h4>Alle Spieltermine</h4>
                <div id="${config.id}-events" class="loading">Lade Termine...</div>
            </div>
        `;

        calendarContainer.appendChild(calendarSection);
    });
}

function generateScheduleSections() {
    const navContainer = document.getElementById('schedule-nav-row');
    const calendarContainer = document.getElementById('team-calendars-container');

    // Clear existing schedule nav content
    navContainer.innerHTML = '';

    // Generate navigation links and calendar sections for each schedule
    SCHEDULE_CONFIGS.forEach(config => {
        // Create navigation link
        const navLink = createNavLink(
            `#schedule-${config.id}`,
            'nav-link schedule-nav-link',
            config.label,
            (e) => {
                e.preventDefault();
                showCalendarSection(`schedule-${config.id}-section`);
            }
        );
        navContainer.appendChild(navLink);

        // Create calendar section
        const calendarSection = document.createElement('div');
        calendarSection.className = 'calendar-section';
        calendarSection.id = `schedule-${config.id}-section`;
        
        const encodedCalId = encodeURIComponent(config.calId);
        const calendarUrl = `https://calendar.google.com/calendar/embed?src=${encodedCalId}&ctz=Europe%2FBerlin`;
        
        calendarSection.innerHTML = `
            <div class="calendar-link" id="schedule_${config.id}">
                <h3>Termine: ${config.label}</h3>
                ${createCalendarActionsHTML(config.icsUrl, calendarUrl, 'Kalender')}
            </div>

            <div class="events-container">
                <h4>Termine des nächsten Monats</h4>
                <div id="schedule-${config.id}-events" class="loading">Lade Termine...</div>
            </div>
        `;

        calendarContainer.appendChild(calendarSection);
    });
}



function showCalendarSection(sectionId, updateUrl = true) {
    // Hide all calendar sections
    const sections = document.querySelectorAll('.calendar-section');
    sections.forEach(section => section.classList.remove('active'));

    // Show the selected section
    const targetSection = document.getElementById(sectionId);
    if (targetSection) {
        targetSection.classList.add('active');
        
        // Smooth scroll to the headline of the section
        const headline = targetSection.querySelector('h3');
        if (headline) {
            headline.scrollIntoView({
                behavior: 'smooth',
                block: 'start',
                inline: 'nearest'
            });
        }
    }

    // Update navigation links
    const navLinks = document.querySelectorAll('.nav-link');
    navLinks.forEach(link => link.classList.remove('active'));

    // Add active class to the clicked nav link
    const activeLink = document.querySelector(`a[href="#${sectionId.replace('-section', '')}"]`);
    if (activeLink) {
        activeLink.classList.add('active');
    }

    // Update URL and browser history
    if (updateUrl) {
        const route = sectionId.replace('-section', '');
        const newUrl = window.location.pathname + '#' + route;
        window.history.pushState({ section: sectionId }, '', newUrl);
    }
}

function handleRouting() {
    // Get current hash from URL
    const hash = window.location.hash.substring(1); // Remove the '#' character
    
    if (hash) {
        // Check for direct section matches first (spiele, heimspiele, anleitung)
        let sectionId = hash + '-section';
        let targetSection = document.getElementById(sectionId);
        
        if (targetSection) {
            showCalendarSection(sectionId, false);
            return;
        }
        
        // Check for team sections (he1, he4, etc.)
        sectionId = hash + '-section';
        targetSection = document.getElementById(sectionId);
        if (targetSection) {
            showCalendarSection(sectionId, false);
            return;
        }
        
        // Check for schedule sections (schedule-boys, etc.)
        if (hash.startsWith('schedule-')) {
            sectionId = hash + '-section';
            targetSection = document.getElementById(sectionId);
            if (targetSection) {
                showCalendarSection(sectionId, false);
                return;
            }
        }
        
        // Handle legacy format (spielplan_teamid)
        if (hash.startsWith('spielplan_')) {
            const teamId = hash.replace('spielplan_', '');
            sectionId = teamId + '-section';
            targetSection = document.getElementById(sectionId);
            if (targetSection) {
                showCalendarSection(sectionId, false);
                // Update URL to new format
                window.history.replaceState({ section: sectionId }, '', window.location.pathname + '#' + teamId);
                return;
            }
        }
    }
    
    // Default to "spiele" if no valid hash
    showCalendarSection('spiele-section', false);
}

// Handle browser back/forward buttons
window.addEventListener('popstate', function(event) {
    if (event.state && event.state.section) {
        showCalendarSection(event.state.section, false);
    } else {
        handleRouting();
    }
});

// Helper function to show copy feedback
function showCopyFeedback(button) {
    const originalText = button.textContent;
    button.textContent = UI_FEEDBACK.COPY_SUCCESS;
    button.style.backgroundColor = UI_FEEDBACK.COPY_SUCCESS_COLOR;

    setTimeout(() => {
        button.textContent = originalText;
        button.style.backgroundColor = UI_FEEDBACK.COPY_DEFAULT_COLOR;
    }, UI_FEEDBACK.COPY_TIMEOUT);
}

function copyToClipboard(text, event) {
    navigator.clipboard.writeText(text).then(() => {
        showCopyFeedback(event.target);
    }).catch(() => {
        // Fallback for older browsers
        const textArea = document.createElement('textarea');
        textArea.value = text;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
        
        showCopyFeedback(event.target);
    });
}

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

function formatDateRange(startDate, endDate) {
    // Check if it's a multi-day event (different dates, not just different times)
    const startDateOnly = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate());
    const endDateOnly = new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate());
    
    if (startDateOnly.getTime() !== endDateOnly.getTime()) {
        // Multi-day event: format as "Mo., 20.10.2025 bis Do., 24.10.2025"
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
        // Single day event: use original formatting
        return formatDate(startDate);
    }
}

// Common function to get date ranges
function getDateRange(rangeType) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const endDate = new Date(today);
    
    switch (rangeType) {
        case 'week':
            endDate.setDate(today.getDate() + DATE_RANGES.NEXT_WEEK);
            break;
        case 'month':
            endDate.setMonth(today.getMonth() + DATE_RANGES.NEXT_MONTH);
            break;
        default:
            // No end date for 'all' events
            return { start: today, end: null };
    }
    
    endDate.setHours(23, 59, 59, 999);
    return { start: today, end: endDate };
}

// Common function to parse ICS data
function parseIcsData(data, teamId = null) {
    try {
        const jcalData = ICAL.parse(data);
        const comp = new ICAL.Component(jcalData);
        const vevents = comp.getAllSubcomponents('vevent');

        return vevents.map(vevent => {
            const event = new ICAL.Event(vevent);
            return {
                summary: event.summary,
                startDate: event.startDate.toJSDate(),
                endDate: event.endDate.toJSDate(),
                location: event.location,
                description: event.description,
                teamId: teamId ? teamId.toUpperCase() : null
            };
        });
    } catch (error) {
        console.error('Error parsing calendar:', error);
        return [];
    }
}

// Common function to parse ICS data with recurring events
function parseIcsDataWithRecurring(data, dateRange, teamId = null) {
    try {
        const jcalData = ICAL.parse(data);
        const comp = new ICAL.Component(jcalData);
        const vevents = comp.getAllSubcomponents('vevent');

        const allEvents = [];

        vevents.forEach(vevent => {
            const event = new ICAL.Event(vevent);
            
            // Handle recurring events properly
            if (event.isRecurring() && dateRange.end) {
                const iterator = event.iterator();
                let next;
                
                // Expand recurring events within our date range
                while ((next = iterator.next()) && next.toJSDate() <= dateRange.end) {
                    const eventDate = next.toJSDate();
                    if (eventDate >= dateRange.start) {
                        const endTime = new Date(eventDate);
                        endTime.setTime(eventDate.getTime() + (event.endDate.toJSDate() - event.startDate.toJSDate()));
                        
                        allEvents.push({
                            summary: event.summary,
                            startDate: eventDate,
                            endDate: endTime,
                            location: event.location,
                            description: event.description,
                            teamId: teamId ? teamId.toUpperCase() : null
                        });
                    }
                }
            } else {
                // Non-recurring event
                const eventDate = event.startDate.toJSDate();
                allEvents.push({
                    summary: event.summary,
                    startDate: eventDate,
                    endDate: event.endDate.toJSDate(),
                    location: event.location,
                    description: event.description,
                    teamId: teamId ? teamId.toUpperCase() : null
                });
            }
        });

        return allEvents;
    } catch (error) {
        console.error('Error parsing calendar:', error);
        return [];
    }
}

// Common function to filter events by date range
function filterEventsByDateRange(events, rangeType) {
    const dateRange = getDateRange(rangeType);
    
    return events.filter(event => {
        if (rangeType === 'all') {
            return event.startDate >= dateRange.start;
        }
        return event.startDate >= dateRange.start && event.startDate <= dateRange.end;
    });
}

// Common function to fetch and parse calendar data
function fetchAndParseCalendar(url, rangeType = 'all', teamId = null, useRecurring = false) {
    return fetch(url)
        .then(response => response.text())
        .then(data => {
            if (useRecurring && rangeType !== 'all') {
                const dateRange = getDateRange(rangeType);
                return parseIcsDataWithRecurring(data, dateRange, teamId);
            } else {
                const events = parseIcsData(data, teamId);
                return filterEventsByDateRange(events, rangeType);
            }
        });
}

// Load team events (Spielplan) - shows all upcoming events
function loadTeamCalendarEvents(url, containerId, maxEvents = -1, teamId = null) {
    fetchAndParseCalendar(url, 'all', teamId)
        .then(events => {
            events.sort((a, b) => a.startDate - b.startDate);
            displayEvents(events, containerId);
        })
        .catch(error => {
            console.error('Error loading team calendar:', error);
            document.getElementById(containerId).innerHTML = `<div class="error">${ERROR_MESSAGES.GAMES_ERROR}</div>`;
        });
}

// Load termine events - shows events for next month only
function loadCalendarEvents(url, containerId, maxEvents = -1, teamId = null) {
    fetchAndParseCalendar(url, 'month', teamId, true)
        .then(events => {
            events.sort((a, b) => a.startDate - b.startDate);
            displayEvents(events, containerId);
        })
        .catch(error => {
            console.error('Error loading calendar events:', error);
            document.getElementById(containerId).innerHTML = `<div class="error">${ERROR_MESSAGES.PARSE_ERROR}</div>`;
        });
}

function displayEvents(events, containerId) {
    const container = document.getElementById(containerId);

    if (events.length === 0) {
        container.innerHTML = '<div>Keine Termine im nächsten Monat</div>';
        return;
    }

    const eventsHTML = events.map(event => {
        const title = event.summary || 'Kein Titel';
        const displayTitle = event.teamId ? `${event.teamId}: ${title}` : title;
        
        // Make BC Lions team names bold
        const formattedTitle = displayTitle.replace(/(BC Lions\s+\w+(?:\s+\d+)?(?:\s+mix)?)/g, '<strong>$1</strong>');
        
        return `
        <div class="event-item">
            <div class="event-main">
                <div class="event-date">${formatDateRange(event.startDate, event.endDate)}</div>
                <div class="event-title">${formattedTitle}</div>
                ${event.location ? `<div class="event-location">📍 <a href="https://maps.google.com/maps?q=${encodeURIComponent(event.location)}" target="_blank" rel="noopener noreferrer" title="In Google Maps öffnen">${event.location}</a></div>` : ''}
            </div>
        </div>
    `;
    }).join('');

    container.innerHTML = eventsHTML;
}

// Common function to load multiple team events with filtering
function loadMultipleTeamEvents(containerId, rangeType = 'all', filterFunction = null) {
    const allEventsPromises = CALENDAR_CONFIGS.map(config => {
        const icsFile = config.icsFilename.replace('docs/', './');
        return fetchAndParseCalendar(icsFile, rangeType, config.id);
    });

    Promise.all(allEventsPromises)
        .then(eventArrays => {
            // Flatten all events into a single array
            let allEvents = eventArrays.flat();
            
            // Apply additional filtering if provided
            if (filterFunction) {
                allEvents = allEvents.filter(filterFunction);
            }

            // Sort events by date
            allEvents.sort((a, b) => a.startDate - b.startDate);

            displayEvents(allEvents, containerId);
        })
        .catch(error => {
            console.error('Error loading team events:', error);
            document.getElementById(containerId).innerHTML = `<div class="error">${ERROR_MESSAGES.PARSE_ERROR}</div>`;
        });
}

function loadAllTeamEvents(containerId) {
    loadMultipleTeamEvents(containerId, 'all');
}

function loadUpcomingTeamEvents(containerId) {
    loadMultipleTeamEvents(containerId, 'week');
}

function loadUpcomingHomeGames(containerId) {
    // Filter function to check for home games
    const homeGameFilter = (event) => {
        return event.summary && event.summary.startsWith('BC Lions Moabit');
    };
    
    loadMultipleTeamEvents(containerId, 'week', homeGameFilter);
}

// Helper function to format date for last modified display
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

// Function to get and display last modified date
function updateLastModifiedDate() {
    const setLastModifiedDate = (date) => {
        const formattedDate = formatLastModifiedDate(date);
        document.getElementById('last-updated-date').textContent = formattedDate;
    };

    // Make a HEAD request to get the Last-Modified header
    fetch(window.location.href, { method: 'HEAD' })
        .then(response => {
            const lastModified = response.headers.get('Last-Modified');
            const date = lastModified ? new Date(lastModified) : new Date();
            setLastModifiedDate(date);
        })
        .catch(error => {
            console.error('Error fetching last modified date:', error);
            setLastModifiedDate(new Date());
        });
}

// Helper function to add click handler for navigation links
function addNavClickHandler(selector, sectionId) {
    const element = document.querySelector(selector);
    if (element) {
        element.addEventListener('click', (e) => {
            e.preventDefault();
            showCalendarSection(sectionId);
        });
    }
}

// Initialize app when page loads
function initializeCalendarApp() {
    // Update last modified date
    updateLastModifiedDate();
    
    // Generate team sections dynamically
    generateTeamSections();
    
    // Generate schedule sections dynamically
    generateScheduleSections();

    // Add click handlers to existing navigation links
    addNavClickHandler('a[href="#spiele"]', 'spiele-section');
    addNavClickHandler('a[href="#heimspiele"]', 'heimspiele-section');
    addNavClickHandler('a[href="#anleitung"]', 'anleitung-section');

    // Handle initial routing based on URL
    handleRouting();

    // Load upcoming team events for the next 7 days
    loadUpcomingTeamEvents('spiele-events');
    
    // Load home games for the "Heimspiele" section
    loadUpcomingHomeGames('heimspiele-events');

    // Load events for dynamically configured team calendars
    CALENDAR_CONFIGS.forEach(config => {
        const icsFile = config.icsFilename.replace('docs/', './');
        loadTeamCalendarEvents(icsFile, `${config.id}-events`, -1, config.id);
    });

    // Load events for dynamically configured schedule calendars
    SCHEDULE_CONFIGS.forEach(config => {
        const icsFile = config.icsFilename.replace('docs/', './');
        loadCalendarEvents(icsFile, `schedule-${config.id}-events`, -1, config.label);
    });
}

// Load events when page loads
document.addEventListener('DOMContentLoaded', initializeCalendarApp);