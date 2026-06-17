"""
Trivia Questions Database for Global Vibes Trivia Game
Multiple categories with varying difficulty levels
"""

TRIVIA_QUESTIONS = [
    # ==================== GENERAL KNOWLEDGE ====================
    {
        "id": "gk1",
        "category": "general",
        "difficulty": "easy",
        "question": "What is the capital of France?",
        "options": [
            {"id": "a", "text": "London"},
            {"id": "b", "text": "Berlin"},
            {"id": "c", "text": "Paris"},
            {"id": "d", "text": "Madrid"}
        ],
        "correct_answer": "c",
        "explanation": "Paris is the capital and largest city of France."
    },
    {
        "id": "gk2",
        "category": "general",
        "difficulty": "easy",
        "question": "How many continents are there?",
        "options": [
            {"id": "a", "text": "5"},
            {"id": "b", "text": "6"},
            {"id": "c", "text": "7"},
            {"id": "d", "text": "8"}
        ],
        "correct_answer": "c",
        "explanation": "There are 7 continents: Africa, Antarctica, Asia, Australia, Europe, North America, and South America."
    },
    {
        "id": "gk3",
        "category": "general",
        "difficulty": "medium",
        "question": "What is the largest ocean on Earth?",
        "options": [
            {"id": "a", "text": "Atlantic Ocean"},
            {"id": "b", "text": "Indian Ocean"},
            {"id": "c", "text": "Arctic Ocean"},
            {"id": "d", "text": "Pacific Ocean"}
        ],
        "correct_answer": "d",
        "explanation": "The Pacific Ocean is the largest ocean, covering more than 63 million square miles."
    },
    
    # ==================== SCIENCE ====================
    {
        "id": "sci1",
        "category": "science",
        "difficulty": "easy",
        "question": "What planet is known as the Red Planet?",
        "options": [
            {"id": "a", "text": "Venus"},
            {"id": "b", "text": "Mars"},
            {"id": "c", "text": "Jupiter"},
            {"id": "d", "text": "Saturn"}
        ],
        "correct_answer": "b",
        "explanation": "Mars is called the Red Planet because of its reddish appearance caused by iron oxide on its surface."
    },
    {
        "id": "sci2",
        "category": "science",
        "difficulty": "easy",
        "question": "How many bones are in the adult human body?",
        "options": [
            {"id": "a", "text": "186"},
            {"id": "b", "text": "206"},
            {"id": "c", "text": "226"},
            {"id": "d", "text": "246"}
        ],
        "correct_answer": "b",
        "explanation": "The adult human body has 206 bones."
    },
    {
        "id": "sci3",
        "category": "science",
        "difficulty": "medium",
        "question": "What is the chemical symbol for gold?",
        "options": [
            {"id": "a", "text": "Go"},
            {"id": "b", "text": "Gd"},
            {"id": "c", "text": "Au"},
            {"id": "d", "text": "Ag"}
        ],
        "correct_answer": "c",
        "explanation": "Au is the chemical symbol for gold, derived from the Latin word 'aurum'."
    },
    
    # ==================== MOVIES & TV ====================
    {
        "id": "mov1",
        "category": "movies",
        "difficulty": "easy",
        "question": "Who played Iron Man in the Marvel Cinematic Universe?",
        "options": [
            {"id": "a", "text": "Chris Evans"},
            {"id": "b", "text": "Robert Downey Jr."},
            {"id": "c", "text": "Chris Hemsworth"},
            {"id": "d", "text": "Mark Ruffalo"}
        ],
        "correct_answer": "b",
        "explanation": "Robert Downey Jr. portrayed Tony Stark/Iron Man across multiple MCU films."
    },
    {
        "id": "mov2",
        "category": "movies",
        "difficulty": "medium",
        "question": "Which movie won the Academy Award for Best Picture in 2020?",
        "options": [
            {"id": "a", "text": "1917"},
            {"id": "b", "text": "Joker"},
            {"id": "c", "text": "Parasite"},
            {"id": "d", "text": "Once Upon a Time in Hollywood"}
        ],
        "correct_answer": "c",
        "explanation": "Parasite made history as the first non-English language film to win Best Picture."
    },
    {
        "id": "mov3",
        "category": "movies",
        "difficulty": "easy",
        "question": "What is the name of Harry Potter's owl?",
        "options": [
            {"id": "a", "text": "Hedwig"},
            {"id": "b", "text": "Errol"},
            {"id": "c", "text": "Pigwidgeon"},
            {"id": "d", "text": "Scabbers"}
        ],
        "correct_answer": "a",
        "explanation": "Hedwig was Harry Potter's loyal snowy owl companion."
    },
    
    # ==================== SPORTS ====================
    {
        "id": "spo1",
        "category": "sports",
        "difficulty": "easy",
        "question": "How many players are on a basketball team on the court at once?",
        "options": [
            {"id": "a", "text": "4"},
            {"id": "b", "text": "5"},
            {"id": "c", "text": "6"},
            {"id": "d", "text": "7"}
        ],
        "correct_answer": "b",
        "explanation": "Each basketball team has 5 players on the court at the same time."
    },
    {
        "id": "spo2",
        "category": "sports",
        "difficulty": "medium",
        "question": "Which country has won the most FIFA World Cups?",
        "options": [
            {"id": "a", "text": "Germany"},
            {"id": "b", "text": "Argentina"},
            {"id": "c", "text": "Brazil"},
            {"id": "d", "text": "Italy"}
        ],
        "correct_answer": "c",
        "explanation": "Brazil has won the FIFA World Cup 5 times, more than any other nation."
    },
    {
        "id": "spo3",
        "category": "sports",
        "difficulty": "easy",
        "question": "What sport is known as 'The Beautiful Game'?",
        "options": [
            {"id": "a", "text": "Basketball"},
            {"id": "b", "text": "Soccer/Football"},
            {"id": "c", "text": "Tennis"},
            {"id": "d", "text": "Baseball"}
        ],
        "correct_answer": "b",
        "explanation": "Soccer (football) is often called 'The Beautiful Game' due to its grace and artistry."
    },
    
    # ==================== HISTORY ====================
    {
        "id": "his1",
        "category": "history",
        "difficulty": "easy",
        "question": "Who was the first President of the United States?",
        "options": [
            {"id": "a", "text": "Thomas Jefferson"},
            {"id": "b", "text": "George Washington"},
            {"id": "c", "text": "Abraham Lincoln"},
            {"id": "d", "text": "John Adams"}
        ],
        "correct_answer": "b",
        "explanation": "George Washington was the first President of the United States, serving from 1789 to 1797."
    },
    {
        "id": "his2",
        "category": "history",
        "difficulty": "medium",
        "question": "In which year did World War II end?",
        "options": [
            {"id": "a", "text": "1943"},
            {"id": "b", "text": "1944"},
            {"id": "c", "text": "1945"},
            {"id": "d", "text": "1946"}
        ],
        "correct_answer": "c",
        "explanation": "World War II ended in 1945 with Germany's surrender in May and Japan's in September."
    },
    {
        "id": "his3",
        "category": "history",
        "difficulty": "hard",
        "question": "Who was the first woman to win a Nobel Prize?",
        "options": [
            {"id": "a", "text": "Rosalind Franklin"},
            {"id": "b", "text": "Marie Curie"},
            {"id": "c", "text": "Jane Addams"},
            {"id": "d", "text": "Mother Teresa"}
        ],
        "correct_answer": "b",
        "explanation": "Marie Curie won the Nobel Prize in Physics in 1903, becoming the first woman to receive the honor."
    },
    
    # ==================== GEOGRAPHY ====================
    {
        "id": "geo1",
        "category": "geography",
        "difficulty": "easy",
        "question": "What is the tallest mountain in the world?",
        "options": [
            {"id": "a", "text": "K2"},
            {"id": "b", "text": "Mount Kilimanjaro"},
            {"id": "c", "text": "Mount Everest"},
            {"id": "d", "text": "Mount Fuji"}
        ],
        "correct_answer": "c",
        "explanation": "Mount Everest is the tallest mountain at 29,032 feet (8,849 meters) above sea level."
    },
    {
        "id": "geo2",
        "category": "geography",
        "difficulty": "medium",
        "question": "Which country has the longest coastline in the world?",
        "options": [
            {"id": "a", "text": "Australia"},
            {"id": "b", "text": "Russia"},
            {"id": "c", "text": "Canada"},
            {"id": "d", "text": "United States"}
        ],
        "correct_answer": "c",
        "explanation": "Canada has the world's longest coastline at over 202,080 kilometers."
    },
    {
        "id": "geo3",
        "category": "geography",
        "difficulty": "easy",
        "question": "What is the largest desert in the world?",
        "options": [
            {"id": "a", "text": "Sahara Desert"},
            {"id": "b", "text": "Antarctic Desert"},
            {"id": "c", "text": "Gobi Desert"},
            {"id": "d", "text": "Arabian Desert"}
        ],
        "correct_answer": "b",
        "explanation": "The Antarctic Desert is the largest, though the Sahara is the largest hot desert."
    },
    
    # ==================== MUSIC ====================
    {
        "id": "mus1",
        "category": "music",
        "difficulty": "easy",
        "question": "Who is known as the 'King of Pop'?",
        "options": [
            {"id": "a", "text": "Elvis Presley"},
            {"id": "b", "text": "Michael Jackson"},
            {"id": "c", "text": "Prince"},
            {"id": "d", "text": "Justin Timberlake"}
        ],
        "correct_answer": "b",
        "explanation": "Michael Jackson earned the title 'King of Pop' for his revolutionary impact on music and entertainment."
    },
    {
        "id": "mus2",
        "category": "music",
        "difficulty": "medium",
        "question": "Which band released the album 'Abbey Road' in 1969?",
        "options": [
            {"id": "a", "text": "The Rolling Stones"},
            {"id": "b", "text": "The Who"},
            {"id": "c", "text": "The Beatles"},
            {"id": "d", "text": "Led Zeppelin"}
        ],
        "correct_answer": "c",
        "explanation": "The Beatles released the iconic 'Abbey Road' album in September 1969."
    },
    {
        "id": "mus3",
        "category": "music",
        "difficulty": "easy",
        "question": "What instrument has 88 keys?",
        "options": [
            {"id": "a", "text": "Guitar"},
            {"id": "b", "text": "Piano"},
            {"id": "c", "text": "Violin"},
            {"id": "d", "text": "Drums"}
        ],
        "correct_answer": "b",
        "explanation": "A standard piano has 88 keys - 52 white keys and 36 black keys."
    },
    
    # ==================== POP CULTURE ====================
    {
        "id": "pop1",
        "category": "pop_culture",
        "difficulty": "easy",
        "question": "What social media platform uses a bird as its logo?",
        "options": [
            {"id": "a", "text": "Facebook"},
            {"id": "b", "text": "Instagram"},
            {"id": "c", "text": "Twitter/X"},
            {"id": "d", "text": "TikTok"}
        ],
        "correct_answer": "c",
        "explanation": "Twitter (now known as X) famously used a blue bird as its logo for many years."
    },
    {
        "id": "pop2",
        "category": "pop_culture",
        "difficulty": "medium",
        "question": "Who is the author of the Harry Potter series?",
        "options": [
            {"id": "a", "text": "J.R.R. Tolkien"},
            {"id": "b", "text": "J.K. Rowling"},
            {"id": "c", "text": "Stephen King"},
            {"id": "d", "text": "George R.R. Martin"}
        ],
        "correct_answer": "b",
        "explanation": "J.K. Rowling wrote the beloved Harry Potter series of seven books."
    },
    {
        "id": "pop3",
        "category": "pop_culture",
        "difficulty": "easy",
        "question": "What year did the first iPhone release?",
        "options": [
            {"id": "a", "text": "2005"},
            {"id": "b", "text": "2007"},
            {"id": "c", "text": "2009"},
            {"id": "d", "text": "2010"}
        ],
        "correct_answer": "b",
        "explanation": "Apple released the first iPhone on June 29, 2007, revolutionizing the smartphone industry."
    },
]

# Category metadata
TRIVIA_CATEGORIES = [
    {"id": "general", "name": "General Knowledge", "emoji": "🧠", "color": "#3B82F6"},
    {"id": "science", "name": "Science", "emoji": "🔬", "color": "#10B981"},
    {"id": "movies", "name": "Movies & TV", "emoji": "🎬", "color": "#F59E0B"},
    {"id": "sports", "name": "Sports", "emoji": "⚽", "color": "#EF4444"},
    {"id": "history", "name": "History", "emoji": "📚", "color": "#8B5CF6"},
    {"id": "geography", "name": "Geography", "emoji": "🌍", "color": "#06B6D4"},
    {"id": "music", "name": "Music", "emoji": "🎵", "color": "#EC4899"},
    {"id": "pop_culture", "name": "Pop Culture", "emoji": "✨", "color": "#F97316"},
]
