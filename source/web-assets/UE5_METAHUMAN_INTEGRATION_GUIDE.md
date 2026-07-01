# 🎭 UE5 MetaHuman Dealer Integration Guide

## Overview
Complete guide for integrating Unreal Engine 5 MetaHuman dealers with the Global Vibez DSG backend via WebSockets and REST APIs.

---

## 🚀 Quick Start

### Prerequisites
- Unreal Engine 5.3+
- MetaHuman plugin installed
- Web Browser plugin enabled
- JSON Blueprint Utilities plugin

###WebSocket Connection URL
```
wss://your-domain.com/ws/table/{table_id}
```

---

## 📡 WebSocket Integration

### Step 1: Create WebSocket Component (C++)

```cpp
// MetaHumanDealerWebSocket.h
#pragma once

#include "CoreMinimal.h"
#include "Components/ActorComponent.h"
#include "IWebSocket.h"
#include "MetaHumanDealerWebSocket.generated.h"

UCLASS()
class GLOBALVIBEZ_API UMetaHumanDealerWebSocket : public UActorComponent
{
    GENERATED_BODY()

public:
    UMetaHumanDealerWebSocket();

    UFUNCTION(BlueprintCallable, Category = "MetaHuman Dealer")
    void ConnectToTable(FString TableID);

    UFUNCTION(BlueprintCallable, Category = "MetaHuman Dealer")
    void DisconnectFromTable();

protected:
    virtual void BeginPlay() override;

private:
    TSharedPtr<IWebSocket> WebSocket;
    FString CurrentTableID;

    void OnConnected();
    void OnConnectionError(const FString& Error);
    void OnClosed(int32 StatusCode, const FString& Reason, bool bWasClean);
    void OnMessage(const FString& Message);
    void OnMessageSent(const FString& Message);
};
```

```cpp
// MetaHumanDealerWebSocket.cpp
#include "MetaHumanDealerWebSocket.h"
#include "WebSocketsModule.h"
#include "JsonObjectConverter.h"

UMetaHumanDealerWebSocket::UMetaHumanDealerWebSocket()
{
    PrimaryComponentTick.bCanEverTick = false;
}

void UMetaHumanDealerWebSocket::ConnectToTable(FString TableID)
{
    CurrentTableID = TableID;
    
    // Create WebSocket connection
    FString WebSocketURL = FString::Printf(
        TEXT("wss://social-connect-953.emergent.host/ws/table/%s"),
        *TableID
    );
    
    WebSocket = FWebSocketsModule::Get().CreateWebSocket(WebSocketURL);
    
    // Bind delegates
    WebSocket->OnConnected().AddUObject(this, &UMetaHumanDealerWebSocket::OnConnected);
    WebSocket->OnConnectionError().AddUObject(this, &UMetaHumanDealerWebSocket::OnConnectionError);
    WebSocket->OnClosed().AddUObject(this, &UMetaHumanDealerWebSocket::OnClosed);
    WebSocket->OnMessage().AddUObject(this, &UMetaHumanDealerWebSocket::OnMessage);
    WebSocket->OnMessageSent().AddUObject(this, &UMetaHumanDealerWebSocket::OnMessageSent);
    
    // Connect
    WebSocket->Connect();
    
    UE_LOG(LogTemp, Log, TEXT("Connecting to MetaHuman Dealer table: %s"), *TableID);
}

void UMetaHumanDealerWebSocket::OnConnected()
{
    UE_LOG(LogTemp, Log, TEXT("✅ Connected to MetaHuman Dealer table"));
}

void UMetaHumanDealerWebSocket::OnMessage(const FString& Message)
{
    UE_LOG(LogTemp, Log, TEXT("📨 Dealer Event: %s"), *Message);
    
    // Parse JSON
    TSharedPtr<FJsonObject> JsonObject;
    TSharedRef<TJsonReader<>> Reader = TJsonReaderFactory<>::Create(Message);
    
    if (FJsonSerializer::Deserialize(Reader, JsonObject))
    {
        FString EventType = JsonObject->GetStringField("event_type");
        TSharedPtr<FJsonObject> EventData = JsonObject->GetObjectField("data");
        
        if (EventType == "dealer_animation")
        {
            FString AnimationName = EventData->GetStringField("animation");
            FString Speech = EventData->GetStringField("speech");
            
            // Trigger animation on MetaHuman
            // TODO: Call your MetaHuman animation blueprint
            UE_LOG(LogTemp, Log, TEXT("🎭 Dealer Animation: %s"), *AnimationName);
            UE_LOG(LogTemp, Log, TEXT("💬 Dealer Speech: %s"), *Speech);
        }
        else if (EventType == "card_dealt")
        {
            FString TargetPlayer = EventData->GetStringField("player_id");
            FString CardValue = EventData->GetStringField("card");
            
            // Spawn card and animate to player position
            UE_LOG(LogTemp, Log, TEXT("🃏 Card Dealt: %s to %s"), *CardValue, *TargetPlayer);
        }
        else if (EventType == "game_state_change")
        {
            FString NewPhase = EventData->GetStringField("phase");
            UE_LOG(LogTemp, Log, TEXT("🎮 Game Phase: %s"), *NewPhase);
        }
    }
}

void UMetaHumanDealerWebSocket::DisconnectFromTable()
{
    if (WebSocket && WebSocket->IsConnected())
    {
        WebSocket->Close();
    }
}
```

---

### Step 2: Blueprint Setup

1. **Create Blueprint Actor** `BP_MetaHumanDealerTable`
2. **Add Component** → `MetaHumanDealerWebSocket`
3. **Event Graph**:

```
Event BeginPlay
   └─> MetaHumanDealerWebSocket → ConnectToTable
          Table ID: "poker_table_001"
```

---

## 🎬 Dealer Animations

### Available Animations (13 total)

| Animation Name | Trigger Event | Description |
|---------------|---------------|-------------|
| `WELCOME_PLAYER` | Player joins table | Welcoming gesture, eye contact |
| `BET_APPROVED` | Small bet placed | Nod of acknowledgment |
| `BIG_BET_REACTION` | Bet > $2000 | Excited reaction, lean forward |
| `DEALING_CARDS` | Cards being dealt | Smooth dealing animation |
| `SHUFFLE_DECK` | New round starts | Professional shuffle |
| `PLAYER_WINS` | Hand won | Congratulatory gesture |
| `PLAYER_LOSES` | Hand lost | Sympathetic nod |
| `ALL_IN_SHOCK` | Player goes all-in | Surprise reaction |
| `IDLE_NEUTRAL` | Waiting state | Subtle breathing, eye darts |
| `THINKING` | Complex decision | Hand on chin |
| `CELEBRATION` | Big win | Applause animation |
| `BID_WHIST_TEN_FOR_200` | Bid Whist special | Specific bid reaction |
| `POKER_BIG_BET` | High stakes poker | Intensity increase |

### Triggering Animations

**Option A: WebSocket (Automatic)**
Backend automatically sends animation events via WebSocket.

**Option B: Manual Trigger**
```cpp
void ADealerController::TriggerDealerAnimation(FString AnimationName)
{
    FString URL = FString::Printf(
        TEXT("https://social-connect-953.emergent.host/api/dealer/trigger/%s/%s"),
        *TableID,
        *AnimationName
    );
    
    TSharedRef<IHttpRequest> Request = FHttpModule::Get().CreateRequest();
    Request->SetURL(URL);
    Request->SetVerb("POST");
    Request->ProcessRequest();
}
```

---

## 📍 Spatial Coordinates

### Querying Player Seat Positions

```cpp
void ASmartTable::GetPlayerSeatPosition(int32 PlayerIndex)
{
    FString URL = FString::Printf(
        TEXT("https://social-connect-953.emergent.host/api/tables/%s/spatial/seat"),
        *TableID
    );
    
    TSharedRef<IHttpRequest> Request = FHttpModule::Get().CreateRequest();
    Request->SetURL(URL);
    Request->SetVerb("GET");
    Request->OnProcessRequestComplete().BindUObject(
        this, &ASmartTable::OnSpatialDataReceived
    );
    Request->ProcessRequest();
}

void ASmartTable::OnSpatialDataReceived(
    FHttpRequestPtr Request,
    FHttpResponsePtr Response,
    bool bWasSuccessful
)
{
    if (!bWasSuccessful) return;
    
    TSharedPtr<FJsonObject> JsonObject;
    TSharedRef<TJsonReader<>> Reader = TJsonReaderFactory<>::Create(
        Response->GetContentAsString()
    );
    
    if (FJsonSerializer::Deserialize(Reader, JsonObject))
    {
        TArray<TSharedPtr<FJsonValue>> Seats = JsonObject->GetArrayField("seats");
        
        for (int32 i = 0; i < Seats.Num(); ++i)
        {
            TSharedPtr<FJsonObject> Seat = Seats[i]->AsObject();
            
            float X = Seat->GetNumberField("x");
            float Y = Seat->GetNumberField("y");
            float Z = Seat->GetNumberField("z");
            
            // Convert to UE5 world space (multiply by scale factor)
            FVector WorldPos = FVector(X, Y, Z) * 100.0f; // cm to UU
            
            UE_LOG(LogTemp, Log, TEXT("Seat %d Position: %s"), i, *WorldPos.ToString());
            
            // Spawn player avatar or camera anchor
            SpawnPlayerAvatar(i, WorldPos);
        }
    }
}
```

### Coordinate System Mapping

| Backend (cm) | UE5 (Unreal Units) | Notes |
|--------------|-------------------|-------|
| `x: 0-300` | `0-30000 UU` | Table width |
| `y: 0-150` | `0-15000 UU` | Table depth |
| `z: 75` | `7500 UU` | Seat height |

**Conversion Formula**: `UE5_Position = Backend_Position * 100.0f`

---

## 🎮 Game Event Handling

### WebSocket Event Payload Examples

#### 1. Dealer Animation Event
```json
{
  "event_type": "dealer_animation",
  "table_id": "poker_table_001",
  "timestamp": "2025-04-11T12:00:00Z",
  "data": {
    "animation": "BIG_BET_REACTION",
    "speech": "HIGH ROLLER ALERT! 🔥 Everyone, take notes!",
    "duration": 3.5,
    "mood": "excited"
  }
}
```

#### 2. Card Dealt Event
```json
{
  "event_type": "card_dealt",
  "table_id": "poker_table_001",
  "timestamp": "2025-04-11T12:00:05Z",
  "data": {
    "player_id": "player_seat_2",
    "card": "A♠",
    "position": {
      "x": 150.0,
      "y": 100.0,
      "z": 75.0
    },
    "face_down": false
  }
}
```

#### 3. Game Phase Change
```json
{
  "event_type": "game_state_change",
  "table_id": "poker_table_001",
  "timestamp": "2025-04-11T12:00:10Z",
  "data": {
    "phase": "flop",
    "pot": 5000,
    "community_cards": ["K♥", "7♦", "3♣"]
  }
}
```

---

## 🎥 Camera System Integration

### Dynamic Camera Anchors

```cpp
void ACameraController::TransitionToPlayerView(int32 PlayerIndex)
{
    // Query camera anchor position from backend
    FString URL = FString::Printf(
        TEXT("https://social-connect-953.emergent.host/api/tables/%s/spatial/camera_anchor"),
        *TableID
    );
    
    // Add query parameter for player
    URL += FString::Printf(TEXT("?player_index=%d"), PlayerIndex);
    
    TSharedRef<IHttpRequest> Request = FHttpModule::Get().CreateRequest();
    Request->SetURL(URL);
    Request->OnProcessRequestComplete().BindLambda([this](
        FHttpRequestPtr Req,
        FHttpResponsePtr Res,
        bool bSuccess
    ){
        if (bSuccess)
        {
            // Parse camera position and smoothly transition
            TSharedPtr<FJsonObject> Json;
            TSharedRef<TJsonReader<>> Reader = TJsonReaderFactory<>::Create(
                Res->GetContentAsString()
            );
            
            if (FJsonSerializer::Deserialize(Reader, Json))
            {
                FVector CamPos = FVector(
                    Json->GetNumberField("x") * 100.0f,
                    Json->GetNumberField("y") * 100.0f,
                    Json->GetNumberField("z") * 100.0f
                );
                
                FRotator CamRot = FRotator(
                    Json->GetNumberField("pitch"),
                    Json->GetNumberField("yaw"),
                    Json->GetNumberField("roll")
                );
                
                // Smooth camera transition
                SmoothMoveCameraTo(CamPos, CamRot, 1.5f);
            }
        }
    });
    
    Request->ProcessRequest();
}
```

---

## 🎙️ Live Streaming Integration

### Winner's Circle Interview System

When a player wins, trigger the Winner's Circle sequence:

```cpp
void ADealerController::StartWinnersCircleInterview(FString WinnerPlayerID)
{
    // 1. Transition camera to interview position
    TransitionToInterviewCamera();
    
    // 2. Trigger dealer interview animation
    TriggerDealerAnimation("INTERVIEW_WINNER");
    
    // 3. Send WebSocket event to start streaming overlay
    FString Message = FString::Printf(
        TEXT("{\"event\":\"winners_circle\",\"player_id\":\"%s\"}"),
        *WinnerPlayerID
    );
    WebSocketComponent->SendMessage(Message);
    
    // 4. Display winner stats overlay
    ShowWinnerStatsUI(WinnerPlayerID);
}
```

### Twitch/YouTube Streaming

The backend broadcasts to Twitch via RTMP. In UE5:

1. **Capture Render Target** of table view
2. **Send to OBS** via NDI plugin
3. **Backend handles** RTMP streaming to Twitch

---

## 🔧 REST API Reference

### Table Management

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/tables/create` | POST | Create new table |
| `/api/tables/list` | GET | List active tables |
| `/api/tables/{id}/state` | GET | Get game state |
| `/api/tables/{id}/sit` | POST | Player joins seat |

### Currency & Betting

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/verify-bet` | POST | Lock funds for bet |
| `/api/balance/{player_id}` | GET | Get player balance |
| `/api/release-bet/{lock_id}` | POST | Release/transfer funds |

### Dealer Animations

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/dealer/animations` | GET | List all animations |
| `/api/dealer/trigger/{table_id}/{event}` | POST | Manually trigger animation |

### Spatial Data

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/tables/{id}/spatial/seat` | GET | Get seat positions |
| `/api/tables/{id}/spatial/camera_anchor` | GET | Get camera positions |

---

## 🎯 Production Checklist

- [ ] WebSocket reconnection logic implemented
- [ ] Spatial coordinates scaled correctly (×100)
- [ ] All 13 dealer animations imported to MetaHuman
- [ ] Camera anchor system tested
- [ ] Card dealing physics finalized
- [ ] Live streaming RTMP configured
- [ ] Winner's Circle interview sequence tested
- [ ] Fallback for network disconnects
- [ ] Performance optimization (60 FPS target)
- [ ] Security: SSL/TLS for WebSocket (wss://)

---

## 📞 Support

For integration issues:
- **Backend API Docs**: `/api/docs` (Swagger UI)
- **WebSocket Test Tool**: `wscat -c wss://your-domain.com/ws/table/test`
- **Spatial Data Visualizer**: `/metahuman-dealer` (Web fallback)

---

## 🚀 Next Steps

1. Implement WebSocket component in UE5
2. Import MetaHuman dealer model
3. Configure animation blueprint with 13 dealer animations
4. Test card dealing physics and spatial positioning
5. Integrate live streaming camera system
6. Deploy to production with load testing

**Happy Building! 🎮🎭**
