# 🏠 UE5 Private Vibe Suites Integration Guide

## Overview
Complete guide for implementing Private Vibe Suites in Unreal Engine 5, enabling matched players to transition from the main hub to private, dynamically-loaded environments.

---

## 🎯 System Architecture

```
Main Hub (Z = 0)
    │
    ├─> Match System detects compatibility
    │
    ├─> Invitation sent via Backend API
    │
    ├─> Both players accept
    │
    └─> Level Streaming + Teleport to Private Suite (Z = 5000+)
            │
            ├─> Glass Suite (modern, transparent walls)
            ├─> Penthouse Suite (luxury, city view)
            ├─> Beach Suite (oceanfront, sunset)
            └─> Skyline Suite (rooftop, stars)
```

---

## 📡 Backend API Integration

### Base URL
```
https://social-connect-953.emergent.host/api/private-suites
```

### Key Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/create` | POST | Create new suite for 2 players |
| `/list` | GET | List active suites |
| `/{suite_id}` | GET | Get suite details |
| `/invite` | POST | Send suite invitation |
| `/invite/{id}/respond` | POST | Accept/decline invitation |
| `/invitations/{player_id}` | GET | Get pending invitations |
| `/{suite_id}/position` | POST | Update player position |
| `/{suite_id}/activity` | POST | Log activity |
| `/{suite_id}/leave` | POST | Leave suite |
| `/ws/{suite_id}` | WebSocket | Real-time suite events |

---

## 🎬 Step 1: Social Manager Setup (C++)

### ASocialManager.h
```cpp
#pragma once

#include "CoreMinimal.h"
#include "GameFramework/Actor.h"
#include "Http.h"
#include "Json.h"
#include "SocialManager.generated.h"

UCLASS()
class GLOBALVIBEZ_API ASocialManager : public AActor
{
    GENERATED_BODY()

public:
    UFUNCTION(BlueprintCallable, Category = "Private Suites")
    void SendSuiteInvitation(FString FromPlayerID, FString ToPlayerID);

    UFUNCTION(BlueprintCallable, Category = "Private Suites")
    void AcceptSuiteInvitation(FString InvitationID);

    UFUNCTION(BlueprintCallable, Category = "Private Suites")
    void DeclineSuiteInvitation(FString InvitationID);

    UFUNCTION(BlueprintCallable, Category = "Private Suites")
    void TransitionToPrivateRoom(APlayerState* P1, APlayerState* P2, FString SuiteType);

private:
    FString BackendURL = TEXT("https://social-connect-953.emergent.host/api/private-suites");
    
    void OnSuiteCreated(FHttpRequestPtr Request, FHttpResponsePtr Response, bool bWasSuccessful);
    void OnInvitationSent(FHttpRequestPtr Request, FHttpResponsePtr Response, bool bWasSuccessful);
};
```

### ASocialManager.cpp
```cpp
#include "SocialManager.h"
#include "HttpModule.h"
#include "Interfaces/IHttpResponse.h"
#include "JsonObjectConverter.h"
#include "Engine/LevelStreaming.h"
#include "Kismet/GameplayStatics.h"

void ASocialManager::SendSuiteInvitation(FString FromPlayerID, FString ToPlayerID)
{
    TSharedRef<IHttpRequest> Request = FHttpModule::Get().CreateRequest();
    
    FString URL = FString::Printf(
        TEXT("%s/invite?from_player_id=%s&to_player_id=%s"),
        *BackendURL,
        *FromPlayerID,
        *ToPlayerID
    );
    
    Request->SetURL(URL);
    Request->SetVerb("POST");
    Request->SetHeader("Content-Type", "application/json");
    Request->OnProcessRequestComplete().BindUObject(
        this, &ASocialManager::OnInvitationSent
    );
    Request->ProcessRequest();
    
    UE_LOG(LogTemp, Log, TEXT("📨 Sent suite invitation from %s to %s"), *FromPlayerID, *ToPlayerID);
}

void ASocialManager::OnInvitationSent(FHttpRequestPtr Request, FHttpResponsePtr Response, bool bWasSuccessful)
{
    if (!bWasSuccessful)
    {
        UE_LOG(LogTemp, Error, TEXT("❌ Failed to send invitation"));
        return;
    }
    
    TSharedPtr<FJsonObject> JsonObject;
    TSharedRef<TJsonReader<>> Reader = TJsonReaderFactory<>::Create(Response->GetContentAsString());
    
    if (FJsonSerializer::Deserialize(Reader, JsonObject))
    {
        FString InvitationID = JsonObject->GetStringField("invitation_id");
        UE_LOG(LogTemp, Log, TEXT("✅ Invitation sent! ID: %s"), *InvitationID);
        
        // TODO: Show UI notification to sending player
    }
}

void ASocialManager::AcceptSuiteInvitation(FString InvitationID)
{
    TSharedRef<IHttpRequest> Request = FHttpModule::Get().CreateRequest();
    
    FString URL = FString::Printf(
        TEXT("%s/invite/%s/respond?accept=true"),
        *BackendURL,
        *InvitationID
    );
    
    Request->SetURL(URL);
    Request->SetVerb("POST");
    Request->SetHeader("Content-Type", "application/json");
    Request->OnProcessRequestComplete().BindUObject(
        this, &ASocialManager::OnSuiteCreated
    );
    Request->ProcessRequest();
    
    UE_LOG(LogTemp, Log, TEXT("✅ Accepted invitation: %s"), *InvitationID);
}

void ASocialManager::OnSuiteCreated(FHttpRequestPtr Request, FHttpResponsePtr Response, bool bWasSuccessful)
{
    if (!bWasSuccessful)
    {
        UE_LOG(LogTemp, Error, TEXT("❌ Failed to create suite"));
        return;
    }
    
    TSharedPtr<FJsonObject> JsonObject;
    TSharedRef<TJsonReader<>> Reader = TJsonReaderFactory<>::Create(Response->GetContentAsString());
    
    if (FJsonSerializer::Deserialize(Reader, JsonObject))
    {
        TSharedPtr<FJsonObject> SuiteData = JsonObject->GetObjectField("suite");
        
        FString SuiteID = SuiteData->GetStringField("suite_id");
        FString LevelName = SuiteData->GetStringField("level_name");
        float ZOffset = SuiteData->GetNumberField("z_offset");
        
        UE_LOG(LogTemp, Log, TEXT("🏠 Suite created: %s at Z=%f"), *SuiteID, ZOffset);
        
        // Get teleport positions
        TSharedPtr<FJsonObject> Positions = SuiteData->GetObjectField("teleport_positions");
        
        // TODO: Trigger level streaming and teleport
        // TransitionToPrivateRoom(Player1, Player2, LevelName, ZOffset);
    }
}

void ASocialManager::TransitionToPrivateRoom(APlayerState* P1, APlayerState* P2, FString SuiteType)
{
    // 1. Generate a unique Room ID
    FString RoomID = FGuid::NewGuid().ToString();
    
    // 2. Determine Z-offset (5000 base + 1000 per active suite)
    float ZOffset = 5000.0f;
    
    // 3. Stream in the Private Suite Level
    FString LevelPath = FString::Printf(TEXT("L_PrivateSuite_%s"), *SuiteType);
    FLatentActionInfo LatentInfo;
    LatentInfo.CallbackTarget = this;
    
    UGameplayStatics::LoadStreamLevel(
        GetWorld(),
        FName(*LevelPath),
        true,
        false,
        LatentInfo
    );
    
    UE_LOG(LogTemp, Log, TEXT("🔄 Loading suite level: %s"), *LevelPath);
    
    // 4. Wait for level to load, then teleport players
    FTimerHandle TeleportTimer;
    GetWorld()->GetTimerManager().SetTimer(TeleportTimer, [=]()
    {
        if (P1 && P1->GetPawn())
        {
            P1->GetPawn()->SetActorLocation(FVector(0, 0, ZOffset + 100));
            UE_LOG(LogTemp, Log, TEXT("✅ Teleported Player 1 to suite"));
        }
        
        if (P2 && P2->GetPawn())
        {
            P2->GetPawn()->SetActorLocation(FVector(100, 0, ZOffset + 100));
            UE_LOG(LogTemp, Log, TEXT("✅ Teleported Player 2 to suite"));
        }
        
        // 5. Connect to suite WebSocket for real-time events
        ConnectToSuiteWebSocket(RoomID);
        
    }, 2.0f, false);
}

void ASocialManager::ConnectToSuiteWebSocket(FString SuiteID)
{
    FString WebSocketURL = FString::Printf(
        TEXT("wss://social-connect-953.emergent.host/api/private-suites/ws/%s"),
        *SuiteID
    );
    
    // TODO: Implement WebSocket connection
    UE_LOG(LogTemp, Log, TEXT("🔌 Connecting to suite WebSocket: %s"), *WebSocketURL);
}
```

---

## 🎨 Step 2: Suite Level Setup

### Creating Suite Levels

1. **Create 4 Base Levels:**
   - `L_PrivateSuite_Glass` (modern, glass walls, city view)
   - `L_PrivateSuite_Penthouse` (luxury, high-end furniture)
   - `L_PrivateSuite_Beach` (oceanfront, palm trees)
   - `L_PrivateSuite_Skyline` (rooftop, starry sky)

2. **Z-Offset Architecture:**
   ```
   Main Hub:        Z = 0
   Suite 1:         Z = 5000
   Suite 2:         Z = 6000
   Suite 3:         Z = 7000
   ...
   ```

3. **Level Streaming Setup:**
   - Set each suite level to "Always Loaded" = FALSE
   - Use Dynamic Loading via `LoadStreamLevel`
   - Unload when both players leave

### Suite Blueprint (BP_PrivateSuite)

```cpp
// In Blueprint or C++
UCLASS()
class ABP_PrivateSuite : public AActor
{
    GENERATED_BODY()

public:
    UPROPERTY(EditAnywhere, BlueprintReadWrite)
    FString SuiteID;

    UPROPERTY(EditAnywhere, BlueprintReadWrite)
    FString SuiteType; // glass, penthouse, beach, skyline

    UPROPERTY(EditAnywhere, BlueprintReadWrite)
    TArray<AActor*> SpawnPoints; // Player spawn locations

    UPROPERTY(EditAnywhere, BlueprintReadWrite)
    TArray<AActor*> InteractiveObjects; // Couch, bar, view points

    UFUNCTION(BlueprintCallable)
    void InitializeSuite(FString InSuiteID, FString InType);

    UFUNCTION(BlueprintCallable)
    void SpawnPlayers(APlayerState* P1, APlayerState* P2);
};
```

---

## 🎮 Step 3: Player Interaction System

### Interactive Elements

```cpp
UCLASS()
class AInteractiveFurniture : public AActor
{
    GENERATED_BODY()

public:
    UPROPERTY(EditAnywhere)
    FString InteractionType; // sit, drink, dance, view

    UFUNCTION(BlueprintCallable)
    void OnPlayerInteract(APlayerController* Player);

    UFUNCTION(BlueprintCallable)
    void LogInteractionToBackend(FString PlayerID, FString SuiteID);
};

void AInteractiveFurniture::LogInteractionToBackend(FString PlayerID, FString SuiteID)
{
    TSharedRef<IHttpRequest> Request = FHttpModule::Get().CreateRequest();
    
    FString URL = FString::Printf(
        TEXT("https://social-connect-953.emergent.host/api/private-suites/%s/activity"),
        *SuiteID
    );
    
    // Create JSON body
    TSharedPtr<FJsonObject> JsonBody = MakeShareable(new FJsonObject);
    JsonBody->SetStringField("activity_type", InteractionType);
    
    TSharedPtr<FJsonObject> Details = MakeShareable(new FJsonObject);
    Details->SetStringField("player_id", PlayerID);
    Details->SetStringField("timestamp", FDateTime::UtcNow().ToString());
    JsonBody->SetObjectField("details", Details);
    
    FString OutputString;
    TSharedRef<TJsonWriter<>> Writer = TJsonWriterFactory<>::Create(&OutputString);
    FJsonSerializer::Serialize(JsonBody.ToSharedRef(), Writer);
    
    Request->SetURL(URL);
    Request->SetVerb("POST");
    Request->SetHeader("Content-Type", "application/json");
    Request->SetContentAsString(OutputString);
    Request->ProcessRequest();
    
    UE_LOG(LogTemp, Log, TEXT("📊 Logged activity: %s"), *InteractionType);
}
```

---

## 🎥 Step 4: Camera & Lighting

### Suite Camera Setup

```cpp
UCLASS()
class ASuiteCameraController : public AActor
{
    GENERATED_BODY()

public:
    UPROPERTY(EditAnywhere)
    TArray<ACameraActor*> ViewPoints; // Multiple camera angles

    UFUNCTION(BlueprintCallable)
    void SwitchToRomanticView();

    UFUNCTION(BlueprintCallable)
    void SwitchToPanoramicView();

    UFUNCTION(BlueprintCallable)
    void SwitchToConversationView();
};
```

### Lighting Themes

- **Romantic:** Warm colors, soft shadows, candles
- **Party:** RGB lighting, disco ball, dynamic colors
- **Relaxed:** Natural daylight, minimal shadows
- **Night:** Moon lighting, stars, ambient glow

---

## 📍 Step 5: Position Synchronization

### Real-Time Position Updates

```cpp
void APlayerCharacter::Tick(float DeltaTime)
{
    Super::Tick(DeltaTime);
    
    // Send position update every 0.5 seconds
    PositionUpdateTimer += DeltaTime;
    if (PositionUpdateTimer >= 0.5f)
    {
        PositionUpdateTimer = 0.0f;
        SendPositionToBackend();
    }
}

void APlayerCharacter::SendPositionToBackend()
{
    if (!CurrentSuiteID.IsEmpty())
    {
        FVector Location = GetActorLocation();
        FRotator Rotation = GetActorRotation();
        
        TSharedRef<IHttpRequest> Request = FHttpModule::Get().CreateRequest();
        
        FString URL = FString::Printf(
            TEXT("https://social-connect-953.emergent.host/api/private-suites/%s/position"),
            *CurrentSuiteID
        );
        
        // JSON body
        TSharedPtr<FJsonObject> JsonBody = MakeShareable(new FJsonObject);
        JsonBody->SetStringField("player_id", PlayerID);
        JsonBody->SetNumberField("x", Location.X);
        JsonBody->SetNumberField("y", Location.Y);
        JsonBody->SetNumberField("z", Location.Z);
        
        TSharedPtr<FJsonObject> RotationObj = MakeShareable(new FJsonObject);
        RotationObj->SetNumberField("pitch", Rotation.Pitch);
        RotationObj->SetNumberField("yaw", Rotation.Yaw);
        RotationObj->SetNumberField("roll", Rotation.Roll);
        JsonBody->SetObjectField("rotation", RotationObj);
        
        FString OutputString;
        TSharedRef<TJsonWriter<>> Writer = TJsonWriterFactory<>::Create(&OutputString);
        FJsonSerializer::Serialize(JsonBody.ToSharedRef(), Writer);
        
        Request->SetURL(URL);
        Request->SetVerb("POST");
        Request->SetHeader("Content-Type", "application/json");
        Request->SetContentAsString(OutputString);
        Request->ProcessRequest();
    }
}
```

---

## 🔌 Step 6: WebSocket Integration

### Real-Time Suite Events

```cpp
#include "WebSocketsModule.h"
#include "IWebSocket.h"

TSharedPtr<IWebSocket> SuiteWebSocket;

void ASocialManager::ConnectToSuiteWebSocket(FString SuiteID)
{
    FString WebSocketURL = FString::Printf(
        TEXT("wss://social-connect-953.emergent.host/api/private-suites/ws/%s"),
        *SuiteID
    );
    
    SuiteWebSocket = FWebSocketsModule::Get().CreateWebSocket(WebSocketURL);
    
    SuiteWebSocket->OnConnected().AddLambda([=]()
    {
        UE_LOG(LogTemp, Log, TEXT("✅ Connected to suite WebSocket"));
    });
    
    SuiteWebSocket->OnMessage().AddLambda([=](const FString& Message)
    {
        UE_LOG(LogTemp, Log, TEXT("📨 Suite event: %s"), *Message);
        
        TSharedPtr<FJsonObject> JsonObject;
        TSharedRef<TJsonReader<>> Reader = TJsonReaderFactory<>::Create(Message);
        
        if (FJsonSerializer::Deserialize(Reader, JsonObject))
        {
            FString EventType = JsonObject->GetStringField("event");
            
            if (EventType == "player_moved")
            {
                // Update other player's position
                FString PlayerID = JsonObject->GetStringField("player_id");
                TSharedPtr<FJsonObject> Position = JsonObject->GetObjectField("position");
                
                float X = Position->GetNumberField("x");
                float Y = Position->GetNumberField("y");
                float Z = Position->GetNumberField("z");
                
                // TODO: Update player avatar position
            }
            else if (EventType == "player_left")
            {
                // Handle player leaving
                FString PlayerID = JsonObject->GetStringField("player_id");
                UE_LOG(LogTemp, Warning, TEXT("⚠️ Player left: %s"), *PlayerID);
            }
            else if (EventType == "suite_closed")
            {
                // Teleport back to main hub
                ReturnToMainHub();
            }
        }
    });
    
    SuiteWebSocket->Connect();
}
```

---

## 🚀 Step 7: Return to Main Hub

```cpp
void ASocialManager::ReturnToMainHub()
{
    // 1. Disconnect WebSocket
    if (SuiteWebSocket && SuiteWebSocket->IsConnected())
    {
        SuiteWebSocket->Close();
    }
    
    // 2. Teleport player back to main hub (Z = 0)
    APlayerController* PC = UGameplayStatics::GetPlayerController(GetWorld(), 0);
    if (PC && PC->GetPawn())
    {
        PC->GetPawn()->SetActorLocation(FVector(0, 0, 100));
        UE_LOG(LogTemp, Log, TEXT("✅ Returned to main hub"));
    }
    
    // 3. Unload suite level
    FString LevelToUnload = CurrentSuiteLevel;
    UGameplayStatics::UnloadStreamLevel(
        GetWorld(),
        FName(*LevelToUnload),
        FLatentActionInfo(),
        false
    );
    
    UE_LOG(LogTemp, Log, TEXT("🗑️ Unloaded suite level: %s"), *LevelToUnload);
}
```

---

## 📊 Step 8: Analytics & Metrics

### Track Suite Usage

```cpp
void ASocialManager::OnSuiteSessionEnd(FString SuiteID)
{
    TSharedRef<IHttpRequest> Request = FHttpModule::Get().CreateRequest();
    
    FString URL = FString::Printf(
        TEXT("https://social-connect-953.emergent.host/api/private-suites/%s/analytics"),
        *SuiteID
    );
    
    Request->SetURL(URL);
    Request->SetVerb("GET");
    Request->OnProcessRequestComplete().AddLambda([](
        FHttpRequestPtr Req,
        FHttpResponsePtr Res,
        bool bSuccess
    ){
        if (bSuccess)
        {
            // Parse analytics
            TSharedPtr<FJsonObject> JsonObject;
            TSharedRef<TJsonReader<>> Reader = TJsonReaderFactory<>::Create(
                Res->GetContentAsString()
            );
            
            if (FJsonSerializer::Deserialize(Reader, JsonObject))
            {
                TSharedPtr<FJsonObject> Analytics = JsonObject->GetObjectField("analytics");
                
                float Duration = Analytics->GetNumberField("duration_minutes");
                int32 Activities = Analytics->GetIntegerField("activities_count");
                
                UE_LOG(LogTemp, Log, TEXT("📊 Suite session: %.1f min, %d activities"),
                    Duration, Activities);
            }
        }
    });
    
    Request->ProcessRequest();
}
```

---

## 🎯 Production Checklist

- [ ] All 4 suite levels created (Glass, Penthouse, Beach, Skyline)
- [ ] Level streaming working correctly
- [ ] Z-offset system prevents collisions
- [ ] Player teleportation smooth and instant
- [ ] WebSocket connection stable
- [ ] Position synchronization working (0.5s updates)
- [ ] Interactive furniture functional
- [ ] Lighting themes implemented
- [ ] Camera view switching working
- [ ] Return to hub working
- [ ] Analytics tracking operational
- [ ] Invitation system UI complete
- [ ] Memory cleanup on suite close

---

## 🐛 Troubleshooting

### Issue: Level Won't Stream
- Check level path is correct: `L_PrivateSuite_Glass`
- Verify level exists in Content Browser
- Ensure "Always Loaded" is FALSE

### Issue: Players Can't See Each Other
- Verify WebSocket connection is active
- Check position updates are being sent
- Ensure both players are in same Z-offset

### Issue: Suite Doesn't Close
- Call `/leave` API for both players
- Manually call `UnloadStreamLevel`
- Check for lingering WebSocket connections

---

## 📞 Support

**Backend API Docs:** `/api/docs`  
**WebSocket Test:** `wscat -c wss://your-domain/api/private-suites/ws/test`  
**Analytics Dashboard:** `/api/private-suites/{suite_id}/analytics`

---

**Happy Building! 🏠💕**
