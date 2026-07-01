# Unreal Engine 5.5 MetaHuman AI Dealer Integration Guide

**Last Updated**: December 2025  
**Target Platform**: Unreal Engine 5.5+  
**Backend**: FastAPI WebSocket Server  
**Frontend**: React Overlay Components

---

## 🎯 Overview

This integration connects the **Global Vibez DSG AI Dealer** backend personality engine with **Unreal Engine 5.5 MetaHuman** for photorealistic real-time dealer animations, voice synthesis, and game rule enforcement.

### Architecture Layers

| Layer | Technology | Purpose |
|-------|----------|---------|
| **Logic** | FastAPI | Enforces Triple Threat (Dating/Gaming/Streaming) rules |
| **Body** | UE5 MetaHuman | Industry-leader visuals and micro-expressions |
| **Audio** | MetaSounds | Spatialized, authoritative vocal delivery |
| **Security** | SHA-256 Hashing | Provably Fair deck verification |

---

## 📡 WebSocket Protocol

### Backend Endpoint
```
ws://your-backend-url.com/api/ws/tournament/{table_id}
```

### Message Format

#### From Backend → UE5 (Dealer Events)
```json
{
  "type": "DEALER_EVENT",
  "data": {
    "action": "TEN_FOR_200",
    "animation": "MT_10_for_200_Excited",
    "speech": "Ten tricks bid? The big two-hundred is on the line.",
    "vibe": "Intense",
    "facial_expression": "serious_focus",
    "intensity": 1.0,
    "delay_ms": 1800,
    "timestamp": "2025-12-10T14:30:00Z"
  }
}
```

#### From UE5 → Backend (Player Actions)
```json
{
  "type": "PLAYER_ACTION",
  "data": {
    "player_id": "player_001",
    "player_name": "Alex",
    "action_type": "BID",
    "value": 10,
    "metadata": {
      "is_nil": false,
      "is_blind_nil": false
    }
  }
}
```

---

## 🎮 UE5 C++ Implementation

### Step 1: Create DealerAIController Class

**File**: `Source/GlobalVibez/Public/DealerAIController.h`

```cpp
#pragma once

#include "CoreMinimal.h"
#include "GameFramework/Actor.h"
#include "IWebSocket.h"
#include "Components/AudioComponent.h"
#include "DealerAIController.generated.h"

UCLASS()
class GLOBALVIBEZ_API ADealerAIController : public AActor
{
    GENERATED_BODY()

public:
    ADealerAIController();

protected:
    virtual void BeginPlay() override;
    virtual void EndPlay(const EEndPlayReason::Type EndPlayReason) override;

private:
    // WebSocket connection to FastAPI backend
    TSharedPtr<IWebSocket> DealerSocket;

    // MetaHuman skeletal mesh
    UPROPERTY(EditAnywhere, Category = "Dealer")
    USkeletalMeshComponent* DealerMesh;

    // MetaSound voice component
    UPROPERTY(EditAnywhere, Category = "Dealer")
    UAudioComponent* DealerVoiceComponent;

    // Animation montage mappings
    UPROPERTY(EditAnywhere, Category = "Dealer|Animations")
    TMap<FString, UAnimMontage*> DealerMontages;

    // WebSocket handlers
    void OnWebSocketConnected();
    void OnWebSocketMessage(const FString& Message);
    void OnWebSocketError(const FString& Error);
    void OnWebSocketClosed(int32 StatusCode, const FString& Reason, bool bWasClean);

    // Dealer actions
    void ExecuteDealerResponse(FString AnimName, FString Speech);
    void PlayDealerVoice(FString SpeechText);
    UAnimMontage* GetMontageByTag(FString Tag);
};
```

### Step 2: Implement WebSocket Connection

**File**: `Source/GlobalVibez/Private/DealerAIController.cpp`

```cpp
#include "DealerAIController.h"
#include "WebSocketsModule.h"
#include "Json.h"
#include "JsonUtilities.h"

ADealerAIController::ADealerAIController()
{
    PrimaryActorTick.bCanEverTick = true;

    // Create dealer mesh component
    DealerMesh = CreateDefaultSubobject<USkeletalMeshComponent>(TEXT("DealerMesh"));
    RootComponent = DealerMesh;

    // Create voice audio component
    DealerVoiceComponent = CreateDefaultSubobject<UAudioComponent>(TEXT("DealerVoice"));
    DealerVoiceComponent->SetupAttachment(DealerMesh);
}

void ADealerAIController::BeginPlay()
{
    Super::BeginPlay();

    // Connect to FastAPI Tournament Server
    FString WebSocketURL = TEXT("ws://your-backend.com/api/ws/tournament/glasshouse_01");
    
    DealerSocket = FWebSocketsModule::Get().CreateWebSocket(WebSocketURL);

    // Bind event handlers
    DealerSocket->OnConnected().AddUObject(this, &ADealerAIController::OnWebSocketConnected);
    DealerSocket->OnMessage().AddUObject(this, &ADealerAIController::OnWebSocketMessage);
    DealerSocket->OnConnectionError().AddUObject(this, &ADealerAIController::OnWebSocketError);
    DealerSocket->OnClosed().AddUObject(this, &ADealerAIController::OnWebSocketClosed);

    // Connect
    DealerSocket->Connect();
}

void ADealerAIController::OnWebSocketConnected()
{
    UE_LOG(LogTemp, Log, TEXT("✅ Dealer WebSocket connected"));
    
    // Send initial handshake
    FString HandshakeMessage = TEXT("{\"type\":\"CONNECTED\",\"client\":\"UE5_MetaHuman\"}");
    DealerSocket->Send(HandshakeMessage);
}

void ADealerAIController::OnWebSocketMessage(const FString& Message)
{
    // Parse JSON message
    TSharedPtr<FJsonObject> JsonObject;
    TSharedRef<TJsonReader<>> Reader = TJsonReaderFactory<>::Create(Message);

    if (FJsonSerializer::Deserialize(Reader, JsonObject))
    {
        FString MessageType = JsonObject->GetStringField(TEXT("type"));

        if (MessageType == TEXT("DEALER_EVENT"))
        {
            TSharedPtr<FJsonObject> Data = JsonObject->GetObjectField(TEXT("data"));
            
            FString AnimTag = Data->GetStringField(TEXT("animation"));
            FString Speech = Data->GetStringField(TEXT("speech"));
            float DelayMs = Data->GetNumberField(TEXT("delay_ms"));

            // Optional: Add delay before executing
            if (DelayMs > 0)
            {
                FTimerHandle DelayTimer;
                GetWorld()->GetTimerManager().SetTimer(
                    DelayTimer,
                    [this, AnimTag, Speech]() {
                        ExecuteDealerResponse(AnimTag, Speech);
                    },
                    DelayMs / 1000.0f,
                    false
                );
            }
            else
            {
                ExecuteDealerResponse(AnimTag, Speech);
            }
        }
    }
}

void ADealerAIController::ExecuteDealerResponse(FString AnimName, FString Speech)
{
    UE_LOG(LogTemp, Log, TEXT("🎭 Executing dealer response: %s | %s"), *AnimName, *Speech);

    // 1. Play voice via MetaSound
    PlayDealerVoice(Speech);

    // 2. Play facial animation montage
    UAnimInstance* AnimInstance = DealerMesh->GetAnimInstance();
    if (AnimInstance)
    {
        UAnimMontage* SelectedMontage = GetMontageByTag(AnimName);
        if (SelectedMontage)
        {
            AnimInstance->Montage_Play(SelectedMontage);
        }
    }
}

void ADealerAIController::PlayDealerVoice(FString SpeechText)
{
    // Option 1: Use MetaSound parameter
    if (DealerVoiceComponent)
    {
        DealerVoiceComponent->SetStringParameter(FName("SpeechContent"), SpeechText);
        DealerVoiceComponent->Play();
    }

    // Option 2: Trigger TTS via Blueprint callable function
    // (Implement your TTS pipeline here - ElevenLabs, Azure Speech, etc.)
}

UAnimMontage* ADealerAIController::GetMontageByTag(FString Tag)
{
    if (DealerMontages.Contains(Tag))
    {
        return DealerMontages[Tag];
    }
    
    UE_LOG(LogTemp, Warning, TEXT("⚠️ Animation montage not found: %s"), *Tag);
    return nullptr;
}

void ADealerAIController::EndPlay(const EEndPlayReason::Type EndPlayReason)
{
    if (DealerSocket.IsValid() && DealerSocket->IsConnected())
    {
        DealerSocket->Close();
    }

    Super::EndPlay(EndPlayReason);
}
```

---

## 🎬 Animation Montage Mapping

Create these Animation Montages in UE5 and map them in the DealerAIController Blueprint:

| Tag | Montage Name | Description |
|-----|--------------|-------------|
| `MT_Welcoming_Gesture` | Welcoming wave | Initial player greeting |
| `MT_10_for_200_Excited` | Intense lean forward | 10-for-200 bid reaction |
| `MT_BlindNil_Impressed` | Respectful nod | Blind Nil bid reaction |
| `MT_Renegue_Penalty` | Stern stop gesture | Renegue violation |
| `MT_Deck_Shuffle_Cut` | Deck shuffle with cut | Provably Fair deck generation |
| `MT_Approving_Nod` | Approving nod | Winning play |
| `MT_Social_Gesture` | Playful gesture | Social commentary |
| `MT_Jackpot_Celebration` | Excited celebration | Jackpot win |

---

## 🎨 React Overlay Integration

### Available Components

1. **IntegrityHUD** - SHA-256 Hash Display
2. **SocialTicker** - Live Bids & Comments
3. **GiftEffectTrigger** - Niagara Particle Sync

### Demo Page
Visit `/tournament-demo` to see all overlay components in action.

---

## 🧪 Testing

### Backend API Test
```bash
curl -X POST "https://your-backend.com/api/tournament/glasshouse_01/trigger-event" \
  -H "Content-Type: application/json" \
  -d '{"event_type":"TEN_FOR_200","player_name":"Test Player"}'
```

### WebSocket Test (Python)
```python
import asyncio
import websockets
import json

async def test_tournament_websocket():
    uri = "ws://your-backend.com/api/ws/tournament/glasshouse_01"
    
    async with websockets.connect(uri) as websocket:
        # Send player action
        await websocket.send(json.dumps({
            "type": "PLAYER_ACTION",
            "data": {
                "player_id": "test_001",
                "player_name": "Test Player",
                "action_type": "BID",
                "value": 10
            }
        }))
        
        # Receive dealer response
        response = await websocket.recv()
        print(f"Dealer Response: {response}")

asyncio.run(test_tournament_websocket())
```

---

## 📦 Dependencies

### Unreal Engine Modules
Add to `YourProject.Build.cs`:
```csharp
PublicDependencyModuleNames.AddRange(new string[] {
    "Core",
    "CoreUObject",
    "Engine",
    "WebSockets",
    "Json",
    "JsonUtilities",
    "MetasoundEngine"
});
```

### Backend Requirements
```bash
pip install fastapi websockets uvicorn
```

---

## 🚀 Deployment Checklist

- [ ] Configure WebSocket URL in UE5 Blueprint
- [ ] Map all Animation Montages to tags
- [ ] Set up MetaSound TTS pipeline
- [ ] Test WebSocket connection
- [ ] Verify React overlay components display correctly
- [ ] Test Provably Fair hash generation
- [ ] Verify Niagara particle effects trigger correctly

---

## 📞 Support

For integration issues, contact the backend development team or check:
- Backend logs: `/var/log/supervisor/backend.*.log`
- Frontend console: Browser DevTools
- UE5 logs: `Saved/Logs/`

---

**Happy Integration!** 🎮🎩
