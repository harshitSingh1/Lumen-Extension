// --- Lumen Background Service Worker ---

// 1. On Install: Show Onboarding & Setup Context Menus
chrome.runtime.onInstalled.addListener((details) => {
    if (details.reason === 'install') {
        chrome.tabs.create({ url: 'onboarding/onboarding.html' });
        // Set default settings
        chrome.storage.sync.set({
            blockedSites: ['twitter.com', 'youtube.com', 'facebook.com', 'reddit.com'],
            pomodoroWork: 25,
            pomodoroBreak: 5,
        });
        // Set default local settings
        chrome.storage.local.set({
            'lumen-font-scale': 1.0
        });
    }

    // --- Context Menu Setup ---
    chrome.contextMenus.removeAll(() => {
        // --- AI Image Description ---
        chrome.contextMenus.create({
            id: "lumen-describe-image",
            title: "Lumen: Describe this image (AI)",
            contexts: ["image"]
        });
        
        // --- AI Text Analysis ---
        chrome.contextMenus.create({
            id: "lumen-summarize",
            title: "Lumen: Summarize selected text (AI)",
            contexts: ["selection"]
        });
        chrome.contextMenus.create({
            id: "lumen-simplify",
            title: "Lumen: Simplify selected text (AI)",
            contexts: ["selection"]
        });

        // --- AI Page Actions ---
         chrome.contextMenus.create({
            id: "lumen-translate-page-es",
            title: "Lumen: Translate entire page to Spanish (AI)",
            contexts: ["all"]
        });
        chrome.contextMenus.create({
            id: "lumen-translate-page-fr",
            title: "Lumen: Translate entire page to French (AI)",
            contexts: ["all"]
        });

        // --- Accessibility ---
        chrome.contextMenus.create({
            id: "lumen-tts",
            title: "Lumen: Read selected text (Browser TTS)",
            contexts: ["selection"]
        });
    });
});

// 2. Helper: Ensure Content Script is Injected
async function ensureScripting(tabId) {
     try {
        // Ping the tab to see if the content script is already there
        await chrome.tabs.sendMessage(tabId, { action: "ping" });
    } catch (e) {
        // Failed to connect, script isn't injected
        console.log("Lumen: Content script not found, injecting...");
        await chrome.scripting.executeScript({
            target: { tabId: tabId },
            files: ["gemini-api.js", "content.js"]
        });
        await chrome.scripting.insertCSS({
            target: { tabId: tabId },
            files: ["assets/css/lumen-inject.css"]
        });
        // Wait a brief moment for scripts to load
        await new Promise(resolve => setTimeout(resolve, 500));
    }
}


// 3. Context Menu Click Handler
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
    if (!tab?.id || tab.url.startsWith("chrome://")) {
        console.log("Lumen: Cannot inject script on protected page.");
        return; 
    }
    
    // Ensure scripts are ready before sending a message
    await ensureScripting(tab.id);
    
    const { menuItemId, selectionText, srcUrl } = info;

    if (menuItemId === "lumen-tts") {
        chrome.tts.stop();
        chrome.tts.speak(selectionText || "No text selected.", { rate: 1.0 });
    } else if (menuItemId === "lumen-summarize") {
        chrome.tabs.sendMessage(tab.id, { action: "runSummarize", text: selectionText });
    } else if (menuItemId === "lumen-simplify") {
        chrome.tabs.sendMessage(tab.id, { action: "runSimplify", text: selectionText });
    } else if (menuItemId === "lumen-translate-page-es") {
        chrome.tabs.sendMessage(tab.id, { action: "runTranslatePage", lang: 'Spanish' });
    } else if (menuItemId === "lumen-translate-page-fr") {
        chrome.tabs.sendMessage(tab.id, { action: "runTranslatePage", lang: 'French' });
    } else if (menuItemId === "lumen-describe-image") {
        if (srcUrl) {
            chrome.tabs.sendMessage(tab.id, { action: "runImageDescription", srcUrl: srcUrl });
        }
    }
});

// Add this to the message listener in background.js
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'closeCurrentTab' && sender.tab) {
        chrome.tabs.remove(sender.tab.id);
    }
});

// 4. Distraction Blocker
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
    if (changeInfo.status !== 'loading' || !tab.url) return;

    const { blockedSites } = await chrome.storage.sync.get('blockedSites');
    if (!blockedSites || blockedSites.length === 0) return;

    try {
        const url = new URL(tab.url);
        // Clean the hostname to match storage format
        const cleanHostname = url.hostname.replace(/^www\./, '');
        
        const isBlocked = blockedSites.some(site => cleanHostname.includes(site));

        if (isBlocked) {
            chrome.tabs.update(tabId, {
                url: chrome.runtime.getURL('blocked.html')
            });
        }
    } catch (e) {
        // Ignore invalid URLs like chrome://
    }
});

