// --- Lumen Content Script (The Brain) ---

// Global state variables
let lumenUiModal = null;
let focusOverlay = null;
let pomodoroTimerElement = null;
let pomodoroInterval = null;
let voiceRecognition = null;
let readingGuideElement = null;
let isTranslating = false;
let isReadingAloud = false;

const FONT_SCALE_STEP = 0.1;
const MIN_FONT_SCALE = 0.8;
const MAX_FONT_SCALE = 2.0;
const DEFAULT_FONT_SCALE = 1.0;

// --- 1. Modal & AI Helpers ---

/**
 * Checks if the Gemini API key is set.
 * If not, shows a modal prompting the user to set it.
 * @returns {Promise<boolean>} True if key is set, false otherwise.
 */
async function checkApiKey() {
    try {
        // Try to access the Gemini API functions
        if (typeof getGeminiApiKey === 'undefined' && window.LumenAI) {
            // Use the global LumenAI object if direct function is not available
            const apiKey = await window.LumenAI.getGeminiApiKey();
            return !!apiKey;
        } else if (typeof getGeminiApiKey !== 'undefined') {
            const apiKey = await getGeminiApiKey();
            return !!apiKey;
        } else {
            return false;
        }
    } catch (error) {
        console.error('Error checking API key:', error);
        return false;
    }
}

function showLumenModal(title, content) {
    if (!lumenUiModal) {
        lumenUiModal = document.createElement('div');
        lumenUiModal.id = 'lumen-ui-modal';
        document.body.appendChild(lumenUiModal);
        lumenUiModal.addEventListener('click', (e) => {
             // Close modal if backdrop or close button is clicked
             if (e.target.id === 'lumen-ui-modal' || e.target.id === 'lumen-modal-close' || e.target.parentElement.id === 'lumen-modal-close') {
                hideLumenModal();
             }
        });
    }
    lumenUiModal.innerHTML = `
        <div class="lumen-modal-content">
            <div id="lumen-modal-header">
                <span id="lumen-modal-title">${title}</span>
                <button id="lumen-modal-close" title="Close">
                   <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                </button>
            </div>
            <div id="lumen-modal-body">${content}</div>
        </div>
    `;
    lumenUiModal.style.display = 'flex';
}

function hideLumenModal() {
    if (lumenUiModal) {
        lumenUiModal.style.display = 'none';
    }
}

function showProgressNotification(message, type = 'info') {
    // Create a simple progress notification that doesn't block the page
    const notification = document.createElement('div');
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: ${type === 'error' ? '#dc3545' : '#007bff'};
        color: white;
        padding: 12px 16px;
        border-radius: 8px;
        z-index: 10000;
        font-family: -apple-system, BlinkMacSystemFont, sans-serif;
        font-size: 14px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        max-width: 300px;
    `;
    notification.textContent = message;
    document.body.appendChild(notification);
    
    // Auto-remove after 5 seconds
    setTimeout(() => {
        if (notification.parentElement) {
            notification.remove();
        }
    }, 5000);
    
    return notification;
}

/**
 * Fetches an image and converts it to Base64.
 * @param {string} srcUrl - The URL of the image.
 * @returns {Promise<{base64Data: string, mimeType: string}>}
 */
async function fetchImageAsBase64(srcUrl) {
    const proxyUrl = 'https://api.allorigins.win/raw?url=';
    
    let response;
    try {
         response = await fetch(proxyUrl + encodeURIComponent(srcUrl));
    } catch(e) {
        console.warn("Lumen: Proxy fetch failed, trying direct fetch...", e);
        response = await fetch(srcUrl);
    }

    if (!response.ok) {
        try {
            response = await fetch(srcUrl);
        } catch (e2) {
             throw new Error(`Failed to fetch image directly. Status: ${e2.message}`);
        }
        if (!response.ok) {
            throw new Error(`Failed to fetch image. Status: ${response.status}`);
        }
    }
    
    const blob = await response.blob();
    const mimeType = blob.type;
    
    if (!mimeType.startsWith('image/')) {
        throw new Error(`Fetched resource is not an image: ${mimeType}`);
    }

    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
            const base64Data = reader.result.split(',')[1];
            resolve({ base64Data, mimeType });
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });
}

// --- 2. AI Feature Implementations ---

async function runSummarize(text) {
    if (!await checkApiKey()) return;
    showLumenModal('Lumen: AI Summary', '<div class="lumen-loader">Generating summary...</div>');
    try {
        const prompt = `You are an expert summarizer. Summarize the following text into 3 key bullet points. Be concise and clear.\n\nTEXT:\n"""${text}"""`;
        
        let result;
        if (window.LumenAI && window.LumenAI.callGeminiText) {
            result = await window.LumenAI.callGeminiText(prompt);
        } else if (typeof callGeminiText !== 'undefined') {
            result = await callGeminiText(prompt);
        } else {
            throw new Error('AI functions not available');
        }
        
        showLumenModal('Lumen: AI Summary', result.replace(/\n/g, '<br>'));
    } catch (e) {
        showLumenModal('Lumen AI Error', `Failed to generate summary. ${e.message}`);
    }
}

async function runSimplify(text) {
    if (!await checkApiKey()) return;
    showLumenModal('Lumen: AI Simplification', '<div class="lumen-loader">Simplifying text...</div>');
    try {
        const prompt = `Rewrite the following text in simple, easy-to-understand English, suitable for a 5th grader. Use short sentences.\n\nTEXT:\n"""${text}"""`;
        
        let result;
        if (window.LumenAI && window.LumenAI.callGeminiText) {
            result = await window.LumenAI.callGeminiText(prompt);
        } else if (typeof callGeminiText !== 'undefined') {
            result = await callGeminiText(prompt);
        } else {
            throw new Error('AI functions not available');
        }
        
        showLumenModal('Lumen: AI Simplification', result.replace(/\n/g, '<br>'));
    } catch (e) {
        showLumenModal('Lumen AI Error', `Failed to simplify text. ${e.message}`);
    }
}

async function runTranslatePage(lang) {
    if (!await checkApiKey()) return;
    
    if (isTranslating) {
        showProgressNotification('Translation already in progress...', 'info');
        return;
    }
    
    isTranslating = true;
    const progressNotification = showProgressNotification(`🔄 Translating page to ${lang}... This may take a moment.`);
    
    try {
        // 1. Get all visible text nodes
        const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null, false);
        const textNodes = [];
        let node;
        while (node = walker.nextNode()) {
            const parentTag = node.parentElement.tagName;
            if (node.nodeValue.trim().length > 5 && !['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEXTAREA'].includes(parentTag)) {
                textNodes.push(node);
            }
        }
        
        if (textNodes.length === 0) {
            throw new Error('No translatable text found on this page.');
        }

        // 2. Create batches to avoid token limits
        const batchSize = 20;
        const batches = [];
        for (let i = 0; i < textNodes.length; i += batchSize) {
            batches.push(textNodes.slice(i, i + batchSize));
        }

        let totalTranslated = 0;

        for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
            const batch = batches[batchIndex];
            
            // Update progress
            progressNotification.textContent = `🔄 Translating page to ${lang}... (${Math.round((batchIndex / batches.length) * 100)}%)`;
            
            // Create batch prompt
            const combinedText = batch.map((node, index) => `[${index}]:: ${node.nodeValue}`).join('\n');
            const prompt = `You are a professional translator. Translate the following text blocks into ${lang}. Maintain the exact block structure (e.g., "[0]:: ...", "[1]:: ...") in your response. Only return the translated text for each block. If a block is just a number or symbol, return it unchanged.\n\n${combinedText}`;

            // Call API
            let response;
            if (window.LumenAI && window.LumenAI.callGeminiText) {
                response = await window.LumenAI.callGeminiText(prompt);
            } else if (typeof callGeminiText !== 'undefined') {
                response = await callGeminiText(prompt);
            } else {
                throw new Error('AI functions not available');
            }

            // Parse response and replace text
            const translationMap = {};
            const regex = /\[(\d+)\]:: ([\s\S]*?)(?=\n\[\d+\]:: |$)/g;
            let match;
            while ((match = regex.exec(response)) !== null) {
                translationMap[match[1]] = match[2];
            }

            batch.forEach((node, index) => {
                if (translationMap[index]) {
                    node.nodeValue = translationMap[index];
                    totalTranslated++;
                }
            });

            // Small delay between batches to avoid rate limiting
            if (batchIndex < batches.length - 1) {
                await new Promise(resolve => setTimeout(resolve, 500));
            }
        }

        progressNotification.textContent = `✅ Page translated to ${lang}! (${totalTranslated} elements translated)`;
        progressNotification.style.background = '#28a745';
        
        // Keep the success message visible longer
        setTimeout(() => {
            if (progressNotification.parentElement) {
                progressNotification.remove();
            }
        }, 8000);

    } catch (error) {
        progressNotification.textContent = `❌ Translation failed: ${error.message}`;
        progressNotification.style.background = '#dc3545';
        console.error('Translation error:', error);
    } finally {
        isTranslating = false;
    }
}

async function runImageDescription(srcUrl) {
    if (!await checkApiKey()) return;
    showLumenModal('Lumen: AI Image Description', `<div class="lumen-loader">Analyzing image...</div>`);
    try {
        const { base64Data, mimeType } = await fetchImageAsBase64(srcUrl);
        const prompt = "You are an expert in accessibility. Describe this image for a visually impaired user. Be descriptive but concise. Start with 'Image of...'";
        
        let result;
        if (window.LumenAI && window.LumenAI.callGeminiVision) {
            result = await window.LumenAI.callGeminiVision(prompt, mimeType, base64Data);
        } else if (typeof callGeminiVision !== 'undefined') {
            result = await callGeminiVision(prompt, mimeType, base64Data);
        } else {
            throw new Error('AI functions not available');
        }
        
        showLumenModal('Lumen: AI Image Description', result.replace(/\n/g, '<br>'));
    } catch (e) {
        showLumenModal('Lumen AI Error', `Failed to describe image. ${e.message}. This is often a CORS issue on the source image.`);
    }
}

// --- NEW AI FEATURES ---

async function runAITranslatePage(language) {
    await runTranslatePage(language);
}

async function runAISummarizePage(length) {
    if (!await checkApiKey()) return;
    
    showLumenModal('Lumen: AI Summarizer', `<div class="lumen-loader">Generating summary... This may take a moment.</div>`);
    
    try {
        const pageContent = extractPageContent();
        if (!pageContent || pageContent.length < 100) {
            throw new Error('Not enough content found on this page to summarize.');
        }

        let lengthInstruction = '';
        switch(length) {
            case 'short':
                lengthInstruction = 'Provide a very concise summary in 2-3 sentences.';
                break;
            case 'medium':
                lengthInstruction = 'Provide a comprehensive summary in one paragraph (4-6 sentences).';
                break;
            case 'bullet':
                lengthInstruction = 'Provide the key points as a bulleted list (3-5 main points).';
                break;
        }

        const systemPrompt = `You are an expert summarizer. ${lengthInstruction} Focus on the main ideas and key information. Return only the summary.`;
        
        let summary;
        if (window.LumenAI && window.LumenAI.callGeminiText) {
            summary = await window.LumenAI.callGeminiText(systemPrompt + "\n\nCONTENT TO SUMMARIZE:\n" + pageContent);
        } else if (typeof callGeminiText !== 'undefined') {
            summary = await callGeminiText(systemPrompt + "\n\nCONTENT TO SUMMARIZE:\n" + pageContent);
        } else {
            throw new Error('AI functions not available');
        }
        
        let formattedSummary = summary;
        if (length === 'bullet') {
            formattedSummary = summary.replace(/\n/g, '<br>');
        }

        showLumenModal('Lumen: Summary Generated', `
            <h3>Page Summary</h3>
            <div style="max-height: 300px; overflow-y: auto; border: 1px solid #ddd; padding: 10px; border-radius: 4px; background: #f9f9f9; line-height: 1.5;">
                ${formattedSummary}
            </div>
        `);
        
    } catch (error) {
        showLumenModal('Lumen AI Error', `Failed to generate summary: ${error.message}`);
    }
}

async function runAIReadAloud(voice) {
    if (isReadingAloud) {
        // If already reading, stop it
        window.speechSynthesis.cancel();
        isReadingAloud = false;
        showProgressNotification('🔇 Reading stopped', 'info');
        return;
    }
    
    try {
        const pageContent = extractPageContent();
        if (!pageContent || pageContent.length < 50) {
            throw new Error('Not enough content found on this page to read aloud.');
        }

        // Use browser TTS directly
        if ('speechSynthesis' in window) {
            // Stop any current speech
            window.speechSynthesis.cancel();
            
            // Create utterance with limited text for better performance
            const shortContent = pageContent.substring(0, 2000); // Increased limit
            const utterance = new SpeechSynthesisUtterance(shortContent);
            
            // Configure voice settings
            utterance.rate = 0.8;
            utterance.pitch = 1;
            utterance.volume = 1;
            
            // Try to find a suitable voice
            const voices = speechSynthesis.getVoices();
            let selectedVoice = null;
            
            // Map our voice names to browser voice characteristics
            const voiceMapping = {
                'Kore': ['female', 'google', 'english', 'karen', 'samantha'],
                'Puck': ['male', 'english', 'us', 'alex', 'daniel'],
                'Zephyr': ['female', 'english', 'uk', 'victoria', 'kate'],
                'Charon': ['male', 'english', 'us', 'fred', 'thomas']
            };
            
            if (voices.length > 0) {
                const voicePrefs = voiceMapping[voice] || voiceMapping['Kore'];
                selectedVoice = voices.find(voiceObj => 
                    voicePrefs.some(pref => 
                        voiceObj.name.toLowerCase().includes(pref.toLowerCase()) ||
                        voiceObj.lang.toLowerCase().includes(pref.toLowerCase())
                    )
                ) || voices[0]; // Fallback to first available voice
                
                if (selectedVoice) {
                    utterance.voice = selectedVoice;
                }
            }
            
            isReadingAloud = true;
            const progressNotification = showProgressNotification(`🔊 Reading page content with ${voice} voice... Click stop in popup to cancel.`);
            
            // Add event listeners for speech control
            utterance.onend = () => {
                isReadingAloud = false;
                if (progressNotification.parentElement) {
                    progressNotification.textContent = '✅ Finished reading page content';
                    progressNotification.style.background = '#28a745';
                    setTimeout(() => progressNotification.remove(), 3000);
                }
            };
            
            utterance.onerror = (event) => {
                isReadingAloud = false;
                if (progressNotification.parentElement) {
                    progressNotification.textContent = '❌ Error reading aloud';
                    progressNotification.style.background = '#dc3545';
                    setTimeout(() => progressNotification.remove(), 3000);
                }
                console.error('Speech synthesis error:', event);
            };
            
            // Start speaking
            window.speechSynthesis.speak(utterance);
            
        } else {
            throw new Error('Text-to-speech is not supported by your browser.');
        }
        
    } catch (error) {
        showProgressNotification(`❌ Failed to read aloud: ${error.message}`, 'error');
        isReadingAloud = false;
    }
}

// Helper function to extract main content from page
function extractPageContent() {
    // Try to get the main content first
    const mainSelectors = [
        'main', 'article', '.content', '#content', '.post-content', 
        '.entry-content', '.story-content', '.article-content', '.page-content'
    ];
    
    let mainElement = null;
    for (const selector of mainSelectors) {
        mainElement = document.querySelector(selector);
        if (mainElement) break;
    }
    
    // If no main content found, use body but exclude navigation and other non-content elements
    if (!mainElement) {
        mainElement = document.body;
    }
    
    // Clone to avoid modifying the original
    const contentElement = mainElement.cloneNode(true);
    
    // Remove unwanted elements
    const unwantedSelectors = [
        'nav', 'header', 'footer', 'aside', '.navigation', '.menu', 
        '.sidebar', '.ad', '.advertisement', 'script', 'style', '.social',
        '.comments', '.related', '.share', '.newsletter', '.popup'
    ];
    
    unwantedSelectors.forEach(selector => {
        contentElement.querySelectorAll(selector).forEach(el => el.remove());
    });
    
    return contentElement.textContent.trim().replace(/\s+/g, ' ');
}

// --- 3. Toggled Feature Implementations ---

function applyClassToBody(className, enabled) {
    document.body.classList.toggle(className, enabled);
}

function applyClassToHtml(className, enabled) {
    document.documentElement.classList.toggle(className, enabled);
}

async function adjustFontSize(direction) {
    const storageKey = 'lumen-font-scale';
    let { [storageKey]: currentScale = DEFAULT_FONT_SCALE } = await chrome.storage.local.get(storageKey);
    let newScale;

    if (direction === 'increase') {
        newScale = Math.min(MAX_FONT_SCALE, currentScale + FONT_SCALE_STEP);
    } else if (direction === 'decrease') {
        newScale = Math.max(MIN_FONT_SCALE, currentScale - FONT_SCALE_STEP);
    } else { // Reset
        newScale = DEFAULT_FONT_SCALE;
    }

    document.documentElement.style.setProperty('--lumen-font-scale', newScale.toFixed(2));
    await chrome.storage.local.set({ [storageKey]: newScale });
}

function setupReadingGuide(enabled) {
    const guideId = 'lumen-reading-guide-overlay';
    readingGuideElement = document.getElementById(guideId);

    if (enabled && !readingGuideElement) {
        readingGuideElement = document.createElement('div');
        readingGuideElement.id = guideId;
        document.body.appendChild(readingGuideElement);
        document.addEventListener('mousemove', handleReadingGuideMove);
    } else if (!enabled && readingGuideElement) {
        document.removeEventListener('mousemove', handleReadingGuideMove);
        readingGuideElement.remove();
        readingGuideElement = null;
    }
}

function handleReadingGuideMove(e) {
    if (readingGuideElement) {
        readingGuideElement.style.top = `${e.clientY}px`;
    }
}

function addSkipLink() {
    if (document.getElementById('lumen-skip-link')) {
        document.getElementById('lumen-skip-link').focus();
        return; // Already added
    }

    const main = document.querySelector('main, [role="main"], article, #content, #main');
    if (main) {
        if (!main.id) main.id = 'lumen-main-content'; // Ensure main content has an ID
        
        const skipLink = document.createElement('a');
        skipLink.id = 'lumen-skip-link';
        skipLink.href = '#lumen-main-content';
        skipLink.textContent = 'Skip to Main Content';
        
        document.body.prepend(skipLink);
        skipLink.focus();
    } else {
        alert('Lumen could not find a "main" content area on this page.');
    }
}

function toggleVoiceControl(enabled) {
    if (enabled) {
        if (!voiceRecognition) {
            const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
            if (!SpeechRecognition) {
                alert('Speech Recognition is not supported by your browser.');
                return;
            }
            voiceRecognition = new SpeechRecognition();
            voiceRecognition.continuous = true; // Keep listening
            voiceRecognition.interimResults = false;
            voiceRecognition.lang = 'en-US';

            voiceRecognition.onresult = (event) => {
                const transcript = event.results[event.results.length - 1][0].transcript.trim().toLowerCase();
                console.log('Lumen Voice Command:', transcript);
                handleVoiceCommand(transcript);
            };

            voiceRecognition.onerror = (event) => {
                console.error('Lumen Voice Error:', event.error);
                if(event.error === 'not-allowed' || event.error === 'service-not-allowed') {
                    alert('Lumen Voice Control: Please allow microphone access for this site.');
                    // Turn off the toggle
                    chrome.storage.local.set({ 'lumen-voice-control': false });
                    voiceRecognition = null;
                }
            };
            
            voiceRecognition.onend = () => {
                // Restart if it wasn't manually stopped
                chrome.storage.local.get('lumen-voice-control', data => {
                     if(data['lumen-voice-control'] && voiceRecognition) {
                        try {
                            voiceRecognition.start();
                        } catch(e) { /* Already started */ }
                     }
                });
            };
        }
        try {
             voiceRecognition.start();
        } catch(e) {
            // Fails if already started
        }
    } else {
        if (voiceRecognition) {
            voiceRecognition.stop();
            voiceRecognition = null;
        }
    }
}

function handleVoiceCommand(command) {
    if (command.includes('scroll down')) {
        window.scrollBy(0, window.innerHeight * 0.8);
    } else if (command.includes('scroll up')) {
        window.scrollBy(0, -window.innerHeight * 0.8);
    } else if (command.includes('go to top')) {
        window.scrollTo(0, 0);
    } else if (command.includes('go to bottom')) {
        window.scrollTo(0, document.body.scrollHeight);
    } else if (command.includes('focus mode') || command.includes('reader mode')) {
        toggleFocusMode(true);
        chrome.storage.local.set({ 'lumen-focus-mode': true });
    } else if (command.includes('exit focus') || command.includes('close reader')) {
        toggleFocusMode(false);
         chrome.storage.local.set({ 'lumen-focus-mode': false });
    } else if (command.includes('stop listening') || command.includes('voice off')) {
         toggleVoiceControl(false);
         chrome.storage.local.set({ 'lumen-voice-control': false });
    }
}

function toggleFocusMode(enabled) {
    if (enabled) {
        if (focusOverlay) return; // Already on

        let article;
        // Simple heuristic to find main content
        const selectors = ['article', 'main', '.post-content', '.entry-content', '#main-content', '#content', '.main'];
        for(const selector of selectors) {
            article = document.querySelector(selector);
            if(article) break;
        }
        
        // Fallback: find the largest text container if no semantic tag
        if(!article) {
            let maxScore = 0;
            document.querySelectorAll('div, section').forEach(el => {
                // Basic check to avoid nav/footers
                const classOrId = (el.id + el.className).toLowerCase();
                if (classOrId.includes('nav') || classOrId.includes('footer') || classOrId.includes('header') || classOrId.includes('sidebar')) {
                    return;
                }
                const score = el.innerText.length;
                if(score > 1000 && score > maxScore) { // At least 1000 chars
                    maxScore = score;
                    article = el;
                }
            });
        }
        
        if (!article) {
            alert("Lumen couldn't find the main content to focus on.");
            // Ensure toggle is reset
            chrome.storage.local.set({ 'lumen-focus-mode': false });
            return;
        }

        focusOverlay = document.createElement('div');
        focusOverlay.id = 'lumen-focus-overlay';
        
        const content = document.createElement('div');
        content.id = 'lumen-focus-content';
        content.innerHTML = article.innerHTML; // Clone content
        
        const tools = document.createElement('div');
        tools.id = 'lumen-focus-tools';
        
        pomodoroTimerElement = document.createElement('div');
        pomodoroTimerElement.id = 'lumen-pomodoro-timer';
        
        const closeBtn = document.createElement('button');
        closeBtn.id = 'lumen-focus-close';
        closeBtn.innerHTML = '&times; Exit Focus';
        closeBtn.onclick = () => toggleFocusMode(false);
        
        tools.appendChild(pomodoroTimerElement);
        tools.appendChild(closeBtn);
        focusOverlay.appendChild(tools);
        focusOverlay.appendChild(content);
        document.body.appendChild(focusOverlay);
        document.body.classList.add('lumen-no-scroll');
        
        startPomodoro();
    } else {
        if (focusOverlay) {
            focusOverlay.remove();
            focusOverlay = null;
        }
        if (pomodoroInterval) {
            clearInterval(pomodoroInterval);
            pomodoroInterval = null;
        }
        document.body.classList.remove('lumen-no-scroll');
        // Update the toggle state in storage
        chrome.storage.local.set({ 'lumen-focus-mode': false });
    }
}

async function startPomodoro() {
    const { pomodoroWork = 25, pomodoroBreak = 5 } = await chrome.storage.sync.get(['pomodoroWork', 'pomodoroBreak']);
    let isWork = true;
    let time = pomodoroWork * 60; // in seconds

    function updateTimer() {
        const minutes = Math.floor(time / 60);
        const seconds = time % 60;
        if(pomodoroTimerElement) {
             pomodoroTimerElement.textContent = `${isWork ? 'Work' : 'Break'}: ${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
        }
        
        if (time === 0) {
            isWork = !isWork;
            time = (isWork ? pomodoroWork : pomodoroBreak) * 60;
            // Play a sound
            new Audio('https://actions.google.com/sounds/v1/alarms/alarm_clock.ogg').play();
        } else {
            time--;
        }
    }

    if (pomodoroInterval) clearInterval(pomodoroInterval);
    updateTimer(); // Run once immediately
    pomodoroInterval = setInterval(updateTimer, 1000);
}

// --- 4. Message Listener & Initialization ---

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    // Ping to check if script is active
    if (request.action === "ping") {
        sendResponse({ status: "ready" });
        return true;
    }
    
    // Voice status check
    if(request.action === "getVoiceStatus") {
        sendResponse({ listening: !!voiceRecognition });
        return true;
    }

    // AI Actions
    if (request.action === "runSummarize") {
        runSummarize(request.text);
    } else if (request.action === "runSimplify") {
        runSimplify(request.text);
    } else if (request.action === "runTranslatePage") {
        runTranslatePage(request.lang);
    } else if (request.action === "runImageDescription") {
        runImageDescription(request.srcUrl);
    }

    // NEW AI Feature Handlers
    if (request.action === "runAITranslatePage") {
        runAITranslatePage(request.language);
    } else if (request.action === "runAISummarizePage") {
        runAISummarizePage(request.length);
    } else if (request.action === "runAIReadAloud") {
        runAIReadAloud(request.voice);
    }

    // Toggle Actions
    else if (request.action === "toggleFeature") {
        const { key, value } = request;
        
        // Handle HTML element filters
        if (key.includes('protanopia') || key.includes('deuteranopia') || key.includes('tritanopia') || key.includes('grayscale') || key.includes('high-contrast')) {
            applyClassToHtml(key, value);
        } 
        // Handle BODY element features
        else if (key === 'lumen-reading-guide') {
            setupReadingGuide(value);
        } else if (key === 'lumen-focus-mode') {
            toggleFocusMode(value);
        } else if (key === 'lumen-voice-control') {
            toggleVoiceControl(value);
        } else {
            // This handles all other CSS-based toggles:
            // dyslexia, seizure-protect, focus-ring, enlarge-targets
            applyClassToBody(key, value);
        }
    }

    // Font Size
    else if (request.action === "adjustFontSize") {
        adjustFontSize(request.value);
    }
    
    // Utility Actions
    else if (request.action === "addSkipLink") {
        addSkipLink();
    }
    
    sendResponse({ status: 'received' });
    return true; // Keep message port open for async response
});

// Load initial settings on page load
async function initializeSettings() {
    const settings = await chrome.storage.local.get(null);
    for (const key in settings) {
        if (key.startsWith('lumen-')) {
             if (key.includes('protanopia') || key.includes('deuteranopia') || key.includes('tritanopia') || key.includes('grayscale') || key.includes('high-contrast')) {
                applyClassToHtml(key, settings[key]);
            } else if (key === 'lumen-reading-guide') {
                setupReadingGuide(settings[key]);
            } else if (key === 'lumen-focus-mode' || key === 'lumen-voice-control') {
                // Don't auto-start these active modes on page load
                await chrome.storage.local.set({ [key]: false });
            } else if (key === 'lumen-font-scale') {
                 // Special handling for font scale
                const scale = settings[key] || DEFAULT_FONT_SCALE;
                document.documentElement.style.setProperty('--lumen-font-scale', scale.toFixed(2));
            } else {
                applyClassToBody(key, settings[key]);
            }
        }
    }
}

// Start initialization
initializeSettings();