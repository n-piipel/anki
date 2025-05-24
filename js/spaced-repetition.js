/**
 * Spaced Repetition Manager
 * Implements the SM-2 algorithm for optimal card scheduling
 */

class SpacedRepetitionManager {
    constructor() {
        // SM-2 algorithm constants
        this.MINIMUM_EASE_FACTOR = 1.3;
        this.DEFAULT_EASE_FACTOR = 2.5;
        this.EASE_FACTOR_BONUS = 0.15;
        this.EASE_FACTOR_PENALTY = 0.2;
        
        // Difficulty multipliers for SM-2
        this.DIFFICULTY_MULTIPLIERS = {
            again: 0,     // Reset interval
            hard: 0.8,    // Reduce interval
            good: 1.0,    // Standard interval
            easy: 1.3     // Increase interval + ease factor bonus
        };
        
        // Initial intervals for new cards (in days)
        this.INITIAL_INTERVALS = {
            again: 1/1440,  // 1 minute
            hard: 1/240,    // 6 minutes  
            good: 1/144,    // 10 minutes
            easy: 4         // 4 days
        };
    }
    
    /**
     * Calculate the next review date and update card state
     * @param {Object} cardState - Current state of the card
     * @param {string} difficulty - User's response: 'again', 'hard', 'good', 'easy'
     * @returns {Object} Updated card state
     */
    updateCardState(cardState, difficulty) {
        const newState = { ...cardState };
        const now = new Date();
        
        // Update review counts
        newState.totalReviews = (newState.totalReviews || 0) + 1;
        newState.lastReviewed = now.toISOString();
        
        if (difficulty === 'good' || difficulty === 'easy') {
            newState.correctReviews = (newState.correctReviews || 0) + 1;
        }
        
        // Calculate new interval and ease factor based on SM-2 algorithm
        if (difficulty === 'again') {
            // Failed card - restart learning
            newState.repetitions = 0;
            newState.interval = this.INITIAL_INTERVALS.again;
            newState.easeFactor = Math.max(
                this.MINIMUM_EASE_FACTOR,
                newState.easeFactor - this.EASE_FACTOR_PENALTY
            );
        } else {
            // Successful review
            newState.repetitions = (newState.repetitions || 0) + 1;
            
            if (newState.repetitions === 1) {
                // First successful review
                newState.interval = this.INITIAL_INTERVALS[difficulty];
            } else if (newState.repetitions === 2) {
                // Second successful review
                newState.interval = difficulty === 'easy' ? 4 : 
                                   difficulty === 'good' ? 1 : 
                                   difficulty === 'hard' ? 0.25 : 1;
            } else {
                // Subsequent reviews - apply SM-2 formula
                const multiplier = this.DIFFICULTY_MULTIPLIERS[difficulty];
                newState.interval = newState.interval * newState.easeFactor * multiplier;
                
                // Minimum interval constraints
                if (difficulty === 'hard') {
                    newState.interval = Math.max(newState.interval, newState.interval * 0.8);
                }
            }
            
            // Update ease factor
            this.updateEaseFactor(newState, difficulty);
        }
        
        // Calculate due date
        const dueDate = new Date(now.getTime() + newState.interval * 24 * 60 * 60 * 1000);
        newState.dueDate = dueDate.toISOString().split('T')[0];
        
        // Round interval to reasonable precision
        newState.interval = Math.round(newState.interval * 100) / 100;
        
        return newState;
    }
    
    /**
     * Update ease factor based on difficulty response
     * @param {Object} cardState - Current card state
     * @param {string} difficulty - User's response
     */
    updateEaseFactor(cardState, difficulty) {
        switch (difficulty) {
            case 'easy':
                cardState.easeFactor += this.EASE_FACTOR_BONUS;
                break;
            case 'hard':
                cardState.easeFactor = Math.max(
                    this.MINIMUM_EASE_FACTOR,
                    cardState.easeFactor - this.EASE_FACTOR_PENALTY
                );
                break;
            case 'good':
                // No change to ease factor for 'good' responses
                break;
        }
        
        // Ensure ease factor stays within reasonable bounds
        cardState.easeFactor = Math.max(this.MINIMUM_EASE_FACTOR, cardState.easeFactor);
        cardState.easeFactor = Math.min(3.0, cardState.easeFactor); // Cap at 3.0
    }
    
    /**
     * Calculate what the intervals would be for each difficulty option
     * Used to show preview intervals on buttons
     * @param {Object} cardState - Current state of the card
     * @returns {Object} Intervals for each difficulty
     */
    calculateIntervals(cardState) {
        const intervals = {};
        
        ['again', 'hard', 'good', 'easy'].forEach(difficulty => {
            const tempState = this.updateCardState(cardState, difficulty);
            intervals[difficulty] = tempState.interval;
        });
        
        return intervals;
    }
    
    /**
     * Check if a card is due for review
     * @param {Object} cardState - Current state of the card
     * @returns {boolean} True if card is due
     */
    isCardDue(cardState) {
        const today = new Date().toISOString().split('T')[0];
        return cardState.dueDate <= today;
    }
    
    /**
     * Get cards that are due for review
     * @param {Array} cards - Array of cards with their states
     * @returns {Array} Cards that are due for review
     */
    getDueCards(cards) {
        return cards.filter(card => this.isCardDue(card.state));
    }
    
    /**
     * Sort cards by priority (overdue cards first, then by ease factor)
     * @param {Array} cards - Array of cards with their states
     * @returns {Array} Sorted cards
     */
    sortCardsByPriority(cards) {
        const today = new Date().toISOString().split('T')[0];
        
        return cards.sort((a, b) => {
            const aDaysOverdue = this.getDaysOverdue(a.state, today);
            const bDaysOverdue = this.getDaysOverdue(b.state, today);
            
            // First priority: most overdue cards
            if (aDaysOverdue !== bDaysOverdue) {
                return bDaysOverdue - aDaysOverdue;
            }
            
            // Second priority: cards with lower ease factor (more difficult)
            const aEase = a.state.easeFactor || this.DEFAULT_EASE_FACTOR;
            const bEase = b.state.easeFactor || this.DEFAULT_EASE_FACTOR;
            
            return aEase - bEase;
        });
    }
    
    /**
     * Calculate how many days overdue a card is
     * @param {Object} cardState - Current state of the card  
     * @param {string} today - Today's date in YYYY-MM-DD format
     * @returns {number} Days overdue (negative if not due yet)
     */
    getDaysOverdue(cardState, today) {
        const dueDate = new Date(cardState.dueDate);
        const todayDate = new Date(today);
        return Math.floor((todayDate - dueDate) / (1000 * 60 * 60 * 24));
    }
    
    /**
     * Get statistics about the spaced repetition performance
     * @param {Array} cards - Array of cards with their states
     * @returns {Object} Statistics object
     */
    getStatistics(cards) {
        const stats = {
            totalCards: cards.length,
            newCards: 0,
            learningCards: 0,
            reviewCards: 0,
            matureCards: 0,
            averageEaseFactor: 0,
            averageInterval: 0,
            dueToday: 0,
            overdue: 0
        };
        
        const today = new Date().toISOString().split('T')[0];
        let totalEase = 0;
        let totalInterval = 0;
        let cardsWithEase = 0;
        
        cards.forEach(card => {
            const state = card.state;
            const reps = state.repetitions || 0;
            
            // Categorize cards
            if (reps === 0) {
                stats.newCards++;
            } else if (reps < 3) {
                stats.learningCards++;
            } else if (reps >= 3 && state.interval < 21) {
                stats.reviewCards++;
            } else {
                stats.matureCards++;
            }
            
            // Due status
            if (this.isCardDue(state)) {
                stats.dueToday++;
                
                const daysOverdue = this.getDaysOverdue(state, today);
                if (daysOverdue > 0) {
                    stats.overdue++;
                }
            }
            
            // Calculate averages
            if (state.easeFactor) {
                totalEase += state.easeFactor;
                cardsWithEase++;
            }
            
            if (state.interval) {
                totalInterval += state.interval;
            }
        });
        
        // Calculate averages
        if (cardsWithEase > 0) {
            stats.averageEaseFactor = Math.round((totalEase / cardsWithEase) * 100) / 100;
        }
        
        if (cards.length > 0) {
            stats.averageInterval = Math.round((totalInterval / cards.length) * 100) / 100;
        }
        
        return stats;
    }
    
    /**
     * Get recommended study schedule for upcoming days
     * @param {Array} cards - Array of cards with their states
     * @param {number} days - Number of days to forecast
     * @returns {Array} Schedule for each day
     */
    getForecast(cards, days = 7) {
        const forecast = [];
        const today = new Date();
        
        for (let i = 0; i < days; i++) {
            const date = new Date(today);
            date.setDate(today.getDate() + i);
            const dateStr = date.toISOString().split('T')[0];
            
            const dueCards = cards.filter(card => card.state.dueDate === dateStr);
            
            forecast.push({
                date: dateStr,
                day: date.toLocaleDateString('ru-RU', { weekday: 'short' }),
                cardCount: dueCards.length,
                newCards: dueCards.filter(card => (card.state.repetitions || 0) === 0).length,
                reviewCards: dueCards.filter(card => (card.state.repetitions || 0) > 0).length
            });
        }
        
        return forecast;
    }
    
    /**
     * Calculate optimal study session size based on available time
     * @param {Array} dueCards - Cards due for review
     * @param {number} availableMinutes - Available study time in minutes
     * @param {number} avgTimePerCard - Average time per card in seconds
     * @returns {Object} Recommended session configuration
     */
    calculateOptimalSession(dueCards, availableMinutes = 20, avgTimePerCard = 30) {
        const availableSeconds = availableMinutes * 60;
        const maxCards = Math.floor(availableSeconds / avgTimePerCard);
        
        // Prioritize overdue cards and new cards
        const today = new Date().toISOString().split('T')[0];
        const overdueCards = dueCards.filter(card => this.getDaysOverdue(card.state, today) > 0);
        const newCards = dueCards.filter(card => (card.state.repetitions || 0) === 0);
        const reviewCards = dueCards.filter(card => 
            (card.state.repetitions || 0) > 0 && this.getDaysOverdue(card.state, today) <= 0
        );
        
        let sessionCards = [];
        
        // Add overdue cards first (up to 50% of session)
        const maxOverdue = Math.floor(maxCards * 0.5);
        sessionCards = sessionCards.concat(overdueCards.slice(0, maxOverdue));
        
        // Add new cards (up to 30% of remaining space)
        const remainingSpace = maxCards - sessionCards.length;
        const maxNew = Math.floor(remainingSpace * 0.3);
        sessionCards = sessionCards.concat(newCards.slice(0, maxNew));
        
        // Fill remaining space with review cards
        const finalRemainingSpace = maxCards - sessionCards.length;
        sessionCards = sessionCards.concat(reviewCards.slice(0, finalRemainingSpace));
        
        return {
            recommendedCards: sessionCards,
            totalCards: sessionCards.length,
            estimatedTime: Math.round((sessionCards.length * avgTimePerCard) / 60),
            breakdown: {
                overdue: Math.min(overdueCards.length, maxOverdue),
                new: Math.min(newCards.length, maxNew),
                review: Math.min(reviewCards.length, finalRemainingSpace)
            }
        };
    }
} 