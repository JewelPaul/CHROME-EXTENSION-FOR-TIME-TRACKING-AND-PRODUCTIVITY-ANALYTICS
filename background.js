// Background script for TimeTrack Pro
// Handles website tracking and time calculations

// Default website categories
const DEFAULT_CATEGORIES = {
  productive: [
    "github.com",
    "stackoverflow.com",
    "docs.google.com",
    "linkedin.com",
    "udemy.com",
    "coursera.org",
    "kaggle.com",
    "medium.com"
  ],
  unproductive: [
    "facebook.com",
    "instagram.com",
    "twitter.com",
    "reddit.com",
    "youtube.com",
    "netflix.com",
    "tiktok.com"
  ]
};

// Initialize data structure
let trackingData = {
  today: {},
  thisWeek: {},
  allTime: {},
  startTime: null,
  currentUrl: null,
  currentTabId: null,
  categories: DEFAULT_CATEGORIES
};

// Load saved data when extension starts
chrome.storage.local.get(['trackingData'], function(result) {
  if (result.trackingData) {
    trackingData = result.trackingData;

    // Reset today's data if it's a new day
    const today = new Date().toDateString();
    const savedDate = trackingData.lastSaveDate || '';

    if (today !== savedDate) {
      // It's a new day, archive yesterday's data to weekly
      updateWeeklyData();
      trackingData.today = {};
      trackingData.lastSaveDate = today;
    }
  } else {
    // Initialize with default data
    trackingData.lastSaveDate = new Date().toDateString();
  }

  // Make sure categories exist
  if (!trackingData.categories) {
    trackingData.categories = DEFAULT_CATEGORIES;
  }

  saveData();
});

// Update weekly data by adding today's data
function updateWeeklyData() {
  const todayData = trackingData.today;

  // Add today's data to weekly data
  for (const url in todayData) {
    if (!trackingData.thisWeek[url]) {
      trackingData.thisWeek[url] = 0;
    }
    trackingData.thisWeek[url] += todayData[url];

    // Also update all-time data
    if (!trackingData.allTime[url]) {
      trackingData.allTime[url] = 0;
    }
    trackingData.allTime[url] += todayData[url];
  }

  // Check if we need to reset weekly data (if it's a new week)
  const today = new Date();
  const dayOfWeek = today.getDay(); // 0 = Sunday, 1 = Monday, etc.

  if (dayOfWeek === 0) { // If it's Sunday, reset the weekly data
    if (trackingData.lastWeekReset) {
      const lastReset = new Date(trackingData.lastWeekReset);
      const weekDiff = Math.floor((today - lastReset) / (7 * 24 * 60 * 60 * 1000));

      if (weekDiff >= 1) {
        trackingData.thisWeek = {};
        trackingData.lastWeekReset = today.toISOString();
      }
    } else {
      trackingData.lastWeekReset = today.toISOString();
    }
  }
}

// Save tracking data to storage
function saveData() {
  chrome.storage.local.set({ 'trackingData': trackingData });
}

// Extract domain from URL or get file name for local files
function extractDomain(url) {
  if (!url) return null;

  try {
    const urlObj = new URL(url);

    // Handle different URL protocols
    if (urlObj.protocol === 'file:') {
      // For local files, use the filename as the "domain"
      const pathParts = urlObj.pathname.split('/');
      const filename = pathParts[pathParts.length - 1];
      return filename || 'local-file';
    } else if (urlObj.protocol === 'chrome-extension:') {
      // For chrome extension pages
      return 'chrome-extension';
    } else {
      // For web URLs, extract the domain
      let domain = urlObj.hostname;

      // Remove www. prefix if present
      if (domain.startsWith('www.')) {
        domain = domain.substring(4);
      }

      return domain;
    }
  } catch (e) {
    console.error('Error extracting domain:', e);
    return url.substring(0, 30) + '...'; // Return a truncated version of the URL as fallback
  }
}

// Check if a domain or file belongs to a category
function getDomainCategory(domain) {
  if (!domain) return 'neutral';

  // First check if this is a local file
  if (trackingData.currentUrl && trackingData.currentUrl.startsWith('file:')) {
    // Consider document files as productive by default
    const productiveFileTypes = ['pdf', 'doc', 'docx', 'ppt', 'pptx', 'xls', 'xlsx', 'txt', 'rtf', 'odt', 'ods', 'odp'];

    if (trackingData.currentFileType && productiveFileTypes.includes(trackingData.currentFileType)) {
      return 'productive';
    }

    // Check if the user has manually categorized this file
    if (trackingData.categories.productive.some(d => domain.includes(d))) {
      return 'productive';
    }

    if (trackingData.categories.unproductive.some(d => domain.includes(d))) {
      return 'unproductive';
    }

    // Default local files to neutral
    return 'neutral';
  }

  // For web domains
  if (trackingData.categories.productive.some(d => domain.includes(d))) {
    return 'productive';
  }

  if (trackingData.categories.unproductive.some(d => domain.includes(d))) {
    return 'unproductive';
  }

  // Check if this is a work/productivity domain by common patterns
  const productiveDomainPatterns = ['docs.', 'sheets.', 'slides.', 'office.', 'notion.', 'atlassian.', 'jira.', 'confluence.', 'trello.', 'asana.', 'monday.', 'figma.', 'miro.', 'github.', 'gitlab.', 'bitbucket.', 'stackoverflow.', 'stackexchange.', 'linkedin.', 'coursera.', 'udemy.', 'edx.', 'canvas.', 'blackboard.', 'moodle.'];

  if (productiveDomainPatterns.some(pattern => domain.includes(pattern))) {
    return 'productive';
  }

  // Check if this is a social/entertainment domain by common patterns
  const unproductiveDomainPatterns = ['facebook.', 'instagram.', 'twitter.', 'tiktok.', 'reddit.', 'youtube.', 'netflix.', 'hulu.', 'disney+', 'twitch.', 'pinterest.', 'snapchat.', 'tumblr.', 'vimeo.', 'dailymotion.', 'imgur.', '9gag.'];

  if (unproductiveDomainPatterns.some(pattern => domain.includes(pattern))) {
    return 'unproductive';
  }

  return 'neutral';
}

// Start tracking time for the current tab
function startTracking(url, tabId) {
  // Stop tracking the previous tab
  stopTracking();

  // Track http/https URLs and local files
  if (url) {
    let shouldTrack = false;
    let trackingLabel = '';

    if (url.startsWith('http')) {
      // Web URL
      shouldTrack = true;
      trackingLabel = extractDomain(url);
    } else if (url.startsWith('file:')) {
      // Local file
      shouldTrack = true;
      // Extract filename from file:// URL
      const filename = url.split('/').pop().split('#')[0].split('?')[0];
      trackingLabel = filename || 'local-file';

      // Store the file extension for categorization
      const fileExt = (filename.includes('.') ? filename.split('.').pop().toLowerCase() : '');
      trackingData.currentFileType = fileExt;
    } else if (url.startsWith('chrome-extension:')) {
      // Chrome extension page
      shouldTrack = true;
      trackingLabel = 'chrome-extension';
    }

    if (shouldTrack) {
      // Start tracking the new tab
      trackingData.startTime = Date.now();
      trackingData.currentUrl = url;
      trackingData.currentTabId = tabId;

      // Log tracking start for debugging
      console.log('Started tracking:', trackingLabel);
    }
  }
}

// Stop tracking time for the current tab
function stopTracking() {
  if (trackingData.startTime && trackingData.currentUrl) {
    const domain = extractDomain(trackingData.currentUrl);
    if (!domain) return;

    const currentTime = Date.now();
    const elapsedMs = currentTime - trackingData.startTime;

    // Validate the time difference is reasonable (less than 1 hour)
    // This prevents unrealistic time tracking if the computer was asleep
    if (elapsedMs > 0 && elapsedMs < 3600000) { // 1 hour in milliseconds
      const timeSpent = Math.floor(elapsedMs / 1000); // in seconds

      // Only record if time was actually spent (at least 1 second)
      if (timeSpent >= 1) {
        // Get the category for this domain/file
        const category = getDomainCategory(domain);

        // Update today's data
        if (!trackingData.today[domain]) {
          trackingData.today[domain] = 0;
        }
        trackingData.today[domain] += timeSpent;

        // Also update category totals for better productivity calculation
        if (!trackingData.categoryTotals) {
          trackingData.categoryTotals = {
            productive: 0,
            unproductive: 0,
            neutral: 0
          };
        }

        trackingData.categoryTotals[category] += timeSpent;

        // Log for debugging
        console.log(`Recorded ${timeSpent}s for ${domain} (${category}). Total: ${trackingData.today[domain]}s`);

        saveData();
      }
    } else if (elapsedMs <= 0) {
      console.warn('Invalid time difference detected:', elapsedMs);
    } else {
      console.warn('Time difference too large, may be due to system sleep:', elapsedMs);
    }

    // Reset tracking variables
    trackingData.startTime = null;
    trackingData.currentUrl = null;
    trackingData.currentTabId = null;
    trackingData.currentFileType = null;
  }
}

// Listen for tab activation changes
chrome.tabs.onActivated.addListener(function(activeInfo) {
  // First stop tracking the previous tab
  stopTracking();

  // Then get info about the newly activated tab
  chrome.tabs.get(activeInfo.tabId, function(tab) {
    if (tab && tab.url && tab.url.startsWith('http')) {
      console.log('Tab activated:', tab.url);
      startTracking(tab.url, tab.id);
    }
  });
});

// Listen for tab URL changes
chrome.tabs.onUpdated.addListener(function(tabId, changeInfo, tab) {
  // Only process if this is the active tab and the URL has completed loading
  if (changeInfo.status === 'complete' && tab.url && tab.active) {
    console.log('Tab updated:', tab.url);

    // Check if this is the tab we're currently tracking
    if (tabId === trackingData.currentTabId) {
      // If URL changed, update tracking
      if (trackingData.currentUrl !== tab.url) {
        stopTracking();
        startTracking(tab.url, tab.id);
      }
    } else {
      // If this is a different active tab, switch tracking to it
      chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
        if (tabs.length > 0 && tabs[0].id === tab.id) {
          stopTracking();
          startTracking(tab.url, tab.id);
        }
      });
    }
  }
});

// Listen for window focus changes
chrome.windows.onFocusChanged.addListener(function(windowId) {
  if (windowId === chrome.windows.WINDOW_ID_NONE) {
    // Window lost focus, stop tracking
    console.log('Window lost focus, stopping tracking');
    stopTracking();
  } else {
    // Window gained focus, start tracking the active tab
    console.log('Window gained focus, starting tracking');
    chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
      if (tabs.length > 0 && tabs[0].url) {
        stopTracking(); // Stop any existing tracking first
        startTracking(tabs[0].url, tabs[0].id);
      }
    });
  }
});

// Listen for tab removal
chrome.tabs.onRemoved.addListener(function(tabId, removeInfo) {
  // If the closed tab was being tracked, stop tracking
  if (tabId === trackingData.currentTabId) {
    console.log('Tracked tab was closed');
    stopTracking();

    // Find the new active tab to track
    chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
      if (tabs.length > 0 && tabs[0].url) {
        startTracking(tabs[0].url, tabs[0].id);
      }
    });
  }
});

// Set up an alarm to periodically update tracking data (every 5 seconds for more accurate tracking)
chrome.alarms.create('updateTracking', { periodInMinutes: 0.083 }); // 5 seconds

// Set up an alarm for updating the popup if it's open (every 1 second)
chrome.alarms.create('updatePopup', { periodInMinutes: 0.017 }); // 1 second

chrome.alarms.onAlarm.addListener(function(alarm) {
  if (alarm.name === 'updateTracking') {
    // First check if the current tab is still the active one
    if (trackingData.currentTabId) {
      chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
        if (tabs.length > 0) {
          // If active tab changed, update tracking
          if (tabs[0].id !== trackingData.currentTabId) {
            console.log('Active tab changed during alarm check');
            stopTracking();
            if (tabs[0].url && tabs[0].url.startsWith('http')) {
              startTracking(tabs[0].url, tabs[0].id);
            }
          } else if (tabs[0].url !== trackingData.currentUrl) {
            // URL changed in the same tab
            console.log('URL changed in active tab during alarm check');
            stopTracking();
            if (tabs[0].url && tabs[0].url.startsWith('http')) {
              startTracking(tabs[0].url, tabs[0].id);
            }
          } else {
            // Same tab and URL, just update the time
            // This creates more accurate time tracking by saving the current session
            // without resetting the timer
            if (trackingData.startTime && trackingData.currentUrl) {
              const domain = extractDomain(trackingData.currentUrl);
              if (domain) {
                const currentTime = Date.now();
                const elapsedMs = currentTime - trackingData.startTime;

                if (elapsedMs > 0 && elapsedMs < 3600000) { // 1 hour max
                  const timeSpent = Math.floor(elapsedMs / 1000);

                  if (timeSpent >= 1) {
                    // Update today's data
                    if (!trackingData.today[domain]) {
                      trackingData.today[domain] = 0;
                    }
                    trackingData.today[domain] += timeSpent;

                    // Reset start time to now without stopping tracking
                    trackingData.startTime = currentTime;

                    console.log(`Incremental update: Added ${timeSpent}s to ${domain}. Total: ${trackingData.today[domain]}s`);
                    saveData();
                  }
                }
              }
            }
          }
        }
      });
    } else {
      // No current tracking, check if we should start
      chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
        if (tabs.length > 0 && tabs[0].url && tabs[0].url.startsWith('http')) {
          console.log('Starting tracking during alarm check');
          startTracking(tabs[0].url, tabs[0].id);
        }
      });
    }
  } else if (alarm.name === 'updatePopup') {
    // Notify popup to refresh its data if it's open
    chrome.runtime.sendMessage({ action: 'refreshPopupData' }).catch(() => {
      // Ignore errors when popup is not open
    });
  }
});

// Listen for messages from popup or options page
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  if (request.action === 'getTrackingData') {
    // Update the current tracking session before sending data
    if (trackingData.startTime && trackingData.currentUrl) {
      const domain = extractDomain(trackingData.currentUrl);
      if (domain) {
        const currentTime = Date.now();
        const elapsedMs = currentTime - trackingData.startTime;

        if (elapsedMs > 0 && elapsedMs < 3600000) { // 1 hour max
          const timeSpent = Math.floor(elapsedMs / 1000);

          if (timeSpent >= 1) {
            // Update today's data
            if (!trackingData.today[domain]) {
              trackingData.today[domain] = 0;
            }
            trackingData.today[domain] += timeSpent;

            // Reset start time to now without stopping tracking
            trackingData.startTime = currentTime;

            console.log(`Data request update: Added ${timeSpent}s to ${domain}. Total: ${trackingData.today[domain]}s`);
            saveData();
          }
        }
      }
    }

    // Get the current active tab to ensure UI shows correct info
    chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
      if (tabs.length > 0) {
        // Update the current URL in the tracking data for UI display
        trackingData.currentActiveUrl = tabs[0].url;
      }

      sendResponse({ trackingData: trackingData });
    });

    return true; // Required for async response
  } else if (request.action === 'updateCategories') {
    trackingData.categories = request.categories;
    saveData();
    sendResponse({ success: true });
  } else if (request.action === 'resetData') {
    if (request.scope === 'today') {
      trackingData.today = {};
    } else if (request.scope === 'week') {
      trackingData.thisWeek = {};
    } else if (request.scope === 'all') {
      trackingData.today = {};
      trackingData.thisWeek = {};
      trackingData.allTime = {};
    }
    saveData();
    sendResponse({ success: true });
  } else if (request.action === 'getCurrentStatus') {
    // New action to get current tracking status without modifying data
    sendResponse({
      isTracking: !!trackingData.startTime,
      currentUrl: trackingData.currentUrl,
      startTime: trackingData.startTime
    });
  } else if (request.action === 'forceUpdate') {
    // Force an update of the current tracking session
    if (trackingData.startTime && trackingData.currentUrl) {
      const domain = extractDomain(trackingData.currentUrl);
      if (domain) {
        const currentTime = Date.now();
        const elapsedMs = currentTime - trackingData.startTime;

        if (elapsedMs > 0 && elapsedMs < 3600000) { // 1 hour max
          const timeSpent = Math.floor(elapsedMs / 1000);

          if (timeSpent >= 1) {
            // Update today's data
            if (!trackingData.today[domain]) {
              trackingData.today[domain] = 0;
            }
            trackingData.today[domain] += timeSpent;

            // Reset start time to now without stopping tracking
            trackingData.startTime = currentTime;

            console.log(`Force update: Added ${timeSpent}s to ${domain}. Total: ${trackingData.today[domain]}s`);
            saveData();
          }
        }
      }
    }

    // Check if we need to start tracking
    if (!trackingData.startTime) {
      chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
        if (tabs.length > 0 && tabs[0].url && tabs[0].url.startsWith('http')) {
          startTracking(tabs[0].url, tabs[0].id);
        }
      });
    }

    sendResponse({ success: true });
  }

  return true; // Required for async response
});
