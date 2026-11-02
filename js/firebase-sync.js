/**
 * Western India Plywoods - Boiler Fuel Management
 * Google Firebase Firestore Cloud Sync Module
 * Syncs shift data across multiple mobile phones on different internet connections in real-time.
 */

const FIREBASE_CONFIG_KEY = 'wip_firebase_config_v1';

class FirebaseSyncService {
  constructor() {
    this.app = null;
    this.db = null;
    this.isInitialized = false;
    this.unsubscribeListener = null;
    this.statusCallback = null;
    this.dataUpdateCallback = null;

    // Load saved config if any
    this.config = this.loadConfig();
  }

  loadConfig() {
    try {
      const data = localStorage.getItem(FIREBASE_CONFIG_KEY);
      return data ? JSON.parse(data) : null;
    } catch (e) {
      console.error('Failed to load Firebase config', e);
      return null;
    }
  }

  saveConfig(config) {
    this.config = config;
    try {
      localStorage.setItem(FIREBASE_CONFIG_KEY, JSON.stringify(config));
    } catch (e) {
      console.error('Failed to save Firebase config', e);
    }
  }

  clearConfig() {
    this.config = null;
    localStorage.removeItem(FIREBASE_CONFIG_KEY);
    if (this.unsubscribeListener) {
      this.unsubscribeListener();
      this.unsubscribeListener = null;
    }
    this.isInitialized = false;
    this.updateStatus('disconnected', 'Cloud Disconnected');
  }

  onStatusChange(cb) {
    this.statusCallback = cb;
  }

  onDataUpdate(cb) {
    this.dataUpdateCallback = cb;
  }

  updateStatus(status, text) {
    if (this.statusCallback) {
      this.statusCallback(status, text);
    }
  }

  async init(customConfig = null) {
    const configToUse = customConfig || this.config;
    if (!configToUse || !configToUse.apiKey || !configToUse.projectId) {
      this.updateStatus('unconfigured', 'Local Only (No Cloud Config)');
      return false;
    }

    try {
      if (typeof firebase === 'undefined') {
        this.updateStatus('error', 'Firebase SDK not loaded');
        console.warn('Firebase SDK compat scripts not available');
        return false;
      }

      // Initialize or reuse app
      if (!firebase.apps.length) {
        this.app = firebase.initializeApp(configToUse);
      } else {
        this.app = firebase.app();
      }

      this.db = firebase.firestore();

      // Enable offline persistence if possible
      try {
        await this.db.enablePersistence({ synchronizeTabs: true });
        console.log('Firestore offline persistence enabled');
      } catch (err) {
        if (err.code === 'failed-precondition') {
          console.warn('Firestore persistence failed: Multiple tabs open');
        } else if (err.code === 'unimplemented') {
          console.warn('Firestore persistence not supported in this browser');
        }
      }

      this.saveConfig(configToUse);
      this.isInitialized = true;
      this.updateStatus('connected', 'Cloud Synced (Firebase)');

      // Start real-time sync listener
      this.listenToShifts();

      // Upload any local shifts that are not yet in Firestore
      this.syncPendingLocalShifts();

      return true;
    } catch (err) {
      console.error('Firebase initialization error', err);
      this.updateStatus('error', `Firebase Error: ${err.message}`);
      return false;
    }
  }

  /**
   * Real-time listener for shifts collection
   */
  listenToShifts() {
    if (!this.db || !this.isInitialized) return;

    if (this.unsubscribeListener) {
      this.unsubscribeListener();
    }

    try {
      this.unsubscribeListener = this.db.collection('shifts')
        .onSnapshot((snapshot) => {
          const remoteShifts = [];
          snapshot.forEach(doc => {
            remoteShifts.push(doc.data());
          });

          this.updateStatus('connected', 'Cloud Synced (Live)');

          if (this.dataUpdateCallback) {
            this.dataUpdateCallback(remoteShifts);
          }
        }, (error) => {
          console.error('Firestore listener error', error);
          this.updateStatus('offline', 'Cloud Offline (Using Local Data)');
        });
    } catch (e) {
      console.error('Failed to attach Firestore snapshot listener', e);
    }
  }

  /**
   * Save a shift document to Firestore
   */
  async saveShift(shiftData) {
    if (!this.isInitialized || !this.db) {
      console.log('Firebase not initialized, saved locally only.');
      return false;
    }

    try {
      const docId = shiftData.id;
      const cleanData = JSON.parse(JSON.stringify(shiftData)); // Strip functions / undefined
      await this.db.collection('shifts').doc(docId).set(cleanData, { merge: true });
      console.log('Shift synced to Firebase Firestore:', docId);
      this.updateStatus('connected', 'Cloud Synced (Saved)');
      return true;
    } catch (err) {
      console.error('Failed to save shift to Firestore', err);
      this.updateStatus('offline', 'Cloud Error (Saved Locally)');
      return false;
    }
  }

  /**
   * Delete a shift from Firestore
   */
  async deleteShift(shiftId) {
    if (!this.isInitialized || !this.db) return false;
    try {
      await this.db.collection('shifts').doc(shiftId).delete();
      console.log('Shift deleted from Firebase:', shiftId);
      return true;
    } catch (err) {
      console.error('Failed to delete shift from Firestore', err);
      return false;
    }
  }

  /**
   * Sync existing shifts from local storage to Firestore
   */
  async syncPendingLocalShifts() {
    if (!this.isInitialized || !this.db || !window.boilerStore) return;

    try {
      const localShifts = window.boilerStore.shifts || [];
      for (const shift of localShifts) {
        await this.saveShift(shift);
      }
    } catch (e) {
      console.warn('Local shift sync to Firestore had warnings', e);
    }
  }
}

// Global Firebase service instance
window.firebaseSync = new FirebaseSyncService();
