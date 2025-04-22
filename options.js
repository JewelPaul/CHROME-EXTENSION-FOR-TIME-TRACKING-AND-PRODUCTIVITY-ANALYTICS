// Options script for TimeTrack Pro

// Initialize options page
document.addEventListener('DOMContentLoaded', function() {
  // Load tracking data from background script
  loadTrackingData();

  // Set up tab navigation
  setupTabNavigation();

  // Set up event listeners for buttons
  setupEventListeners();
});

// Load tracking data from the background script
function loadTrackingData() {
  chrome.runtime.sendMessage({ action: 'getTrackingData' }, function(response) {
    if (response && response.trackingData) {
      updateCategoryLists(response.trackingData.categories);
      updateRecentSitesList(response.trackingData.today, response.trackingData.categories);
    }
  });
}

// Update the recent sites list
function updateRecentSitesList(todayData, categories) {
  const recentSitesList = document.getElementById('recent-sites-list');
  const noRecentSitesMsg = document.getElementById('no-recent-sites');

  // Clear the list
  recentSitesList.innerHTML = '';

  // Get domains sorted by time spent
  const sortedDomains = Object.keys(todayData).sort((a, b) => todayData[b] - todayData[a]);

  if (sortedDomains.length === 0) {
    // Show the empty message
    noRecentSitesMsg.style.display = 'block';
    recentSitesList.style.display = 'none';
  } else {
    // Hide the empty message
    noRecentSitesMsg.style.display = 'none';
    recentSitesList.style.display = 'block';

    // Add each domain to the list
    sortedDomains.forEach(domain => {
      // Skip if domain is empty or null
      if (!domain) return;

      // Determine current category
      let currentCategory = 'neutral';
      if (categories.productive.includes(domain)) {
        currentCategory = 'productive';
      } else if (categories.unproductive.includes(domain)) {
        currentCategory = 'unproductive';
      }

      // Create the list item
      const item = document.createElement('div');
      item.className = 'recent-site-item';

      // Format time spent
      const timeSpent = formatTime(todayData[domain]);

      // Create HTML for the item
      item.innerHTML = `
        <div class="site-info">
          <span class="site-domain">${domain}</span>
          <span class="site-time">${timeSpent}</span>
        </div>
        <div class="site-actions">
          <button class="category-btn productive-btn ${currentCategory === 'productive' ? 'active' : ''}"
                  data-domain="${domain}" data-category="productive">
            <i class="fas fa-check-circle"></i> Productive
          </button>
          <button class="category-btn neutral-btn ${currentCategory === 'neutral' ? 'active' : ''}"
                  data-domain="${domain}" data-category="neutral">
            <i class="fas fa-question-circle"></i> Neutral
          </button>
          <button class="category-btn unproductive-btn ${currentCategory === 'unproductive' ? 'active' : ''}"
                  data-domain="${domain}" data-category="unproductive">
            <i class="fas fa-times-circle"></i> Unproductive
          </button>
        </div>
      `;

      recentSitesList.appendChild(item);
    });

    // Add event listeners to category buttons
    document.querySelectorAll('.category-btn').forEach(btn => {
      btn.addEventListener('click', function() {
        const domain = this.getAttribute('data-domain');
        const category = this.getAttribute('data-category');

        // Update the category
        updateSiteCategory(domain, category);
      });
    });
  }
}

// Update a site's category
function updateSiteCategory(domain, category) {
  chrome.runtime.sendMessage({ action: 'getTrackingData' }, function(response) {
    if (response && response.trackingData) {
      const categories = response.trackingData.categories;

      // Remove from all categories first
      categories.productive = categories.productive.filter(d => d !== domain);
      categories.unproductive = categories.unproductive.filter(d => d !== domain);

      // Add to the selected category (if not neutral)
      if (category !== 'neutral') {
        categories[category].push(domain);
      }

      // Save changes
      chrome.runtime.sendMessage({
        action: 'updateCategories',
        categories: categories
      }, function() {
        // Update UI
        updateCategoryLists(categories);
        updateRecentSitesList(response.trackingData.today, categories);

        // Show notification
        showNotification(`${domain} categorized as ${category}.`);
      });
    }
  });
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

// Set up tab navigation
function setupTabNavigation() {
  const tabButtons = document.querySelectorAll('.tab-btn');
  const tabContents = document.querySelectorAll('.tab-content');

  tabButtons.forEach(button => {
    button.addEventListener('click', function() {
      // Remove active class from all buttons and contents
      tabButtons.forEach(btn => btn.classList.remove('active'));
      tabContents.forEach(content => content.classList.remove('active'));

      // Add active class to clicked button and corresponding content
      this.classList.add('active');
      const tabId = this.getAttribute('data-tab');
      document.getElementById(tabId + '-tab').classList.add('active');
    });
  });
}

// Set up event listeners for buttons
function setupEventListeners() {
  // Add productive site
  document.getElementById('add-productive-btn').addEventListener('click', function() {
    addSite('productive');
  });

  // Add unproductive site
  document.getElementById('add-unproductive-btn').addEventListener('click', function() {
    addSite('unproductive');
  });

  // Reset today's data
  document.getElementById('reset-today-btn').addEventListener('click', function() {
    if (confirm('Are you sure you want to reset today\'s data? This cannot be undone.')) {
      chrome.runtime.sendMessage({
        action: 'resetData',
        scope: 'today'
      }, function() {
        showNotification('Today\'s data has been reset.');
      });
    }
  });

  // Reset weekly data
  document.getElementById('reset-week-btn').addEventListener('click', function() {
    if (confirm('Are you sure you want to reset this week\'s data? This cannot be undone.')) {
      chrome.runtime.sendMessage({
        action: 'resetData',
        scope: 'week'
      }, function() {
        showNotification('Weekly data has been reset.');
      });
    }
  });

  // Reset all data
  document.getElementById('reset-all-btn').addEventListener('click', function() {
    if (confirm('Are you sure you want to reset ALL data? This cannot be undone.')) {
      chrome.runtime.sendMessage({
        action: 'resetData',
        scope: 'all'
      }, function() {
        showNotification('All data has been reset.');
      });
    }
  });
}

// Add a site to a category
function addSite(category) {
  const inputId = `add-${category}-input`;
  const input = document.getElementById(inputId);
  const domain = input.value.trim();

  if (!domain) {
    showNotification('Please enter a domain name.', 'error');
    return;
  }

  chrome.runtime.sendMessage({ action: 'getTrackingData' }, function(response) {
    if (response && response.trackingData) {
      const categories = response.trackingData.categories;

      // Check if domain is already in the category
      if (categories[category].includes(domain)) {
        showNotification(`${domain} is already in the ${category} category.`, 'error');
        return;
      }

      // Remove from other category if present
      const otherCategory = category === 'productive' ? 'unproductive' : 'productive';
      categories[otherCategory] = categories[otherCategory].filter(d => d !== domain);

      // Add to selected category
      categories[category].push(domain);

      // Save changes
      chrome.runtime.sendMessage({
        action: 'updateCategories',
        categories: categories
      }, function() {
        // Clear input
        input.value = '';

        // Update category lists
        updateCategoryLists(categories);

        // Show notification
        showNotification(`${domain} added to ${category} category.`);
      });
    }
  });
}

// Update category lists
function updateCategoryLists(categories) {
  // Update productive list
  const productiveList = document.getElementById('productive-list');
  productiveList.innerHTML = '';

  if (categories.productive.length === 0) {
    productiveList.innerHTML = '<p class="empty-list">No productive websites added yet.</p>';
  } else {
    categories.productive.forEach(domain => {
      const item = document.createElement('div');
      item.className = 'category-item';
      item.innerHTML = `
        <span>${domain}</span>
        <button class="remove-btn" data-domain="${domain}" data-category="productive">
          <i class="fas fa-times"></i>
        </button>
      `;
      productiveList.appendChild(item);
    });
  }

  // Update unproductive list
  const unproductiveList = document.getElementById('unproductive-list');
  unproductiveList.innerHTML = '';

  if (categories.unproductive.length === 0) {
    unproductiveList.innerHTML = '<p class="empty-list">No unproductive websites added yet.</p>';
  } else {
    categories.unproductive.forEach(domain => {
      const item = document.createElement('div');
      item.className = 'category-item';
      item.innerHTML = `
        <span>${domain}</span>
        <button class="remove-btn" data-domain="${domain}" data-category="unproductive">
          <i class="fas fa-times"></i>
        </button>
      `;
      unproductiveList.appendChild(item);
    });
  }

  // Add event listeners to remove buttons
  document.querySelectorAll('.remove-btn').forEach(btn => {
    btn.addEventListener('click', function() {
      const domain = this.getAttribute('data-domain');
      const category = this.getAttribute('data-category');

      removeSite(domain, category);
    });
  });
}

// Remove a site from a category
function removeSite(domain, category) {
  chrome.runtime.sendMessage({ action: 'getTrackingData' }, function(response) {
    if (response && response.trackingData) {
      const categories = response.trackingData.categories;

      // Remove domain from category
      categories[category] = categories[category].filter(d => d !== domain);

      // Save changes
      chrome.runtime.sendMessage({
        action: 'updateCategories',
        categories: categories
      }, function() {
        // Update category lists
        updateCategoryLists(categories);

        // Show notification
        showNotification(`${domain} removed from ${category} category.`);
      });
    }
  });
}

// Show notification
function showNotification(message, type = 'success') {
  // Check if notification container exists
  let notificationContainer = document.querySelector('.notification-container');

  // Create container if it doesn't exist
  if (!notificationContainer) {
    notificationContainer = document.createElement('div');
    notificationContainer.className = 'notification-container';
    document.body.appendChild(notificationContainer);
  }

  // Create notification
  const notification = document.createElement('div');
  notification.className = `notification ${type}`;
  notification.innerHTML = `
    <p>${message}</p>
    <button class="close-btn"><i class="fas fa-times"></i></button>
  `;

  // Add to container
  notificationContainer.appendChild(notification);

  // Add event listener to close button
  notification.querySelector('.close-btn').addEventListener('click', function() {
    notification.remove();
  });

  // Auto-remove after 5 seconds
  setTimeout(() => {
    notification.remove();
  }, 5000);
}
