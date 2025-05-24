# 🧠 pAnki Flashcards - Spaced Repetition

A web application for learning with flashcards using the SM-2 spaced repetition algorithm. **pAnki** stands for "Pages Anki" - a GitHub Pages compatible flashcard app.

## 🌐 Demo

**Live Demo:** [https://n-piipel.github.io/anki/](https://n-piipel.github.io/anki/)

## ✨ Features

- **Spaced Repetition Algorithm**: Implementation of the SM-2 algorithm for optimal repetition scheduling
- **Local Storage**: All progress is saved in the user's browser
- **Static Files**: Works on GitHub Pages without a backend
- **CSV Support**: Easy addition of new flashcard sets via CSV files
- **Responsive Design**: Support for mobile devices and tablets
- **Dark Theme**: Toggle between light and dark themes
- **Keyboard Shortcuts**: Quick controls during study sessions
- **Statistics**: Detailed analytics of learning progress

## 🛠 Technologies

- **Frontend**: Vanilla JavaScript (ES6+), HTML5, CSS3
- **Styles**: CSS Custom Properties, CSS Grid, Flexbox
- **Local Storage**: localStorage API
- **Algorithm**: SM-2 Spaced Repetition
- **Data Format**: CSV files
- **Hosting**: GitHub Pages ready

## 📚 How to Use

### 1. Learning Flashcards

1. Open the application
2. Select a flashcard set on the main page
3. Read the question and try to answer
4. Click "Show Answer" or press Space
5. Rate the difficulty:
   - **Again** (1) - I don't remember, repeat in 1 minute
   - **Hard** (2) - I remember with difficulty, repeat in 6 minutes
   - **Good** (3) - I remember well, standard interval
   - **Easy** (4) - I remember perfectly, increase interval

### 2. Keyboard Shortcuts

- `Space` or `Enter` - show answer
- `1` - Again
- `2` - Hard
- `3` - Good
- `4` - Easy

### 3. Adding New Flashcard Sets

Create a CSV file in the `data/` folder in the format:

```csv
Question,Answer
"What is HTML?","HyperText Markup Language"
"Capital of France?","Paris"
```

#### Supported CSV Formats:

- **Basic**: `Question,Answer`
- **With Additional Fields**: `Question,Answer,Hint,Category,Difficulty`
- **With Quotes**: Use quotes for fields containing commas
- **Escaping**: Double quotes inside a field: `"He said ""Hello"""`

#### Adding a New Set:

1. Create a file `data/your-set-name.csv`
2. Add its name to the `knownCardSets` array in the `js/flashcard.js` file
3. Commit changes to GitHub

## 📊 Spaced Repetition Algorithm

The application uses the SM-2 (SuperMemo 2) algorithm:

- **New Cards**: Start with intervals 1-10 minutes
- **Successful Answers**: Increase interval
- **Failed Answers**: Reset interval
- **Ease Factor**: Adjusts to card difficulty
- **Scheduling**: Cards appear when it's time to repeat

### Default Intervals:

- **Again**: 1 minute
- **Hard**: 6 minutes
- **Good**: 10 minutes (new) / standard interval (learned)
- **Easy**: 4 days (new) / increased interval (learned)

## 🏗 Project Structure

```
anki/
├── index.html              # Main page SPA
├── css/
│   └── style.css          # Main styles
├── js/
│   ├── app.js             # Main application controller
│   ├── storage.js         # LocalStorage management
│   ├── spaced-repetition.js # SM-2 algorithm
│   └── flashcard.js       # Flashcard management and CSV
├── data/
│   ├── general-knowledge.csv
│   └── programming-terms.csv
├── scripts/
│   └── prd.txt            # Product Requirements Document
└── README.md
```

## ⚙️ Settings

### Themes:
- **Light Theme**: Classic light palette
- **Dark Theme**: Dark palette for comfortable use
- **System Theme**: Automatic switching based on system settings

### Learning Parameters:
- **Cards per Session**: Number of new cards to learn
- **Keyboard Shortcuts**: Enable/disable quick shortcuts

## 📈 Statistics

The application tracks:

- **Overall Statistics**: Total cards learned, sessions, time
- **Progress by Sets**: Statistics for each flashcard set
- **Daily Streaks**: Number of consecutive days with study
- **Answer Accuracy**: Percentage of correct answers
- **Forecast**: Study plan for upcoming days

## 🔧 Development

### Local Development:

1. Clone the repository:
```bash
git clone https://github.com/n-piipel/anki.git
cd anki
```

2. Start a local server:
```bash
# Python 3
python -m http.server 8000

# Node.js
npx http-server

# PHP
php -S localhost:8000
```

3. Open http://localhost:8000

### GitHub Pages Deployment:

1. **Fork or clone this repository**
2. **Enable GitHub Pages:**
   - Go to Settings in your repository
   - Scroll down to the "Pages" section
   - In "Source" select "Deploy from a branch"
   - Choose branch `main` and folder `/ (root)`
   - Click "Save"
3. **Wait for deployment** (usually 1-2 minutes)
4. **Your app will be available** at: `https://your-username.github.io/anki`

> **Note:** The application is completely static and requires no backend. GitHub Pages is perfect for hosting!

### Content Updates:

- Any changes to the `main` branch will automatically update the app on GitHub Pages
- Add new CSV files to the `data/` folder and update `data/index.json`

## 🤝 Contributing

All improvements are welcome! You can:

1. **Add new flashcard sets**: Create a PR with new CSV files
2. **Fix bugs**: Describe the issue in Issues
3. **Suggest new features**: Discuss ideas in Issues
4. **Improve design**: Suggest UI/UX improvements

### How to Contribute:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push the branch (`git push origin feature/amazing-feature`)
5. Create a Pull Request

## 📝 License

This project is distributed under the MIT License. See [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- [SuperMemo](https://www.supermemo.com/) for the SM-2 algorithm
- [Anki](https://apps.ankiweb.net/) for inspiration
- All open-source community contributors

## 📬 Contact

Have questions or suggestions? Create an [Issue](https://github.com/n-piipel/anki/issues) or contact me:

- GitHub: [@n-piipel](https://github.com/n-piipel)
- Email: hcppfl@gmail.com

---

**Start learning effectively today! 🚀** 