// --- Popup Logic ---

// Helper to get the active tab
async function getActiveTab() {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    return tabs[0];
}

// Send a message to the content script
async function sendMessage(tabId, message) {
    try {
        await chrome.tabs.sendMessage(tabId, message);
    } catch (error) {
        // Suppress common error when script isn't injected yet or page is protected
        if (!error.message.includes("Receiving end does not exist") && !error.message.includes("Cannot access")) {
             console.warn("Lumen: Could not send message.", error.message);
        }
    }
}

// Load settings from storage and update the UI
async function loadSettings() {
    const settings = await chrome.storage.local.get(null);
    document.querySelectorAll('.control-item').forEach(item => {
        const key = item.dataset.setting;
        const input = item.querySelector('input[type="checkbox"]');
        if (input && key) {
            input.checked = !!settings[key];
        }
    });
}

// Attach event listeners
function attachEventListeners() {
    const tabPromise = getActiveTab();

    // --- Tab Switching ---
    const tabButtons = document.querySelectorAll('.tab-btn');
    const tabPanels = document.querySelectorAll('.tab-panel');
    tabButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            tabButtons.forEach(b => b.classList.remove('active'));
            tabPanels.forEach(p => p.classList.remove('active'));
            btn.classList.add('active');
            const tabPanel = document.getElementById(btn.dataset.tab);
            if (tabPanel) {
                tabPanel.classList.add('active');
            }
        });
    });

    // --- Settings Button ---
    document.getElementById('btn-settings')?.addEventListener('click', () => {
        chrome.runtime.openOptionsPage();
    });

    // --- Utility Buttons ---
     document.getElementById('btn-skip-link')?.addEventListener('click', async () => {
        const tab = await tabPromise;
        if (tab?.id) sendMessage(tab.id, { action: "addSkipLink" });
        window.close();
    });

    // --- Font Size Controls ---
    document.getElementById('btn-font-dec')?.addEventListener('click', async () => {
        const tab = await tabPromise;
        if (tab?.id) sendMessage(tab.id, { action: "adjustFontSize", value: 'decrease' });
    });
    document.getElementById('btn-font-reset')?.addEventListener('click', async () => {
        const tab = await tabPromise;
        if (tab?.id) sendMessage(tab.id, { action: "adjustFontSize", value: 'reset' });
    });
    document.getElementById('btn-font-inc')?.addEventListener('click', async () => {
        const tab = await tabPromise;
        if (tab?.id) sendMessage(tab.id, { action: "adjustFontSize", value: 'increase' });
    });

    // --- All Toggles ---
    document.querySelectorAll('.control-item input[type="checkbox"]').forEach(input => {
        input.addEventListener('change', async (e) => {
            const tab = await tabPromise;
            if (!tab?.id) return;
            
            const enabled = e.target.checked;
            const key = e.target.id.replace('toggle-', 'lumen-');
            
            // Special case for color filters (radio button behavior)
            if (e.target.name === 'color-filter') {
                // Uncheck all other filters
                document.querySelectorAll('input[name="color-filter"]').forEach(async otherInput => {
                    if (otherInput !== e.target) {
                        if (otherInput.checked) {
                            otherInput.checked = false;
                            const otherKey = otherInput.id.replace('toggle-', 'lumen-');
                            await chrome.storage.local.set({ [otherKey]: false });
                            sendMessage(tab.id, { action: "toggleFeature", key: otherKey, value: false });
                        }
                    }
                });
            }

            // Save state and send message
            await chrome.storage.local.set({ [key]: enabled });
            sendMessage(tab.id, { action: "toggleFeature", key: key, value: enabled });

            // Close popup for instant-action items
            if (key === 'lumen-focus-mode' || key === 'lumen-voice-control') {
                window.close();
            }
        });
    });
}

// AI Feature Handlers
function attachAIEventListeners() {
    const tabPromise = getActiveTab();

    // Translate Page - Updated for direct page translation
    document.getElementById('btn-translate-page')?.addEventListener('click', async () => {
        const tab = await tabPromise;
        if (!tab?.id) return;
        
        const language = document.getElementById('ai-target-language').value;
        const button = document.getElementById('btn-translate-page');
        
        button.disabled = true;
        const originalText = button.textContent;
        button.textContent = 'Translating...';
        
        try {
            await sendMessage(tab.id, { 
                action: "runAITranslatePage", 
                language: language 
            });
            
            // Show success message and reset button after a delay
            setTimeout(() => {
                button.textContent = '✅ Translated!';
                setTimeout(() => {
                    button.disabled = false;
                    button.textContent = originalText;
                }, 2000);
            }, 1000);
            
        } catch (error) {
            console.error('Translation failed:', error);
            button.textContent = '❌ Failed';
            setTimeout(() => {
                button.disabled = false;
                button.textContent = originalText;
            }, 2000);
        }
        
        // Don't close popup - let user see the translation progress
    });

    // Summarize Page - Still shows modal
    document.getElementById('btn-summarize-page')?.addEventListener('click', async () => {
        const tab = await tabPromise;
        if (!tab?.id) return;
        
        const length = document.getElementById('ai-summary-length').value;
        const button = document.getElementById('btn-summarize-page');
        
        button.disabled = true;
        const originalText = button.textContent;
        button.textContent = 'Summarizing...';
        
        try {
            await sendMessage(tab.id, { 
                action: "runAISummarizePage", 
                length: length 
            });
            
            // Reset button after a short delay
            setTimeout(() => {
                button.disabled = false;
                button.textContent = originalText;
            }, 1000);
            
        } catch (error) {
            console.error('Summarization failed:', error);
            button.textContent = '❌ Failed';
            setTimeout(() => {
                button.disabled = false;
                button.textContent = originalText;
            }, 2000);
        }
        
        // Close popup for summary since it shows a modal
        window.close();
    });

    // Read Aloud - Updated for direct page reading
    document.getElementById('btn-read-page')?.addEventListener('click', async () => {
        const tab = await tabPromise;
        if (!tab?.id) return;
        
        const voice = document.getElementById('ai-tts-voice').value;
        const button = document.getElementById('btn-read-page');
        
        // Toggle behavior - click again to stop
        if (button.classList.contains('reading-active')) {
            // Stop reading
            button.disabled = true;
            button.textContent = 'Stopping...';
            
            try {
                await sendMessage(tab.id, { 
                    action: "runAIReadAloud", 
                    voice: voice 
                });
                
                setTimeout(() => {
                    button.disabled = false;
                    button.textContent = 'Read Page Aloud';
                    button.classList.remove('reading-active');
                }, 500);
                
            } catch (error) {
                console.error('Stop reading failed:', error);
                button.disabled = false;
                button.textContent = 'Read Page Aloud';
                button.classList.remove('reading-active');
            }
        } else {
            // Start reading
            button.disabled = true;
            const originalText = button.textContent;
            button.textContent = 'Starting...';
            
            try {
                await sendMessage(tab.id, { 
                    action: "runAIReadAloud", 
                    voice: voice 
                });
                
                // Update button to show stop option
                setTimeout(() => {
                    button.disabled = false;
                    button.textContent = '🛑 Stop Reading';
                    button.classList.add('reading-active');
                }, 1000);
                
            } catch (error) {
                console.error('Read aloud failed:', error);
                button.textContent = '❌ Failed';
                setTimeout(() => {
                    button.disabled = false;
                    button.textContent = originalText;
                }, 2000);
            }
        }
        
        // Don't close popup - let user control reading
    });

    // Add CSS for the reading-active state
    const style = document.createElement('style');
    style.textContent = `
        .reading-active {
            background: #dc3545 !important;
        }
        .reading-active:hover {
            background: #c82333 !important;
        }
    `;
    document.head.appendChild(style);
}

// Check if content script is ready and update button states
async function checkContentScriptStatus() {
    const tab = await getActiveTab();
    if (!tab?.id) return;

    try {
        // Try to ping the content script
        const status = await chrome.tabs.sendMessage(tab.id, { action: "ping" });
        if (status && status.status === "ready") {
            // Content script is ready, enable AI buttons
            document.querySelectorAll('.ai-action-btn').forEach(btn => {
                btn.disabled = false;
            });
            
            // Check voice status
            const voiceStatus = await chrome.tabs.sendMessage(tab.id, { action: "getVoiceStatus" });
            if (voiceStatus && voiceStatus.listening) {
                const statusEl = document.getElementById('voice-status');
                if(statusEl) statusEl.textContent = " (On)";
                const toggle = document.getElementById('toggle-voice-control');
                if(toggle) toggle.checked = true;
            }
        }
    } catch (error) {
        // Content script not ready, disable AI buttons
        console.log('Content script not ready, disabling AI features');
        document.querySelectorAll('.ai-action-btn').forEach(btn => {
            btn.disabled = true;
            btn.title = 'Please refresh the page and try again';
        });
    }
}

// Update button states based on current page activity
async function updateButtonStates() {
    const tab = await getActiveTab();
    if (!tab?.id) return;

    try {
        // Check if reading is currently active
        const readButton = document.getElementById('btn-read-page');
        if (readButton) {
            // We can't directly check if reading is active, but we can update the button
            // based on whether it has the reading-active class
            if (!readButton.classList.contains('reading-active')) {
                readButton.textContent = 'Read Page Aloud';
                readButton.classList.remove('reading-active');
            }
        }
    } catch (error) {
        // Ignore errors
    }
}

// Main initialization
document.addEventListener('DOMContentLoaded', async () => {
    await loadSettings();
    attachEventListeners();
    attachAIEventListeners();
    
    // Check content script status and update UI
    await checkContentScriptStatus();
    await updateButtonStates();
    
    // Set up periodic status checks
    setInterval(updateButtonStates, 2000);
});

// Prevent popup from closing when clicking inside
document.addEventListener('click', (e) => {
    e.stopPropagation();
});

// Only close when explicitly clicking close buttons or similar
document.addEventListener('mousedown', (e) => {
    // Allow normal closing behavior for the modal close button and similar elements
    if (e.target.closest('#lumen-modal-close') || 
        e.target.closest('.tab-btn') ||
        e.target.closest('input[type="checkbox"]')) {
        return;
    }
    
    // For other clicks inside the popup, prevent the default closing behavior
    e.stopPropagation();
});