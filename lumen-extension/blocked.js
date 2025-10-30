// blocked.js - Handle blocked page interactions
document.addEventListener('DOMContentLoaded', () => {
    const goBackBtn = document.getElementById('go-back-btn');
    const closeTabBtn = document.getElementById('close-tab-btn');

    // Go back to previous page
    goBackBtn.addEventListener('click', () => {
        window.history.back();
    });

    // Close current tab
    closeTabBtn.addEventListener('click', () => {
        chrome.runtime.sendMessage({ action: 'closeCurrentTab' });
    });
});

// Listen for messages from background script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'closeTab') {
        window.close();
    }
});