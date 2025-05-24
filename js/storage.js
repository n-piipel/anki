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
    
    /**
     * Performance optimization: Data compression methods
     */
    
    /**
     * Compress data using simple run-length encoding for JSON
     * @param {string} data - Data to compress
     * @returns {string} Compressed data
     */
    compressData(data) {
        try {
            // Simple compression for JSON data
            // Remove unnecessary whitespace and apply basic compression
            let compressed = data
                .replace(/\s+/g, ' ')
                .replace(/","/g, '","')
                .replace(/": "/g, '":"')
                .replace(/", "/g, '","');
            
            // Basic run-length encoding for repeated patterns
            compressed = compressed.replace(/(".{1,10}")\1+/g, (match, pattern) => {
                const count = match.length / pattern.length;
                return `${pattern}*${count}`;
            });
            
            return compressed;
        } catch (error) {
            console.warn('Compression failed, using original data:', error);
            return data;
        }
    }
    
    /**
     * Decompress data
     * @param {string} data - Compressed data
     * @returns {string} Decompressed data
     */
    decompressData(data) {
        try {
            // Reverse run-length encoding
            return data.replace(/(".{1,10}")\*(\d+)/g, (match, pattern, count) => {
                return pattern.repeat(parseInt(count));
            });
        } catch (error) {
            console.warn('Decompression failed, using original data:', error);
            return data;
        }
    }
    
    /**
     * Get compressed storage size info
     * @returns {Object} Storage size information
     */
    getStorageSizeInfo() {
        let totalSize = 0;
        let compressedSize = 0;
        const items = {};
        
        for (const key in localStorage) {
            if (key.startsWith(this.prefix)) {
                const value = localStorage[key];
                const compressed = this.compressData(value);
                
                totalSize += value.length;
                compressedSize += compressed.length;
                
                items[key] = {
                    original: value.length,
                    compressed: compressed.length,
                    ratio: Math.round((1 - compressed.length / value.length) * 100)
                };
            }
        }
        
        return {
            totalSize,
            compressedSize,
            compressionRatio: totalSize > 0 ? Math.round((1 - compressedSize / totalSize) * 100) : 0,
            items,
            estimatedSavings: totalSize - compressedSize
        };
    }
    
    /**
     * Optimize localStorage by compressing large items
     */
    optimizeStorage() {
        const sizeInfo = this.getStorageSizeInfo();
        let optimized = 0;
        
        for (const [key, info] of Object.entries(sizeInfo.items)) {
            // Optimize items larger than 1KB with potential savings > 10%
            if (info.original > 1024 && info.ratio > 10) {
                try {
                    const originalData = localStorage.getItem(key);
                    const compressedData = this.compressData(originalData);
                    
                    // Mark as compressed and store
                    localStorage.setItem(key, `__COMPRESSED__${compressedData}`);
                    optimized++;
                    
                    console.log(`🗜️ Compressed ${key}: ${info.original} → ${info.compressed} bytes (${info.ratio}% saved)`);
                } catch (error) {
                    console.warn(`Failed to compress ${key}:`, error);
                }
            }
        }
        
        console.log(`📦 Storage optimization complete: ${optimized} items compressed`);
        return optimized;
    }
    
    /**
     * Enhanced getData with decompression support
     * @param {string} key - Storage key
     * @param {*} defaultValue - Default value if key doesn't exist
     * @returns {*} Stored data
     */
    getDataOptimized(key, defaultValue = null) {
        try {
            const fullKey = `${this.prefix}${key}`;
            let data = localStorage.getItem(fullKey);
            
            if (data === null) {
                return defaultValue;
            }
            
            // Check if data is compressed
            if (data.startsWith('__COMPRESSED__')) {
                data = this.decompressData(data.slice(14)); // Remove __COMPRESSED__ prefix
            }
            
            return JSON.parse(data);
        } catch (error) {
            console.error(`Error getting optimized data for key ${key}:`, error);
            return defaultValue;
        }
    }
    
    /**
     * Clean up old or corrupted data
     */
    cleanupStorage() {
        const keysToRemove = [];
        let cleanedSize = 0;
        
        for (const key in localStorage) {
            if (key.startsWith(this.prefix)) {
                try {
                    const value = localStorage.getItem(key);
                    
                    // Check for corrupted data
                    if (value && value.startsWith('__COMPRESSED__')) {
                        const decompressed = this.decompressData(value.slice(14));
                        JSON.parse(decompressed); // Test if valid JSON
                    } else if (value) {
                        JSON.parse(value); // Test if valid JSON
                    }
                    
                    // Check for very old data (> 6 months)
                    const data = this.getDataOptimized(key.replace(this.prefix, ''));
                    if (data && data.lastAccessed) {
                        const age = Date.now() - data.lastAccessed;
                        const sixMonths = 6 * 30 * 24 * 60 * 60 * 1000;
                        
                        if (age > sixMonths) {
                            keysToRemove.push(key);
                            cleanedSize += value.length;
                        }
                    }
                    
                } catch (error) {
                    // Corrupted data, mark for removal
                    console.warn(`Corrupted data found: ${key}`, error);
                    keysToRemove.push(key);
                    cleanedSize += localStorage.getItem(key).length;
                }
            }
        }
        
        // Remove identified keys
        keysToRemove.forEach(key => {
            localStorage.removeItem(key);
            console.log(`🗑️ Removed corrupted/old data: ${key}`);
        });
        
        console.log(`🧹 Storage cleanup complete: ${keysToRemove.length} items removed, ${cleanedSize} bytes freed`);
        return { itemsRemoved: keysToRemove.length, bytesFreed: cleanedSize };
    }
    
    /**
     * Get detailed storage statistics
     */
    getDetailedStorageStats() {
        const sizeInfo = this.getStorageSizeInfo();
        const cleanupInfo = { itemsRemoved: 0, bytesFreed: 0 }; // Simulate cleanup analysis
        
        // Calculate storage quota usage (estimate)
        const estimatedQuota = 5 * 1024 * 1024; // 5MB typical quota
        const usagePercent = Math.round((sizeInfo.totalSize / estimatedQuota) * 100);
        
        return {
            usage: {
                totalBytes: sizeInfo.totalSize,
                totalKB: Math.round(sizeInfo.totalSize / 1024),
                usagePercent: Math.min(usagePercent, 100),
                estimatedQuota: estimatedQuota
            },
            compression: {
                enabled: sizeInfo.compressionRatio > 0,
                ratio: sizeInfo.compressionRatio,
                savedBytes: sizeInfo.estimatedSavings
            },
            cleanup: cleanupInfo,
            recommendations: this.getStorageRecommendations(sizeInfo, usagePercent)
        };
    }
    
    /**
     * Get storage optimization recommendations
     */
    getStorageRecommendations(sizeInfo, usagePercent) {
        const recommendations = [];
        
        if (usagePercent > 80) {
            recommendations.push('⚠️ Высокое использование хранилища - рекомендуется очистка');
        }
        
        if (sizeInfo.compressionRatio < 10) {
            recommendations.push('📦 Можно улучшить сжатие данных');
        }
        
        if (Object.keys(sizeInfo.items).length > 50) {
            recommendations.push('🧹 Много элементов - рекомендуется очистка старых данных');
        }
        
        if (recommendations.length === 0) {
            recommendations.push('✅ Хранилище оптимизировано');
        }
        
        return recommendations;
    }
} 