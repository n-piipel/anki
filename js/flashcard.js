/**
 * Flashcard Manager
 * Handles loading CSV files, parsing cards, and integrating with storage and spaced repetition
 */

class FlashcardManager {
    constructor(storageManager, spacedRepetitionManager) {
        this.storage = storageManager;
        this.spacedRepetition = spacedRepetitionManager;
        this.cardSets = new Map();
        this.csvCache = new Map();
        
        // Performance optimization: Cache management
        this.cacheTimestamps = new Map();
        this.CACHE_TTL = 10 * 60 * 1000; // 10 minutes cache TTL
        this.MAX_CACHE_SIZE = 50; // Maximum cached card sets
        
        // Performance optimization: Prefetch popular sets
        this.popularSets = new Set(['general-knowledge', 'programming-terms']);
        this.preloadPromises = new Map();
    }
    
    /**
     * Get available card sets by scanning the data directory
     * @returns {Array} Array of card set objects
     */
    async getAvailableCardSets() {
        try {
            // Method 1: Try to load index.json file first (recommended approach)
            try {
                const indexResponse = await fetch('data/index.json');
                if (indexResponse.ok) {
                    const indexData = await indexResponse.json();
                    console.log('📋 Loading card sets from index.json');
                    
                    const availableCardSets = [];
                    for (const cardSetInfo of indexData.cardSets) {
                        try {
                            // Verify the file actually exists
                            const fileResponse = await fetch(`data/${cardSetInfo.filename}`, { method: 'HEAD' });
                            if (fileResponse.ok) {
                                const cardSetData = await this.getCardSetInfo(cardSetInfo.filename, cardSetInfo);
                                availableCardSets.push(cardSetData);
                            } else {
                                console.warn(`📁 File ${cardSetInfo.filename} listed in index but not found`);
                            }
                        } catch (error) {
                            console.warn(`📁 Error checking ${cardSetInfo.filename}:`, error);
                        }
                    }
                    
                    if (availableCardSets.length > 0) {
                        return availableCardSets;
                    }
                }
            } catch (error) {
                console.log('📋 No index.json found, falling back to automatic detection');
            }
            
            // Method 2: Fallback - try common/popular filenames
            console.log('🔍 Auto-detecting CSV files in data/ directory...');
            const potentialFiles = [
                'general-knowledge.csv',
                'programming-terms.csv',
                'english-vocabulary.csv',
                'history-facts.csv', 
                'science-basics.csv',
                'math-basics.csv',
                'geography.csv',
                'literature.csv',
                'philosophy.csv',
                'biology.csv',
                'chemistry.csv',
                'physics.csv',
                'language-learning.csv',
                'computer-science.csv',
                'web-development.csv',
                'javascript.csv',
                'python.csv',
                'react.csv',
                'spanish.csv',
                'french.csv',
                'german.csv',
                'russian.csv',
                'chinese.csv',
                'japanese.csv'
            ];
            
            const availableCardSets = [];
            
            // Check which files actually exist
            for (const fileName of potentialFiles) {
                try {
                    const response = await fetch(`data/${fileName}`, { method: 'HEAD' });
                    if (response.ok) {
                        console.log(`✅ Found: ${fileName}`);
                        const cardSetInfo = await this.getCardSetInfo(fileName);
                        availableCardSets.push(cardSetInfo);
                    }
                } catch (error) {
                    // File doesn't exist, skip it
                    console.log(`❌ Not found: ${fileName}`);
                }
            }
            
            // If no predefined sets found, create a demo set
            if (availableCardSets.length === 0) {
                console.log('📝 No CSV files found, creating demo set');
                availableCardSets.push(this.createDemoCardSet());
            }
            
            console.log(`📚 Found ${availableCardSets.length} card sets`);
            return availableCardSets;
            
        } catch (error) {
            console.error('Error getting available card sets:', error);
            return [this.createDemoCardSet()];
        }
    }
    
    /**
     * Get information about a specific card set
     * @param {string} fileName - Name of the CSV file
     * @param {Object} indexInfo - Optional additional info from index.json
     * @returns {Object} Card set information
     */
    async getCardSetInfo(fileName, indexInfo = null) {
        const id = fileName.replace('.csv', '');
        const name = indexInfo?.name || this.formatCardSetName(id);
        const description = indexInfo?.description || null;
        
        try {
            // Try to load the actual file to get accurate card count
            const cards = await this.loadCardsFromFile(fileName);
            const progress = this.storage.getCardSetProgress(id);
            
            const cardSetInfo = {
                id: id,
                name: name,
                fileName: fileName,
                totalCards: cards.length,
                newCards: Math.max(0, cards.length - progress.totalCards),
                reviewCards: progress.reviewCards,
                progressPercent: progress.totalCards > 0 ? 
                    Math.round((progress.totalCards / cards.length) * 100) : 0
            };
            
            // Add description if available
            if (description) {
                cardSetInfo.description = description;
            }
            
            return cardSetInfo;
            
        } catch (error) {
            // If we can't load the file, return basic info
            console.warn(`Could not load ${fileName} for info:`, error);
            return {
                id: id,
                name: name,
                fileName: fileName,
                totalCards: 0,
                newCards: 0,
                reviewCards: 0,
                progressPercent: 0,
                description: description
            };
        }
    }
    
    /**
     * Format card set ID into a readable name
     * @param {string} id - Card set ID
     * @returns {string} Formatted name
     */
    formatCardSetName(id) {
        return id
            .split('-')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' ');
    }
    
    /**
     * Create a demo card set for when no files are available
     * @returns {Object} Demo card set info
     */
    createDemoCardSet() {
        return {
            id: 'demo',
            name: 'Demo Flashcards',
            fileName: null,
            totalCards: 5,
            newCards: 5,
            reviewCards: 0,
            progressPercent: 0,
            isDemo: true
        };
    }
    
    /**
     * Load a specific card set
     * @param {string} cardSetId - ID of the card set to load
     * @returns {Object} Loaded card set with cards
     */
    async loadCardSet(cardSetId) {
        try {
            if (cardSetId === 'demo') {
                return this.createDemoCards();
            }
            
            const cardSetInfo = await this.getCardSetInfo(`${cardSetId}.csv`);
            const cards = await this.loadCardsFromFile(cardSetInfo.fileName);
            
            // Add IDs to cards if not present
            cards.forEach((card, index) => {
                if (!card.id) {
                    card.id = `${cardSetId}-${index}`;
                }
            });
            
            const cardSet = {
                ...cardSetInfo,
                cards: cards
            };
            
            // Cache the loaded card set
            this.cardSets.set(cardSetId, cardSet);
            
            return cardSet;
            
        } catch (error) {
            console.error(`Error loading card set ${cardSetId}:`, error);
            throw new Error(`Failed to load card set: ${cardSetId}`);
        }
    }
    
    /**
     * Load cards from a CSV file with improved caching
     * @param {string} fileName - Name of the CSV file
     * @returns {Array} Array of card objects
     */
    async loadCardsFromFile(fileName) {
        try {
            // Performance optimization: Check cache with TTL
            if (this.csvCache.has(fileName) && this.isCacheValid(fileName)) {
                console.log(`📦 Cache hit: ${fileName}`);
                return this.csvCache.get(fileName);
            }
            
            // Performance optimization: Check if already loading
            if (this.preloadPromises.has(fileName.replace('.csv', ''))) {
                console.log(`⏳ Waiting for prefetch: ${fileName}`);
                const cards = await this.preloadPromises.get(fileName.replace('.csv', ''));
                if (cards) return cards;
            }
            
            console.log(`🌐 Loading from network: ${fileName}`);
            const response = await fetch(`data/${fileName}`);
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            const csvContent = await response.text();
            const cards = this.parseCSV(csvContent);
            
            // Performance optimization: Enhanced caching
            this.csvCache.set(fileName, cards);
            this.updateCacheTimestamp(fileName);
            this.cleanExpiredCache();
            this.limitCacheSize();
            
            console.log(`✅ Loaded and cached: ${fileName} (${cards.length} cards)`);
            return cards;
            
        } catch (error) {
            console.error(`Error loading CSV file ${fileName}:`, error);
            throw error;
        }
    }
    
    /**
     * Parse CSV content into card objects
     * @param {string} csvContent - Raw CSV content
     * @returns {Array} Array of card objects
     */
    parseCSV(csvContent) {
        const lines = csvContent.trim().split('\n');
        const cards = [];
        
        // Skip empty lines and process each line
        lines.forEach((line, index) => {
            const trimmedLine = line.trim();
            if (!trimmedLine) return;
            
            try {
                // Simple CSV parsing - handles basic cases
                // For more complex CSV (with quotes, commas in fields), 
                // a proper CSV parser would be needed
                const parts = this.parseCSVLine(trimmedLine);
                
                if (parts.length >= 2) {
                    cards.push({
                        id: null, // Will be set by loadCardSet
                        question: parts[0].trim(),
                        answer: parts[1].trim(),
                        hint: parts[2] ? parts[2].trim() : null,
                        category: parts[3] ? parts[3].trim() : null,
                        difficulty: parts[4] ? parts[4].trim() : 'medium'
                    });
                }
            } catch (error) {
                console.warn(`Error parsing line ${index + 1}: ${line}`, error);
            }
        });
        
        return cards;
    }
    
    /**
     * Parse a single CSV line, handling quotes and escaped characters
     * @param {string} line - CSV line to parse
     * @returns {Array} Array of field values
     */
    parseCSVLine(line) {
        const result = [];
        let current = '';
        let inQuotes = false;
        let i = 0;
        
        while (i < line.length) {
            const char = line[i];
            
            if (char === '"' && !inQuotes) {
                inQuotes = true;
            } else if (char === '"' && inQuotes) {
                // Check for escaped quote
                if (i + 1 < line.length && line[i + 1] === '"') {
                    current += '"';
                    i++; // Skip next quote
                } else {
                    inQuotes = false;
                }
            } else if (char === ',' && !inQuotes) {
                result.push(current);
                current = '';
            } else {
                current += char;
            }
            i++;
        }
        
        // Add the last field
        result.push(current);
        
        return result;
    }
    
    /**
     * Create demo cards for demonstration purposes
     * @returns {Object} Demo card set
     */
    createDemoCards() {
        const cards = [
            {
                id: 'demo-1',
                question: 'What is spaced repetition?',
                answer: 'A learning method based on repeating material at increasing intervals to improve long-term memory.'
            },
            {
                id: 'demo-2', 
                question: 'What is the capital of France?',
                answer: 'Paris'
            },
            {
                id: 'demo-3',
                question: 'How many planets are in the Solar System?',
                answer: '8 planets (Mercury, Venus, Earth, Mars, Jupiter, Saturn, Uranus, Neptune)'
            },
            {
                id: 'demo-4',
                question: 'What does HTML stand for?',
                answer: 'HyperText Markup Language'
            },
            {
                id: 'demo-5',
                question: 'In what year was Google founded?',
                answer: '1998'
            }
        ];
        
        return {
            id: 'demo',
            name: 'Demo Flashcards',
            fileName: null,
            totalCards: cards.length,
            newCards: cards.length,
            reviewCards: 0,
            progressPercent: 0,
            cards: cards,
            isDemo: true
        };
    }
    
    /**
     * Get cards that are due for review
     * @param {string} cardSetId - ID of the card set
     * @returns {Array} Cards due for review
     */
    async getDueCards(cardSetId) {
        const cardSet = this.cardSets.get(cardSetId) || await this.loadCardSet(cardSetId);
        const dueCards = [];
        
        cardSet.cards.forEach(card => {
            const cardState = this.storage.getCardState(cardSetId, card.id);
            if (this.spacedRepetition.isCardDue(cardState)) {
                dueCards.push({
                    ...card,
                    state: cardState
                });
            }
        });
        
        // Sort by priority (overdue first, then by ease factor)
        return this.spacedRepetition.sortCardsByPriority(dueCards);
    }
    
    /**
     * Update card state after review
     * @param {string} cardSetId - ID of the card set
     * @param {string} cardId - ID of the card
     * @param {string} difficulty - User's difficulty rating
     * @returns {Object} Updated card state
     */
    async updateCardState(cardSetId, cardId, difficulty) {
        const currentState = this.storage.getCardState(cardSetId, cardId);
        const newState = this.spacedRepetition.updateCardState(currentState, difficulty);
        
        // Save the updated state
        this.storage.setCardState(cardSetId, cardId, newState);
        
        return newState;
    }
    
    /**
     * Get statistics for a card set
     * @param {string} cardSetId - ID of the card set
     * @returns {Object} Statistics object
     */
    async getCardSetStatistics(cardSetId) {
        const cardSet = this.cardSets.get(cardSetId) || await this.loadCardSet(cardSetId);
        const cardsWithStates = cardSet.cards.map(card => ({
            ...card,
            state: this.storage.getCardState(cardSetId, card.id)
        }));
        
        return this.spacedRepetition.getStatistics(cardsWithStates);
    }
    
    /**
     * Get forecast for upcoming reviews
     * @param {string} cardSetId - ID of the card set
     * @param {number} days - Number of days to forecast
     * @returns {Array} Forecast data
     */
    async getForecast(cardSetId, days = 7) {
        const cardSet = this.cardSets.get(cardSetId) || await this.loadCardSet(cardSetId);
        const cardsWithStates = cardSet.cards.map(card => ({
            ...card,
            state: this.storage.getCardState(cardSetId, card.id)
        }));
        
        return this.spacedRepetition.getForecast(cardsWithStates, days);
    }
    
    /**
     * Reset progress for a card set
     * @param {string} cardSetId - ID of the card set
     */
    resetCardSetProgress(cardSetId) {
        const cardsData = this.storage.getData(this.storage.keys.CARDS, {});
        delete cardsData[cardSetId];
        this.storage.setData(this.storage.keys.CARDS, cardsData);
    }
    
    /**
     * Export card set data
     * @param {string} cardSetId - ID of the card set
     * @returns {Object} Exportable card set data
     */
    async exportCardSetData(cardSetId) {
        const cardSet = this.cardSets.get(cardSetId) || await this.loadCardSet(cardSetId);
        const cardsWithStates = cardSet.cards.map(card => ({
            ...card,
            state: this.storage.getCardState(cardSetId, card.id)
        }));
        
        return {
            cardSet: {
                id: cardSet.id,
                name: cardSet.name,
                exportDate: new Date().toISOString()
            },
            cards: cardsWithStates,
            statistics: await this.getCardSetStatistics(cardSetId)
        };
    }
    
    /**
     * Performance optimization: Cache management methods
     */
    
    /**
     * Check if cached data is still valid
     * @param {string} key - Cache key
     * @returns {boolean} True if cache is valid
     */
    isCacheValid(key) {
        const timestamp = this.cacheTimestamps.get(key);
        if (!timestamp) return false;
        return (Date.now() - timestamp) < this.CACHE_TTL;
    }
    
    /**
     * Clean expired cache entries
     */
    cleanExpiredCache() {
        const now = Date.now();
        for (const [key, timestamp] of this.cacheTimestamps.entries()) {
            if ((now - timestamp) >= this.CACHE_TTL) {
                this.csvCache.delete(key);
                this.cardSets.delete(key);
                this.cacheTimestamps.delete(key);
                console.log(`🧹 Cleaned expired cache for: ${key}`);
            }
        }
    }
    
    /**
     * Limit cache size to prevent memory issues
     */
    limitCacheSize() {
        if (this.csvCache.size > this.MAX_CACHE_SIZE) {
            // Remove oldest entries
            const entries = Array.from(this.cacheTimestamps.entries())
                .sort((a, b) => a[1] - b[1]); // Sort by timestamp
            
            const toRemove = entries.slice(0, entries.length - this.MAX_CACHE_SIZE);
            for (const [key] of toRemove) {
                this.csvCache.delete(key);
                this.cardSets.delete(key);
                this.cacheTimestamps.delete(key);
                console.log(`📦 Removed from cache due to size limit: ${key}`);
            }
        }
    }
    
    /**
     * Update cache timestamp
     * @param {string} key - Cache key
     */
    updateCacheTimestamp(key) {
        this.cacheTimestamps.set(key, Date.now());
    }
    
    /**
     * Prefetch popular card sets in background
     */
    async prefetchPopularSets() {
        try {
            console.log('🚀 Prefetching popular card sets...');
            const prefetchPromises = [];
            
            for (const setId of this.popularSets) {
                if (!this.csvCache.has(`${setId}.csv`) || !this.isCacheValid(`${setId}.csv`)) {
                    const promise = this.loadCardsFromFile(`${setId}.csv`)
                        .then(cards => {
                            console.log(`✅ Prefetched: ${setId} (${cards.length} cards)`);
                            return cards;
                        })
                        .catch(error => {
                            console.log(`⚠️ Failed to prefetch ${setId}:`, error.message);
                        });
                    prefetchPromises.push(promise);
                    this.preloadPromises.set(setId, promise);
                }
            }
            
            if (prefetchPromises.length > 0) {
                await Promise.allSettled(prefetchPromises);
                console.log('🎯 Prefetching completed');
            }
        } catch (error) {
            console.warn('Prefetch failed:', error);
        }
    }
    
    /**
     * Get memory usage statistics
     * @returns {Object} Memory usage info
     */
    getMemoryStats() {
        return {
            cachedCardSets: this.cardSets.size,
            cachedCsvFiles: this.csvCache.size,
            totalCachedCards: Array.from(this.csvCache.values())
                .reduce((total, cards) => total + cards.length, 0),
            cacheTimestamps: this.cacheTimestamps.size,
            oldestCacheEntry: this.cacheTimestamps.size > 0 ? 
                new Date(Math.min(...this.cacheTimestamps.values())).toLocaleString() : null
        };
    }

    /**
     * Clear all cached data
     */
    clearCache() {
        this.cardSets.clear();
        this.csvCache.clear();
        this.cacheTimestamps.clear();
        this.preloadPromises.clear();
        console.log('🧹 All cache cleared');
    }
    
    /**
     * Preload all available card sets for better performance
     */
    async preloadCardSets() {
        try {
            const cardSets = await this.getAvailableCardSets();
            const loadPromises = cardSets.map(cardSet => 
                this.loadCardSet(cardSet.id).catch(error => {
                    console.warn(`Failed to preload card set ${cardSet.id}:`, error);
                })
            );
            
            await Promise.all(loadPromises);
            console.log('Card sets preloaded successfully');
        } catch (error) {
            console.warn('Failed to preload card sets:', error);
        }
    }
} 