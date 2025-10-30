'''test_analyzer.py — A simple test harness for analyzer.py
Reads x.html from the project root, runs all checks, and prints a JSON report.'''
import json
from bs4 import BeautifulSoup
import analyzer  # assumes analyzer.py is in the same directory
import os

# Get the directory where this script is located
script_dir = os.path.dirname(os.path.abspath(__file__))

# Load and parse the HTML file
with open(os.path.join(script_dir, 'x.html'), 'r', encoding='utf-8') as f:
    html = f.read()

soup = BeautifulSoup(html, 'html.parser')

# Prepare report by invoking each check directly
report = {
    'missingAlt':         analyzer.check_missing_alt(soup),
    'lowContrast':        analyzer.check_low_contrast(soup),
    'missingLabel':       analyzer.check_missing_label(soup),
    'gunningFog':         analyzer.check_gunning_fog(soup),
    'jargonRatio':        analyzer.check_jargon_ratio(soup),
    'inclusiveLanguage':  analyzer.check_inclusive_language(soup),
    'smallTouchTargets':  analyzer.check_small_touch_targets(soup),
    'passiveVoice':       analyzer.check_passive_voice(soup),
}

# Print formatted JSON to console
def simplify(html_snippet):
    # Trim long snippets for readability
    return html_snippet[:100] + '...' if len(html_snippet) > 100 else html_snippet

print(json.dumps({
    k: [simplify(el) for el in v] for k, v in report.items()
}, indent=2))
