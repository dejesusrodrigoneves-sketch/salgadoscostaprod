/**
 * Offline support module
 * IndexedDB for caching orders and queueing confirmations
 */
const EntregadorOffline = {
  DB_NAME: 'sic-entregador',
  DB_VERSION: 1,
  db: null,

  async init() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.DB_NAME, this.DB_VERSION);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = event.target.result;

        // Cached orders
        if (!db.objectStoreNames.contains('cachedOrders')) {
          const store = db.createObjectStore('cachedOrders', { keyPath: 'id' });
          store.createIndex('empresaId', 'empresaId', { unique: false });
          store.createIndex('entregadorId', 'entregadorId', { unique: false });
        }

        // Pending confirmations (offline queue)
        if (!db.objectStoreNames.contains('pendingConfirmations')) {
          db.createObjectStore('pendingConfirmations', { keyPath: 'id', autoIncrement: true });
        }

        // Sync queue
        if (!db.objectStoreNames.contains('syncQueue')) {
          db.createObjectStore('syncQueue', { keyPath: 'id', autoIncrement: true });
        }
      };
    });
  },

  // ===== CACHED ORDERS =====

  async cacheOrders(orders) {
    if (!this.db) await this.init();
    const tx = this.db.transaction('cachedOrders', 'readwrite');
    const store = tx.objectStore('cachedOrders');
    for (const order of orders) {
      store.put({ ...order, lastUpdated: Date.now() });
    }
    return new Promise((resolve) => { tx.oncomplete = resolve; });
  },

  async getCachedOrders() {
    if (!this.db) await this.init();
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction('cachedOrders', 'readonly');
      const store = tx.objectStore('cachedOrders');
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  },

  async clearCachedOrders() {
    if (!this.db) await this.init();
    const tx = this.db.transaction('cachedOrders', 'readwrite');
    const store = tx.objectStore('cachedOrders');
    store.clear();
    return new Promise((resolve) => { tx.oncomplete = resolve; });
  },

  // ===== PENDING CONFIRMATIONS =====

  async queueConfirmation(pedidoId, valorCobrado, observacao) {
    if (!this.db) await this.init();
    const item = {
      pedidoId,
      valorCobrado,
      observacao,
      timestamp: Date.now(),
      synced: false,
    };
    const tx = this.db.transaction('pendingConfirmations', 'readwrite');
    const store = tx.objectStore('pendingConfirmations');
    const request = store.add(item);
    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve(request.result);
      tx.onerror = () => reject(tx.error);
    });
  },

  async getPendingConfirmations() {
    if (!this.db) await this.init();
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction('pendingConfirmations', 'readonly');
      const store = tx.objectStore('pendingConfirmations');
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result.filter(i => !i.synced));
      request.onerror = () => reject(request.error);
    });
  },

  async markConfirmationSynced(id) {
    if (!this.db) await this.init();
    const tx = this.db.transaction('pendingConfirmations', 'readwrite');
    const store = tx.objectStore('pendingConfirmations');
    const request = store.get(id);
    request.onsuccess = () => {
      const item = request.result;
      if (item) {
        item.synced = true;
        store.put(item);
      }
    };
    return new Promise((resolve) => { tx.oncomplete = resolve; });
  },

  // ===== SYNC QUEUE =====

  async addToSyncQueue(type, payload) {
    if (!this.db) await this.init();
    const item = { type, payload, timestamp: Date.now() };
    const tx = this.db.transaction('syncQueue', 'readwrite');
    const store = tx.objectStore('syncQueue');
    const request = store.add(item);
    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve(request.result);
      tx.onerror = () => reject(tx.error);
    });
  },

  async getSyncQueue() {
    if (!this.db) await this.init();
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction('syncQueue', 'readonly');
      const store = tx.objectStore('syncQueue');
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  },

  async clearSyncQueue() {
    if (!this.db) await this.init();
    const tx = this.db.transaction('syncQueue', 'readwrite');
    const store = tx.objectStore('syncQueue');
    store.clear();
    return new Promise((resolve) => { tx.oncomplete = resolve; });
  },

  // ===== SYNC PROCESS =====

  async syncPendingConfirmations() {
    const pending = await this.getPendingConfirmations();
    if (pending.length === 0) return;

    console.log(`[Offline] Syncing ${pending.length} pending confirmations...`);

    for (const item of pending) {
      try {
        await EntregadorAPI.confirmarEntrega(item.pedidoId, item.valorCobrado, item.observacao);
        await this.markConfirmationSynced(item.id);
        console.log(`[Offline] Synced confirmation for pedido ${item.pedidoId}`);
      } catch (err) {
        console.error(`[Offline] Failed to sync confirmation for pedido ${item.pedidoId}:`, err.message);
      }
    }
  },

  // ===== ONLINE/OFFLINE HANDLING =====

  setupSyncOnReconnect() {
    window.addEventListener('online', async () => {
      console.log('[Offline] Back online — syncing...');
      document.body.classList.remove('offline');
      await this.syncPendingConfirmations();
    });

    window.addEventListener('offline', () => {
      console.log('[Offline] Gone offline');
      document.body.classList.add('offline');
    });

    // Initial check
    if (!navigator.onLine) {
      document.body.classList.add('offline');
    }
  },

  // ===== ENHANCED API (offline-aware) =====

  async loadOrders() {
    try {
      const data = await EntregadorAPI.getPedidos();
      // Cache for offline use
      await this.cacheOrders(data.pedidos || []);
      return data;
    } catch (err) {
      // Offline — serve from cache
      if (!navigator.onLine) {
        const cached = await this.getCachedOrders();
        return { pedidos: cached, count: cached.length, fromCache: true };
      }
      throw err;
    }
  },

  async confirmDelivery(pedidoId, valorCobrado, observacao) {
    if (navigator.onLine) {
      return EntregadorAPI.confirmarEntrega(pedidoId, valorCobrado, observacao);
    }

    // Offline — queue for later
    await this.queueConfirmation(pedidoId, valorCobrado, observacao);
    await this.addToSyncQueue('confirm', { pedidoId, valorCobrado, observacao });

    // Remove from cached orders (optimistic)
    const cached = await this.getCachedOrders();
    const updated = cached.filter(o => o.id !== pedidoId);
    await this.clearCachedOrders();
    await this.cacheOrders(updated);

    return { success: true, offline: true };
  },
};

// Auto-init on load
if (typeof window !== 'undefined') {
  EntregadorOffline.init().then(() => {
    EntregadorOffline.setupSyncOnReconnect();
  }).catch(err => {
    console.error('[Offline] Init failed:', err.message);
  });
}
