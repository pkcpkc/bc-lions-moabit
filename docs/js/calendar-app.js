// Team configuration data - will be dynamically populated
const CALENDAR_CONFIGS = window.CALENDAR_CONFIGS || [];
const SCHEDULE_CONFIGS = window.SCHEDULE_CONFIGS || [];
const GENERAL_CONFIGS = window.GENERAL_CONFIGS || [];

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

const ERROR_MESSAGES = {
    PARSE_ERROR: 'Fehler beim Lesen der Termine',
    GAMES_ERROR: 'Fehler beim Laden der Spiele'
};

const UI_FEEDBACK = {
    COPY_SUCCESS: 'Kopiert!',
    COPY_SUCCESS_COLOR: '#28a745',
    COPY_DEFAULT_COLOR: '#007bff',
    COPY_TIMEOUT: 2000
};

/**
 * Container configuration array with detector functions for different event sections.
 * Configurations are evaluated in order, first match wins.
 * @typedef {Object} ContainerConfig
 * @property {function(string): boolean} detector - Function to determine if config applies to containerId
 * @property {string} emptyMessage - Message shown when no events are found
 * @property {string} loadingMessage - Message shown while loading events
 * @property {function(string): void} [loadMethod] - Optional method to load events for this container, receives containerId as parameter
 */
const CONTAINER_CONFIG = [
    {
        detector: (containerId) => containerId === 'spiele-events',
        emptyMessage: 'Keine zukünftigen Spiele',
        loadingMessage: 'Lade Spiele...',
        loadMethod: (containerId) => loadUpcomingTeamEvents(containerId)
    },
    {
        detector: (containerId) => containerId === 'heimspiele-events',
        emptyMessage: 'Keine zukünftigen Heimspiele',
        loadingMessage: 'Lade Heimspiele...',
        loadMethod: (containerId) => loadUpcomingHomeGames(containerId)
    },
    {
        detector: (containerId) => containerId === 'ergebnisse-events',
        emptyMessage: 'Keine Ergebnisse in dem letzten Monat',
        loadingMessage: 'Lade Ergebnisse...',
        loadMethod: (containerId) => loadRecentResults(containerId)
    },
    {
        detector: (containerId) => containerId.startsWith('schedule-') && containerId.endsWith('-events'),
        emptyMessage: 'Keine Trainings in diesem Zeitraum',
        loadingMessage: 'Lade Training...',
        loadMethod: (containerId) => loadScheduleEvents(containerId)
    },
    {
        detector: (containerId) => containerId.startsWith('termine-') && containerId.endsWith('-events'),
        emptyMessage: 'Keine zukünftigen Termine',
        loadingMessage: 'Lade Termine...',
        loadMethod: (containerId) => loadTermineEvents(containerId)
    },
    {
        detector: (containerId) => containerId.endsWith('-events'),
        emptyMessage: 'Keine Spiele in diesem Zeitraum',
        loadingMessage: 'Lade Termine...',
        loadMethod: (containerId) => loadTeamCalendarEvents(containerId)
    }
];

/**
 * Get container configuration using detector functions.
 * Evaluates configurations in order and returns the first match.
 * @param {string} containerId - The container ID to find configuration for
 * @returns {ContainerConfig} The matching configuration or default fallback
 */
function getContainerConfig(containerId) {
    // Find the first matching configuration using detector functions
    const config = CONTAINER_CONFIG.find(config => config.detector(containerId));
    
    if (config) {
        return config;
    }
    
    // Default fallback if no detector matches
    return {
        emptyMessage: 'Keine Termine',
        loadingMessage: 'Lade...'
    };
}

// Helper function to set loading state for a container
function setLoadingState(containerId) {
    const container = document.getElementById(containerId);
    if (container) {
        const config = getContainerConfig(containerId);
        container.innerHTML = `<div class="loading">${config.loadingMessage}</div>`;
        container.className = 'loading';
    }
}

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
    const webcalUrl = `webcal://pkcpkc.github.io/bc-lions-moabit/${icsUrl.replace('https://', '')}`;
    return `
        <div class="calendar-actions">
            <a href="${webcalUrl}">Abonnieren</a>
            <span class="calendar-separator">|</span>
            <a href="${additionalUrl}" target="_blank" rel="noopener noreferrer">${additionalText}</a><span class="calendar-separator">|</span>
            <button class="copy-button"
                onclick="copyToClipboard('https://pkcpkc.github.io/bc-lions-moabit/${icsUrl}', event)">iCal-URL
                kopieren</button>
        </div>
    `;
}

// Enhanced function to extract game results from structured JSON data
function extractGameResultFromData(gameData) {
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
        // No result available - omit the badge entirely
        return '';
    }
}

function generateUnifiedNavigation() {
    const navContainer = document.getElementById('unified-nav-container');
    const calendarContainer = document.getElementById('team-calendars-container');

    // Clear existing dynamic content
    navContainer.innerHTML = '';
    calendarContainer.innerHTML = '';

    // Create map of team ID to team name
    const teamMap = {};
    CALENDAR_CONFIGS.forEach(config => {
        teamMap[config.id] = config.name;
    });

    // Generate cards for each termine/schedule category
    SCHEDULE_CONFIGS.forEach(config => {
        // Create navigation card
        const navCard = document.createElement('div');
        navCard.className = 'nav-card';
        
        const cardHeader = document.createElement('div');
        cardHeader.className = 'nav-card-header';
        cardHeader.textContent = config.label;
        
        const teamsContainer = document.createElement('div');
        teamsContainer.className = 'nav-card-teams';

        // Add training link first
        const trainingLink = createNavLink(
            `#schedule-${config.id}`,
            'nav-link schedule-nav-link',
            'Training',
            (e) => {
                e.preventDefault();
                showCalendarSection(`schedule-${config.id}-section`);
            }
        );
        teamsContainer.appendChild(trainingLink);

        // Add team links if teams are specified
        if (config.teams && config.teams.length > 0) {
            config.teams.forEach(teamId => {
                if (teamMap[teamId]) {
                    const teamLink = createNavLink(
                        `#${teamId}`,
                        'nav-link team-nav-link',
                        teamMap[teamId].replace('BC Lions Moabit ', ''),
                        (e) => {
                            e.preventDefault();
                            showCalendarSection(`${teamId}-section`);
                        }
                    );
                    teamsContainer.appendChild(teamLink);
                }
            });
        } else if (!config.teams) {
            // If no teams are specified, show "Alle Teams" 
            const allTeamsText = document.createElement('span');
            allTeamsText.textContent = 'Alle Teams';
            allTeamsText.className = 'nav-link';
            allTeamsText.style.backgroundColor = '#f8f9fa';
            allTeamsText.style.color = '#666';
            allTeamsText.style.cursor = 'default';
            teamsContainer.appendChild(allTeamsText);
        }

        navCard.appendChild(cardHeader);
        navCard.appendChild(teamsContainer);
        navContainer.appendChild(navCard);

        // Create schedule calendar section
        const scheduleSection = document.createElement('div');
        scheduleSection.className = 'calendar-section';
        scheduleSection.id = `schedule-${config.id}-section`;

        const encodedCalId = encodeURIComponent(config.calId);
        const calendarUrl = `https://calendar.google.com/calendar/embed?src=${encodedCalId}&ctz=Europe%2FBerlin`;

        const containerId = `schedule-${config.id}-events`;
        const containerConfig = getContainerConfig(containerId);
        
        scheduleSection.innerHTML = `
            <div class="calendar-link" id="schedule_${config.id}">
                <h3>Training: ${config.label}</h3>
                ${createCalendarActionsHTML(config.icsUrl, calendarUrl, 'Kalender')}
            </div>

            <div class="events-container">
                <h4>Training des nächsten Monats</h4>
                <div id="${containerId}" class="loading">${containerConfig.loadingMessage}</div>
            </div>
        `;

        calendarContainer.appendChild(scheduleSection);
    });

    // Generate team calendar sections (referenced by the cards above)
    CALENDAR_CONFIGS.forEach(config => {
        const calendarSection = document.createElement('div');
        calendarSection.className = 'calendar-section';
        calendarSection.id = `${config.id}-section`;
        
        const containerId = `${config.id}-events`;
        const containerConfig = getContainerConfig(containerId);
        
        calendarSection.innerHTML = `
            <div class="calendar-link" id="spielplan_${config.id}">
                <h3>Spielplan: ${config.name}</h3>
                ${createCalendarActionsHTML(config.icsUrl, config.webUrl, 'DBB Seite')}
            </div>

            <div class="events-container">
                <h4>Alle Spieltermine</h4>
                <div id="${containerId}" class="loading">${containerConfig.loadingMessage}</div>
            </div>
        `;

        calendarContainer.appendChild(calendarSection);
    });
}

function generateTermineNavigation() {
    const overviewNavRow = document.getElementById('overview-nav-row');
    const calendarContainer = document.getElementById('team-calendars-container');

    if (!overviewNavRow || !calendarContainer) return;

    // Generate navigation links and sections for each termine config
    GENERAL_CONFIGS.forEach(config => {
        // Create navigation link
        const termineLink = createNavLink(
            `#termine-${config.id}`,
            'nav-link',
            config.label,
            (e) => {
                e.preventDefault();
                showCalendarSection(`termine-${config.id}-section`);
            }
        );
        // Insert the termine link at the beginning of the nav-row (before existing links)
        overviewNavRow.insertBefore(termineLink, overviewNavRow.firstChild);

        // Create calendar section
        const termineSection = document.createElement('div');
        termineSection.className = 'calendar-section';
        termineSection.id = `termine-${config.id}-section`;

        const encodedCalId = encodeURIComponent(config.calId);
        const calendarUrl = `https://calendar.google.com/calendar/embed?src=${encodedCalId}&ctz=Europe%2FBerlin`;

        const containerId = `termine-${config.id}-events`;
        const containerConfig = getContainerConfig(containerId);
        
        termineSection.innerHTML = `
            <div class="calendar-link" id="termine_${config.id}">
                <h3>Termine: ${config.label}</h3>
                ${createCalendarActionsHTML(config.icsUrl, calendarUrl, 'Kalender')}
            </div>

            <div class="events-container">
                <h4>Alle zukünftigen Termine</h4>
                <div id="${containerId}" class="loading">${containerConfig.loadingMessage}</div>
            </div>
        `;

        calendarContainer.appendChild(termineSection);
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
    }

    // Default to "termine-bc-lions" section, when no hash or invalid hash
    showCalendarSection('termine-bc-lions-section', false);
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

// Helper function to extract the first URL from a text string
function extractFirstUrl(text) {
    if (!text) return null;
    
    // Regular expression to match URLs (http/https) - more restrictive to avoid capturing extra characters
    const urlRegex = /(https?:\/\/[^\s<>"]+)/i;
    const match = text.match(urlRegex);
    
    return match ? match[1] : null;
}



// Parse JSON data from docs/data files
function parseJsonData(data, teamId = null) {
    try {
        if (!data.events || !Array.isArray(data.events)) {
            console.warn('No events array found in JSON data');
            return [];
        }

        // Handle both spiele and termine data formats - both use same events structure
        const events = data.events.map(event => {
            const startDate = new Date(event.startDate);
            const endDate = new Date(event.endDate);

            return {
                summary: event.summary,
                startDate: startDate,
                endDate: endDate,
                location: event.location || '',
                description: event.description || '',
                venueName: event.venueName || '', // Optional field from spiele data
                teamId: teamId ? teamId.toUpperCase() : null,
                gameData: event.game || null // Include game data if available (from spiele)
            };
        });

        return events;
    } catch (error) {
        console.error('Error parsing JSON data:', error);
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



// Load team events from JSON (Spielplan) - shows all upcoming events
function loadTeamCalendarEventsFromJSON(url, containerId, teamId = null) {
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
function loadCalendarEventsFromJSON(url, containerId, teamId = null) {
    fetchAndParseJSON(url, RANGE_TYPES.NEXT_MONTH, teamId)
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
        // Get empty message from container config using helper function
        const config = getContainerConfig(containerId);
        container.innerHTML = `<div class="loading"><div>${config.emptyMessage}</div></div>`;
        return;
    }

    const eventsHTML = events.map(event => {
        const title = event.summary || 'Kein Titel';
        let displayTitle = title;

        // Add venueName in brackets if available
        if (event.venueName) {
            displayTitle += ` (${event.venueName})`;
        }

        // Extract game result from structured data from JSON
        const gameResult = event.gameData
            ? extractGameResultFromData(event.gameData)
            : { hasResult: false };

        // Make BC Lions team names bold
        let formattedTitle = displayTitle.replace(/(BC Lions\s+\w+(?:\s+\d+)?(?:\s+mix)?)/g, '<strong>$1</strong>');

        // Highlight game results
        if (gameResult.hasResult) {
            formattedTitle = formatTitleWithResult(formattedTitle, gameResult);
        }

        // Extract URL from description and make title clickable if URL exists
        const eventUrl = extractFirstUrl(event.description);
        let titleContent;
        if (eventUrl) {
            // Ensure URL is properly encoded for HTML attribute
            const encodedUrl = eventUrl.replace(/"/g, '&quot;');
            titleContent = `<a href="${encodedUrl}" target="_blank" rel="noopener noreferrer">${formattedTitle}</a>`;
        } else {
            titleContent = formattedTitle;
        }

        return `
        <div class="event-item ${gameResult.hasResult ? 'has-result' : 'has-pending'}">
            <div class="event-main">
                <div class="event-header-line">
                    ${event.teamId ? `<span class="team-id">${event.teamId}</span>` : ''}
                    <span class="game-result">${formatResultBadge(gameResult)}</span>
                </div>
                <div class="event-date">${formatDateRange(event.startDate, event.endDate)}</div>
                <div class="event-title">${titleContent}</div>
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
        const jsonFile = `./data/spiele/${config.id}.json`;
        return fetchAndParseJSON(jsonFile, rangeTypeFilter, config.id);
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



function loadUpcomingTeamEvents(containerId) {
    loadMultipleTeamEvents(containerId, RANGE_TYPES.FUTURE);
}

function loadUpcomingHomeGames(containerId) {
    // Filter function to check for home games
    const homeGameFilter = (events) => {
        return events.filter(event =>
            event.summary && event.summary.startsWith('BC Lions Moabit')
        );
    };

    loadMultipleTeamEvents(containerId, RANGE_TYPES.FUTURE, homeGameFilter);
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

// Function to load recent results (last week's events with game results, latest first)
function loadRecentResults(containerId) {
    // Custom load for recent results with different sorting - use JSON
    const allEventsPromises = CALENDAR_CONFIGS.map(config => {
        const jsonFile = `./data/spiele/${config.id}.json`;
        return fetchAndParseJSON(jsonFile, RANGE_TYPES.PAST_MONTH, config.id);
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
            console.error('Error loading recent results:', error);
            document.getElementById(containerId).innerHTML = `<div class="error">${ERROR_MESSAGES.PARSE_ERROR}</div>`;
        });
}

// Function to load schedule events for a specific container
function loadScheduleEvents(containerId) {
    // Extract schedule ID from container ID (schedule-{id}-events)
    const scheduleId = containerId.replace('schedule-', '').replace('-events', '');
    
    // Find the matching schedule config
    const scheduleConfig = SCHEDULE_CONFIGS.find(config => config.id === scheduleId);
    if (!scheduleConfig) {
        console.error(`No schedule config found for ID: ${scheduleId}`);
        document.getElementById(containerId).innerHTML = `<div class="error">${ERROR_MESSAGES.PARSE_ERROR}</div>`;
        return;
    }
    
    const jsonFile = scheduleConfig.jsonUrl;
    loadCalendarEventsFromJSON(jsonFile, containerId, scheduleConfig.label);
}

// Function to load termine events for a specific container - shows ALL future events
function loadTermineEvents(containerId) {
    // Extract termine ID from container ID (termine-{id}-events)
    const termineId = containerId.replace('termine-', '').replace('-events', '');
    
    // Find the matching general config
    const termineConfig = GENERAL_CONFIGS.find(config => config.id === termineId);
    if (!termineConfig) {
        console.error(`No termine config found for ID: ${termineId}`);
        document.getElementById(containerId).innerHTML = `<div class="error">${ERROR_MESSAGES.PARSE_ERROR}</div>`;
        return;
    }
    
    const jsonFile = termineConfig.jsonUrl;
    // Use FUTURE range for termine events to show all upcoming events (not just next month)
    fetchAndParseJSON(jsonFile, RANGE_TYPES.FUTURE, termineConfig.label)
        .then(events => {
            events.sort((a, b) => a.startDate - b.startDate);
            displayEvents(events, containerId);
        })
        .catch(error => {
            console.error('Error loading termine events:', error);
            document.getElementById(containerId).innerHTML = `<div class="error">${ERROR_MESSAGES.PARSE_ERROR}</div>`;
        });
}

// Function to load team calendar events for a specific container
function loadTeamCalendarEvents(containerId) {
    // Extract team ID from container ID ({teamId}-events)
    const teamId = containerId.replace('-events', '');
    
    // Find the matching calendar config
    const calendarConfig = CALENDAR_CONFIGS.find(config => config.id === teamId);
    if (!calendarConfig) {
        console.error(`No calendar config found for team ID: ${teamId}`);
        document.getElementById(containerId).innerHTML = `<div class="error">${ERROR_MESSAGES.PARSE_ERROR}</div>`;
        return;
    }
    
    const jsonFile = `./data/spiele/${calendarConfig.id}.json`;
    loadTeamCalendarEventsFromJSON(jsonFile, containerId, calendarConfig.id);
}

// Initialize app when page loads
function initializeCalendarApp() {
    // Update last modified date
    updateLastModifiedDate();

    // Generate unified navigation and sections dynamically
    generateUnifiedNavigation();
    
    // Generate termine navigation links
    generateTermineNavigation();

    // Add click handlers to existing navigation links
    addNavClickHandler('a[href="#spiele"]', 'spiele-section');
    addNavClickHandler('a[href="#heimspiele"]', 'heimspiele-section');
    addNavClickHandler('a[href="#ergebnisse"]', 'ergebnisse-section');
    addNavClickHandler('a[href="#anleitung"]', 'anleitung-section');

    // Handle initial routing based on URL
    handleRouting();

    // Load main overview sections using container config (only configs with loadMethod)
    // We need to find containers that match each loadable config and call their loadMethod
    const allContainers = document.querySelectorAll('[id$="-events"]');
    allContainers.forEach(container => {
        const containerId = container.id;
        const config = getContainerConfig(containerId);
        if (config && config.loadMethod) {
            config.loadMethod(containerId);
        }
    });

    // Note: All event loading is now handled by the unified container config system above
    // Dynamic configs (team calendars, schedule calendars, termine calendars) are automatically
    // loaded based on their container IDs through the detector functions in CONTAINER_CONFIG
}

// Load events when page loads
document.addEventListener('DOMContentLoaded', initializeCalendarApp);