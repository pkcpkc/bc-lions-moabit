// Team configuration data - will be dynamically populated
const CALENDAR_CONFIGS = window.CALENDAR_CONFIGS || [];
const SCHEDULE_CONFIGS = window.SCHEDULE_CONFIGS || [];

// Range Type Enum with built-in filtering logic
const RANGE_TYPES = {
    ALL: (events) => events, // No filtering
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
    // Legacy support for existing code
    WEEK: (events) => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const endDate = new Date(today);
        endDate.setDate(today.getDate() + 7);
        endDate.setHours(23, 59, 59, 999);
        return events.filter(event =>
            event.startDate >= today && event.startDate <= endDate
        );
    },
    MONTH: (events) => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const endDate = new Date(today);
        endDate.setMonth(today.getMonth() + 30);
        endDate.setHours(23, 59, 59, 999);
        return events.filter(event =>
            event.startDate >= today && event.startDate <= endDate
        );
    }
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

// Enhanced function to extract game results from structured JSON data
function extractGameResultFromData(gameData, title) {
    if (gameData.result && gameData.result.isFinished) {
        const result = gameData.result;

        if (result.homeScore !== null && result.guestScore !== null) {
            // Determine if BC Lions won based on team position
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

// Legacy: Helper function to extract game results from event title
function extractGameResult(title) {
    // Match score pattern like "85:78" or "(Beendet)" - flexible with whitespace
    const scoreMatch = title.match(/(\d+):(\d+)/);
    const finishedMatch = title.match(/\(Beendet\)/);

    if (scoreMatch) {
        const homeScore = parseInt(scoreMatch[1]);
        const guestScore = parseInt(scoreMatch[2]);

        // Determine if BC Lions Moabit won based on their position in the title
        let isWin = null;
        if (title.includes('BC Lions Moabit')) {
            const vsIndex = title.indexOf(' vs ');
            const lionIndex = title.indexOf('BC Lions Moabit');

            if (vsIndex !== -1 && lionIndex !== -1) {
                // BC Lions is home team (before "vs")
                if (lionIndex < vsIndex) {
                    isWin = homeScore > guestScore;
                }
                // BC Lions is guest team (after "vs") 
                else {
                    isWin = guestScore > homeScore;
                }
            }
        }

        return {
            hasResult: true,
            homeScore,
            guestScore,
            isWin,
            isFinished: true,
            scoreText: `${homeScore}:${guestScore}`,
            scoreDiff: Math.abs(homeScore - guestScore)
        };
    }

    if (finishedMatch) {
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

    return { hasResult: false };
}

// Helper function to format title without result (since we have badges)
function formatTitleWithResult(title, gameResult) {
    if (gameResult.homeScore !== null && gameResult.guestScore !== null) {
        // Remove the score from the title since we now show it in the badge
        const scorePattern = new RegExp(`\\s${gameResult.scoreText}(\\s|$)`);
        return title.replace(scorePattern, ' ').trim();
    } else if (gameResult.isFinished) {
        // Remove "Beendet" text since we show it in the badge
        return title.replace(/\s*\(Beendet\)\s*/, ' ').trim();
    }
    return title;
}

// Helper function to format result badge (always returns a badge)
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
        // No result available - show "Ausstehend" in grey
        return `<span class="result-badge result-pending">Ausstehend</span>`;
    }
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
                ${createCalendarActionsHTML(config.icsUrl, config.webUrl, 'DBB Seite')}
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
        // Check for direct section matches first (spiele, heimspiele, ergebnisse, anleitung)
        let sectionId = hash + '-section';
        let targetSection = document.getElementById(sectionId);

        if (targetSection) {
            showCalendarSection(sectionId, false);

            // Load recent results when routing to results section
            if (sectionId === 'ergebnisse-section') {
                loadRecentResults('ergebnisse-events');
            }
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
window.addEventListener('popstate', function (event) {
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



// Common function to parse ICS data
// Parse JSON data from docs/data files
function parseJsonData(data, teamId = null) {
    try {
        // Handle both team game data and termine data formats
        let events = [];

        if (data.games) {
            // Team games format
            events = data.games.map(game => {
                const gameDate = new Date(`${game.date}T${game.time}:00`);
                const endDate = new Date(gameDate);
                endDate.setHours(gameDate.getHours() + 2); // Assume 2-hour duration

                // Create game title with result if available
                let summary = `${game.home} vs ${game.guest}`;
                if (game.result && game.result.isFinished) {
                    if (game.result.homeScore !== null && game.result.guestScore !== null) {
                        summary += ` ${game.result.homeScore}:${game.result.guestScore}`;
                    } else {
                        summary += ' (Beendet)';
                    }
                }

                // Add venue info if available
                const location = game.venue ? `${game.venue.name} (${game.venue.street}, ${game.venue.zip} ${game.venue.city})` : '';

                return {
                    summary,
                    startDate: gameDate,
                    endDate: endDate,
                    location,
                    description: `Match ID: ${game.matchId}`,
                    teamId: teamId ? teamId.toUpperCase() : null,
                    gameData: game // Include original game data for enhanced processing
                };
            });
        } else if (data.events) {
            // Termine format
            events = data.events.map(event => {
                const startDate = new Date(event.startDate);
                const endDate = new Date(event.endDate);

                return {
                    summary: event.summary,
                    startDate: startDate,
                    endDate: endDate,
                    location: event.location || '',
                    description: event.description || '',
                    teamId: teamId ? teamId.toUpperCase() : null
                };
            });
        }

        return events;
    } catch (error) {
        console.error('Error parsing JSON data:', error);
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



// Common function to fetch and parse JSON data
function fetchAndParseJSON(url, rangeTypeFilter = RANGE_TYPES.ALL, teamId = null) {
    return fetch(url)
        .then(response => response.json())
        .then(data => {
            const events = parseJsonData(data, teamId);
            return rangeTypeFilter(events);
        });
}

// Load team events (Spielplan) - shows all upcoming events from ICS files
function loadTeamCalendarEvents(url, containerId, maxEvents = -1, teamId = null) {
    fetchAndParseCalendar(url, RANGE_TYPES.FUTURE, teamId)
        .then(events => {
            events.sort((a, b) => a.startDate - b.startDate);
            displayEvents(events, containerId);
        })
        .catch(error => {
            console.error('Error loading team calendar:', error);
            document.getElementById(containerId).innerHTML = `<div class="error">${ERROR_MESSAGES.GAMES_ERROR}</div>`;
        });
}

// Load team events from JSON (Spielplan) - shows all upcoming events
function loadTeamCalendarEventsFromJSON(url, containerId, maxEvents = -1, teamId = null) {
    fetchAndParseJSON(url, RANGE_TYPES.FUTURE, teamId)
        .then(events => {
            events.sort((a, b) => a.startDate - b.startDate);
            displayEvents(events, containerId);
        })
        .catch(error => {
            console.error('Error loading team calendar:', error);
            document.getElementById(containerId).innerHTML = `<div class="error">${ERROR_MESSAGES.GAMES_ERROR}</div>`;
        });
}

// Load termine events from JSON - shows events for next month only
function loadCalendarEventsFromJSON(url, containerId, maxEvents = -1, teamId = null) {
    fetchAndParseJSON(url, RANGE_TYPES.MONTH, teamId)
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
        container.innerHTML = '<div>Keine Termine</div>';
        return;
    }

    const eventsHTML = events.map(event => {
        const title = event.summary || 'Kein Titel';
        const displayTitle = event.teamId ? `${event.teamId}: ${title}` : title;

        // Extract game result from title if present, or use structured data from JSON
        const gameResult = event.gameData
            ? extractGameResultFromData(event.gameData, displayTitle)
            : extractGameResult(displayTitle);

        // Make BC Lions team names bold
        let formattedTitle = displayTitle.replace(/(BC Lions\s+\w+(?:\s+\d+)?(?:\s+mix)?)/g, '<strong>$1</strong>');

        // Highlight game results
        if (gameResult.hasResult) {
            formattedTitle = formatTitleWithResult(formattedTitle, gameResult);
        }

        return `
        <div class="event-item ${gameResult.hasResult ? 'has-result' : 'has-pending'}">
            <div class="event-main">
                <div class="event-date-line">
                    <span class="event-date">${formatDateRange(event.startDate, event.endDate)}</span>
                    <span class="game-result">${formatResultBadge(gameResult)}</span>
                </div>
                <div class="event-title">${formattedTitle}</div>
                ${event.location ? `<div class="event-location">📍 <a href="https://maps.google.com/maps?q=${encodeURIComponent(event.location)}" target="_blank" rel="noopener noreferrer" title="In Google Maps öffnen">${event.location}</a></div>` : ''}
            </div>
        </div>
    `;
    }).join('');

    container.innerHTML = eventsHTML;
}

// Common function to load multiple team events with filtering
function loadMultipleTeamEvents(containerId, rangeTypeFilter = RANGE_TYPES.ALL, filterFunction = null) {
    const allEventsPromises = CALENDAR_CONFIGS.map(config => {
        const icsFile = config.icsFilename.replace('docs/', './');
        return fetchAndParseCalendar(icsFile, rangeTypeFilter, config.id);
    });

    Promise.all(allEventsPromises)
        .then(eventArrays => {
            // Flatten all events into a single array
            let allEvents = eventArrays.flat();

            // Apply additional filtering if provided
            if (filterFunction) {
                allEvents = filterFunction(allEvents);
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
    loadMultipleTeamEvents(containerId, RANGE_TYPES.FUTURE);
}

function loadUpcomingTeamEvents(containerId) {
    loadMultipleTeamEvents(containerId, RANGE_TYPES.WEEK);
}

function loadUpcomingHomeGames(containerId) {
    // Filter function to check for home games
    const homeGameFilter = (events) => {
        return events.filter(event =>
            event.summary && event.summary.startsWith('BC Lions Moabit')
        );
    };

    loadMultipleTeamEvents(containerId, RANGE_TYPES.WEEK, homeGameFilter);
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

            // Load recent results when the results section is shown
            if (sectionId === 'ergebnisse-section') {
                loadRecentResults('ergebnisse-events');
            }
        });
    }
}

// Function to load recent results (last week's events with game results, latest first)
function loadRecentResults(containerId) {
    console.log('🔍 loadRecentResults gestartet für Container:', containerId);
    console.log('📅 Suche Ergebnisse der letzten Woche');

    // Custom load for recent results with different sorting - use JSON
    const allEventsPromises = CALENDAR_CONFIGS.map(config => {
        return fetchAndParseJSON(config.jsonUrl, RANGE_TYPES.PAST_WEEK, config.id);
    });

    Promise.all(allEventsPromises)
        .then(eventArrays => {
            // Flatten all events into a single array
            let allEvents = eventArrays.flat();

            // Sort results by date descending (newest first) for results section
            allEvents.sort((a, b) => b.startDate - a.startDate);

            displayEvents(allEvents, containerId);
        })
        .catch(error => {
            console.error('❌ Fehler beim Laden der Ergebnisse:', error);
            const container = document.getElementById(containerId);
            if (container) {
                container.innerHTML = '<div>Fehler beim Laden der Ergebnisse</div>';
            }
        });
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
    addNavClickHandler('a[href="#ergebnisse"]', 'ergebnisse-section');
    addNavClickHandler('a[href="#anleitung"]', 'anleitung-section');

    // Handle initial routing based on URL
    handleRouting();

    // Load upcoming team events for the next 7 days
    loadUpcomingTeamEvents('spiele-events');

    // Load home games for the "Heimspiele" section
    loadUpcomingHomeGames('heimspiele-events');

    // Load events for dynamically configured team calendars (using ICS files)
    CALENDAR_CONFIGS.forEach(config => {
        const icsFile = config.icsFilename.replace('docs/', './');
        loadTeamCalendarEvents(icsFile, `${config.id}-events`, -1, config.id);
    });

    // Load events for dynamically configured schedule calendars
    SCHEDULE_CONFIGS.forEach(config => {
        loadCalendarEventsFromJSON(config.jsonUrl, `schedule-${config.id}-events`, -1, config.label);
    });
}

// Load events when page loads
document.addEventListener('DOMContentLoaded', initializeCalendarApp);