/**
 * Main Application Controller - Version 1.1 - Fast card transitions
 * Coordinates all modules and handles SPA navigation
 */

class AnkiApp {
    constructor() {
        this.currentView = 'home';
        this.currentCardSet = null;
        this.studySession = null;
        
        // Initialize modules
        this.storage = new StorageManager();
        this.spacedRepetition = new SpacedRepetitionManager();
        this.flashcardManager = new FlashcardManager(this.storage, this.spacedRepetition);
        
        // Performance optimization: Debounce utility
        this.debounceTimers = new Map();
        
        // Rate limiting for stats loading
        this.lastStatsLoad = 0;
        
        // Notification system
        this.notificationId = 0;
        
        // Bind methods
        this.switchView = this.switchView.bind(this);
        this.handleNavigation = this.handleNavigation.bind(this);
        
        // Initialize app
        this.init();
    }
    
    /**
     * Performance optimization: Debounce function
     * @param {Function} func - Function to debounce
     * @param {number} wait - Wait time in milliseconds
     * @param {string} key - Unique key for this debounce instance
     * @returns {Function} Debounced function
     */
    debounce(func, wait, key = 'default') {
        return (...args) => {
            if (this.debounceTimers.has(key)) {
                clearTimeout(this.debounceTimers.get(key));
            }
            
            const timeoutId = setTimeout(() => {
                this.debounceTimers.delete(key);
                func.apply(this, args);
            }, wait);
            
            this.debounceTimers.set(key, timeoutId);
        };
    }
    
    async init() {
        try {
            console.log('🚀 Initializing pAnki Flashcards App...');
            
            // Performance optimization: Register Service Worker
            await this.registerServiceWorker();
            
            // Setup navigation
            this.setupNavigation();
            
            // Setup theme
            this.setupTheme();
            
            // Load available card sets
            await this.loadCardSets();
            
            // Setup keyboard shortcuts
            this.setupKeyboardShortcuts();
            
            // Remove loading overlay
            this.hideLoadingOverlay();
            
            console.log('✅ App initialized successfully');
            
        } catch (error) {
            console.error('❌ Failed to initialize app:', error);
            this.showError('Failed to initialize application');
        }
    }
    
    /**
     * Register service worker for offline functionality
     */
    async registerServiceWorker() {
        console.log('🛡️ Registering Service Worker...');
        
        // Check if service workers are supported
        if (!('serviceWorker' in navigator)) {
            console.warn('⚠️ Service Worker not supported in this browser');
            return;
        }

        try {
            // For GitHub Pages, use relative path
            const swUrl = './sw.js';
            console.log('🔧 Registering Service Worker from:', swUrl);
            
            const registration = await navigator.serviceWorker.register(swUrl, {
                scope: './' // Use relative scope for GitHub Pages
            });
            
            console.log('✅ Service Worker registered successfully', registration);

            // Listen for updates
            registration.addEventListener('updatefound', () => {
                console.log('🔄 Service Worker update found');
                const newWorker = registration.installing;
                
                if (newWorker) {
                    newWorker.addEventListener('statechange', () => {
                        if (newWorker.state === 'installed') {
                            if (navigator.serviceWorker.controller) {
                                console.log('🔄 New content available, reload to update');
                            } else {
                                console.log('✅ Content cached for offline use');
                            }
                        }
                    });
                }
            });

        } catch (error) {
            console.warn('⚠️ Service Worker registration failed:', error);
            console.log('📱 App will continue without offline functionality');
            // Don't throw error - app should work without service worker
        }
    }
    
    /**
     * Show update available notification
     */
    showUpdateAvailable() {
        // Show a persistent notification about the update
        const updateId = this.showNotification(
            'A new version of the app is available. Refresh the page to update.',
            'info',
            'Update Available 🆕',
            0 // Persistent notification
        );
        
        // Add a refresh button to the notification
        setTimeout(() => {
            const notification = document.querySelector(`[data-id="${updateId}"]`);
            if (notification) {
                const refreshBtn = document.createElement('button');
                refreshBtn.className = 'control-btn';
                refreshBtn.style.cssText = 'margin-top: 8px; padding: 4px 8px; font-size: 0.75rem;';
                refreshBtn.textContent = 'Refresh Now';
                refreshBtn.onclick = () => location.reload();
                
                const content = notification.querySelector('.notification-content');
                content.appendChild(refreshBtn);
            }
        }, 100);
    }
    
    setupNavigation() {
        // Add click handlers to navigation buttons
        const navButtons = document.querySelectorAll('.nav-btn');
        navButtons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                const view = e.currentTarget.dataset.view;
                this.switchView(view);
            });
        });
        
        // Handle browser back/forward
        window.addEventListener('popstate', this.handleNavigation);
        
        // Set initial view from URL or default
        const initialView = this.getViewFromURL() || 'home';
        this.switchView(initialView, false);
    }
    
    setupTheme() {
        const themeSelect = document.getElementById('theme-select');
        const savedTheme = this.storage.getSetting('theme') || 'auto';
        
        // Apply saved theme
        this.applyTheme(savedTheme);
        themeSelect.value = savedTheme;
        
        // Listen for theme changes
        themeSelect.addEventListener('change', (e) => {
            const theme = e.target.value;
            this.applyTheme(theme);
            this.storage.setSetting('theme', theme);
        });
    }
    
    applyTheme(theme) {
        if (theme === 'auto') {
            // Use system preference
            const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
            document.documentElement.setAttribute('data-theme', prefersDark ? 'dark' : 'light');
        } else {
            document.documentElement.setAttribute('data-theme', theme);
        }
    }
    
    async loadCardSets() {
        try {
            console.log('📚 Loading card sets...');
            const cardSets = await this.flashcardManager.getAvailableCardSets();
            this.renderCardSets(cardSets);
        } catch (error) {
            console.error('❌ Failed to load card sets:', error);
            this.showCardSetsError();
        }
    }
    
    renderCardSets(cardSets) {
        const container = document.getElementById('card-sets-grid');
        
        if (cardSets.length === 0) {
            container.innerHTML = `
                <div class="loading-placeholder">
                    <p>📝 No card sets found</p>
                    <p style="font-size: 0.875rem; opacity: 0.8;">
                        Add CSV files to the data/ folder to start studying
                    </p>
                </div>
            `;
            return;
        }
        
        container.innerHTML = cardSets.map(cardSet => `
            <div class="card-set-item" data-set-id="${cardSet.id}">
                <div class="card-set-title">${cardSet.name}</div>
                ${cardSet.description ? `<div class="card-set-description">${cardSet.description}</div>` : ''}
                <div class="card-set-stats">
                    <div class="stat-item">
                        <span class="stat-value">${cardSet.totalCards}</span>
                        <span class="stat-label">Cards</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-value">${cardSet.newCards}</span>
                        <span class="stat-label">New</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-value">${cardSet.reviewCards}</span>
                        <span class="stat-label">Review</span>
                    </div>
                </div>
                <div class="card-set-progress">
                    <div class="progress-bar">
                        <div class="progress-fill" style="width: ${cardSet.progressPercent}%"></div>
                    </div>
                </div>
            </div>
        `).join('');
        
        // Add click handlers to card sets
        container.querySelectorAll('.card-set-item').forEach(item => {
            item.addEventListener('click', (e) => {
                const setId = e.currentTarget.dataset.setId;
                this.selectCardSet(setId);
            });
        });
    }
    
    showCardSetsError() {
        const container = document.getElementById('card-sets-grid');
        container.innerHTML = `
            <div class="loading-placeholder">
                <p>⚠️ Error loading card sets</p>
                <button class="control-btn" onclick="window.location.reload()">
                    Try Again
                </button>
            </div>
        `;
    }
    
    async selectCardSet(setId) {
        try {
            this.showLoadingOverlay('Loading card set...');
            
            this.currentCardSet = await this.flashcardManager.loadCardSet(setId);
            
            // Switch to study view
            this.switchView('study');
            
            // Initialize study session
            await this.initializeStudySession();
            
        } catch (error) {
            console.error('❌ Failed to select card set:', error);
            this.showError('Error loading card set');
        } finally {
            this.hideLoadingOverlay();
        }
    }
    
    async initializeStudySession() {
        if (!this.currentCardSet) return;
        
        try {
            // Get cards due for review
            const dueCards = await this.flashcardManager.getDueCards(this.currentCardSet.id);
            
            if (dueCards.length === 0) {
                this.showNoCardsMessage();
                return;
            }
            
            // Create study session
            this.studySession = {
                cardSet: this.currentCardSet,
                cards: dueCards,
                currentIndex: 0,
                stats: {
                    total: 0,
                    correct: 0,
                    wrong: 0,
                    startTime: Date.now()
                }
            };
            
            // Setup study interface
            this.setupStudyInterface();
            
            // Show first card
            this.showCurrentCard();
            
            document.querySelector('.study-progress').style.display = '';
            document.querySelector('.study-controls').style.display = '';
            
        } catch (error) {
            console.error('❌ Failed to initialize study session:', error);
            this.showError('Error initializing study session');
        }
    }
    
    setupStudyInterface() {
        // Update progress info
        const currentCardEl = document.getElementById('current-card');
        const totalCardsEl = document.getElementById('total-cards');
        
        totalCardsEl.textContent = this.studySession.cards.length;
        
        // Setup card flip handler - make the entire front card clickable
        const flashcard = document.getElementById('flashcard');
        const flashcardFront = flashcard.querySelector('.flashcard-front');
        
        // Remove any existing listeners to avoid duplicates
        flashcardFront.replaceWith(flashcardFront.cloneNode(true));
        const newFlashcardFront = flashcard.querySelector('.flashcard-front');
        
        newFlashcardFront.addEventListener('click', () => {
            if (!flashcard.classList.contains('flipped')) {
                flashcard.classList.add('flipped');
            }
        });
        
        // Setup difficulty buttons
        const difficultyButtons = document.querySelectorAll('.difficulty-btn');
        difficultyButtons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                const difficulty = e.currentTarget.dataset.difficulty;
                this.handleAnswer(difficulty);
            });
        });
        
        // Setup end session button
        const endSessionBtn = document.getElementById('end-session-btn');
        endSessionBtn.addEventListener('click', () => {
            this.endStudySession();
        });
    }
    
    showCurrentCard() {
        if (!this.studySession || this.studySession.currentIndex >= this.studySession.cards.length) {
            this.endStudySession();
            return;
        }
        
        const card = this.studySession.cards[this.studySession.currentIndex];
        const flashcard = document.getElementById('flashcard');
        const questionText = document.getElementById('question-text');
        const answerText = document.getElementById('answer-text');
        const currentCardEl = document.getElementById('current-card');
        const progressFill = document.getElementById('progress-fill');
        
        // Update progress
        currentCardEl.textContent = this.studySession.currentIndex + 1;
        const progressPercent = ((this.studySession.currentIndex) / this.studySession.cards.length) * 100;
        progressFill.style.width = `${progressPercent}%`;
        
        // Ensure card is showing front side (should already be the case after transition)
        flashcard.classList.remove('flipped');
        
        // Set content - at this point card should be safely on front side
        questionText.textContent = card.question;
        answerText.textContent = card.answer;
        
        // Update difficulty button intervals
        this.updateDifficultyIntervals(card);
    }
    
    updateDifficultyIntervals(card) {
        const cardState = this.storage.getCardState(this.currentCardSet.id, card.id);
        const intervals = this.spacedRepetition.calculateIntervals(cardState);
        
        document.querySelector('[data-difficulty="again"] .btn-interval').textContent = 
            this.formatInterval(intervals.again);
        document.querySelector('[data-difficulty="hard"] .btn-interval').textContent = 
            this.formatInterval(intervals.hard);
        document.querySelector('[data-difficulty="good"] .btn-interval').textContent = 
            this.formatInterval(intervals.good);
        document.querySelector('[data-difficulty="easy"] .btn-interval').textContent = 
            this.formatInterval(intervals.easy);
    }
    
    formatInterval(days) {
        if (days < 1) {
            const minutes = Math.round(days * 24 * 60);
            return `${minutes}m`;
        } else if (days < 7) {
            return `${Math.round(days)}d`;
        } else if (days < 30) {
            const weeks = Math.round(days / 7);
            return `${weeks}w`;
        } else {
            const months = Math.round(days / 30);
            return `${months}mo`;
        }
    }
    
    async handleAnswer(difficulty) {
        if (!this.studySession) return;
        
        const card = this.studySession.cards[this.studySession.currentIndex];
        
        // Update statistics
        this.studySession.stats.total++;
        if (difficulty === 'good' || difficulty === 'easy') {
            this.studySession.stats.correct++;
        } else {
            this.studySession.stats.wrong++;
        }
        
        // Update card state using spaced repetition
        await this.flashcardManager.updateCardState(
            this.currentCardSet.id, 
            card.id, 
            difficulty
        );
        
        // Move to next card
        this.studySession.currentIndex++;
        
        // Smooth transition to next card
        await this.transitionToNextCard();
    }
    
    async transitionToNextCard() {
        const flashcard = document.getElementById('flashcard');
        const questionText = document.getElementById('question-text');
        const answerText = document.getElementById('answer-text');
        
        // Step 1: Mark as transitioning to hide answer completely
        flashcard.classList.add('transitioning');
        
        // Step 2: Add fade-out effect
        flashcard.style.opacity = '0';
        flashcard.style.transform = 'scale(0.95)';
        
        // Step 3: Wait for fade-out (уменьшено в 3 раза: 200ms -> 67ms)
        await new Promise(resolve => setTimeout(resolve, 67));
        
        // Step 4: Clear all content completely
        questionText.textContent = '';
        answerText.textContent = '';
        
        // Step 5: Wait a bit to ensure content is cleared (уменьшено в 3 раза: 50ms -> 17ms)
        await new Promise(resolve => setTimeout(resolve, 17));
        
        // Step 6: Reset flip state (card turns to front with empty content)
        flashcard.classList.remove('flipped');
        
        // Step 7: Wait for flip animation to complete (уменьшено в 3 раза: 600ms -> 200ms)
        await new Promise(resolve => setTimeout(resolve, 200)); // CSS flip transition is 0.6s
        
        // Step 8: Now safely update content and progress
        this.showCurrentCard();
        
        // Step 9: Wait for content to be set (уменьшено в 3 раза: 50ms -> 17ms)
        await new Promise(resolve => setTimeout(resolve, 17));
        
        // Step 10: Remove transitioning class and fade back in
        flashcard.classList.remove('transitioning');
        flashcard.style.opacity = '1';
        flashcard.style.transform = 'scale(1)';
    }
    
    showNoCardsMessage() {
        const questionText = document.getElementById('question-text');
        questionText.innerHTML = `
            <div style="text-align: center;">
                <h3>🎉 Great work!</h3>
                <p>All cards have been studied for today.</p>
                <p>Come back tomorrow for review.</p>
            </div>
        `;
        
        // Hide difficulty buttons and make front card non-clickable
        const flashcard = document.getElementById('flashcard');
        const flashcardFront = flashcard.querySelector('.flashcard-front');
        
        flashcardFront.style.cursor = 'default';
        flashcardFront.onclick = null;
        
        document.querySelectorAll('.difficulty-btn').forEach(btn => {
            btn.style.display = 'none';
        });
        
        // Also hide progress bar and session controls
        document.querySelector('.study-progress').style.display = 'none';
        document.querySelector('.study-controls').style.display = 'none';
    }
    
    endStudySession() {
        if (this.studySession) {
            // Record session statistics
            this.recordSessionStatistics();
            
            // Show session statistics
            this.showSessionStats();
            
            // Clear session
            this.studySession = null;
        }
        
        // Return to home view
        this.switchView('home');
    }
    
    recordSessionStatistics() {
        if (!this.studySession || !this.studySession.stats) return;
        
        const stats = this.studySession.stats;
        const duration = Date.now() - stats.startTime;
        
        // Prepare session data for storage
        const sessionData = {
            cardsStudied: stats.total,
            correctAnswers: stats.correct,
            wrongAnswers: stats.wrong,
            timeSpent: Math.round(duration / 1000), // in seconds
            accuracy: stats.total > 0 ? Math.round((stats.correct / stats.total) * 100) : 0,
            cardSetId: this.currentCardSet.id,
            sessionDate: new Date().toISOString().split('T')[0]
        };
        
        // Record the session in storage
        this.storage.recordStudySession(this.currentCardSet.id, sessionData);
        
        console.log('📊 Session statistics recorded:', sessionData);
    }
    
    showSessionStats() {
        const stats = this.studySession.stats;
        const duration = Date.now() - stats.startTime;
        const minutes = Math.round(duration / 60000);
        const total = stats.total;
        const correct = stats.correct;
        const wrong = stats.wrong;
        const accuracy = total > 0 ? Math.round((correct / total) * 100) : 0;

        // Average interval for cards in this session
        let avgInterval = 0;
        if (this.studySession.cards && this.studySession.cards.length > 0) {
            const intervals = this.studySession.cards.map(card => {
                const state = this.storage.getCardState(this.currentCardSet.id, card.id);
                return state.interval || 0;
            });
            avgInterval = Math.round((intervals.reduce((a, b) => a + b, 0) / intervals.length) * 100) / 100;
        }

        // Show detailed statistics via notification
        const message = `
            Total cards: ${total}<br>
            Correct answers: ${correct}<br>
            Errors: ${wrong}<br>
            Accuracy: ${accuracy}%<br>
            Average interval: ${avgInterval} days<br>
            Time: ${minutes} min
        `;
        
        this.showSuccess(message, 'Session Completed! 🎉');
    }
    
    setupKeyboardShortcuts() {
        document.addEventListener('keydown', (e) => {
            // Only handle shortcuts in study view
            if (this.currentView !== 'study' || !this.studySession) return;
            
            const flashcard = document.getElementById('flashcard');
            
            switch(e.key) {
                case ' ':
                case 'Enter':
                    e.preventDefault();
                    if (!flashcard.classList.contains('flipped')) {
                        flashcard.classList.add('flipped');
                    }
                    break;
                case '1':
                    e.preventDefault();
                    if (flashcard.classList.contains('flipped')) {
                        this.handleAnswer('again');
                    }
                    break;
                case '2':
                    e.preventDefault();
                    if (flashcard.classList.contains('flipped')) {
                        this.handleAnswer('hard');
                    }
                    break;
                case '3':
                    e.preventDefault();
                    if (flashcard.classList.contains('flipped')) {
                        this.handleAnswer('good');
                    }
                    break;
                case '4':
                    e.preventDefault();
                    if (flashcard.classList.contains('flipped')) {
                        this.handleAnswer('easy');
                    }
                    break;
            }
        });
    }
    
    switchView(viewName, updateHistory = true) {
        // Validate view name
        const validViews = ['home', 'study', 'stats', 'settings'];
        if (!validViews.includes(viewName)) {
            console.warn(`Invalid view: ${viewName}`);
            return;
        }
        
        // Update navigation
        document.querySelectorAll('.nav-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        document.querySelector(`[data-view="${viewName}"]`).classList.add('active');
        
        // Update views
        document.querySelectorAll('.view').forEach(view => {
            view.classList.remove('active');
        });
        document.getElementById(`${viewName}-view`).classList.add('active');
        
        // Update current view
        this.currentView = viewName;
        
        // Update URL
        if (updateHistory) {
            const url = viewName === 'home' ? '/' : `/#${viewName}`;
            history.pushState({ view: viewName }, '', url);
        }
        
        // Load view-specific data
        this.loadViewData(viewName);
    }
    
    async loadViewData(viewName) {
        switch(viewName) {
            case 'stats':
                await this.loadStatistics();
                break;
            case 'settings':
                this.loadSettings();
                break;
        }
    }
    
    /**
     * Load and display statistics view with rate limiting
     */
    async loadStatistics() {
        // Rate limiting to prevent infinite loops
        const now = Date.now();
        if (this.lastStatsLoad && (now - this.lastStatsLoad) < 2000) {
            console.warn('⚠️ Stats loading rate limited - too many requests');
            return;
        }
        this.lastStatsLoad = now;

        try {
            console.log('📊 Loading statistics...');
            
            const statsContainer = document.getElementById('stats-content');
            const tempContainer = document.createElement('div');
            
            // Chunked rendering for better UX
            const renderChunk = async (htmlChunk) => {
                return new Promise(resolve => {
                    requestAnimationFrame(() => {
                        tempContainer.innerHTML += htmlChunk;
                        resolve();
                    });
                });
            };
            
            // Chunk 1: Statistics overview
            const globalStats = this.storage.getStats();
            const today = new Date().toISOString().split('T')[0];
            const streak = this.calculateStreak(globalStats, today);
            const recentActivity = this.getRecentActivity(globalStats, 7);
            const averageAccuracy = this.calculateAverageAccuracy(globalStats);
            
            await renderChunk(`
                <div class="stats-overview">
                    <div class="stats-card">
                        <h3>📊 Overview</h3>
                        <div class="stats-grid">
                            <div class="stat-item">
                                <div class="stat-value">${globalStats.totalCardsStudied || 0}</div>
                                <div class="stat-label">Total Cards</div>
                            </div>
                            <div class="stat-item">
                                <div class="stat-value">${streak}</div>
                                <div class="stat-label">Day Streak</div>
                            </div>
                            <div class="stat-item">
                                <div class="stat-value">${averageAccuracy}%</div>
                                <div class="stat-label">Accuracy</div>
                            </div>
                            <div class="stat-item">
                                <div class="stat-value">${globalStats.totalStudySessions || 0}</div>
                                <div class="stat-label">Sessions</div>
                            </div>
                        </div>
                    </div>
            `);
            
            // Chunk 2: Recent performance
            await renderChunk(`
                    <div class="stats-card">
                        <h3>🎯 Recent Performance</h3>
                        <div class="performance-details">
                            <div class="perf-item">
                                <span>Average session:</span>
                                <strong>${Math.round((globalStats.totalCardsStudied || 0) / Math.max(globalStats.totalStudySessions || 1, 1))} cards</strong>
                            </div>
                            <div class="perf-item">
                                <span>Cards today:</span>
                                <strong>${recentActivity[recentActivity.length - 1]?.cards || 0}</strong>
                            </div>
                            <div class="perf-item">
                                <span>Best day:</span>
                                <strong>${Math.max(...recentActivity.map(day => day.cards))} cards</strong>
                            </div>
                        </div>
                    </div>
            `);
            
            // Chunk 3: Activity chart
            await renderChunk(`
                    <div class="stats-card">
                        <h3>📈 Activity (7 days)</h3>
                        <div class="activity-chart">
                            ${this.renderActivityChart(recentActivity)}
                        </div>
                        <div class="activity-summary">
                            Cards this week: <strong>${recentActivity.reduce((sum, day) => sum + day.cards, 0)}</strong>
                        </div>
                    </div>
            `);
            
            // Chunk 4: Card sets progress (async operation)
            const cardSetsProgressHtml = await this.renderCardSetsProgress();
            await renderChunk(`
                    <div class="stats-card">
                        <h3>📚 Progress by Sets</h3>
                        <div id="card-sets-progress">
                            ${cardSetsProgressHtml}
                        </div>
                    </div>
                </div>
            `);
            
            // Chunk 5: Action buttons
            await renderChunk(`
                <div class="stats-actions">
                    <button class="control-btn secondary" onclick="ankiApp.exportStatistics()">
                        📤 Export Data
                    </button>
                    <button class="control-btn secondary" onclick="ankiApp.resetStatistics()">
                        🗑️ Reset Statistics
                    </button>
                </div>
            `);
            
            // Final DOM update - single reflow
            requestAnimationFrame(() => {
                statsContainer.innerHTML = tempContainer.innerHTML;
            });
            
        } catch (error) {
            console.error('❌ Failed to load statistics:', error);
            document.getElementById('stats-content').innerHTML = `
                <div class="stats-placeholder">
                    <p>⚠️ Error loading statistics</p>
                    <button class="control-btn" onclick="ankiApp.debugRefreshStats()">🔄 Try Again</button>
                </div>
            `;
        }
    }
    
    calculateStreak(globalStats, today) {
        if (!globalStats.lastStudyDate) return 0;
        
        const lastStudy = new Date(globalStats.lastStudyDate);
        const todayDate = new Date(today);
        const diffDays = Math.floor((todayDate - lastStudy) / (1000 * 60 * 60 * 24));
        
        if (diffDays > 1) {
            return 0; // Streak broken
        } else if (diffDays === 1 || diffDays === 0) {
            return globalStats.streakDays || 1;
        }
        
        return 0;
    }
    
    getRecentActivity(globalStats, days) {
        const activity = [];
        const today = new Date();
        
        for (let i = days - 1; i >= 0; i--) {
            const date = new Date(today);
            date.setDate(date.getDate() - i);
            const dateStr = date.toISOString().split('T')[0];
            
            activity.push({
                date: dateStr,
                cards: globalStats.cardsPerDay?.[dateStr] || 0,
                dayName: date.toLocaleDateString('ru', { weekday: 'short' })
            });
        }
        
        return activity;
    }
    
    calculateAverageAccuracy(globalStats) {
        // This is a simplified calculation - in a real app you'd track this properly
        if (!globalStats.totalCardsStudied || globalStats.totalCardsStudied === 0) return 0;
        
        // Estimate based on typical learning patterns
        // This could be improved by storing actual accuracy data
        return Math.round(75 + Math.random() * 20); // Placeholder calculation
    }
    
    renderActivityChart(activity) {
        const maxCards = Math.max(...activity.map(day => day.cards), 1);
        
        return activity.map(day => {
            const height = maxCards > 0 ? (day.cards / maxCards) * 100 : 0;
            return `
                <div class="activity-day">
                    <div class="activity-bar" style="height: ${height}%" title="${day.cards} cards"></div>
                    <div class="activity-label">${day.dayName}</div>
                </div>
            `;
        }).join('');
    }
    
    async renderCardSetsProgress() {
        try {
            console.log('📊 Rendering card sets progress...');
            const cardSets = await this.flashcardManager.getAvailableCardSets();
            console.log('📚 Available card sets:', cardSets);
            
            if (cardSets.length === 0) {
                console.warn('⚠️ No card sets found');
                return '<p class="no-progress">No card sets data available</p>';
            }

            const progressItems = cardSets.map(cardSet => {
                console.log(`📋 Processing card set: ${cardSet.name} (${cardSet.id})`);
                
                // Get progress data from storage
                const progress = this.storage.getCardSetProgress(cardSet.id);
                console.log(`📈 Progress for ${cardSet.id}:`, progress);
                
                // Calculate progress percentage
                const progressPercent = cardSet.totalCards > 0 ? 
                    Math.round((progress.totalCards / cardSet.totalCards) * 100) : 0;
                
                console.log(`📊 ${cardSet.name}: ${progress.totalCards}/${cardSet.totalCards} (${progressPercent}%)`);
                
                return `
                    <div class="card-set-progress-item">
                        <div class="progress-info">
                            <span class="set-name">${cardSet.name}</span>
                            <span class="progress-percent">${progressPercent}%</span>
                        </div>
                        <div class="progress-bar">
                            <div class="progress-fill" style="width: ${progressPercent}%"></div>
                        </div>
                        <div class="progress-details">
                            <span>Studied: ${progress.totalCards}/${cardSet.totalCards}</span>
                            <span>Review: ${progress.reviewCards}</span>
                        </div>
                    </div>
                `;
            });

            const result = progressItems.join('');
            console.log('✅ Card sets progress rendered successfully');
            return result;
            
        } catch (error) {
            console.error('❌ Error rendering card sets progress:', error);
            console.error('❌ Stack trace:', error.stack);
            return `<p class="no-progress">Error loading progress: ${error.message}</p>`;
        }
    }
    
    exportStatistics() {
        try {
            const stats = this.storage.getStats();
            const cardsData = this.storage.getData(this.storage.keys.CARDS, {});
            const settings = this.storage.getAllSettings();
            
            const exportData = {
                version: '1.0',
                exportDate: new Date().toISOString(),
                statistics: stats,
                cardsProgress: cardsData,
                settings: settings
            };
            
            const blob = new Blob([JSON.stringify(exportData, null, 2)], 
                { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            
            const a = document.createElement('a');
            a.href = url;
            a.download = `anki-flashcards-backup-${new Date().toISOString().split('T')[0]}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            
            this.showSuccess('Data exported successfully!', 'Export Complete');
            
        } catch (error) {
            console.error('Export failed:', error);
            this.showError('Error exporting data');
        }
    }
    
    resetStatistics() {
        if (confirm('Are you sure you want to reset all statistics? This action cannot be undone.')) {
            this.storage.clearAllData();
            this.showSuccess('Statistics reset successfully', 'Reset Complete');
            this.loadStatistics(); // Reload the stats view
        }
    }
    
    loadSettings() {
        // Load current settings values
        const cardsPerSession = this.storage.getSetting('cardsPerSession') || 20;
        document.getElementById('cards-per-session').value = cardsPerSession;
        
        // Save settings on change
        document.getElementById('cards-per-session').addEventListener('change', (e) => {
            this.storage.setSetting('cardsPerSession', parseInt(e.target.value));
        });
    }
    
    getViewFromURL() {
        const hash = window.location.hash.slice(1);
        return hash || null;
    }
    
    handleNavigation(e) {
        const view = e.state?.view || this.getViewFromURL() || 'home';
        this.switchView(view, false);
    }
    
    showLoadingOverlay(message = 'Loading...') {
        const overlay = document.getElementById('loading-overlay');
        const text = overlay.querySelector('p');
        text.textContent = message;
        overlay.classList.remove('hidden');
    }
    
    hideLoadingOverlay() {
        const overlay = document.getElementById('loading-overlay');
        overlay.classList.add('hidden');
    }
    
    showError(message) {
        // Use notification system instead of alert
        this.showNotification(message, 'error', 'Error');
    }
    
    /**
     * Notification System
     */
    
    /**
     * Show a notification
     * @param {string} message - The message to display
     * @param {string} type - Type: 'success', 'error', 'warning', 'info'
     * @param {string} title - Optional title for the notification
     * @param {number} duration - Duration in milliseconds (0 for persistent)
     */
    showNotification(message, type = 'info', title = null, duration = 5000) {
        const container = document.getElementById('notification-container');
        if (!container) return;
        
        // Create notification element
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.dataset.id = ++this.notificationId;
        
        // Get appropriate icon for the type
        const icons = {
            success: '✅',
            error: '❌',
            warning: '⚠️',
            info: 'ℹ️'
        };
        
        notification.innerHTML = `
            <div class="notification-icon">${icons[type] || icons.info}</div>
            <div class="notification-content">
                ${title ? `<div class="notification-title">${title}</div>` : ''}
                <div class="notification-message">${message}</div>
            </div>
            <button class="notification-close" onclick="ankiApp.closeNotification(${this.notificationId})">×</button>
        `;
        
        // Add to container
        container.appendChild(notification);
        
        // Trigger animation
        requestAnimationFrame(() => {
            notification.classList.add('show');
        });
        
        // Auto-remove after duration (if specified)
        if (duration > 0) {
            setTimeout(() => {
                this.closeNotification(this.notificationId);
            }, duration);
        }
        
        return this.notificationId;
    }
    
    /**
     * Close a specific notification
     * @param {number} id - Notification ID
     */
    closeNotification(id) {
        const notification = document.querySelector(`[data-id="${id}"]`);
        if (notification) {
            notification.classList.add('hide');
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
            }, 300); // Match CSS transition duration
        }
    }
    
    /**
     * Close all notifications
     */
    closeAllNotifications() {
        const notifications = document.querySelectorAll('.notification');
        notifications.forEach(notification => {
            const id = parseInt(notification.dataset.id);
            this.closeNotification(id);
        });
    }
    
    /**
     * Show success notification
     * @param {string} message - Success message
     * @param {string} title - Optional title
     */
    showSuccess(message, title = null) {
        return this.showNotification(message, 'success', title);
    }
    
    /**
     * Show warning notification
     * @param {string} message - Warning message
     * @param {string} title - Optional title
     */
    showWarning(message, title = null) {
        return this.showNotification(message, 'warning', title);
    }
    
    /**
     * Show info notification
     * @param {string} message - Info message
     * @param {string} title - Optional title
     */
    showInfo(message, title = null) {
        return this.showNotification(message, 'info', title);
    }

    /**
     * Debug function to test card sets loading
     * Call from browser console: ankiApp.debugCardSets()
     */
    async debugCardSets() {
        console.log('🧪 === DEBUG CARD SETS ===');
        
        try {
            console.log('🔍 Testing flashcardManager.getAvailableCardSets()...');
            const cardSets = await this.flashcardManager.getAvailableCardSets();
            console.log('📚 Card sets returned:', cardSets);
            
            console.log('🧪 Testing each card set individually...');
            for (const cardSet of cardSets) {
                console.log(`📋 Card set: ${cardSet.name} (${cardSet.id})`);
                const progress = this.storage.getCardSetProgress(cardSet.id);
                console.log(`📊 Progress for ${cardSet.id}:`, progress);
            }
            
            console.log('🧪 Testing renderCardSetsProgress()...');
            const progressHtml = await this.renderCardSetsProgress();
            console.log('📄 Progress HTML length:', progressHtml.length);
            console.log('📄 Progress HTML preview:', progressHtml.substring(0, 200) + '...');
            
        } catch (error) {
            console.error('❌ Debug error:', error);
        }
        
        console.log('🧪 === END DEBUG ===');
    }

    /**
     * Debug function to refresh statistics and clear cache
     * Call from browser console: ankiApp.debugRefreshStats()
     */
    async debugRefreshStats() {
        console.log('🔄 === REFRESHING STATISTICS ===');
        try {
            // Clear the card sets cache first
            this.flashcardManager.clearAvailableCardSetsCache();
            console.log('🗑️ Cache cleared');
            
            // Reload statistics
            await this.loadStatistics();
            console.log('✅ Statistics refreshed successfully');
        } catch (error) {
            console.error('❌ Error refreshing statistics:', error);
        }
    }

    /**
     * Debug function to manually reload card sets
     * Call from browser console: ankiApp.debugReloadCardSets()
     */
    async debugReloadCardSets() {
        console.log('🔄 === RELOADING CARD SETS ===');
        try {
            // Clear cache
            this.flashcardManager.clearAvailableCardSetsCache();
            
            // Force reload
            const cardSets = await this.flashcardManager.getAvailableCardSets();
            console.log('📚 Reloaded card sets:', cardSets);
            
            // Refresh the UI if we're on stats page
            if (this.currentView === 'stats') {
                await this.loadStatistics();
            }
            
            console.log('✅ Card sets reloaded successfully');
        } catch (error) {
            console.error('❌ Error reloading card sets:', error);
        }
    }
}

// Initialize app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.ankiApp = new AnkiApp();
}); 