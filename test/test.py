import subprocess
import tempfile
import os
from ics import Calendar

test_input_content = """\
12.-13.07., 10-15h: Basketball Turnier Potsdam RedHawks @OSZ Banken, Immobilien und Versicherungen Berlin
15.07.: Team Meeting
15.6.-17.6.2024: Testevent
31.12.2024-1.4.2025: Sylvester @Partylocation
19.–23.07: Projekttage Made in Moabit
24.07–07.09: Sommerferien (Training/Camps/Ferienreise/Boysday/Trainingslager Ostsee)
5.8.2025: Single Day Event with Year and No Location
9.9.: Event without Year and Location
"""

def run_test():
    with tempfile.TemporaryDirectory() as tmpdir:
        input_path = os.path.join(tmpdir, "test_events.txt")
        output_path = os.path.join(tmpdir, "test_output.ics")

        # Write test input file
        with open(input_path, "w", encoding="utf-8") as f:
            f.write(test_input_content)

        # Run the generate_ics.py script
        result = subprocess.run(
            ["python3", "generate_ics.py", input_path, output_path],
            capture_output=True,
            text=True,
        )

        print("SCRIPT STDOUT:")
        print(result.stdout)
        print("SCRIPT STDERR:")
        print(result.stderr)

        if result.returncode != 0:
            print("Script exited with error.")
            return

        # Check output file exists
        if not os.path.isfile(output_path):
            print("Error: output ICS file not created.")
            return

        # Read and parse ICS file with ics module to validate format
        with open(output_path, "r", encoding="utf-8") as f:
            ics_content = f.read()

        try:
            calendar = Calendar(ics_content)
            print(f"Parsed ICS file successfully. Events count: {len(calendar.events)}")
            for e in calendar.events:
                print(f"- {e.name} from {e.begin} to {e.end} Location: {e.location}")
        except Exception as e:
            print(f"Failed to parse ICS file: {e}")

if __name__ == "__main__":
    run_test()