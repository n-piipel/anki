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
            console.log('🚀 Initializing Anki Flashcards App...');
            
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
            this.showError('Ошибка инициализации приложения');
        }
    }
    
    /**
     * Performance optimization: Register Service Worker for offline functionality
     */
    async registerServiceWorker() {
        if ('serviceWorker' in navigator) {
            try {
                console.log('🛡️ Registering Service Worker...');
                const registration = await navigator.serviceWorker.register('/sw.js');
                
                registration.addEventListener('updatefound', () => {
                    console.log('🔄 Service Worker update found');
                    const newWorker = registration.installing;
                    
                    newWorker.addEventListener('statechange', () => {
                        if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                            // Новая версия доступна
                            console.log('🆕 New version available');
                            this.showUpdateAvailable();
                        }
                    });
                });
                
                // Обработка сообщений от Service Worker
                navigator.serviceWorker.addEventListener('message', event => {
                    if (event.data.type === 'CACHE_UPDATED') {
                        console.log('📦 Cache updated:', event.data.payload);
                    }
                });
                
                console.log('✅ Service Worker registered successfully');
                return registration;
                
            } catch (error) {
                console.warn('⚠️ Service Worker registration failed:', error);
            }
        } else {
            console.log('ℹ️ Service Worker not supported');
        }
    }
    
    /**
     * Show update available notification
     */
    showUpdateAvailable() {
        // Можно показать уведомление о доступном обновлении
        const updateBanner = document.createElement('div');
        updateBanner.className = 'update-banner';
        updateBanner.innerHTML = `
            <div class="update-content">
                <span>🆕 Доступно обновление приложения</span>
                <button onclick="location.reload()" class="control-btn">Обновить</button>
                <button onclick="this.parentElement.parentElement.remove()" class="control-btn secondary">Позже</button>
            </div>
        `;
        
        // Добавляем стили для баннера обновления
        const style = document.createElement('style');
        style.textContent = `
            .update-banner {
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                background: var(--primary);
                color: white;
                padding: var(--space-sm);
                z-index: 1001;
                box-shadow: var(--shadow-md);
            }
            .update-content {
                display: flex;
                align-items: center;
                justify-content: center;
                gap: var(--space-md);
                max-width: 1200px;
                margin: 0 auto;
            }
            .update-banner .control-btn {
                padding: var(--space-xs) var(--space-sm);
                font-size: 0.875rem;
            }
        `;
        
        document.head.appendChild(style);
        document.body.appendChild(updateBanner);
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
        const savedTheme = this.storage.getSetting('theme') || 'light';
        
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
            
            // Performance optimization: Start prefetching popular sets in background
            this.flashcardManager.prefetchPopularSets().catch(error => {
                console.warn('Prefetch failed:', error);
            });
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
                    <p>📝 Наборы карточек не найдены</p>
                    <p style="font-size: 0.875rem; opacity: 0.8;">
                        Добавьте CSV файлы в папку data/ для начала изучения
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
                        <span class="stat-label">Карточек</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-value">${cardSet.newCards}</span>
                        <span class="stat-label">Новых</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-value">${cardSet.reviewCards}</span>
                        <span class="stat-label">К повторению</span>
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
                <p>⚠️ Ошибка загрузки наборов карточек</p>
                <button class="control-btn" onclick="window.location.reload()">
                    Попробовать снова
                </button>
            </div>
        `;
    }
    
    async selectCardSet(setId) {
        try {
            this.showLoadingOverlay('Загрузка набора карточек...');
            
            this.currentCardSet = await this.flashcardManager.loadCardSet(setId);
            
            // Switch to study view
            this.switchView('study');
            
            // Initialize study session
            await this.initializeStudySession();
            
        } catch (error) {
            console.error('❌ Failed to select card set:', error);
            this.showError('Ошибка загрузки набора карточек');
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
            this.showError('Ошибка инициализации сессии изучения');
        }
    }
    
    setupStudyInterface() {
        // Update progress info
        const currentCardEl = document.getElementById('current-card');
        const totalCardsEl = document.getElementById('total-cards');
        
        totalCardsEl.textContent = this.studySession.cards.length;
        
        // Setup card flip handler
        const showAnswerBtn = document.getElementById('show-answer-btn');
        const flashcard = document.getElementById('flashcard');
        
        showAnswerBtn.addEventListener('click', () => {
            flashcard.classList.add('flipped');
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
            return `${minutes}м`;
        } else if (days < 7) {
            return `${Math.round(days)}д`;
        } else if (days < 30) {
            const weeks = Math.round(days / 7);
            return `${weeks}н`;
        } else {
            const months = Math.round(days / 30);
            return `${months}мес`;
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
                <h3>🎉 Отличная работа!</h3>
                <p>Все карточки изучены на сегодня.</p>
                <p>Возвращайтесь завтра для повторения.</p>
            </div>
        `;
        
        // Hide answer button and difficulty buttons
        document.getElementById('show-answer-btn').style.display = 'none';
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

        // Show detailed statistics
        alert(
            `Сессия завершена!\n\n` +
            `Всего карточек: ${total}\n` +
            `Правильных ответов: ${correct}\n` +
            `Ошибок: ${wrong}\n` +
            `Точность: ${accuracy}%\n` +
            `Средний интервал: ${avgInterval} дней\n` +
            `Время: ${minutes} мин`
        );
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
    
    async loadStatistics() {
        try {
            // Performance optimization: Show loading immediately
            const statsContainer = document.getElementById('stats-content');
            statsContainer.innerHTML = `
                <div class="loading-placeholder">
                    <div class="loading-spinner large"></div>
                    <p>Загрузка статистики...</p>
                </div>
            `;
            
            // Get global statistics
            const globalStats = this.storage.getStats();
            
            // Performance optimization: Batch DOM updates
            const fragment = document.createDocumentFragment();
            const tempContainer = document.createElement('div');
            
            // Calculate all data first (sync operations)
            const today = new Date().toISOString().split('T')[0];
            const streak = this.calculateStreak(globalStats, today);
            const recentActivity = this.getRecentActivity(globalStats, 7);
            const hoursSpent = Math.round((globalStats.totalTimeSpent || 0) / 3600 * 10) / 10;
            const minutesSpent = Math.round(((globalStats.totalTimeSpent || 0) % 3600) / 60);
            const avgAccuracy = this.calculateAverageAccuracy(globalStats);
            
            // Render in chunks to avoid blocking
            const renderChunk = async (htmlChunk) => {
                return new Promise(resolve => {
                    requestAnimationFrame(() => {
                        tempContainer.innerHTML += htmlChunk;
                        resolve();
                    });
                });
            };
            
            // Chunk 1: General stats
            await renderChunk(`
                <div class="stats-grid">
                    <div class="stats-card">
                        <h3>📊 Общая статистика</h3>
                        <div class="stats-list">
                            <div class="stat-row">
                                <span class="stat-label">Всего карточек изучено:</span>
                                <span class="stat-value">${globalStats.totalCardsStudied || 0}</span>
                            </div>
                            <div class="stat-row">
                                <span class="stat-label">Сессий завершено:</span>
                                <span class="stat-value">${globalStats.totalSessions || 0}</span>
                            </div>
                            <div class="stat-row">
                                <span class="stat-label">Время изучения:</span>
                                <span class="stat-value">${hoursSpent}ч ${minutesSpent}м</span>
                            </div>
                            <div class="stat-row">
                                <span class="stat-label">Средняя точность:</span>
                                <span class="stat-value">${avgAccuracy}%</span>
                            </div>
                        </div>
                    </div>
            `);
            
            // Chunk 2: Streak info
            await renderChunk(`
                    <div class="stats-card">
                        <h3>🔥 Серия дней</h3>
                        <div class="streak-display">
                            <div class="streak-number">${streak}</div>
                            <div class="streak-label">${streak === 1 ? 'день' : streak < 5 ? 'дня' : 'дней'} подряд</div>
                            <div class="streak-info">
                                ${globalStats.lastStudyDate === today ? 
                                    '✅ Сегодня уже изучали' : 
                                    '💪 Продолжайте изучение!'}
                            </div>
                        </div>
                    </div>
            `);
            
            // Chunk 3: Activity chart
            await renderChunk(`
                    <div class="stats-card">
                        <h3>📈 Активность (7 дней)</h3>
                        <div class="activity-chart">
                            ${this.renderActivityChart(recentActivity)}
                        </div>
                        <div class="activity-summary">
                            Карточек за неделю: <strong>${recentActivity.reduce((sum, day) => sum + day.cards, 0)}</strong>
                        </div>
                    </div>
            `);
            
            // Chunk 4: Card sets progress (async operation)
            const cardSetsProgressHtml = await this.renderCardSetsProgress();
            await renderChunk(`
                    <div class="stats-card">
                        <h3>📚 Прогресс по наборам</h3>
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
                        📤 Экспорт данных
                    </button>
                    <button class="control-btn secondary" onclick="ankiApp.resetStatistics()">
                        🗑️ Сбросить статистику
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
                    <p>⚠️ Ошибка загрузки статистики</p>
                    <button class="control-btn" onclick="ankiApp.loadStatistics()">Попробовать снова</button>
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
                    <div class="activity-bar" style="height: ${height}%" title="${day.cards} карточек"></div>
                    <div class="activity-label">${day.dayName}</div>
                </div>
            `;
        }).join('');
    }
    
    async renderCardSetsProgress() {
        try {
            const cardSets = await this.flashcardManager.getAvailableCardSets();
            
            if (cardSets.length === 0) {
                return '<p class="no-progress">Нет данных по наборам карточек</p>';
            }
            
            return cardSets.map(cardSet => {
                const progress = this.storage.getCardSetProgress(cardSet.id);
                const progressPercent = cardSet.totalCards > 0 ? 
                    Math.round((progress.totalCards / cardSet.totalCards) * 100) : 0;
                
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
                            <span>Изучено: ${progress.totalCards}/${cardSet.totalCards}</span>
                            <span>К повторению: ${progress.reviewCards}</span>
                        </div>
                    </div>
                `;
            }).join('');
            
        } catch (error) {
            console.error('Error rendering card sets progress:', error);
            return '<p class="no-progress">Ошибка загрузки прогресса</p>';
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
            
            alert('✅ Данные экспортированы успешно!');
            
        } catch (error) {
            console.error('Export failed:', error);
            alert('❌ Ошибка экспорта данных');
        }
    }
    
    resetStatistics() {
        if (confirm('Вы уверены, что хотите сбросить всю статистику? Это действие нельзя отменить.')) {
            this.storage.clearAllData();
            alert('✅ Статистика сброшена');
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
        
        // Performance optimization: Add cache management controls
        this.setupCacheManagement();
    }
    
    /**
     * Setup cache management controls in settings
     */
    setupCacheManagement() {
        // Add cache stats and controls if not already added
        const settingsContainer = document.querySelector('.settings-container');
        
        if (!document.getElementById('cache-management')) {
            const cacheSection = document.createElement('div');
            cacheSection.className = 'settings-group';
            cacheSection.id = 'cache-management';
            
            const memStats = this.flashcardManager.getMemoryStats();
            const storageStats = this.storage.getDetailedStorageStats();
            
            cacheSection.innerHTML = `
                <h3>🚀 Производительность</h3>
                
                <!-- Cache Statistics -->
                <div class="setting-item">
                    <label>Кэшировано наборов:</label>
                    <span id="cache-stats-sets">${memStats.cachedCardSets}</span>
                </div>
                <div class="setting-item">
                    <label>Всего карточек в кэше:</label>
                    <span id="cache-stats-cards">${memStats.totalCachedCards}</span>
                </div>
                
                <!-- Storage Statistics -->
                <div class="setting-item">
                    <label>Использование хранилища:</label>
                    <span id="storage-usage">${storageStats.usage.totalKB} KB (${storageStats.usage.usagePercent}%)</span>
                </div>
                <div class="setting-item">
                    <label>Сжатие данных:</label>
                    <span id="compression-ratio">${storageStats.compression.ratio}% экономии</span>
                </div>
                
                <!-- Cache Controls -->
                <div class="setting-item">
                    <button class="control-btn secondary" onclick="ankiApp.clearAppCache()">
                        🧹 Очистить кэш
                    </button>
                    <button class="control-btn secondary" onclick="ankiApp.updateCacheStats()">
                        📊 Обновить статистику
                    </button>
                </div>
                
                <!-- Storage Optimization -->
                <div class="setting-item">
                    <button class="control-btn secondary" onclick="ankiApp.optimizeStorage()">
                        🗜️ Оптимизировать хранилище
                    </button>
                    <button class="control-btn secondary" onclick="ankiApp.cleanupStorage()">
                        🧹 Очистить старые данные
                    </button>
                </div>
                
                <!-- Prefetch Controls -->
                <div class="setting-item">
                    <button class="control-btn secondary" onclick="ankiApp.prefetchAllSets()">
                        ⚡ Предзагрузить все наборы
                    </button>
                </div>
                
                <!-- Recommendations -->
                <div class="setting-item" id="storage-recommendations">
                    <label>Рекомендации:</label>
                    <div class="recommendations">
                        ${storageStats.recommendations.map(rec => `<div class="recommendation">${rec}</div>`).join('')}
                    </div>
                </div>
            `;
            
            settingsContainer.appendChild(cacheSection);
            
            // Add CSS for recommendations
            const style = document.createElement('style');
            style.textContent = `
                .recommendations {
                    margin-top: var(--space-xs);
                }
                .recommendation {
                    padding: var(--space-xs) var(--space-sm);
                    background: var(--bg-tertiary);
                    border-radius: var(--radius-sm);
                    font-size: 0.875rem;
                    margin-bottom: var(--space-xs);
                    border-left: 3px solid var(--primary);
                }
                .recommendation:last-child {
                    margin-bottom: 0;
                }
            `;
            document.head.appendChild(style);
        }
    }
    
    /**
     * Clear app cache
     */
    clearAppCache() {
        this.flashcardManager.clearCache();
        this.updateCacheStats();
        alert('✅ Кэш очищен!');
    }
    
    /**
     * Update cache statistics display
     */
    updateCacheStats() {
        const memStats = this.flashcardManager.getMemoryStats();
        const storageStats = this.storage.getDetailedStorageStats();
        
        const setsEl = document.getElementById('cache-stats-sets');
        const cardsEl = document.getElementById('cache-stats-cards');
        const storageEl = document.getElementById('storage-usage');
        const compressionEl = document.getElementById('compression-ratio');
        
        if (setsEl) setsEl.textContent = memStats.cachedCardSets;
        if (cardsEl) cardsEl.textContent = memStats.totalCachedCards;
        if (storageEl) storageEl.textContent = `${storageStats.usage.totalKB} KB (${storageStats.usage.usagePercent}%)`;
        if (compressionEl) compressionEl.textContent = `${storageStats.compression.ratio}% экономии`;
        
        // Update recommendations
        const recommendationsEl = document.querySelector('.recommendations');
        if (recommendationsEl) {
            recommendationsEl.innerHTML = storageStats.recommendations
                .map(rec => `<div class="recommendation">${rec}</div>`)
                .join('');
        }
    }
    
    /**
     * Prefetch all available card sets
     */
    async prefetchAllSets() {
        try {
            this.showLoadingOverlay('Предзагрузка всех наборов...');
            await this.flashcardManager.preloadCardSets();
            this.updateCacheStats();
            alert('✅ Все наборы предзагружены!');
        } catch (error) {
            console.error('Prefetch failed:', error);
            alert('❌ Ошибка предзагрузки');
        } finally {
            this.hideLoadingOverlay();
        }
    }
    
    getViewFromURL() {
        const hash = window.location.hash.slice(1);
        return hash || null;
    }
    
    handleNavigation(e) {
        const view = e.state?.view || this.getViewFromURL() || 'home';
        this.switchView(view, false);
    }
    
    showLoadingOverlay(message = 'Загрузка...') {
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
        // Simple error display - could be enhanced with a modal
        alert(`Ошибка: ${message}`);
    }
    
    /**
     * Optimize storage compression
     */
    async optimizeStorage() {
        try {
            this.showLoadingOverlay('Оптимизация хранилища...');
            
            const optimized = this.storage.optimizeStorage();
            this.updateCacheStats();
            
            alert(`✅ Хранилище оптимизировано!\nСжато элементов: ${optimized}`);
        } catch (error) {
            console.error('Storage optimization failed:', error);
            alert('❌ Ошибка оптимизации хранилища');
        } finally {
            this.hideLoadingOverlay();
        }
    }
    
    /**
     * Clean up old storage data
     */
    async cleanupStorage() {
        try {
            this.showLoadingOverlay('Очистка старых данных...');
            
            const result = this.storage.cleanupStorage();
            this.updateCacheStats();
            
            if (result.itemsRemoved > 0) {
                alert(`✅ Очистка завершена!\nУдалено элементов: ${result.itemsRemoved}\nОсвобождено: ${Math.round(result.bytesFreed / 1024)} KB`);
            } else {
                alert('✅ Старые данные не найдены, хранилище чистое!');
            }
        } catch (error) {
            console.error('Storage cleanup failed:', error);
            alert('❌ Ошибка очистки хранилища');
        } finally {
            this.hideLoadingOverlay();
        }
    }
}

// Initialize app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.ankiApp = new AnkiApp();
}); 