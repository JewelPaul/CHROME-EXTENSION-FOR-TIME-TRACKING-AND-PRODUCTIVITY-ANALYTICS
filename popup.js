// Popup script for TimeTrack Pro

// Global variable to store tracking data
let trackingData = null;

document.addEventListener('DOMContentLoaded', function() {
  // Load tracking data from background script
  loadTrackingData();

  // Set up real-time updates
  setupRealTimeUpdates();

  // Set up button event listeners
  document.getElementById('dashboard-btn').addEventListener('click', function() {
    chrome.tabs.create({ url: 'dashboard.html' });
  });

  document.getElementById('settings-btn').addEventListener('click', function() {
    chrome.tabs.create({ url: 'options.html' });
  });

  // Add reset button functionality
  document.getElementById('reset-btn').addEventListener('click', function() {
    if (confirm('Are you sure you want to reset today\'s tracking data? This cannot be undone.')) {
      resetTodayData();
    }
  });
});

// Reset today's tracking data
function resetTodayData() {
  chrome.runtime.sendMessage({ action: 'resetData', scope: 'today' }, function(response) {
    if (response && response.success) {
      // Show a brief success message
      const container = document.querySelector('.container');
      const message = document.createElement('div');
      message.className = 'reset-message';
      message.textContent = 'Data reset successfully!';
      message.style.backgroundColor = '#4CAF50';
      message.style.color = 'white';
      message.style.padding = '10px';
      message.style.textAlign = 'center';
      message.style.borderRadius = '4px';
      message.style.marginBottom = '10px';
      message.style.fontWeight = 'bold';

      container.insertBefore(message, container.firstChild);

      // Remove the message after 2 seconds
      setTimeout(function() {
        container.removeChild(message);
      }, 2000);

      // Reload tracking data
      loadTrackingData();
    }
  });
}

// Load tracking data from background script
function loadTrackingData() {
  chrome.runtime.sendMessage({ action: 'getTrackingData' }, function(response) {
    if (response && response.trackingData) {
      trackingData = response.trackingData;
      updatePopupUI(trackingData);
    }
  });
}

// Set up real-time updates
function setupRealTimeUpdates() {
  // Listen for refresh messages from background script
  chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
    if (request.action === 'refreshPopupData') {
      loadTrackingData();
    }
    return true;
  });

  // Also set up a timer to refresh data every 2 seconds
  setInterval(loadTrackingData, 2000);
}

// Update the popup UI with tracking data
function updatePopupUI(trackingData) {
  const todayData = trackingData.today;
  const categories = trackingData.categories;

  // Update status indicator with current website
  updateStatusIndicator(trackingData.currentUrl);

  // Calculate time spent in each category
  let productiveTime = 0;
  let unproductiveTime = 0;
  let neutralTime = 0;

  for (const domain in todayData) {
    const timeSpent = todayData[domain];

    if (categories.productive.some(d => domain.includes(d))) {
      productiveTime += timeSpent;
    } else if (categories.unproductive.some(d => domain.includes(d))) {
      unproductiveTime += timeSpent;
    } else {
      neutralTime += timeSpent;
    }
  }

  // Calculate productivity score with a more balanced approach
  const totalTime = productiveTime + unproductiveTime + neutralTime;
  let productivityScore = 0;

  if (totalTime > 0) {
    // New formula: productive time percentage with neutral time weighted at 50%
    // This gives a more balanced score that doesn't penalize neutral activities as much
    const weightedNeutralTime = neutralTime * 0.5;
    const adjustedTotal = productiveTime + unproductiveTime + weightedNeutralTime;

    if (adjustedTotal > 0) {
      // Base score: productive time as percentage of adjusted total
      const baseScore = (productiveTime / adjustedTotal) * 100;

      // Bonus points for having more productive time than unproductive
      let bonusPoints = 0;
      if (productiveTime > unproductiveTime) {
        // Up to 10 bonus points based on the ratio of productive to unproductive time
        bonusPoints = Math.min(10, (productiveTime / Math.max(1, unproductiveTime)) * 5);
      }

      productivityScore = Math.round(baseScore + bonusPoints);

      // Cap at 100%
      productivityScore = Math.min(100, productivityScore);
    }
  }

  // Update UI elements
  document.getElementById('productivity-score').textContent = productivityScore + '%';
  document.getElementById('productive-time').textContent = formatTime(productiveTime);
  document.getElementById('unproductive-time').textContent = formatTime(unproductiveTime);
  document.getElementById('neutral-time').textContent = formatTime(neutralTime);

  // Update the color of the productivity score circle based on the score
  const scoreCircle = document.querySelector('.score-circle');
  if (productivityScore >= 70) {
    scoreCircle.style.backgroundColor = '#4CAF50'; // Green
  } else if (productivityScore >= 40) {
    scoreCircle.style.backgroundColor = '#FFC107'; // Yellow
  } else {
    scoreCircle.style.backgroundColor = '#F44336'; // Red
  }

  // Populate top sites list
  const topSitesList = document.getElementById('top-sites-list');
  topSitesList.innerHTML = '';

  // Sort domains by time spent
  const sortedDomains = Object.keys(todayData).sort((a, b) => todayData[b] - todayData[a]);

  // Display top 5 domains
  const topDomains = sortedDomains.slice(0, 5);

  if (topDomains.length === 0) {
    topSitesList.innerHTML = '<p class="no-data">No data available yet</p>';
  } else {
    topDomains.forEach(domain => {
      const timeSpent = todayData[domain];
      let categoryClass = 'neutral';
      let categoryIcon = 'question-circle';

      if (categories.productive.some(d => domain.includes(d))) {
        categoryClass = 'productive';
        categoryIcon = 'check-circle';
      } else if (categories.unproductive.some(d => domain.includes(d))) {
        categoryClass = 'unproductive';
        categoryIcon = 'times-circle';
      }

      const siteItem = document.createElement('div');
      siteItem.className = 'site-item';

      // Determine if this is a local file
      // Check if it has a file extension but not a domain TLD
      const isLocalFile = domain.includes('.') && !domain.match(/\.[a-z]{2,}$/i);

      // Choose appropriate icon
      let icon = categoryIcon;
      if (domain.endsWith('.pdf')) {
        icon = 'file-pdf';
      } else if (domain.match(/\.(doc|docx)$/i)) {
        icon = 'file-word';
      } else if (domain.match(/\.(xls|xlsx)$/i)) {
        icon = 'file-excel';
      } else if (domain.match(/\.(ppt|pptx)$/i)) {
        icon = 'file-powerpoint';
      } else if (domain.match(/\.(txt|rtf)$/i)) {
        icon = 'file-alt';
      } else if (isLocalFile) {
        icon = 'file';
      }

      // Truncate long filenames
      const displayDomain = domain.length > 25 ? domain.substring(0, 22) + '...' : domain;

      siteItem.innerHTML = `
        <div class="site-info">
          <i class="fas fa-${icon} ${categoryClass}-icon"></i>
          <span class="site-domain" title="${domain}">${displayDomain}</span>
        </div>
        <span class="site-time">${formatTime(timeSpent)}</span>
      `;

      topSitesList.appendChild(siteItem);
    });
  }
}

// Format seconds into a human-readable time string
function formatTime(seconds) {
  if (seconds < 60) {
    return seconds + 's';
  } else if (seconds < 3600) {
    return Math.floor(seconds / 60) + 'm';
  } else {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return hours + 'h ' + minutes + 'm';
  }
}

// Update the status indicator with the current website
function updateStatusIndicator(currentUrl) {
  const statusText = document.querySelector('.status-text');
  const statusDot = document.querySelector('.status-dot');
  const statusIndicator = document.querySelector('.status-indicator');

  if (currentUrl) {
    try {
      const domain = extractDomain(currentUrl);

      // Get the current active tab to verify we're showing the right info
      chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
        if (tabs.length > 0 && tabs[0].url) {
          const activeTabDomain = extractDomain(tabs[0].url);

          if (activeTabDomain === domain) {
            // We're tracking the active tab
            statusText.textContent = `Tracking: ${domain}`;
            statusText.title = domain; // Add tooltip for long domain names

            // Make the status indicator green and pulsing
            statusDot.style.backgroundColor = '#4CAF50';
            statusIndicator.style.color = '#4CAF50';

            // Add a timestamp to show real-time tracking
            const timestamp = document.createElement('span');
            timestamp.className = 'timestamp';
            timestamp.textContent = ` (${new Date().toLocaleTimeString()})`;
            timestamp.style.fontSize = '9px';
            timestamp.style.opacity = '0.7';

            // Remove any existing timestamp
            const existingTimestamp = statusText.querySelector('.timestamp');
            if (existingTimestamp) {
              statusText.removeChild(existingTimestamp);
            }

            statusText.appendChild(timestamp);
          } else {
            // We're tracking a different tab than the active one
            statusText.textContent = `Tracking: ${domain} (background)`;
            statusText.title = domain;

            // Make the status indicator blue for background tracking
            statusDot.style.backgroundColor = '#2196F3';
            statusIndicator.style.color = '#2196F3';
          }
        } else {
          // Fallback if we can't get active tab info
          statusText.textContent = `Tracking: ${domain}`;
          statusText.title = domain;
          statusDot.style.backgroundColor = '#4CAF50';
          statusIndicator.style.color = '#4CAF50';
        }
      });
    } catch (e) {
      statusText.textContent = 'Tracking';
      statusDot.style.backgroundColor = '#4CAF50';
      statusIndicator.style.color = '#4CAF50';
    }
  } else {
    statusText.textContent = 'Idle';
    // Make the status indicator gray when idle
    statusDot.style.backgroundColor = '#9E9E9E';
    statusIndicator.style.color = '#9E9E9E';
  }
}

// Extract domain from URL (simplified version of the background.js function)
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
