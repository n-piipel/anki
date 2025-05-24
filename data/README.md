# 📚 Card Sets

This folder contains CSV files with flashcard sets for learning Greek language.

## 🚀 How to Add a New Card Set

### Method 1: Automatic Discovery (Simple)

1. Create a new CSV file in this folder with any name, for example: `my-cards.csv`
2. Use the format: `question,answer` (one pair per line)
3. Refresh the page - the new set will appear automatically

### Method 2: Via Index File (Recommended)

1. Create a CSV file as in method 1
2. Add information about the set to the `index.json` file:

```json
{
  "cardSets": [
    {
      "id": "my-greek-cards",
      "name": "My Greek Cards",
      "filename": "my-greek-cards.csv", 
      "description": "Custom Greek vocabulary set"
    }
  ]
}
```

## 📝 CSV File Format

```csv
ρωτάω,спрашивать
τραγουδάω,петь
βοηθάω,помогать
αγαπάω,любить
περπατάω,идти пешком
```

### Rules:
- One line = one flashcard
- Format: `question,answer`
- Use UTF-8 encoding
- Avoid commas inside questions/answers or wrap in quotes

## 🇬🇷 Current Greek Language Sets

The application currently includes these Greek language learning sets:

- `greek-verbs-basic.csv` - Essential Greek verbs (ask, sing, help, love, walk)
- `greek-transport-navigation.csv` - Public transport and city navigation phrases
- `greek-verbs-everyday.csv` - Common daily action verbs (read, wait, buy, call)
- `greek-connecting-words.csv` - Conjunctions and discourse markers (but, also, therefore)
- `greek-everyday-life.csv` - Daily life vocabulary (university, travel, bike, gift)

All sets include Greek words/phrases with Russian translations.

## 📊 Learning Progress

Progress for each set is saved in the browser and displayed in the interface:
- Total number of cards
- New cards (never studied)
- Cards for review (based on spaced repetition algorithm)
- Set completion percentage

## 🎯 Study Tips

- **Regular Practice**: Study a little each day rather than long sessions
- **Honest Ratings**: Rate your knowledge honestly for optimal scheduling
- **Context**: Try to use new words in sentences or real situations
- **Review**: Don't skip review sessions - they're crucial for long-term retention

## 🔧 Technical Notes

- Files are automatically scanned when the app starts
- Progress data is stored locally in your browser
- The spaced repetition algorithm (SM-2) optimizes review timing
- Export your progress from the Statistics page for backup 