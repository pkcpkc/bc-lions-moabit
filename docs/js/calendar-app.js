// Team configuration data - will be dynamically populated
const CALENDAR_CONFIGS = window.CALENDAR_CONFIGS || [];
const SCHEDULE_CONFIGS = window.SCHEDULE_CONFIGS || [];

function generateTeamSections() {
    const navContainer = document.getElementById('team-nav-row');
    const calendarContainer = document.getElementById('team-calendars-container');

    // Clear existing dynamic content
    navContainer.innerHTML = '';
    calendarContainer.innerHTML = '';

    // Generate navigation links and calendar sections for each team
    CALENDAR_CONFIGS.forEach(config => {
        // Create navigation link
        const navLink = document.createElement('a');
        navLink.href = `#${config.id}`;
        navLink.className = 'nav-link team-nav-link';
        navLink.textContent = config.name;
        navLink.addEventListener('click', (e) => {
            e.preventDefault();
            showCalendarSection(`${config.id}-section`);
        });

        // Add to team nav row
        navContainer.appendChild(navLink);

        // Create calendar section
        const calendarSection = document.createElement('div');
        calendarSection.className = 'calendar-section';
        calendarSection.id = `${config.id}-section`;
        calendarSection.innerHTML = `
            <div class="calendar-link" id="spielplan_${config.id}">
                <h3>Spielplan: ${config.name}</h3>
                <div class="calendar-actions">
                    <button class="copy-button"
                        onclick="copyToClipboard('${config.icsUrl}', event)">iCal-URL
                        kopieren</button>
                    <span class="calendar-separator">|</span>
                    <a href="webcal://${config.icsUrl.replace('https://', '')}">Abonnieren</a>
                    <span class="calendar-separator">|</span>
                    <a href="${config.webUrl}" target="_blank" rel="noopener noreferrer">DBB Webseite</a>
                </div>
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
        const navLink = document.createElement('a');
        navLink.href = `#schedule-${config.id}`;
        navLink.className = 'nav-link schedule-nav-link';
        navLink.textContent = config.label;
        navLink.addEventListener('click', (e) => {
            e.preventDefault();
            showCalendarSection(`schedule-${config.id}-section`);
        });

        // Add to schedule nav row
        navContainer.appendChild(navLink);

        // Create calendar section
        const calendarSection = document.createElement('div');
        calendarSection.className = 'calendar-section';
        calendarSection.id = `schedule-${config.id}-section`;
        
        const encodedCalId = encodeURIComponent(config.calId);
        const icsUrl = `https://calendar.google.com/calendar/ical/${encodedCalId}/public/basic.ics`;
        const webcalUrl = `webcal://calendar.google.com/calendar/ical/${encodedCalId}/public/basic.ics`;
        
        const calendarUrl = `https://calendar.google.com/calendar/embed?src=${encodedCalId}&ctz=Europe%2FBerlin`;
        
        calendarSection.innerHTML = `
            <div class="calendar-link" id="schedule_${config.id}">
                <h3>Termine: ${config.label}</h3>
                <div class="calendar-actions">
                    <button class="copy-button"
                        onclick="copyToClipboard('${config.icsUrl}', event)">iCal-URL
                        kopieren</button>
                    <span class="calendar-separator">|</span>
                    <a href="webcal://${config.icsUrl.replace('https://', '')}">Abonnieren</a>
                    <span class="calendar-separator">|</span>
                    <a href="${calendarUrl}" target="_blank" rel="noopener noreferrer">Kalender</a>
                </div>
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

function copyToClipboard(text, event) {
    navigator.clipboard.writeText(text).then(function () {
        // Show success feedback
        const button = event.target;
        const originalText = button.textContent;
        button.textContent = 'Kopiert!';
        button.style.backgroundColor = '#28a745';

        setTimeout(function () {
            button.textContent = originalText;
            button.style.backgroundColor = '#007bff';
        }, 2000);
    }).catch(function (err) {
        // Fallback for older browsers
        const textArea = document.createElement('textarea');
        textArea.value = text;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);

        // Show success feedback
        const button = event.target;
        const originalText = button.textContent;
        button.textContent = 'Kopiert!';
        button.style.backgroundColor = '#28a745';

        setTimeout(function () {
            button.textContent = originalText;
            button.style.backgroundColor = '#007bff';
        }, 2000);
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

// Load team events (Spielplan) - shows all upcoming events
function loadTeamCalendarEvents(url, containerId, maxEvents = -1, teamId = null) {
    fetch(url)
        .then(response => response.text())
        .then(data => {
            try {
                const jcalData = ICAL.parse(data);
                const comp = new ICAL.Component(jcalData);
                const vevents = comp.getAllSubcomponents('vevent');

                const events = vevents.map(vevent => {
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

                // Sort events by date
                events.sort((a, b) => a.startDate - b.startDate);

                // Show all upcoming events for team schedules
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                
                const eventsToShow = events.filter(event => event.startDate >= today);
                
                displayEvents(eventsToShow, containerId);
            } catch (error) {
                console.error('Error parsing calendar:', error);
                document.getElementById(containerId).innerHTML = '<div class="error">Fehler beim Laden der Spiele</div>';
            }
        })
        .catch(error => {
            console.error('Error fetching calendar:', error);
            document.getElementById(containerId).innerHTML = '<div class="error">Fehler beim Laden der Spiele</div>';
        });
}

// Load termine events - shows events for next 4 weeks only
function loadCalendarEvents(url, containerId, maxEvents = -1, teamId = null) {
    fetch(url)
        .then(response => response.text())
        .then(data => {
            try {
                const jcalData = ICAL.parse(data);
                const comp = new ICAL.Component(jcalData);
                const vevents = comp.getAllSubcomponents('vevent');

                const allEvents = [];
                
                // Define date range: next 1 month
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                
                const oneMonthFromNow = new Date(today);
                oneMonthFromNow.setMonth(today.getMonth() + 1); // 1 month from now
                oneMonthFromNow.setHours(23, 59, 59, 999);

                vevents.forEach(vevent => {
                    const event = new ICAL.Event(vevent);
                    
                    // Handle recurring events properly
                    if (event.isRecurring()) {
                        const iterator = event.iterator();
                        let next;
                        
                        // Expand recurring events within our date range
                        while ((next = iterator.next()) && next.toJSDate() <= oneMonthFromNow) {
                            const eventDate = next.toJSDate();
                            if (eventDate >= today) {
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

                // Sort events by date
                allEvents.sort((a, b) => a.startDate - b.startDate);
                
                displayEvents(allEvents, containerId);
            } catch (error) {
                console.error('Error parsing calendar:', error);
                document.getElementById(containerId).innerHTML = '<div class="error">Fehler beim Laden der Termine</div>';
            }
        })
        .catch(error => {
            console.error('Error fetching calendar:', error);
            document.getElementById(containerId).innerHTML = '<div class="error">Fehler beim Laden der Termine</div>';
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

function loadAllTeamEvents(containerId) {
    const allEventsPromises = CALENDAR_CONFIGS.map(config => {
        const icsFile = config.icsFilename.replace('docs/', './');
        return fetch(icsFile)
            .then(response => response.text())
            .then(data => {
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
                            teamId: config.id.toUpperCase()
                        };
                    });
                } catch (error) {
                    console.error('Error parsing calendar:', error);
                    return [];
                }
            })
            .catch(error => {
                console.error('Error fetching calendar:', error);
                return [];
            });
    });

    Promise.all(allEventsPromises)
        .then(eventArrays => {
            // Flatten all events into a single array
            const allEvents = eventArrays.flat();

            // Sort events by date
            allEvents.sort((a, b) => a.startDate - b.startDate);

            // Show all upcoming events
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            
            const upcomingEvents = allEvents.filter(event => event.startDate >= today);

            displayEvents(upcomingEvents, containerId);
        })
        .catch(error => {
            console.error('Error loading all team events:', error);
            document.getElementById(containerId).innerHTML = '<div class="error">Fehler beim Laden der Termine</div>';
        });
}

function loadUpcomingTeamEvents(containerId) {
    const allEventsPromises = CALENDAR_CONFIGS.map(config => {
        const icsFile = config.icsFilename.replace('docs/', './');
        return fetch(icsFile)
            .then(response => response.text())
            .then(data => {
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
                            teamId: config.id.toUpperCase()
                        };
                    });
                } catch (error) {
                    console.error('Error parsing calendar:', error);
                    return [];
                }
            })
            .catch(error => {
                console.error('Error fetching calendar:', error);
                return [];
            });
    });

    Promise.all(allEventsPromises)
        .then(eventArrays => {
            // Flatten all events into a single array
            const allEvents = eventArrays.flat();

            // Sort events by date
            allEvents.sort((a, b) => a.startDate - b.startDate);

            // Get upcoming events in the next 7 days
            const today = new Date();
            today.setHours(0, 0, 0, 0); // Start of today
            
            const sevenDaysFromNow = new Date(today);
            sevenDaysFromNow.setDate(today.getDate() + 7);
            sevenDaysFromNow.setHours(23, 59, 59, 999); // End of 7th day

            // Filter events for the next 7 days (including today)
            const upcomingEvents = allEvents.filter(event => 
                event.startDate >= today && event.startDate <= sevenDaysFromNow
            );

            displayEvents(upcomingEvents, containerId);
        })
        .catch(error => {
            console.error('Error loading upcoming team events:', error);
            document.getElementById(containerId).innerHTML = '<div class="error">Fehler beim Laden der kommenden Termine</div>';
        });
}

function loadUpcomingHomeGames(containerId) {
    const allEventsPromises = CALENDAR_CONFIGS.map(config => {
        const icsFile = config.icsFilename.replace('docs/', './');
        return fetch(icsFile)
            .then(response => response.text())
            .then(data => {
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
                            teamId: config.id.toUpperCase()
                        };
                    });
                } catch (error) {
                    console.error('Error parsing calendar:', error);
                    return [];
                }
            })
            .catch(error => {
                console.error('Error fetching calendar:', error);
                return [];
            });
    });

    Promise.all(allEventsPromises)
        .then(eventArrays => {
            // Flatten all events into a single array
            const allEvents = eventArrays.flat();

            // Sort events by date
            allEvents.sort((a, b) => a.startDate - b.startDate);

            // Get upcoming events in the next 7 days
            const today = new Date();
            today.setHours(0, 0, 0, 0); // Start of today
            
            const sevenDaysFromNow = new Date(today);
            sevenDaysFromNow.setDate(today.getDate() + 7);
            sevenDaysFromNow.setHours(23, 59, 59, 999); // End of 7th day

            // Filter for upcoming home games (BC Lions Moabit is the home team)
            const homeGames = allEvents.filter(event => {
                const isUpcoming = event.startDate >= today && event.startDate <= sevenDaysFromNow;
                const isHomeGame = event.summary && event.summary.startsWith('BC Lions Moabit');
                return isUpcoming && isHomeGame;
            });

            displayEvents(homeGames, containerId);
        })
        .catch(error => {
            console.error('Error loading upcoming home games:', error);
            document.getElementById(containerId).innerHTML = '<div class="error">Fehler beim Laden der Heimspiele</div>';
        });
}

// Function to get and display last modified date
function updateLastModifiedDate() {
    // Make a HEAD request to get the Last-Modified header
    fetch(window.location.href, { method: 'HEAD' })
        .then(response => {
            const lastModified = response.headers.get('Last-Modified');
            if (lastModified) {
                const date = new Date(lastModified);
                const options = {
                    weekday: 'long',
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                    timeZone: 'Europe/Berlin'
                };
                const formattedDate = date.toLocaleDateString('de-DE', options);
                document.getElementById('last-updated-date').textContent = formattedDate;
            } else {
                // Fallback: use current date if no Last-Modified header
                const now = new Date();
                const options = {
                    weekday: 'long',
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                    timeZone: 'Europe/Berlin'
                };
                const formattedDate = now.toLocaleDateString('de-DE', options);
                document.getElementById('last-updated-date').textContent = formattedDate;
            }
        })
        .catch(error => {
            console.error('Error fetching last modified date:', error);
            // Fallback: use current date
            const now = new Date();
            const options = {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
                timeZone: 'Europe/Berlin'
            };
            const formattedDate = now.toLocaleDateString('de-DE', options);
            document.getElementById('last-updated-date').textContent = formattedDate;
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
    document.querySelector('a[href="#spiele"]').addEventListener('click', (e) => {
        e.preventDefault();
        showCalendarSection('spiele-section');
    });

    document.querySelector('a[href="#heimspiele"]').addEventListener('click', (e) => {
        e.preventDefault();
        showCalendarSection('heimspiele-section');
    });

    document.querySelector('a[href="#anleitung"]').addEventListener('click', (e) => {
        e.preventDefault();
        showCalendarSection('anleitung-section');
    });

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