import re
import argparse
from datetime import datetime, timedelta
from ics import Calendar, Event

CURRENT_YEAR = datetime.now().year

def parse_single_date(part, fallback_month=None, fallback_year=None):
    """Parses dates like 5.8.2025 or partials like 19. or 23.07."""
    part = part.strip().replace("–", "-").replace("—", "-")
    match = re.match(r"(\d{1,2})(?:\.(\d{1,2}))?(?:\.(\d{2,4}))?", part)
    if not match:
        raise ValueError(f"Invalid date part: {part}")
    day, month, year = match.groups()
    day = int(day)
    month = int(month) if month else fallback_month
    year = int(year) if year else fallback_year or CURRENT_YEAR

    if not month:
        raise ValueError(f"Month missing and no fallback provided in: {part}")
    return datetime(int(year), int(month), int(day))

def parse_date_part(date_str):
    """Extracts start and end dates, infers missing month/year from end."""
    date_str = date_str.strip().replace("–", "-").replace("—", "-")
    parts = date_str.split("-")

    if len(parts) == 1:
        date = parse_single_date(parts[0])
        return date, date

    start_str, end_str = parts
    end = parse_single_date(end_str)
    try:
        start = parse_single_date(start_str, fallback_month=end.month, fallback_year=end.year)
    except Exception as e:
        raise ValueError(f"Invalid date part: {date_str} → {e}")
    return start, end

def parse_time_part(time_str):
    """Parses a time range like 10–15h or 9-12h."""
    time_str = time_str.strip().lower().replace("h", "").replace("–", "-").replace("—", "-")
    match = re.match(r"(\d{1,2})-(\d{1,2})", time_str)
    if not match:
        return None, None
    start_hour, end_hour = map(int, match.groups())
    return start_hour, end_hour

def parse_event_line(line):
    """Parses a line and returns a list of events."""
    if ":" not in line:
        raise ValueError("Missing ':' separator")

    date_time_part, *rest = line.split(":", 1)
    description = rest[0].strip() if rest else ""
    location = ""
    if "@" in description:
        description, location = map(str.strip, description.split("@", 1))

    # Handle optional time part
    if "," in date_time_part:
        date_range_str, time_str = map(str.strip, date_time_part.split(",", 1))
        start_hour, end_hour = parse_time_part(time_str)
    else:
        date_range_str = date_time_part.strip()
        start_hour = end_hour = None

    start_date, end_date = parse_date_part(date_range_str)
    delta = (end_date - start_date).days + 1

    events = []
    for i in range(delta):
        day = start_date + timedelta(days=i)
        e = Event()
        e.name = description or "Event"
        e.location = location
        if start_hour is not None:
            e.begin = day.replace(hour=start_hour, minute=0)
            e.end = day.replace(hour=end_hour, minute=0)
        else:
            e.begin = day.date()
            e.make_all_day()
        events.append(e)
    return events

def main():
    parser = argparse.ArgumentParser(description="Convert event list to ICS calendar.")
    parser.add_argument("-i", "--input", default="events.txt", help="Input .txt file with event definitions")
    parser.add_argument("-o", "--output", default="events.ics", help="Output .ics file")
    args = parser.parse_args()

    cal = Calendar()

    with open(args.input, "r", encoding="utf-8") as f:
        lines = [line.strip() for line in f if line.strip()]
        for line in lines:
            try:
                events = parse_event_line(line)
                for e in events:
                    cal.events.add(e)
            except Exception as err:
                print(f"Skipping line due to error: {line}\n→ {err}")

    with open(args.output, "w", encoding="utf-8") as f:
        f.writelines(cal.serialize_iter())
    print(f"ICS file written to: {args.output}")

if __name__ == "__main__":
    main()