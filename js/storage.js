// Storage wrapper using IndexedDB
class AliasStorage {
  constructor() {
    this.dbName = 'AliaDB';
    this.storeName = 'aliases';
    this.db = null;
    this.initializeDB();
  }

  initializeDB() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, 1);

      request.onerror = (event) => {
        console.error('IndexedDB error:', event.target.error);
        reject(event.target.error);
      };

      request.onsuccess = (event) => {
        this.db = event.target.result;
        resolve(this.db);
      };

      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains(this.storeName)) {
          db.createObjectStore(this.storeName, { keyPath: 'alias' });
        }
      };
    });
  }

  async set(alias, url) {
    if (!this.db) await this.initializeDB();

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);

      const request = store.put({ alias, url });

      request.onsuccess = () => resolve();
      request.onerror = (event) => {
        console.error('Error setting alias:', event.target.error);
        reject(event.target.error);
      };
    });
  }

  async get(alias) {
    if (!this.db) await this.initializeDB();

    return new Promise((resolve) => {
      const transaction = this.db.transaction([this.storeName]);
      const store = transaction.objectStore(this.storeName);

      const request = store.get(alias);

      request.onsuccess = () => resolve(request.result?.url);
      request.onerror = () => resolve(null);
    });
  }

  async getAll() {
    if (!this.db) await this.initializeDB();

    return new Promise((resolve) => {
      const transaction = this.db.transaction([this.storeName]);
      const store = transaction.objectStore(this.storeName);
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

  async remove(alias) {
    if (!this.db) await this.initializeDB();

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);

      const request = store.delete(alias);

      request.onsuccess = () => resolve();
      request.onerror = (event) => {
        console.error('Error removing alias:', event.target.error);
        reject(event.target.error);
      };
    });
  }

  async clear() {
    if (!this.db) await this.initializeDB();

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);

      const request = store.clear();

      request.onsuccess = () => resolve();
      request.onerror = (event) => {
        console.error('Error clearing storage:', event.target.error);
        reject(event.target.error);
      };
    });
  }
}

// Create a singleton instance
const aliasStorage = new AliasStorage();

export default aliasStorage;
