/**
 * Storage Manager
 * Handles localStorage operations for flashcard progress and app settings
 */

class StorageManager {
    constructor() {
        this.prefix = 'anki-flashcards';
        this.version = '1.0';
        this.keys = {
            CARDS: `${this.prefix}-cards`,
            SETTINGS: `${this.prefix}-settings`,
            STATS: `${this.prefix}-stats`,
            VERSION: `${this.prefix}-version`
        };
        
        this.init();
    }
    
    init() {
        // Check if we need to migrate data format
        this.checkVersion();
        
        // Initialize default settings if needed
        this.initializeDefaults();
    }
    
    checkVersion() {
        const storedVersion = localStorage.getItem(this.keys.VERSION);
        
        if (!storedVersion) {
            // First time user - set version
            localStorage.setItem(this.keys.VERSION, this.version);
        } else if (storedVersion !== this.version) {
            // Version mismatch - handle migration if needed
            console.log(`Migrating from version ${storedVersion} to ${this.version}`);
            this.migrateData(storedVersion, this.version);
            localStorage.setItem(this.keys.VERSION, this.version);
        }
    }
    
    migrateData(fromVersion, toVersion) {
        // Handle data migration between versions
        console.log('Data migration not needed for this update');
    }
    
    initializeDefaults() {
        // Initialize settings if they don't exist
        if (!localStorage.getItem(this.keys.SETTINGS)) {
            const defaultSettings = {
                theme: 'light',
                cardsPerSession: 20,
                autoPlayAudio: false,
                showTimer: true,
                keyboardShortcuts: true
            };
            this.setData(this.keys.SETTINGS, defaultSettings);
        }
        
        // Initialize stats if they don't exist
        if (!localStorage.getItem(this.keys.STATS)) {
            const defaultStats = {
                totalCardsStudied: 0,
                totalSessions: 0,
                totalTimeSpent: 0,
                streakDays: 0,
                lastStudyDate: null,
                cardsPerDay: {}
            };
            this.setData(this.keys.STATS, defaultStats);
        }
    }
    
    // Generic data operations
    setData(key, data) {
        try {
            const serialized = JSON.stringify(data);
            localStorage.setItem(key, serialized);
            return true;
        } catch (error) {
            console.error('Failed to save data to localStorage:', error);
            
            // Handle storage quota exceeded
            if (error.name === 'QuotaExceededError') {
                this.handleStorageQuotaExceeded();
            }
            return false;
        }
    }
    
    getData(key, defaultValue = null) {
        try {
            const serialized = localStorage.getItem(key);
            return serialized ? JSON.parse(serialized) : defaultValue;
        } catch (error) {
            console.error('Failed to load data from localStorage:', error);
            return defaultValue;
        }
    }
    
    removeData(key) {
        try {
            localStorage.removeItem(key);
            return true;
        } catch (error) {
            console.error('Failed to remove data from localStorage:', error);
            return false;
        }
    }
    
    // Card state operations
    getCardState(cardSetId, cardId) {
        const cardsData = this.getData(this.keys.CARDS, {});
        const cardSetData = cardsData[cardSetId] || {};
        
        return cardSetData[cardId] || {
            interval: 1,
            easeFactor: 2.5,
            repetitions: 0,
            dueDate: new Date().toISOString().split('T')[0],
            createdAt: new Date().toISOString(),
            lastReviewed: null,
            totalReviews: 0,
            correctReviews: 0
        };
    }
    
    setCardState(cardSetId, cardId, state) {
        const cardsData = this.getData(this.keys.CARDS, {});
        
        if (!cardsData[cardSetId]) {
            cardsData[cardSetId] = {};
        }
        
        cardsData[cardSetId][cardId] = {
            ...state,
            lastReviewed: new Date().toISOString()
        };
        
        return this.setData(this.keys.CARDS, cardsData);
    }
    
    getCardSetProgress(cardSetId) {
        const cardsData = this.getData(this.keys.CARDS, {});
        const cardSetData = cardsData[cardSetId] || {};
        
        const cards = Object.values(cardSetData);
        const today = new Date().toISOString().split('T')[0];
        
        return {
            totalCards: cards.length,
            newCards: cards.filter(card => card.repetitions === 0).length,
            reviewCards: cards.filter(card => card.dueDate <= today && card.repetitions > 0).length,
            matureCards: cards.filter(card => card.repetitions >= 3).length,
            youngCards: cards.filter(card => card.repetitions > 0 && card.repetitions < 3).length
        };
    }
    
    // Settings operations
    getSetting(key) {
        const settings = this.getData(this.keys.SETTINGS, {});
        return settings[key];
    }
    
    setSetting(key, value) {
        const settings = this.getData(this.keys.SETTINGS, {});
        settings[key] = value;
        return this.setData(this.keys.SETTINGS, settings);
    }
    
    getAllSettings() {
        return this.getData(this.keys.SETTINGS, {});
    }
    
    // Statistics operations
    getStats() {
        return this.getData(this.keys.STATS, {});
    }
    
    updateStats(updates) {
        const stats = this.getStats();
        const updatedStats = { ...stats, ...updates };
        return this.setData(this.keys.STATS, updatedStats);
    }
    
    recordStudySession(cardSetId, sessionData) {
        const stats = this.getStats();
        const today = new Date().toISOString().split('T')[0];
        
        // Initialize cardsPerDay if it doesn't exist
        if (!stats.cardsPerDay) {
            stats.cardsPerDay = {};
        }
        
        // Update general stats
        stats.totalCardsStudied = (stats.totalCardsStudied || 0) + sessionData.cardsStudied;
        stats.totalSessions = (stats.totalSessions || 0) + 1;
        stats.totalTimeSpent = (stats.totalTimeSpent || 0) + sessionData.timeSpent;
        stats.lastStudyDate = today;
        
        // Update daily stats
        if (!stats.cardsPerDay[today]) {
            stats.cardsPerDay[today] = 0;
        }
        stats.cardsPerDay[today] += sessionData.cardsStudied;
        
        // Update streak
        this.updateStreak(stats, today);
        
        // Update card set specific stats
        if (!stats.cardSets) {
            stats.cardSets = {};
        }
        
        if (!stats.cardSets[cardSetId]) {
            stats.cardSets[cardSetId] = {
                totalCardsStudied: 0,
                totalSessions: 0,
                totalTimeSpent: 0,
                totalCorrect: 0,
                totalAnswered: 0,
                averageAccuracy: 0,
                lastStudied: null
            };
        }
        
        const cardSetStats = stats.cardSets[cardSetId];
        cardSetStats.totalCardsStudied += sessionData.cardsStudied;
        cardSetStats.totalSessions += 1;
        cardSetStats.totalTimeSpent += sessionData.timeSpent;
        cardSetStats.lastStudied = today;
        
        // Calculate average accuracy
        const totalCorrect = cardSetStats.totalCorrect || 0;
        const totalAnswered = cardSetStats.totalAnswered || 0;
        cardSetStats.totalCorrect = totalCorrect + (sessionData.correctAnswers || 0);
        cardSetStats.totalAnswered = totalAnswered + (sessionData.cardsStudied || 0);
        
        if (cardSetStats.totalAnswered > 0) {
            cardSetStats.averageAccuracy = Math.round((cardSetStats.totalCorrect / cardSetStats.totalAnswered) * 100);
        }
        
        return this.setData(this.keys.STATS, stats);
    }
    
    updateStreak(stats, today) {
        const lastStudyDate = stats.lastStudyDate;
        
        if (!lastStudyDate) {
            // First study session
            stats.streakDays = 1;
        } else {
            const lastDate = new Date(lastStudyDate);
            const todayDate = new Date(today);
            const daysDiff = Math.floor((todayDate - lastDate) / (1000 * 60 * 60 * 24));
            
            if (daysDiff === 1) {
                // Consecutive day
                stats.streakDays += 1;
            } else if (daysDiff === 0) {
                // Same day, no change to streak
            } else {
                // Streak broken
                stats.streakDays = 1;
            }
        }
    }
    
    // Data management
    exportData() {
        const data = {
            version: this.version,
            exportDate: new Date().toISOString(),
            cards: this.getData(this.keys.CARDS, {}),
            settings: this.getData(this.keys.SETTINGS, {}),
            stats: this.getData(this.keys.STATS, {})
        };
        
        return JSON.stringify(data, null, 2);
    }
    
    importData(jsonData) {
        try {
            const data = JSON.parse(jsonData);
            
            // Validate data structure
            if (!data.version || !data.cards || !data.settings || !data.stats) {
                throw new Error('Invalid data format');
            }
            
            // Import data
            this.setData(this.keys.CARDS, data.cards);
            this.setData(this.keys.SETTINGS, data.settings);
            this.setData(this.keys.STATS, data.stats);
            
            return true;
        } catch (error) {
            console.error('Failed to import data:', error);
            return false;
        }
    }
    
    clearAllData() {
        const keys = Object.values(this.keys);
        keys.forEach(key => this.removeData(key));
        
        // Reinitialize defaults
        this.initializeDefaults();
    }
    
    getStorageInfo() {
        const used = new Blob(Object.values(localStorage)).size;
        const available = 5 * 1024 * 1024; // Rough estimate of 5MB localStorage limit
        
        return {
            used: used,
            available: available,
            usedPercentage: Math.round((used / available) * 100),
            usedFormatted: this.formatBytes(used),
            availableFormatted: this.formatBytes(available)
        };
    }
    
    formatBytes(bytes) {
        if (bytes === 0) return '0 Bytes';
        
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }
    
    handleStorageQuotaExceeded() {
        console.warn('localStorage quota exceeded. Attempting to free up space...');
        
        // Strategy 1: Remove old daily stats (keep only last 30 days)
        const stats = this.getStats();
        if (stats.cardsPerDay) {
            const thirtyDaysAgo = new Date();
            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
            
            Object.keys(stats.cardsPerDay).forEach(date => {
                if (new Date(date) < thirtyDaysAgo) {
                    delete stats.cardsPerDay[date];
                }
            });
            
            this.setData(this.keys.STATS, stats);
        }
        
        // Strategy 2: Remove very old card states (keep only last 100 days of due dates)
        const cardsData = this.getData(this.keys.CARDS, {});
        const hundredDaysAgo = new Date();
        hundredDaysAgo.setDate(hundredDaysAgo.getDate() - 100);
        
        Object.keys(cardsData).forEach(cardSetId => {
            Object.keys(cardsData[cardSetId]).forEach(cardId => {
                const cardState = cardsData[cardSetId][cardId];
                if (new Date(cardState.dueDate) < hundredDaysAgo && cardState.repetitions === 0) {
                    delete cardsData[cardSetId][cardId];
                }
            });
        });
        
        this.setData(this.keys.CARDS, cardsData);
        
        console.log('Storage cleanup completed');
    }
} 