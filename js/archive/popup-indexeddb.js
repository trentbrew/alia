// Initialize IndexedDB
const dbName = 'AliaDB';
const storeName = 'aliases';
let db = null;

// Initialize the database
async function initDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(dbName, 1);

    request.onerror = (event) => {
      console.error('IndexedDB error:', event.target.error);
      reject(event.target.error);
    };

    request.onsuccess = (event) => {
      db = event.target.result;
      resolve(db);
    };

    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(storeName)) {
        db.createObjectStore(storeName, { keyPath: 'alias' });
      }
    };
  });
}

// Set an alias in the database
async function set(alias, url) {
  if (!db) await initDB();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([storeName], 'readwrite');
    const store = transaction.objectStore(storeName);

    const request = store.put({ alias, url });

    request.onsuccess = () => resolve();
    request.onerror = (event) => {
      console.error('Error setting alias:', event.target.error);
      reject(event.target.error);
    };
  });
}

// Get all aliases from the database
async function getAll() {
  if (!db) await initDB();

  return new Promise((resolve) => {
    const transaction = db.transaction([storeName]);
    const store = transaction.objectStore(storeName);
    const request = store.getAll();

    request.onsuccess = () => {
      const result = {};
      request.result.forEach((item) => {
        result[item.alias] = item.url;
      });
      resolve(result);
    };

    request.onerror = () => resolve({});
  });
}

// Remove an alias from the database
async function remove(alias) {
  if (!db) await initDB();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([storeName], 'readwrite');
    const store = transaction.objectStore(storeName);

    const request = store.delete(alias);

    request.onsuccess = () => resolve();
    request.onerror = (event) => {
      console.error('Error removing alias:', event.target.error);
      reject(event.target.error);
    };
  });
}

// Clear all aliases
async function clear() {
  if (!db) await initDB();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([storeName], 'readwrite');
    const store = transaction.objectStore(storeName);

    const request = store.clear();

    request.onsuccess = () => resolve();
    request.onerror = (event) => {
      console.error('Error clearing storage:', event.target.error);
      reject(event.target.error);
    };
  });
}

// Update alias count display and toggle visibility of no-aliases message
function updateAliasCount(count) {
  const aliasCount = document.getElementById('alias-count');
  const noAliases = document.getElementById('no-aliases');

  aliasCount.textContent = count;
  noAliases.style.display = count === 0 ? 'block' : 'none';
}

// Export aliases to a JSON file
async function exportAliases() {
  try {
    const aliases = await getAll();
    const data = JSON.stringify(aliases, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = `alia-backup-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    // Show success message
    showToast('Aliases exported successfully!');
  } catch (error) {
    console.error('Export failed:', error);
    showToast('Export failed. Please try again.', 'error');
  }
}

// Import aliases from a JSON file
async function importAliases(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = async (event) => {
      try {
        const aliases = JSON.parse(event.target.result);
        const entries = Object.entries(aliases);

        // Validate the import data
        if (
          !entries.every(
            ([key, value]) =>
              typeof key === 'string' &&
              typeof value === 'string' &&
              key.trim() !== '' &&
              value.trim() !== '',
          )
        ) {
          throw new Error('Invalid import format');
        }

        // Add all aliases
        for (const [alias, url] of entries) {
          await set(alias, url);
        }

        resolve(entries.length);
      } catch (error) {
        console.error('Import failed:', error);
        reject(new Error('Invalid or corrupted import file'));
      }
    };

    reader.onerror = () => {
      reject(new Error('Failed to read file'));
    };

    reader.readAsText(file);
  });
}

// Format storage usage with more precision
function formatStorageUsage(percent) {
  if (percent < 0.01) return percent.toFixed(3);
  if (percent < 0.1) return percent.toFixed(2);
  if (percent < 1) return percent.toFixed(1);
  return Math.round(percent);
}

// Show a toast message
function showToast(message, type = 'success') {
  // Remove any existing toasts
  const existingToast = document.getElementById('toast');
  if (existingToast) {
    existingToast.remove();
  }

  const toast = document.createElement('div');
  toast.id = 'toast';
  toast.className = `fixed bottom-4 left-1/2 transform -translate-x-1/2 px-4 py-2 rounded-md text-white ${
    type === 'error' ? 'bg-red-500' : 'bg-green-500'
  } shadow-lg z-50 transition-opacity duration-300 opacity-0`;
  toast.textContent = message;
  document.body.appendChild(toast);

  // Trigger reflow
  void toast.offsetWidth;

  // Fade in
  toast.classList.remove('opacity-0');
  toast.classList.add('opacity-100');

  // Auto-hide after 3 seconds
  setTimeout(() => {
    toast.classList.remove('opacity-100');
    toast.classList.add('opacity-0');

    // Remove from DOM after fade out
    setTimeout(() => {
      toast.remove();
    }, 300);
  }, 3000);
}

// Get the current tab's URL with timeout to prevent freezing
async function getCurrentTabUrl() {
  try {
    // Add timeout to prevent hanging
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Timeout')), 1000),
    );

    const queryPromise = chrome.tabs.query({
      active: true,
      currentWindow: true,
    });

    const [tab] = await Promise.race([queryPromise, timeoutPromise]);
    if (tab && tab.url) {
      // Only use the origin (protocol + host) to avoid long URLs
      const url = new URL(tab.url);
      return `${url.origin}${url.pathname !== '/' ? url.pathname : ''}`;
    }
  } catch (error) {
    console.error('Error getting current tab URL:', error);
  }
  return '';
}

// Initialize the popup
document.addEventListener('DOMContentLoaded', async () => {
  try {
    await initDB();

    // Set up event listeners
    const aliasInput = $('#alias');
    const urlInput = $('#url');
    const searchInput = $('#search');

    // Focus the alias input
    aliasInput.focus();

    // Get and set the current tab's URL (don't await - do it in background)
    getCurrentTabUrl()
      .then((currentUrl) => {
        if (currentUrl) {
          urlInput.val(currentUrl);
        }
      })
      .catch(() => {});

    // Ensure alias input has focus
    aliasInput.trigger('focus');

    // Set up search with jQuery for better reactivity
    const performSearch = () => {
      try {
        const searchTerm = searchInput.val().toLowerCase().trim();
        let visibleCount = 0;

        // Show/hide aliases based on search
        $('#aliases > div').each(function () {
          const $aliasEl = $(this);
          const alias = $aliasEl.attr('data-alias') || '';
          const url = $aliasEl.find('.url').text() || '';

          const isVisible =
            searchTerm === '' ||
            alias.toLowerCase().includes(searchTerm) ||
            url.toLowerCase().includes(searchTerm);

          $aliasEl.toggle(isVisible);
          if (isVisible) visibleCount++;
        });

        // Update no-aliases message
        const $noResults = $('#no-aliases');
        const $aliasesContainer = $('#aliases');
        const hasAliases = $aliasesContainer.children().length > 0;

        if (!hasAliases) {
          $noResults
            .text('No aliases yet. Add one above or import from a file.')
            .show();
        } else if (visibleCount === 0) {
          $noResults.text('No aliases match your search.').show();
        } else {
          $noResults.hide();
        }
      } catch (error) {
        console.error('Search error:', error);
      }
    };

    // Bind input event
    searchInput.off('input').on('input', performSearch);

    // Initial search
    performSearch();

    $('#new-alias').submit(async (e) => {
      e.preventDefault();

      const alias = $('#alias').val().replace(/[^\w]/g, '');
      const url = $('#url').val();

      if (!alias || !url) {
        alert('You must enter an alias and URL...');
        return;
      }

      try {
        await set(alias, url);
        $('#alias').val('');
        $('#url').val('');
        window.close();
      } catch (error) {
        console.error('Error saving alias:', error);
        alert('Failed to save alias. Please try again.');
      }
    });

    // Load existing aliases
    const aliases = await getAll();
    const aliasCount = Object.keys(aliases).length;
    updateAliasCount(aliasCount);

    for (const alias in aliases) {
      insert(alias, aliases[alias]);
    }

    // Set up export button
    document
      .getElementById('export-btn')
      .addEventListener('click', exportAliases);

    // Set up import file input
    document
      .getElementById('import-file')
      .addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        try {
          const count = await importAliases(file);
          showToast(`Successfully imported ${count} aliases!`);

          // Refresh the alias list
          const aliases = await getAll();
          updateAliasCount(Object.keys(aliases).length);
          document.getElementById('aliases').innerHTML = '';
          for (const alias in aliases) {
            insert(alias, aliases[alias]);
          }
        } catch (error) {
          console.error('Import failed:', error);
          showToast(
            error.message || 'Import failed. Please check the file format.',
            'error',
          );
        } finally {
          // Reset the file input
          e.target.value = '';
        }
      });
  } catch (error) {
    console.error('Initialization error:', error);
    showToast(
      'Failed to initialize the extension. Please refresh and try again.',
      'error',
    );
  }
});

// Helper function to insert an alias into the UI
function insert(alias, url) {
  const aliasElement = document.createElement('div');
  aliasElement.className = 'alias-item';
  aliasElement.setAttribute('data-alias', alias); // Add data-alias attribute
  aliasElement.innerHTML = `
    <span class="alias">${alias}</span>
    <span class="url">${url}</span>
    <button class="remove" data-alias="${alias}">×</button>
  `;

  aliasElement.querySelector('.remove').addEventListener('click', async (e) => {
    e.stopPropagation();
    try {
      await remove(alias);
      aliasElement.remove();
    } catch (error) {
      console.error('Error removing alias:', error);
      alert('Failed to remove alias. Please try again.');
    }
  });

  document.getElementById('aliases').appendChild(aliasElement);
}

// Add some styles for the toast
const style = document.createElement('style');
style.textContent = `
  #toast {
    transition: opacity 0.3s ease-in-out;
    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
  }
`;
document.head.appendChild(style);

// Expose functions for debugging if needed
window.aliasDB = {
  set: async (alias, url) => {
    await set(alias, url);
    const aliases = await getAll();
    updateAliasCount(Object.keys(aliases).length);
  },
  get: getAll,
  remove: async (alias) => {
    await remove(alias);
    const aliases = await getAll();
    updateAliasCount(Object.keys(aliases).length);
  },
  clear: async () => {
    await clear();
    updateAliasCount(0);
  },
};
