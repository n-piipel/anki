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
        this.availableCardSetsCache = null;
        this.lastCacheTime = 0;
        this.cacheTimeout = 5 * 60 * 1000;
        this.failedAttempts = new Set();
        this.maxRetries = 3;
        this.retryCount = 0;
        
        // Detect base path for GitHub Pages
        this.basePath = this.detectBasePath();
        console.log(`🔧 Using base path: ${this.basePath}`);
    }
    
    /**
     * Detect the base path for the application
     * @returns {string} Base path for data files
     */
    detectBasePath() {
        const path = window.location.pathname;
        
        // If we're on GitHub Pages project site (e.g., /anki/), extract the project name
        if (path.startsWith('/') && path.length > 1) {
            const pathParts = path.split('/').filter(p => p.length > 0);
            if (pathParts.length > 0) {
                return `/${pathParts[0]}/`;
            }
        }
        
        // Default to root path for local development or user sites
        return './';
    }
    
    /**
     * Get available card sets by scanning the data directory
     * @returns {Array} Array of card set objects
     */
    async getAvailableCardSets() {
        try {
            console.log('🔍 Getting available card sets...');
            
            // Check cache first - if recent and valid, use it
            const now = Date.now();
            if (this.availableCardSetsCache && 
                (now - this.lastCacheTime) < this.cacheTimeout) {
                console.log('📦 Using cached available card sets');
                return this.availableCardSetsCache;
            }

            // Prevent infinite loops by limiting retries
            if (this.retryCount >= this.maxRetries) {
                console.warn('⚠️ Max retries reached, using demo data');
                const demoSet = [this.createDemoCardSet()];
                this.availableCardSetsCache = demoSet;
                this.lastCacheTime = now;
                return demoSet;
            }

            // Try to load index.json file
            try {
                console.log('📋 Attempting to load index.json...');
                
                // Add timestamp to prevent browser caching issues
                const indexUrl = `${this.basePath}data/index.json?t=${now}`;
                console.log(`🔗 Full URL: ${indexUrl}`);
                const indexResponse = await fetch(indexUrl);
                
                if (indexResponse.ok) {
                    const indexData = await indexResponse.json();
                    console.log('📋 Loading card sets from index.json:', indexData);
                    
                    const availableCardSets = [];
                    for (const cardSetInfo of indexData.cardSets) {
                        try {
                            console.log(`🔍 Checking file: ${cardSetInfo.filename}`);
                            
                            // Skip if this file has failed before
                            if (this.failedAttempts.has(cardSetInfo.filename)) {
                                console.warn(`⏭️ Skipping ${cardSetInfo.filename} - previously failed`);
                                continue;
                            }
                            
                            // Verify the file actually exists
                            const fileUrl = `${this.basePath}data/${cardSetInfo.filename}?t=${now}`;
                            console.log(`🔗 Checking file URL: ${fileUrl}`);
                            const fileResponse = await fetch(fileUrl, { method: 'HEAD' });
                            
                            if (fileResponse.ok) {
                                console.log(`✅ File exists: ${cardSetInfo.filename}`);
                                const cardSetData = await this.getCardSetInfo(cardSetInfo.filename, cardSetInfo);
                                console.log(`📊 Card set data:`, cardSetData);
                                availableCardSets.push(cardSetData);
                            } else {
                                console.warn(`📁 File ${cardSetInfo.filename} listed in index but not found`);
                                this.failedAttempts.add(cardSetInfo.filename);
                            }
                        } catch (error) {
                            console.warn(`📁 Error checking ${cardSetInfo.filename}:`, error);
                            this.failedAttempts.add(cardSetInfo.filename);
                        }
                    }
                    
                    if (availableCardSets.length > 0) {
                        console.log(`✅ Found ${availableCardSets.length} card sets from index.json`);
                        // Cache successful result
                        this.availableCardSetsCache = availableCardSets;
                        this.lastCacheTime = now;
                        this.retryCount = 0; // Reset retry count on success
                        return availableCardSets;
                    } else {
                        console.warn('⚠️ No valid card sets found in index.json');
                        this.retryCount++;
                    }
                } else {
                    console.log('📋 index.json not found or not accessible');
                    this.retryCount++;
                }
            } catch (error) {
                console.log('📋 Error loading index.json:', error);
                this.retryCount++;
            }
            
            // If index.json fails or has no valid card sets, return demo
            console.log('📝 No valid card sets found, creating demo set');
            const demoSet = [this.createDemoCardSet()];
            
            // Cache demo result for a shorter time
            this.availableCardSetsCache = demoSet;
            this.lastCacheTime = now;
            
            return demoSet;
            
        } catch (error) {
            console.error('Error getting available card sets:', error);
            this.retryCount++;
            const demoSet = [this.createDemoCardSet()];
            
            // Cache error result 
            this.availableCardSetsCache = demoSet;
            this.lastCacheTime = Date.now();
            
            return demoSet;
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
     * Load cards from a CSV file with simple caching
     * @param {string} fileName - Name of the CSV file
     * @returns {Array} Array of card objects
     */
    async loadCardsFromFile(fileName) {
        try {
            // Simple cache check
            if (this.csvCache.has(fileName)) {
                console.log(`📦 Cache hit: ${fileName}`);
                return this.csvCache.get(fileName);
            }
            
            console.log(`🌐 Loading from network: ${fileName}`);
            const fileUrl = `${this.basePath}data/${fileName}`;
            console.log(`🔗 Loading file URL: ${fileUrl}`);
            const response = await fetch(fileUrl);
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            const csvContent = await response.text();
            const cards = this.parseCSV(csvContent);
            
            // Simple caching
            this.csvCache.set(fileName, cards);
            
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
     * Get basic memory statistics
     * @returns {Object} Memory usage info
     */
    getMemoryStats() {
        return {
            cachedCardSets: this.cardSets.size,
            totalCachedCards: Array.from(this.csvCache.values())
                .reduce((total, cards) => total + cards.length, 0)
        };
    }

    /**
     * Clear all cached data
     */
    clearCache() {
        this.cardSets.clear();
        this.csvCache.clear();
        console.log('🧹 All cache cleared');
    }

    /**
     * Clear the available card sets cache (useful for refreshing)
     */
    clearAvailableCardSetsCache() {
        console.log('🗑️ Clearing available card sets cache');
        this.availableCardSetsCache = null;
        this.lastCacheTime = 0;
        this.retryCount = 0;
        this.failedAttempts.clear();
    }
} 