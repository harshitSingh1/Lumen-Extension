document.addEventListener('DOMContentLoaded', () => {
    const button = document.getElementById('get-started-btn');
    
    // When the user clicks the button, just close the current tab.
    button?.addEventListener('click', () => {
        chrome.tabs.getCurrent((tab) => {
            if (tab?.id) {
                chrome.tabs.remove(tab.id);
            }
        });
    });
});
