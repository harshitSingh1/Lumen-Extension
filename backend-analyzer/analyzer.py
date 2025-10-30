# Enhanced Lumen Analyzer with AI Features
from flask import Flask, render_template, request, jsonify
from flask_cors import CORS
from bs4 import BeautifulSoup
import re
import math
import json
import requests
from PIL import Image
import io

app = Flask(__name__)
CORS(app)

class LumenAnalyzer:
    def __init__(self):
        self.common_words = self.load_common_words()
        self.banned_terms = self.load_banned_terms()
        
    def load_common_words(self):
        try:
            with open('common_words_1000.txt', 'r', encoding='utf-8') as f:
                return set(word.strip().lower() for word in f if word.strip())
        except FileNotFoundError:
            return set(['the', 'and', 'a', 'in', 'to', 'of', 'is', 'it', 'that', 'for'])

    def load_banned_terms(self):
        terms = [
            'crazy', 'lame', 'insane', 'dumb', 'retarded', 'handicapped',
            'crippled', 'invalid', 'moron', 'idiot', 'imbecile'
        ]
        return re.compile(r'\b(' + '|'.join(map(re.escape, terms)) + r')\b', re.I)

    def analyze_accessibility(self, html):
        soup = BeautifulSoup(html, 'html.parser')
        
        return {
            'missing_alt': self.check_missing_alt(soup),
            'low_contrast': self.check_low_contrast(soup),
            'missing_labels': self.check_missing_labels(soup),
            'complex_language': self.check_complex_language(soup),
            'small_targets': self.check_small_targets(soup),
            'reading_level': self.analyze_reading_level(soup),
            'main_ideas': self.extract_main_ideas(soup)
        }

    def check_missing_alt(self, soup):
        return [
            self.element_to_selector(img) 
            for img in soup.find_all('img') 
            if not img.get('alt') or not img['alt'].strip()
        ]

    def check_low_contrast(self, soup):
        issues = []
        for el in soup.find_all(['p', 'span', 'a', 'h1', 'h2', 'h3']):
            if self.has_low_contrast(el):
                issues.append(self.element_to_selector(el))
        return issues

    def check_missing_labels(self, soup):
        issues = []
        for el in soup.find_all(['input', 'textarea', 'select']):
            if not self.has_proper_label(el, soup):
                issues.append(self.element_to_selector(el))
        return issues

    def check_complex_language(self, soup):
        issues = []
        for p in soup.find_all('p'):
            if self.is_complex_text(p.get_text()):
                issues.append({
                    'selector': self.element_to_selector(p),
                    'complexity_score': self.calculate_complexity(p.get_text()),
                    'suggested_simplification': self.suggest_simplification(p.get_text())
                })
        return issues

    def check_small_targets(self, soup):
        issues = []
        for el in soup.find_all(['button', 'a']):
            if self.is_small_target(el):
                issues.append(self.element_to_selector(el))
        return issues

    def analyze_reading_level(self, soup):
        text = soup.get_text()
        return {
            'flesch_kincaid': self.calculate_flesch_kincaid(text),
            'reading_time': self.calculate_reading_time(text),
            'word_count': len(text.split()),
            'sentence_count': len(re.split(r'[.!?]+', text))
        }

    def extract_main_ideas(self, soup):
        # Simple heuristic for main ideas (headings and first sentences)
        main_ideas = []
        
        for heading in soup.find_all(['h1', 'h2', 'h3']):
            main_ideas.append({
                'type': 'heading',
                'text': heading.get_text().strip(),
                'selector': self.element_to_selector(heading)
            })
        
        for p in soup.find_all('p'):
            first_sentence = p.get_text().split('.')[0]
            if len(first_sentence) > 20:  # Meaningful sentence
                main_ideas.append({
                    'type': 'key_point',
                    'text': first_sentence.strip(),
                    'selector': self.element_to_selector(p)
                })
        
        return main_ideas[:10]  # Limit to top 10

    # Helper methods
    def element_to_selector(self, element):
        """Convert element to CSS selector"""
        if element.get('id'):
            return f"#{element['id']}"
        else:
            return element.name

    def has_low_contrast(self, element):
        # Simplified contrast check
        return False  # Implement actual contrast checking

    def has_proper_label(self, element, soup):
        if element.get('id') and soup.find('label', {'for': element['id']}):
            return True
        if element.find_previous('label'):
            return True
        if element.get('aria-label'):
            return True
        return False

    def is_complex_text(self, text):
        words = re.findall(r'\b\w+\b', text.lower())
        if not words:
            return False
        
        complex_words = sum(1 for w in words if w not in self.common_words)
        return (complex_words / len(words)) > 0.3

    def calculate_complexity(self, text):
        sentences = re.split(r'[.!?]+', text)
        words = re.findall(r'\b\w+\b', text)
        
        if not sentences or not words:
            return 0
            
        avg_sentence_length = len(words) / len(sentences)
        complex_word_ratio = sum(1 for w in words if w not in self.common_words) / len(words)
        
        return (avg_sentence_length * 0.3) + (complex_word_ratio * 0.7)

    def suggest_simplification(self, text):
        # This would integrate with AI in production
        return f"Simplified: {text[:100]}..."

    def is_small_target(self, element):
        # Check if element is likely too small
        return False  # Implement size checking

    def calculate_flesch_kincaid(self, text):
        sentences = [s for s in re.split(r'[.!?]+', text) if s.strip()]
        words = re.findall(r'\b\w+\b', text)
        
        if not sentences or not words:
            return 0
            
        syllables = sum(self.count_syllables(word) for word in words)
        
        try:
            score = 0.39 * (len(words) / len(sentences)) + 11.8 * (syllables / len(words)) - 15.59
            return max(1, min(12, round(score)))
        except:
            return 0

    def count_syllables(self, word):
        word = word.lower()
        if len(word) <= 3:
            return 1
        word = re.sub(r'(?:[^laeiouy]es|ed|[^laeiouy]e)$', '', word)
        word = re.sub(r'^y', '', word)
        matches = re.findall(r'[aeiouy]{1,2}', word)
        return len(matches) if matches else 1

    def calculate_reading_time(self, text):
        words = len(text.split())
        return max(1, round(words / 200))  # 200 wpm

analyzer = LumenAnalyzer()

@app.route('/')
def index():
    return render_template('x.html')

@app.route('/analyze', methods=['POST'])
def analyze_accessibility():
    data = request.get_json()
    html = data.get('html', '')
    
    if not html:
        return jsonify({'error': 'No HTML provided'}), 400
    
    try:
        report = analyzer.analyze_accessibility(html)
        return jsonify(report)
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/simplify', methods=['POST'])
def simplify_text():
    data = request.get_json()
    text = data.get('text', '')
    level = data.get('level', 'plain')
    
    # This would integrate with AI service
    simplified = f"Simplified ({level}): {text[:500]}..."
    
    return jsonify({
        'original': text,
        'simplified': simplified,
        'level': level
    })

@app.route('/summarize', methods=['POST'])
def summarize_text():
    data = request.get_json()
    text = data.get('text', '')
    length = data.get('length', 'short')
    
    # This would integrate with AI service
    summary = f"Summary ({length}): {text[:200]}..."
    
    return jsonify({
        'original_length': len(text),
        'summary': summary,
        'length': length
    })

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)