#!/bin/bash

INPUT_DIR="events"
OUTPUT_DIR="docs/ics"
SCRIPT="generate_ics.py"

# Ensure output directory exists
mkdir -p "$OUTPUT_DIR"

# Loop through all .txt files in the input directory
for txt_file in "$INPUT_DIR"/*.txt; do
    # Get the base filename without extension
    filename=$(basename "$txt_file" .txt)
    
    # Define the output .ics file path
    ics_file="$OUTPUT_DIR/$filename.ics"
    
    echo "Generating $ics_file from $txt_file..."
    
    # Call the Python script with argument flags
    python3 "$SCRIPT" --input "$txt_file" --output "$ics_file"
done

echo "Done."