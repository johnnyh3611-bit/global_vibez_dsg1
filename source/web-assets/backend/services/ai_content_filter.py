"""
AI Content Filter Service
Profanity detection and content moderation with contextual severity
"""
import re
from typing import Dict

# Severity-based profanity lists
MILD_PROFANITY = [
    r'\b(fuck|fucking|shit|damn|ass|hell|crap|piss)\b',
]

SEVERE_PROFANITY = [
    r'\b(bitch|asshole|dick|pussy|cock|bastard|douche)\b',
]

SLURS_HATE_SPEECH = [
    r'\b(nigga|nigger|faggot|fag|retard|tranny|chink|spic|kike|wetback)\b',
    r'\b(whore|slut|hoe|thot|cunt)\b',
]

VIOLENCE_THREATS = [
    r'\b(kill yourself|kys|die|suicide|shoot|bomb|terrorist)\b',
]

# Compile patterns
MILD_PATTERNS = [re.compile(p, re.IGNORECASE) for p in MILD_PROFANITY]
SEVERE_PATTERNS = [re.compile(p, re.IGNORECASE) for p in SEVERE_PROFANITY]
SLUR_PATTERNS = [re.compile(p, re.IGNORECASE) for p in SLURS_HATE_SPEECH]
VIOLENCE_PATTERNS = [re.compile(p, re.IGNORECASE) for p in VIOLENCE_THREATS]


# Context-based severity settings
CONTEXT_SETTINGS = {
    "dating_profile": {
        "name": "Dating/Profiles (STRICT)",
        "block_mild": True,
        "block_severe": True,
        "block_slurs": True,
        "block_violence": True
    },
    "dating_chat": {
        "name": "Dating Chat (STRICT)",
        "block_mild": True,
        "block_severe": True,
        "block_slurs": True,
        "block_violence": True
    },
    "stream_chat": {
        "name": "Streaming Chat (MODERATE)",
        "block_mild": False,  # Allow "fuck", "shit"
        "block_severe": True,  # Block "bitch", "asshole"
        "block_slurs": True,
        "block_violence": True
    },
    "game_chat": {
        "name": "Gaming Chat (RELAXED)",
        "block_mild": False,
        "block_severe": False,  # Allow most profanity
        "block_slurs": True,  # Still block slurs
        "block_violence": True
    },
    "profile": {
        "name": "User Profiles (STRICT)",
        "block_mild": True,
        "block_severe": True,
        "block_slurs": True,
        "block_violence": True
    },
    "general": {
        "name": "General (MODERATE)",
        "block_mild": False,
        "block_severe": True,
        "block_slurs": True,
        "block_violence": True
    }
}


def filter_content(text: str, context: str = "general") -> Dict:
    """
    Filter text content based on context
    
    Args:
        text: Content to filter
        context: "dating_profile", "stream_chat", "game_chat", etc.
    
    Returns:
        {
            "is_clean": bool,
            "filtered_text": str,
            "violations": List[str],
            "severity": str,
            "context_used": str
        }
    """
    if not text:
        return {
            "is_clean": True,
            "filtered_text": "",
            "violations": [],
            "severity": "none",
            "context_used": context
        }
    
    settings = CONTEXT_SETTINGS.get(context, CONTEXT_SETTINGS["general"])
    violations = []
    filtered_text = text
    max_severity = "none"
    
    # Check violence/threats (always blocked)
    if settings["block_violence"]:
        for pattern in VIOLENCE_PATTERNS:
            matches = pattern.findall(text)
            if matches:
                violations.extend(matches)
                filtered_text = pattern.sub(lambda m: '*' * len(m.group()), filtered_text)
                max_severity = "critical"
    
    # Check slurs/hate speech (always blocked except in most relaxed contexts)
    if settings["block_slurs"]:
        for pattern in SLUR_PATTERNS:
            matches = pattern.findall(text)
            if matches:
                violations.extend(matches)
                filtered_text = pattern.sub(lambda m: '*' * len(m.group()), filtered_text)
                if max_severity != "critical":
                    max_severity = "critical"
    
    # Check severe profanity
    if settings["block_severe"]:
        for pattern in SEVERE_PATTERNS:
            matches = pattern.findall(text)
            if matches:
                violations.extend(matches)
                filtered_text = pattern.sub(lambda m: '*' * len(m.group()), filtered_text)
                if max_severity not in ["critical"]:
                    max_severity = "high"
    
    # Check mild profanity (context-dependent)
    if settings["block_mild"]:
        for pattern in MILD_PATTERNS:
            matches = pattern.findall(text)
            if matches:
                violations.extend(matches)
                filtered_text = pattern.sub(lambda m: '*' * len(m.group()), filtered_text)
                if max_severity == "none":
                    max_severity = "medium"
    
    return {
        "is_clean": len(violations) == 0,
        "filtered_text": filtered_text,
        "violations": list(set(violations)),
        "severity": max_severity,
        "context_used": settings["name"]
    }


def check_spam(text: str) -> bool:
    """Check if text appears to be spam"""
    if not text:
        return False
    
    # Spam indicators
    if len(text) > 500 and text.count('http') > 3:
        return True
    
    if text.upper() == text and len(text) > 50:
        return True
    
    if re.search(r'(.)\1{10,}', text):
        return True
    
    return False


def detect_minor_language(text: str) -> bool:
    """Detect language indicating user might be underage"""
    minor_patterns = [
        r'\b(i am|im|i\'m)\s+(1[0-7]|[0-9])\s+(years old|yo|yrs)\b',
        r'\bhigh school\b',
        r'\b(freshman|sophomore|junior|senior) year\b',
        r'\bunder 18\b',
        r'\bminor\b',
    ]
    
    for pattern in minor_patterns:
        if re.search(pattern, text, re.IGNORECASE):
            return True
    
    return False


def moderate_message(text: str, context: str = "general") -> Dict:
    """
    Comprehensive message moderation with contextual filtering
    
    Args:
        text: Message content
        context: Where message is posted
            - "dating_profile" / "dating_chat" → STRICT
            - "stream_chat" → MODERATE (allows mild profanity)
            - "game_chat" → RELAXED (allows most profanity)
    
    Returns:
        {
            "approved": bool,
            "action": str,  # "allow", "filter", "block", "flag_admin"
            "filtered_text": str,
            "reason": str,
            "severity": str,
            "context": str
        }
    """
    # Check for minor language (always critical)
    is_minor_language = detect_minor_language(text)
    if is_minor_language:
        return {
            "approved": False,
            "action": "flag_admin",
            "filtered_text": text,
            "reason": "Possible minor on platform",
            "severity": "critical",
            "context": context
        }
    
    # Check for spam
    is_spam = check_spam(text)
    if is_spam:
        return {
            "approved": False,
            "action": "block",
            "filtered_text": text,
            "reason": "Spam detected",
            "severity": "medium",
            "context": context
        }
    
    # Context-based profanity check
    profanity_check = filter_content(text, context)
    
    # Critical severity (slurs, violence) - always block
    if profanity_check["severity"] == "critical":
        return {
            "approved": False,
            "action": "block",
            "filtered_text": profanity_check["filtered_text"],
            "reason": "Hate speech or violence detected",
            "severity": "critical",
            "context": profanity_check["context_used"]
        }
    
    # High severity - block in strict contexts, filter in others
    if profanity_check["severity"] == "high":
        if context in ["dating_profile", "dating_chat", "profile"]:
            return {
                "approved": False,
                "action": "block",
                "filtered_text": profanity_check["filtered_text"],
                "reason": "Inappropriate language for context",
                "severity": "high",
                "context": profanity_check["context_used"]
            }
        else:
            return {
                "approved": True,
                "action": "filter",
                "filtered_text": profanity_check["filtered_text"],
                "reason": "Profanity filtered",
                "severity": "high",
                "context": profanity_check["context_used"]
            }
    
    # Medium severity - filter in strict contexts, allow in relaxed
    if profanity_check["severity"] == "medium":
        if context in ["dating_profile", "dating_chat", "profile"]:
            return {
                "approved": True,
                "action": "filter",
                "filtered_text": profanity_check["filtered_text"],
                "reason": "Mild profanity filtered",
                "severity": "medium",
                "context": profanity_check["context_used"]
            }
        else:
            # Allow in streaming/gaming contexts
            return {
                "approved": True,
                "action": "allow",
                "filtered_text": text,  # Original text
                "reason": "Allowed in this context",
                "severity": "none",
                "context": profanity_check["context_used"]
            }
    
    # Clean message
    return {
        "approved": True,
        "action": "allow",
        "filtered_text": text,
        "reason": "Clean",
        "severity": "none",
        "context": profanity_check["context_used"]
    }

