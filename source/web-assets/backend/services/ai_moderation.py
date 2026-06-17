"""
AI Moderation Service using Claude Sonnet 4
Context-aware content filtering for chat messages, images, and user-generated content
"""
import os
from dotenv import load_dotenv
from typing import Dict, List
from pydantic import BaseModel
from source.web-assets.backend.services.ai_engine import LlmChat, UserMessage

load_dotenv()

class ModerationResult(BaseModel):
    """Result of content moderation check"""
    is_safe: bool
    severity: str  # LOW, MEDIUM, HIGH, CRITICAL
    categories: List[str]  # harassment, profanity, spam, sexual, violence, etc.
    explanation: str
    recommended_action: str  # ALLOW, WARN, MUTE, BAN
    confidence: float

class AIModerator:
    """
    AI-powered content moderator using Claude Sonnet 4
    Provides context-aware moderation for dating + gaming platform
    """
    
    def __init__(self):
        self.api_key = os.getenv("EMERGENT_LLM_KEY")
        if not self.api_key:
            raise ValueError("EMERGENT_LLM_KEY not found in environment variables")
        
        # Initialize Claude for moderation
        self.chat = LlmChat(
            api_key=self.api_key,
            session_id="moderation_ai",
            system_message=self._get_moderation_system_prompt()
        ).with_model("anthropic", "claude-sonnet-4-5-20250929")
    
    def _get_moderation_system_prompt(self) -> str:
        """System prompt for content moderation"""
        return """You are an AI content moderator for "Global Vibez DSG", a gamified social dating platform that combines gaming, dating, and live streaming.

Your job is to analyze user-generated content (messages, profiles, etc.) and determine if it violates community guidelines.

**Platform Context:**
- This is a DATING app where romantic/flirty messages are expected and allowed
- This is also a GAMING platform where competitive trash talk and banter are normal
- Users can send virtual gifts and compliments
- Live streaming and entertainment content is encouraged

**What IS ALLOWED:**
✅ Flirting, compliments, romantic interest expressions
✅ Gaming trash talk and competitive banter (as long as not extreme)
✅ Casual profanity in gaming context (e.g., "damn I lost" is OK)
✅ Emojis, slang, modern dating language
✅ Invitations to play games together or go on dates
✅ Gift sending, vibe requests

**What IS VIOLATIONS:**
❌ Harassment, bullying, threats
❌ Hate speech (racism, sexism, homophobia, etc.)
❌ Explicit sexual content or solicitation
❌ Spam, scams, phishing attempts
❌ Doxxing or sharing private information
❌ Extreme profanity directed at others
❌ Self-harm or violence encouragement

**Severity Levels:**
- LOW: Minor issues, first-time casual profanity
- MEDIUM: Inappropriate but not extreme, repeat violations
- HIGH: Clear harassment, hate speech, explicit content
- CRITICAL: Severe threats, illegal content, extreme violations

**Recommended Actions:**
- ALLOW: Content is fine, no action needed
- WARN: Send user a warning message
- MUTE: Temporary chat restriction (1-24 hours)
- BAN: Permanent or long-term account suspension

You must respond in JSON format:
{
  "is_safe": true/false,
  "severity": "LOW|MEDIUM|HIGH|CRITICAL",
  "categories": ["category1", "category2"],
  "explanation": "Brief explanation of why content was flagged",
  "recommended_action": "ALLOW|WARN|MUTE|BAN",
  "confidence": 0.0-1.0
}

Be context-aware: What would be inappropriate on a kids' platform might be perfectly fine here. Focus on genuine harm, not prudishness."""

    async def check_message(
        self, 
        content: str, 
        context: Dict = None,
        user_id: str = None,
        user_history: Dict = None
    ) -> ModerationResult:
        """
        Check a chat message for policy violations
        
        Args:
            content: The message text to check
            context: Additional context (game_type, conversation_type, etc.)
            user_id: User ID for history tracking
            user_history: Previous violations/warnings
        
        Returns:
            ModerationResult with safety decision
        """
        # Build context-aware prompt
        prompt = f"""Analyze this message for policy violations:

**Message:** "{content}"

**Context:**
- Platform: Dating + Gaming + Streaming
- User ID: {user_id or 'Unknown'}
"""
        
        if context:
            prompt += f"- Additional Context: {context}\n"
        
        if user_history and user_history.get('violation_count', 0) > 0:
            prompt += f"- User has {user_history['violation_count']} previous violations\n"
        
        prompt += "\nProvide your moderation decision in JSON format as specified in your system instructions."
        
        try:
            # Send to Claude
            user_message = UserMessage(text=prompt)
            response = await self.chat.send_message(user_message)
            
            # Parse JSON response
            import json
            result_data = json.loads(response)
            
            # Create ModerationResult
            result = ModerationResult(**result_data)
            
            # Adjust action based on user history
            if user_history and user_history.get('violation_count', 0) > 2:
                if result.severity in ['MEDIUM', 'HIGH']:
                    result.recommended_action = 'BAN'
                elif result.severity == 'LOW':
                    result.recommended_action = 'MUTE'
            
            return result
            
        except Exception as e:
            print(f"❌ Moderation error: {e}")
            # Fail-safe: allow content but flag for manual review
            return ModerationResult(
                is_safe=True,
                severity="LOW",
                categories=["error"],
                explanation=f"Moderation check failed: {str(e)}. Content allowed pending manual review.",
                recommended_action="ALLOW",
                confidence=0.0
            )
    
    async def check_profile_content(
        self,
        bio: str = None,
        interests: List[str] = None,
        display_name: str = None
    ) -> ModerationResult:
        """Check user profile content for violations"""
        
        content_parts = []
        if display_name:
            content_parts.append(f"Display Name: {display_name}")
        if bio:
            content_parts.append(f"Bio: {bio}")
        if interests:
            content_parts.append(f"Interests: {', '.join(interests)}")
        
        content = "\n".join(content_parts)
        
        prompt = f"""Analyze this user profile for policy violations:

{content}

Focus on:
- Inappropriate usernames
- Offensive or explicit bio content
- Suspicious patterns (spam, scams)

Provide your moderation decision in JSON format."""
        
        try:
            user_message = UserMessage(text=prompt)
            response = await self.chat.send_message(user_message)
            
            import json
            result_data = json.loads(response)
            return ModerationResult(**result_data)
            
        except Exception as e:
            return ModerationResult(
                is_safe=True,
                severity="LOW",
                categories=["error"],
                explanation=f"Profile check failed: {str(e)}",
                recommended_action="ALLOW",
                confidence=0.0
            )
    
    async def bulk_check_messages(
        self,
        messages: List[Dict]
    ) -> List[ModerationResult]:
        """Check multiple messages in batch (for efficiency)"""
        results = []
        
        for msg in messages:
            result = await self.check_message(
                content=msg.get('content', ''),
                context=msg.get('context'),
                user_id=msg.get('user_id'),
                user_history=msg.get('user_history')
            )
            results.append(result)
        
        return results

# Global moderator instance
ai_moderator = AIModerator()
