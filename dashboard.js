// Dashboard script for TimeTrack Pro

// Global variables
let trackingData = null;
let currentTimeFrame = 'today';
let charts = {};

// Initialize the dashboard
document.addEventListener('DOMContentLoaded', function() {
  // Set current date
  const today = new Date();
  document.getElementById('current-date').textContent = today.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  // Load tracking data from background script
  loadTrackingData();

  // Set up tab navigation
  setupTabNavigation();

  // Set up time filter buttons
  setupTimeFilters();

  // Set up settings page functionality
  setupSettingsPage();

  // Set up export functionality
  document.getElementById('export-btn').addEventListener('click', exportData);

  // Set up report generation
  document.getElementById('generate-report-btn').addEventListener('click', generateReport);

  // Set up website search and filters
  setupWebsiteFilters();
});

// Load tracking data from the background script
function loadTrackingData() {
  chrome.runtime.sendMessage({ action: 'getTrackingData' }, function(response) {
    if (response && response.trackingData) {
      trackingData = response.trackingData;
      updateDashboard();
    }
  });
}

// Set up real-time updates
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  if (request.action === 'refreshPopupData') {
    loadTrackingData();
  }
  return true;
});

// Also set up a timer to refresh data every 5 seconds
setInterval(loadTrackingData, 5000);

// Set up tab navigation
function setupTabNavigation() {
  const tabLinks = document.querySelectorAll('.sidebar nav li');
  const tabContents = document.querySelectorAll('.tab-content');

  tabLinks.forEach(link => {
    link.addEventListener('click', function() {
      // Remove active class from all tabs
      tabLinks.forEach(l => l.classList.remove('active'));
      tabContents.forEach(c => c.classList.remove('active'));

      // Add active class to clicked tab
      this.classList.add('active');
      const tabId = this.getAttribute('data-tab');
      document.getElementById(tabId + '-tab').classList.add('active');

      // Special handling for certain tabs
      if (tabId === 'reports') {
        updateReportsTab();
      } else if (tabId === 'websites') {
        updateWebsitesTab();
      } else if (tabId === 'settings') {
        updateSettingsTab();
      }
    });
  });
}

// Set up time filter buttons
function setupTimeFilters() {
  const timeButtons = document.querySelectorAll('.time-btn');

  timeButtons.forEach(btn => {
    btn.addEventListener('click', function() {
      // Remove active class from all buttons
      timeButtons.forEach(b => b.classList.remove('active'));

      // Add active class to clicked button
      this.classList.add('active');

      // Update time frame
      currentTimeFrame = this.getAttribute('data-time');

      // Update dashboard with new time frame
      updateDashboard();
    });
  });
}

// Update the dashboard with current data
function updateDashboard() {
  if (!trackingData) return;

  // Get data for the current time frame
  let currentData;
  if (currentTimeFrame === 'today') {
    currentData = trackingData.today;
  } else if (currentTimeFrame === 'week') {
    currentData = trackingData.thisWeek;
  } else if (currentTimeFrame === 'all') {
    currentData = trackingData.allTime;
  }

  // Calculate time spent in each category
  let productiveTime = 0;
  let unproductiveTime = 0;
  let neutralTime = 0;

  for (const domain in currentData) {
    const timeSpent = currentData[domain];

    if (trackingData.categories.productive.some(d => domain.includes(d))) {
      productiveTime += timeSpent;
    } else if (trackingData.categories.unproductive.some(d => domain.includes(d))) {
      unproductiveTime += timeSpent;
    } else {
      neutralTime += timeSpent;
    }
  }

  const totalTime = productiveTime + unproductiveTime + neutralTime;

  // Update time statistics
  document.getElementById('productive-time').textContent = formatTimeHours(productiveTime);
  document.getElementById('unproductive-time').textContent = formatTimeHours(unproductiveTime);
  document.getElementById('neutral-time').textContent = formatTimeHours(neutralTime);
  document.getElementById('total-time').textContent = formatTimeHours(totalTime);

  // Calculate productivity score
  let productivityScore = 0;
  if (totalTime > 0) {
    productivityScore = Math.round((productiveTime / totalTime) * 100);
  }

  document.getElementById('productivity-score').textContent = productivityScore + '%';

  // Update charts
  updateProductivityGauge(productivityScore);
  updateTimeDistributionChart(productiveTime, unproductiveTime, neutralTime);

  // Update top sites list
  updateTopSites(currentData);

  // Update websites tab if it's active
  if (document.getElementById('websites-tab').classList.contains('active')) {
    updateWebsitesTab();
  }

  // Update reports tab if it's active
  if (document.getElementById('reports-tab').classList.contains('active')) {
    updateReportsTab();
  }
}

// Update the productivity gauge chart
function updateProductivityGauge(score) {
  // Destroy existing chart if it exists
  if (charts.productivityGauge) {
    charts.productivityGauge.destroy();
  }

  const ctx = document.getElementById('productivity-gauge').getContext('2d');

  // Determine color based on score
  let color = '#F44336'; // Red
  if (score >= 70) {
    color = '#4CAF50'; // Green
  } else if (score >= 40) {
    color = '#FFC107'; // Yellow
  }

  // Create gauge chart
  charts.productivityGauge = new Chart(ctx, {
    type: 'doughnut',
    data: {
      datasets: [{
        data: [score, 100 - score],
        backgroundColor: [color, '#E0E0E0'],
        borderWidth: 0
      }]
    },
    options: {
      cutout: '80%',
      circumference: 180,
      rotation: -90,
      plugins: {
        tooltip: {
          enabled: false
        },
        legend: {
          display: false
        }
      },
      maintainAspectRatio: false
    }
  });
}

// Update the time distribution chart
function updateTimeDistributionChart(productiveTime, unproductiveTime, neutralTime) {
  // Destroy existing chart if it exists
  if (charts.timeDistribution) {
    charts.timeDistribution.destroy();
  }

  const ctx = document.getElementById('time-distribution-chart').getContext('2d');

  // Create pie chart
  charts.timeDistribution = new Chart(ctx, {
    type: 'pie',
    data: {
      labels: ['Productive', 'Unproductive', 'Neutral'],
      datasets: [{
        data: [productiveTime, unproductiveTime, neutralTime],
        backgroundColor: ['#4CAF50', '#F44336', '#9E9E9E'],
        borderWidth: 0
      }]
    },
    options: {
      plugins: {
        legend: {
          position: 'right'
        },
        tooltip: {
          callbacks: {
            label: function(context) {
              const label = context.label || '';
              const value = context.raw || 0;
              return label + ': ' + formatTimeHours(value);
            }
          }
        }
      },
      maintainAspectRatio: false
    }
  });
}

// Update the top sites list
function updateTopSites(data) {
  const topSitesList = document.getElementById('top-sites');
  topSitesList.innerHTML = '';

  // Sort domains by time spent
  const sortedDomains = Object.keys(data).sort((a, b) => data[b] - data[a]);

  // Display top 10 domains
  const topDomains = sortedDomains.slice(0, 10);

  if (topDomains.length === 0) {
    topSitesList.innerHTML = '<p class="no-data">No data available for this time period</p>';
    return;
  }

  topDomains.forEach(domain => {
    const timeSpent = data[domain];
    let categoryClass = 'neutral';
    let categoryIcon = 'question-circle';

    if (trackingData.categories.productive.some(d => domain.includes(d))) {
      categoryClass = 'productive';
      categoryIcon = 'check-circle';
    } else if (trackingData.categories.unproductive.some(d => domain.includes(d))) {
      categoryClass = 'unproductive';
      categoryIcon = 'times-circle';
    }

    const siteItem = document.createElement('div');
    siteItem.className = 'top-site-item';
    siteItem.innerHTML = `
      <div class="site-info">
        <i class="fas fa-${categoryIcon} ${categoryClass}-icon"></i>
        <span class="site-domain">${domain}</span>
      </div>
      <div class="site-stats">
        <span class="site-time">${formatTimeHours(timeSpent)}</span>
        <div class="site-bar">
          <div class="site-bar-fill ${categoryClass}-bg" style="width: ${calculateBarWidth(timeSpent, data)}%"></div>
        </div>
      </div>
    `;

    topSitesList.appendChild(siteItem);
  });
}

// Calculate the width percentage for the site bar
function calculateBarWidth(timeSpent, data) {
  const maxTime = Math.max(...Object.values(data));
  return (timeSpent / maxTime) * 100;
}

// Update the websites tab
function updateWebsitesTab() {
  if (!trackingData) return;

  // Get data for the current time frame
  let currentData;
  if (currentTimeFrame === 'today') {
    currentData = trackingData.today;
  } else if (currentTimeFrame === 'week') {
    currentData = trackingData.thisWeek;
  } else if (currentTimeFrame === 'all') {
    currentData = trackingData.allTime;
  }

  // Get filter values
  const searchTerm = document.getElementById('website-search').value.toLowerCase();
  const categoryFilter = document.getElementById('category-select').value;
  const sortOption = document.getElementById('sort-select').value;

  // Filter and sort domains
  let domains = Object.keys(currentData);

  // Apply search filter
  if (searchTerm) {
    domains = domains.filter(domain => domain.toLowerCase().includes(searchTerm));
  }

  // Apply category filter
  if (categoryFilter !== 'all') {
    domains = domains.filter(domain => {
      if (categoryFilter === 'productive') {
        return trackingData.categories.productive.some(d => domain.includes(d));
      } else if (categoryFilter === 'unproductive') {
        return trackingData.categories.unproductive.some(d => domain.includes(d));
      } else if (categoryFilter === 'neutral') {
        return !trackingData.categories.productive.some(d => domain.includes(d)) &&
               !trackingData.categories.unproductive.some(d => domain.includes(d));
      }
      return true;
    });
  }

  // Apply sorting
  domains.sort((a, b) => {
    if (sortOption === 'time-desc') {
      return currentData[b] - currentData[a];
    } else if (sortOption === 'time-asc') {
      return currentData[a] - currentData[b];
    } else if (sortOption === 'alpha-asc') {
      return a.localeCompare(b);
    } else if (sortOption === 'alpha-desc') {
      return b.localeCompare(a);
    }
    return 0;
  });

  // Update table
  const tableBody = document.getElementById('websites-table-body');
  tableBody.innerHTML = '';

  if (domains.length === 0) {
    const row = document.createElement('tr');
    row.innerHTML = '<td colspan="4" class="no-data">No websites match your filters</td>';
    tableBody.appendChild(row);
    return;
  }

  domains.forEach(domain => {
    const timeSpent = currentData[domain];
    let category = 'Neutral';
    let categoryClass = 'neutral';

    if (trackingData.categories.productive.some(d => domain.includes(d))) {
      category = 'Productive';
      categoryClass = 'productive';
    } else if (trackingData.categories.unproductive.some(d => domain.includes(d))) {
      category = 'Unproductive';
      categoryClass = 'unproductive';
    }

    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${domain}</td>
      <td><span class="${categoryClass}-text">${category}</span></td>
      <td>${formatTimeHours(timeSpent)}</td>
      <td>
        <div class="action-buttons">
          <button class="action-btn change-category-btn" data-domain="${domain}" data-category="${categoryClass}">
            <i class="fas fa-exchange-alt"></i>
          </button>
        </div>
      </td>
    `;

    tableBody.appendChild(row);
  });

  // Add event listeners to category change buttons
  document.querySelectorAll('.change-category-btn').forEach(btn => {
    btn.addEventListener('click', function() {
      const domain = this.getAttribute('data-domain');
      const currentCategory = this.getAttribute('data-category');

      let newCategory;
      if (currentCategory === 'productive') {
        newCategory = 'unproductive';
      } else if (currentCategory === 'unproductive') {
        newCategory = 'neutral';
      } else {
        newCategory = 'productive';
      }

      changeDomainCategory(domain, currentCategory, newCategory);
    });
  });
}

// Change a domain's category
function changeDomainCategory(domain, currentCategory, newCategory) {
  // Remove from current category
  if (currentCategory === 'productive') {
    trackingData.categories.productive = trackingData.categories.productive.filter(d => d !== domain);
  } else if (currentCategory === 'unproductive') {
    trackingData.categories.unproductive = trackingData.categories.unproductive.filter(d => d !== domain);
  }

  // Add to new category
  if (newCategory === 'productive') {
    trackingData.categories.productive.push(domain);
  } else if (newCategory === 'unproductive') {
    trackingData.categories.unproductive.push(domain);
  }

  // Save changes
  chrome.runtime.sendMessage({
    action: 'updateCategories',
    categories: trackingData.categories
  }, function() {
    // Refresh data
    loadTrackingData();
  });
}

// Set up website filters
function setupWebsiteFilters() {
  // Search input
  document.getElementById('website-search').addEventListener('input', updateWebsitesTab);

  // Category select
  document.getElementById('category-select').addEventListener('change', updateWebsitesTab);

  // Sort select
  document.getElementById('sort-select').addEventListener('change', updateWebsitesTab);
}

// Update the reports tab
function updateReportsTab() {
  if (!trackingData) return;

  // Update weekly productivity chart
  updateWeeklyProductivityChart();

  // Update daily usage chart
  updateDailyUsageChart();

  // Update insights
  updateInsights();
}

// Update the weekly productivity chart
function updateWeeklyProductivityChart() {
  // This would require daily data which we don't have in our current implementation
  // For demonstration, we'll create a chart with random data

  // Destroy existing chart if it exists
  if (charts.weeklyProductivity) {
    charts.weeklyProductivity.destroy();
  }

  const ctx = document.getElementById('weekly-productivity-chart').getContext('2d');

  // Get days of the week
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const today = new Date().getDay();
  const weekDays = [];

  // Arrange days so that today is the last day
  for (let i = 0; i < 7; i++) {
    const dayIndex = (today - 6 + i + 7) % 7;
    weekDays.push(days[dayIndex]);
  }

  // Create random productivity scores for demonstration
  const scores = [];
  for (let i = 0; i < 7; i++) {
    scores.push(Math.floor(Math.random() * 100));
  }

  // Create line chart
  charts.weeklyProductivity = new Chart(ctx, {
    type: 'line',
    data: {
      labels: weekDays,
      datasets: [{
        label: 'Productivity Score',
        data: scores,
        borderColor: '#2196F3',
        backgroundColor: 'rgba(33, 150, 243, 0.1)',
        tension: 0.4,
        fill: true
      }]
    },
    options: {
      scales: {
        y: {
          beginAtZero: true,
          max: 100,
          title: {
            display: true,
            text: 'Productivity Score (%)'
          }
        }
      },
      plugins: {
        legend: {
          display: false
        }
      },
      maintainAspectRatio: false
    }
  });
}

// Update the daily usage chart
function updateDailyUsageChart() {
  // Destroy existing chart if it exists
  if (charts.dailyUsage) {
    charts.dailyUsage.destroy();
  }

  const ctx = document.getElementById('daily-usage-chart').getContext('2d');

  // Get hours of the day
  const hours = [];
  for (let i = 0; i < 24; i++) {
    hours.push(i + ':00');
  }

  // Create random usage data for demonstration
  const productiveData = [];
  const unproductiveData = [];

  for (let i = 0; i < 24; i++) {
    if (i >= 9 && i <= 17) { // Working hours
      productiveData.push(Math.floor(Math.random() * 30) + 10);
      unproductiveData.push(Math.floor(Math.random() * 15));
    } else {
      productiveData.push(Math.floor(Math.random() * 10));
      unproductiveData.push(Math.floor(Math.random() * 20));
    }
  }

  // Create bar chart
  charts.dailyUsage = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: hours,
      datasets: [
        {
          label: 'Productive',
          data: productiveData,
          backgroundColor: '#4CAF50'
        },
        {
          label: 'Unproductive',
          data: unproductiveData,
          backgroundColor: '#F44336'
        }
      ]
    },
    options: {
      scales: {
        x: {
          stacked: true
        },
        y: {
          stacked: true,
          title: {
            display: true,
            text: 'Minutes'
          }
        }
      },
      plugins: {
        legend: {
          position: 'top'
        }
      },
      maintainAspectRatio: false
    }
  });
}

// Update insights
function updateInsights() {
  const insightsContainer = document.getElementById('insights-container');
  insightsContainer.innerHTML = '';

  // Calculate some insights
  let productiveTime = 0;
  let unproductiveTime = 0;
  let totalTime = 0;

  const weekData = trackingData.thisWeek;

  for (const domain in weekData) {
    const timeSpent = weekData[domain];
    totalTime += timeSpent;

    if (trackingData.categories.productive.some(d => domain.includes(d))) {
      productiveTime += timeSpent;
    } else if (trackingData.categories.unproductive.some(d => domain.includes(d))) {
      unproductiveTime += timeSpent;
    }
  }

  const productivityScore = totalTime > 0 ? Math.round((productiveTime / totalTime) * 100) : 0;

  // Create insights
  const insights = [
    {
      icon: 'chart-line',
      title: 'Weekly Productivity',
      content: `Your productivity score this week is <strong>${productivityScore}%</strong>.`,
      class: getProductivityClass(productivityScore)
    },
    {
      icon: 'clock',
      title: 'Time Distribution',
      content: `You spent <strong>${formatTimeHours(productiveTime)}</strong> on productive activities and <strong>${formatTimeHours(unproductiveTime)}</strong> on unproductive activities this week.`
    },
    {
      icon: 'lightbulb',
      title: 'Productivity Tip',
      content: 'Try the Pomodoro Technique: 25 minutes of focused work followed by a 5-minute break.'
    }
  ];

  // Add most productive day insight (random for demonstration)
  const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
  const randomDay = days[Math.floor(Math.random() * days.length)];

  insights.push({
    icon: 'calendar-check',
    title: 'Most Productive Day',
    content: `Your most productive day this week was <strong>${randomDay}</strong>.`
  });

  // Add insights to container
  insights.forEach(insight => {
    const insightElement = document.createElement('div');
    insightElement.className = 'insight-card';
    if (insight.class) {
      insightElement.classList.add(insight.class);
    }

    insightElement.innerHTML = `
      <div class="insight-icon">
        <i class="fas fa-${insight.icon}"></i>
      </div>
      <div class="insight-content">
        <h4>${insight.title}</h4>
        <p>${insight.content}</p>
      </div>
    `;

    insightsContainer.appendChild(insightElement);
  });
}

// Get productivity class based on score
function getProductivityClass(score) {
  if (score >= 70) {
    return 'productive-insight';
  } else if (score >= 40) {
    return 'neutral-insight';
  } else {
    return 'unproductive-insight';
  }
}

// Set up settings page
function setupSettingsPage() {
  // Add productive site
  document.getElementById('add-productive-btn').addEventListener('click', function() {
    const input = document.getElementById('add-productive-input');
    const domain = input.value.trim();

    if (domain) {
      if (!trackingData.categories.productive.includes(domain)) {
        trackingData.categories.productive.push(domain);

        // Remove from unproductive if it exists there
        trackingData.categories.unproductive = trackingData.categories.unproductive.filter(d => d !== domain);

        // Save changes
        chrome.runtime.sendMessage({
          action: 'updateCategories',
          categories: trackingData.categories
        }, function() {
          // Refresh data
          loadTrackingData();
          // Clear input
          input.value = '';
          // Update settings tab
          updateSettingsTab();
        });
      } else {
        alert('This domain is already in the productive list.');
      }
    }
  });

  // Add unproductive site
  document.getElementById('add-unproductive-btn').addEventListener('click', function() {
    const input = document.getElementById('add-unproductive-input');
    const domain = input.value.trim();

    if (domain) {
      if (!trackingData.categories.unproductive.includes(domain)) {
        trackingData.categories.unproductive.push(domain);

        // Remove from productive if it exists there
        trackingData.categories.productive = trackingData.categories.productive.filter(d => d !== domain);

        // Save changes
        chrome.runtime.sendMessage({
          action: 'updateCategories',
          categories: trackingData.categories
        }, function() {
          // Refresh data
          loadTrackingData();
          // Clear input
          input.value = '';
          // Update settings tab
          updateSettingsTab();
        });
      } else {
        alert('This domain is already in the unproductive list.');
      }
    }
  });

  // Reset data buttons
  document.getElementById('reset-today-btn').addEventListener('click', function() {
    if (confirm('Are you sure you want to reset today\'s data? This cannot be undone.')) {
      chrome.runtime.sendMessage({
        action: 'resetData',
        scope: 'today'
      }, function() {
        // Refresh data
        loadTrackingData();
      });
    }
  });

  document.getElementById('reset-week-btn').addEventListener('click', function() {
    if (confirm('Are you sure you want to reset this week\'s data? This cannot be undone.')) {
      chrome.runtime.sendMessage({
        action: 'resetData',
        scope: 'week'
      }, function() {
        // Refresh data
        loadTrackingData();
      });
    }
  });

  document.getElementById('reset-all-btn').addEventListener('click', function() {
    if (confirm('Are you sure you want to reset ALL data? This cannot be undone.')) {
      chrome.runtime.sendMessage({
        action: 'resetData',
        scope: 'all'
      }, function() {
        // Refresh data
        loadTrackingData();
      });
    }
  });
}

// Update settings tab
function updateSettingsTab() {
  if (!trackingData) return;

  // Update productive sites list
  const productiveList = document.getElementById('productive-list');
  productiveList.innerHTML = '';

  trackingData.categories.productive.forEach(domain => {
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

  // Update unproductive sites list
  const unproductiveList = document.getElementById('unproductive-list');
  unproductiveList.innerHTML = '';

  trackingData.categories.unproductive.forEach(domain => {
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

  // Add event listeners to remove buttons
  document.querySelectorAll('.remove-btn').forEach(btn => {
    btn.addEventListener('click', function() {
      const domain = this.getAttribute('data-domain');
      const category = this.getAttribute('data-category');

      if (category === 'productive') {
        trackingData.categories.productive = trackingData.categories.productive.filter(d => d !== domain);
      } else if (category === 'unproductive') {
        trackingData.categories.unproductive = trackingData.categories.unproductive.filter(d => d !== domain);
      }

      // Save changes
      chrome.runtime.sendMessage({
        action: 'updateCategories',
        categories: trackingData.categories
      }, function() {
        // Refresh data
        loadTrackingData();
      });
    });
  });
}

// Export data as JSON
function exportData() {
  if (!trackingData) return;

  const dataStr = JSON.stringify(trackingData, null, 2);
  const dataUri = 'data:application/json;charset=utf-8,' + encodeURIComponent(dataStr);

  const exportFileName = 'timetrack_data_' + new Date().toISOString().split('T')[0] + '.json';

  const linkElement = document.createElement('a');
  linkElement.setAttribute('href', dataUri);
  linkElement.setAttribute('download', exportFileName);
  linkElement.click();
}

// Generate PDF report (mock function)
function generateReport() {
  alert('PDF report generation would be implemented here. This would typically use a library like jsPDF to create a downloadable PDF with your weekly productivity statistics.');
}

// Format seconds into a human-readable time string (hours and minutes)
function formatTimeHours(seconds) {
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
