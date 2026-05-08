from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import Optional, Dict, Any
import os
import httpx

router = APIRouter()

# Pydantic Models
class VoiceSynthesisRequest(BaseModel):
    text: str
    voice_id: Optional[str] = "default"  # ElevenLabs voice ID
    model_id: Optional[str] = "eleven_flash_v2_5"
    stability: Optional[float] = 0.5
    similarity_boost: Optional[float] = 0.75

# Get ElevenLabs API key from environment
ELEVENLABS_API_KEY = os.getenv("ELEVENLABS_API_KEY", "")

@router.post("/ai/voice-synthesis")
async def synthesize_voice(request: VoiceSynthesisRequest) -> Dict[str, Any]:
    """
    Synthesize AI Dealer voice using ElevenLabs API
    
    This endpoint acts as a proxy to keep API keys secure on the backend.
    Returns audio stream that can be played directly in the browser.
    """
    try:
        if not ELEVENLABS_API_KEY:
            raise HTTPException(
                status_code=500, 
                detail="ElevenLabs API key not configured. Please add ELEVENLABS_API_KEY to backend/.env"
            )
        
        # ElevenLabs API endpoint
        url = f"https://api.elevenlabs.io/v1/text-to-speech/{request.voice_id}"
        
        headers = {
            "Accept": "audio/mpeg",
            "Content-Type": "application/json",
            "xi-api-key": ELEVENLABS_API_KEY
        }
        
        data = {
            "text": request.text,
            "model_id": request.model_id,
            "voice_settings": {
                "stability": request.stability,
                "similarity_boost": request.similarity_boost,
                "style": 0.5,
                "use_speaker_boost": True
            }
        }
        
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(url, json=data, headers=headers)
            
            if response.status_code != 200:
                raise HTTPException(
                    status_code=response.status_code,
                    detail=f"ElevenLabs API error: {response.text}"
                )
            
            # Stream audio back to client
            return StreamingResponse(
                iter([response.content]),
                media_type="audio/mpeg",
                headers={
                    "Content-Disposition": "inline",
                    "Cache-Control": "public, max-age=3600"
                }
            )
    
    except httpx.TimeoutException:
        raise HTTPException(status_code=504, detail="Voice synthesis timeout")
    except httpx.RequestError as e:
        raise HTTPException(status_code=502, detail=f"Request failed: {str(e)}")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/ai/available-voices")
async def get_available_voices() -> Dict[str, Any]:
    """
    Get list of available ElevenLabs voices
    (Including your cloned voice)
    """
    try:
        if not ELEVENLABS_API_KEY:
            return {
                "voices": [],
                "message": "ElevenLabs API key not configured"
            }
        
        url = "https://api.elevenlabs.io/v1/voices"
        headers = {"xi-api-key": ELEVENLABS_API_KEY}
        
        async with httpx.AsyncClient() as client:
            response = await client.get(url, headers=headers)
            
            if response.status_code == 200:
                return response.json()
            else:
                raise HTTPException(
                    status_code=response.status_code,
                    detail="Failed to fetch voices"
                )
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/ai/dealer-phrases")
async def get_dealer_phrases() -> Dict[str, Any]:
    """
    Get pre-defined AI Dealer phrases for the personality
    """
    return {
        "welcome": [
            "Welcome back to the lounge.",
            "Good to see you again, champion.",
            "The tables have missed you."
        ],
        "encouragement": [
            "I'm waiting for you at the table.",
            "Let's see if luck is on your side tonight.",
            "The chips are ready. Are you?",
            "Time to show them what you're made of."
        ],
        "victory": [
            "Knew you had it in you!",
            "That's how it's done!",
            "The house didn't stand a chance."
        ],
        "defeat": [
            "Close one. Next hand is yours.",
            "That's the game. Ready to bounce back?",
            "Every loss is a lesson. Let's go again."
        ],
        "social": [
            "I see you've got some admirers.",
            "Someone's been eyeing your table.",
            "Looks like you've got a vibe request."
        ]
    }
