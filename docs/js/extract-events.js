function extractUpcomingEvents() {
  // Helper map to get full German day names
  const dayNameMap = {
    "Mo": "Montag",
    "Di": "Dienstag",
    "Mi": "Mittwoch",
    "Do": "Donnerstag",
    "Fr": "Freitag",
    "Sa": "Samstag",
    "So": "Sonntag"
  };

  const outputLines = [];
  const weeks = document.querySelectorAll('.calendar-week');

  if (weeks.length === 0) {
    console.log("No '.calendar-week' elements found.");
    return;
  }

  // Iterate over each week block
  weeks.forEach(week => {
    // Get the week's start date from the header (e.g., "10.11.2025")
    const headerText = week.querySelector('.week-header h3')?.textContent;
    if (!headerText) return;

    // Use regex to find the first date in the string
    const startDateMatch = headerText.match(/(\d{2})\.(\d{2})\.(\d{4})/);
    if (!startDateMatch) return; // Skip if format is wrong

    // Parse the start date components
    // 'startDateMatch[0]' is the full match, [1] is day, [2] is month, [3] is year
    const startDay = parseInt(startDateMatch[1], 10);
    const startMonth = parseInt(startDateMatch[2], 10); // 1-indexed
    const startYear = parseInt(startDateMatch[3], 10);

    // Create a Date object for the start of the week.
    // Note: JavaScript months are 0-indexed (0=Jan, 11=Dec)
    const weekStartDate = new Date(startYear, startMonth - 1, startDay);

    const days = week.querySelectorAll('.calendar-day');

    // Iterate over each day within this week's grid
    days.forEach((day, index) => {
      // Calculate the correct date for the current day by adding the index
      // This robustly handles month and year changes
      let currentDate = new Date(weekStartDate);
      currentDate.setDate(weekStartDate.getDate() + index);

      // Find all events for this specific day
      const events = day.querySelectorAll('.calendar-event');

      // If there are events, process them
      if (events.length > 0) {
        // --- Format the Date Header ---
        const shortDayName = day.querySelector('.day-name').textContent.trim();
        const fullDayName = dayNameMap[shortDayName] || shortDayName;

        // Format the date components with leading zeros
        const dayNum = String(currentDate.getDate()).padStart(2, '0');
        const monthNum = String(currentDate.getMonth() + 1).padStart(2, '0'); // +1 for 1-indexing
        const yearNum = currentDate.getFullYear();
        
        const dateHeader = `${dayNum}.${monthNum}.${yearNum} ${fullDayName}`;
        
        outputLines.push(dateHeader);

        // --- Add Each Event ---
        events.forEach(event => {
          const time = event.querySelector('.event-time')?.textContent.trim() || '??:??';
          const teamId = event.querySelector('.team-id')?.textContent.trim() || 'No-ID';
          outputLines.push(`${time} ${teamId}`);
        });
        
        // Add a blank line for readability between days
        outputLines.push('');
      }
    });
  });

  // Join all lines with a newline and log to console
  const finalText = outputLines.join('\n');
  console.log(finalText);
  
  // Optional: Copy to clipboard
  if (navigator.clipboard) {
    navigator.clipboard.writeText(finalText)
      .then(() => alert('Spieldaten kopiert!'))
      .catch(err => alert('Fehler beim Kopieren der Spieldaten:', err));
  }
}

