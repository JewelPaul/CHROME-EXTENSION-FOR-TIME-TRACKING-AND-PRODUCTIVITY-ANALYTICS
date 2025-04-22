// Debug script for TimeTrack Pro

// Global variables
let trackingData = null;
let updateInterval = null;

document.addEventListener('DOMContentLoaded', function() {
  // Load initial data
  refreshStatus();
  loadTodayData();
  
  // Set up auto-refresh
  updateInterval = setInterval(refreshStatus, 1000);
  
  // Set up button event listeners
  document.getElementById('refresh-status-btn').addEventListener('click', function() {
    refreshStatus();
    loadTodayData();
  });
  
  document.getElementById('force-update-btn').addEventListener('click', function() {
    forceUpdate();
  });
  
  document.getElementById('reset-today-btn').addEventListener('click', function() {
    if (confirm('Are you sure you want to reset today\'s tracking data? This cannot be undone.')) {
      resetTodayData();
    }
  });
  
  document.getElementById('clear-storage-btn').addEventListener('click', function() {
    if (confirm('WARNING: This will delete ALL tracking data. This action cannot be undone. Continue?')) {
      clearAllStorage();
    }
  });
  
  document.getElementById('back-btn').addEventListener('click', function() {
    chrome.tabs.create({ url: 'dashboard.html' });
    window.close();
  });
});

// Refresh the current tracking status
function refreshStatus() {
  // Get current tracking status
  chrome.runtime.sendMessage({ action: 'getCurrentStatus' }, function(response) {
    const statusElement = document.getElementById('tracking-status');
    
    if (response) {
      const now = new Date();
      let statusHtml = '';
      
      statusHtml += `<div class="log-entry">
        <span class="timestamp">${now.toLocaleTimeString()}</span><br>
        <strong>Is Tracking:</strong> ${response.isTracking ? 'Yes' : 'No'}<br>
      `;
      
      if (response.currentUrl) {
        statusHtml += `<strong>Current URL:</strong> ${response.currentUrl}<br>`;
        
        try {
          const domain = extractDomain(response.currentUrl);
          statusHtml += `<strong>Domain:</strong> ${domain}<br>`;
        } catch (e) {
          statusHtml += `<strong>Domain:</strong> Error parsing domain<br>`;
        }
      }
      
      if (response.startTime) {
        const startTime = new Date(response.startTime);
        const elapsedMs = now - startTime;
        const elapsedSec = Math.floor(elapsedMs / 1000);
        
        statusHtml += `<strong>Start Time:</strong> ${startTime.toLocaleTimeString()}<br>`;
        statusHtml += `<strong>Elapsed Time:</strong> ${formatTime(elapsedSec)}<br>`;
      }
      
      statusHtml += '</div>';
      
      // Prepend to existing content (limit to 10 entries)
      const existingContent = statusElement.innerHTML === 'Loading...' ? '' : statusElement.innerHTML;
      const entries = existingContent.split('<div class="log-entry">').filter(entry => entry.trim());
      
      if (entries.length >= 10) {
        entries.pop(); // Remove oldest entry
      }
      
      statusElement.innerHTML = statusHtml + existingContent;
    } else {
      statusElement.textContent = 'Error getting tracking status';
    }
  });
}

// Load today's tracking data
function loadTodayData() {
  chrome.runtime.sendMessage({ action: 'getTrackingData' }, function(response) {
    const dataElement = document.getElementById('today-data');
    
    if (response && response.trackingData) {
      trackingData = response.trackingData;
      const todayData = trackingData.today;
      
      if (Object.keys(todayData).length === 0) {
        dataElement.textContent = 'No data recorded today';
      } else {
        // Sort domains by time spent
        const sortedDomains = Object.keys(todayData).sort((a, b) => todayData[b] - todayData[a]);
        
        let dataHtml = '';
        let totalTime = 0;
        
        sortedDomains.forEach(domain => {
          const timeSpent = todayData[domain];
          totalTime += timeSpent;
          
          let category = 'neutral';
          if (trackingData.categories.productive.some(d => domain.includes(d))) {
            category = 'productive';
          } else if (trackingData.categories.unproductive.some(d => domain.includes(d))) {
            category = 'unproductive';
          }
          
          dataHtml += `<div class="log-entry">
            <strong>${domain}</strong> (${category}): ${formatTime(timeSpent)}
          </div>`;
        });
        
        dataHtml = `<div class="log-entry"><strong>Total Time:</strong> ${formatTime(totalTime)}</div>` + dataHtml;
        dataElement.innerHTML = dataHtml;
      }
    } else {
      dataElement.textContent = 'Error loading tracking data';
    }
  });
}

// Force an update of the current tracking session
function forceUpdate() {
  chrome.runtime.sendMessage({ action: 'forceUpdate' }, function(response) {
    refreshStatus();
    loadTodayData();
    
    // Show a brief success message
    alert('Forced update completed');
  });
}

// Reset today's tracking data
function resetTodayData() {
  chrome.runtime.sendMessage({ action: 'resetData', scope: 'today' }, function(response) {
    if (response && response.success) {
      loadTodayData();
      alert('Today\'s data has been reset');
    }
  });
}

// Clear all storage data
function clearAllStorage() {
  chrome.runtime.sendMessage({ action: 'resetData', scope: 'all' }, function(response) {
    if (response && response.success) {
      chrome.storage.local.clear(function() {
        loadTodayData();
        alert('All storage has been cleared');
      });
    }
  });
}

// Format seconds into a human-readable time string
function formatTime(seconds) {
  if (seconds < 60) {
    return seconds + ' sec';
  } else if (seconds < 3600) {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes} min ${remainingSeconds} sec`;
  } else {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const remainingSeconds = seconds % 60;
    return `${hours} hr ${minutes} min ${remainingSeconds} sec`;
  }
}

// Extract domain from URL
function extractDomain(url) {
  if (!url) return null;
  
  const urlObj = new URL(url);
  let domain = urlObj.hostname;
  
  // Remove www. prefix if present
  if (domain.startsWith('www.')) {
    domain = domain.substring(4);
  }
  
  return domain;
}
