// --- Options Page Logic - Enhanced ---

document.addEventListener('DOMContentLoaded', () => {
    const blockedSitesInput = document.getElementById('blocked-sites');
    const saveSitesBtn = document.getElementById('save-sites');
    const workInput = document.getElementById('pomodoro-work');
    const breakInput = document.getElementById('pomodoro-break');
    const savePomodoroBtn = document.getElementById('save-pomodoro');

    // Create status element
    const statusEl = document.createElement('div');
    statusEl.id = 'save-status';
    statusEl.style.display = 'none';
    document.querySelector('main').appendChild(statusEl);

    // Load existing settings
    chrome.storage.sync.get(null, (data) => {
        if (data.blockedSites) {
            blockedSitesInput.value = data.blockedSites.join('\n');
        }
        if (data.pomodoroWork) {
            workInput.value = data.pomodoroWork;
        }
        if (data.pomodoroBreak) {
            breakInput.value = data.pomodoroBreak;
        }
    });

    // Save Blocked Sites
    saveSitesBtn.addEventListener('click', () => {
        const sites = blockedSitesInput.value.split('\n')
            .map(s => s.trim().replace(/^https?:\/\//, '').replace(/^www\./, ''))
            .filter(s => s.length > 0);

        if (sites.length === 0) {
            showStatus('Please enter at least one website to block.', 'error');
            return;
        }

        chrome.storage.sync.set({ blockedSites: sites }, () => {
            showStatus(`✅ ${sites.length} website(s) blocked successfully!`, 'success');
        });
    });

    // Save Pomodoro Settings
    savePomodoroBtn.addEventListener('click', () => {
        const work = parseInt(workInput.value, 10);
        const breakTime = parseInt(breakInput.value, 10);

        if (work < 1 || breakTime < 1) {
            showStatus('Please enter valid time values (minimum 1 minute).', 'error');
            return;
        }

        if (work > 120 || breakTime > 60) {
            showStatus('Work time should be ≤ 120 minutes, break time ≤ 60 minutes.', 'error');
            return;
        }

        chrome.storage.sync.set({ 
            pomodoroWork: work, 
            pomodoroBreak: breakTime 
        }, () => {
            showStatus('✅ Pomodoro timer settings saved!', 'success');
        });
    });

    // Show status message
    function showStatus(message, type = 'success') {
        statusEl.textContent = message;
        statusEl.style.display = 'block';
        
        if (type === 'error') {
            statusEl.style.background = 'rgba(220, 53, 69, 0.1)';
            statusEl.style.border = '1px solid rgba(220, 53, 69, 0.2)';
            statusEl.style.color = '#dc3545';
        } else {
            statusEl.style.background = 'rgba(40, 167, 69, 0.1)';
            statusEl.style.border = '1px solid rgba(40, 167, 69, 0.2)';
            statusEl.style.color = '#28a745';
        }

        // Auto-hide after 4 seconds
        setTimeout(() => {
            statusEl.style.display = 'none';
        }, 4000);
    }

    // Add input validation
    [workInput, breakInput].forEach(input => {
        input.addEventListener('input', (e) => {
            const value = parseInt(e.target.value, 10);
            if (value < 1) e.target.value = 1;
            if (e.target.id === 'pomodoro-work' && value > 120) e.target.value = 120;
            if (e.target.id === 'pomodoro-break' && value > 60) e.target.value = 60;
        });
    });
});