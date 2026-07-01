# Just for the Night - Unreal Engine 5.5 Integration Guide

## Overview
This guide details how to implement the blur-to-reveal visual effect in Unreal Engine 5.5 for the "Just for the Night" premium room experience. When integrated with the Global Vibez DSG backend, this creates a seamless token-gated content reveal system.

---

## Architecture Flow

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│   React Web UI  │────▶│  FastAPI Backend │────▶│  UE5 Client     │
│  (Payment UI)   │     │ (Token Deduction)│     │ (Blur Control)  │
└─────────────────┘     └──────────────────┘     └─────────────────┘
         │                       │                         │
         │    1. User Pays       │                         │
         │   ──────────────────▶ │                         │
         │                       │ 2. Deduct Tokens        │
         │                       │    (70/30 Split)        │
         │                       │                         │
         │    3. Start Challenge │                         │
         │   ◀──────────────────│                         │
         │                       │                         │
         │    4. User Wins Game  │                         │
         │   ──────────────────▶ │                         │
         │                       │ 5. Trigger Reveal Event │
         │                       │ ──────────────────────▶ │
         │                       │                         │
         │                       │        6. Blur → Clear  │
         │                       │     (Post-Process Anim) │
```

---

## Part 1: Post-Process Blur Material

### Step 1: Create Blur Material

1. **In UE5 Content Browser:**
   - Create new Material: `M_JustForTheNight_Blur`
   - Set Material Domain to **Post Process**

2. **Material Graph Setup:**

```cpp
// HLSL Custom Node: Gaussian Blur
// Input: SceneTexture (Scene Color)
// Output: Blurred Scene Color

float4 GaussianBlur(float2 UV, float BlurStrength)
{
    float4 Color = float4(0,0,0,0);
    float TotalWeight = 0.0;
    
    // 5-tap Gaussian kernel (optimized)
    float Offsets[5] = {-2.0, -1.0, 0.0, 1.0, 2.0};
    float Weights[5] = {0.06, 0.24, 0.40, 0.24, 0.06};
    
    for (int i = 0; i < 5; i++)
    {
        for (int j = 0; j < 5; j++)
        {
            float2 Offset = float2(Offsets[i], Offsets[j]) * BlurStrength * 0.001;
            float Weight = Weights[i] * Weights[j];
            
            Color += SceneTextureLookup(UV + Offset, 14, false) * Weight;
            TotalWeight += Weight;
        }
    }
    
    return Color / TotalWeight;
}
```

3. **Add Scalar Parameter:**
   - Name: `BlurStrength`
   - Default Value: `20.0` (heavily blurred)
   - Range: `0.0 - 40.0`

4. **Material Output:**
   - Connect blur result to **Emissive Color**
   - Leave other outputs default

---

## Part 2: Blueprint Logic

### Create Blueprint: `BP_JustForTheNightController`

#### Variables
```cpp
// Blur Control
UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Blur")
UMaterialInstanceDynamic* BlurMaterialInstance;

UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Blur")
float CurrentBlurStrength = 20.0f;

UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Blur")
UCurveFloat* BlurRevealCurve;

// WebSocket Integration
UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Network")
FString BackendWebSocketURL = "wss://social-connect-953.preview.emergentagent.com/ws/reveal";

UPROPERTY()
UWebSocket* RevealSocket;
```

#### Event Graph

**Event BeginPlay:**
```cpp
void AJustForTheNightController::BeginPlay()
{
    Super::BeginPlay();
    
    // Create Dynamic Material Instance
    UMaterial* BlurMaterial = LoadObject<UMaterial>(nullptr, TEXT("/Game/Materials/M_JustForTheNight_Blur"));
    BlurMaterialInstance = UMaterialInstanceDynamic::Create(BlurMaterial, this);
    
    // Apply to Post Process Volume
    APostProcessVolume* PostProcessVolume = GetPostProcessVolume();
    if (PostProcessVolume)
    {
        PostProcessVolume->Settings.WeightedBlendables.Array.Add(
            FWeightedBlendable(1.0f, BlurMaterialInstance)
        );
    }
    
    // Set initial blur
    BlurMaterialInstance->SetScalarParameterValue(TEXT("BlurStrength"), CurrentBlurStrength);
    
    // Connect to WebSocket
    ConnectToRevealWebSocket();
}
```

**Connect to WebSocket:**
```cpp
void AJustForTheNightController::ConnectToRevealWebSocket()
{
    RevealSocket = NewObject<UWebSocket>(this);
    RevealSocket->OnConnected.AddDynamic(this, &AJustForTheNightController::OnWebSocketConnected);
    RevealSocket->OnMessage.AddDynamic(this, &AJustForTheNightController::OnRevealMessage);
    RevealSocket->Connect(BackendWebSocketURL);
}

void AJustForTheNightController::OnWebSocketConnected()
{
    UE_LOG(LogTemp, Log, TEXT("Connected to reveal WebSocket"));
}

void AJustForTheNightController::OnRevealMessage(const FString& Message)
{
    // Parse JSON: {"event": "reveal_identity", "room_id": "xxx", "won": true}
    TSharedPtr<FJsonObject> JsonObject;
    TSharedRef<TJsonReader<>> Reader = TJsonReaderFactory<>::Create(Message);
    
    if (FJsonSerializer::Deserialize(Reader, JsonObject))
    {
        FString Event = JsonObject->GetStringField(TEXT("event"));
        bool Won = JsonObject->GetBoolField(TEXT("won"));
        
        if (Event == TEXT("reveal_identity") && Won)
        {
            // Trigger blur reveal animation
            StartBlurReveal();
        }
    }
}
```

**Blur Reveal Animation (Timeline):**
```cpp
void AJustForTheNightController::StartBlurReveal()
{
    // Create Timeline
    FTimeline RevealTimeline;
    RevealTimeline.SetLooping(false);
    RevealTimeline.SetTimelineLength(1.5f); // 1.5 second transition
    
    // Bind update function
    FOnTimelineFloat TimelineUpdate;
    TimelineUpdate.BindDynamic(this, &AJustForTheNightController::UpdateBlurStrength);
    RevealTimeline.AddInterpFloat(BlurRevealCurve, TimelineUpdate);
    
    // Start timeline
    RevealTimeline.PlayFromStart();
}

void AJustForTheNightController::UpdateBlurStrength(float Alpha)
{
    // Alpha goes from 0.0 to 1.0
    // Interpolate blur from 20.0 to 0.0
    float NewBlurStrength = FMath::Lerp(20.0f, 0.0f, Alpha);
    
    if (BlurMaterialInstance)
    {
        BlurMaterialInstance->SetScalarParameterValue(TEXT("BlurStrength"), NewBlurStrength);
    }
    
    CurrentBlurStrength = NewBlurStrength;
}
```

---

## Part 3: Dealer Avatar Integration

### Founder AI Dealer Special Abilities

When the creator selects "Founder AI" as the dealer, activate VIP features:

```cpp
void AJustForTheNightController::SetDealerType(const FString& DealerType)
{
    if (DealerType == TEXT("founder_ai"))
    {
        // Enable VIP cosmetics
        EnableFounderCosmetics();
        
        // Enable bonus token airdrop on win
        bEnableBonusTokens = true;
        BonusTokenAmount = 50;
        
        // Apply gold card shader
        ApplyFounderCardMaterial();
    }
    else if (DealerType == TEXT("personal_avatar"))
    {
        // Load creator's custom MetaHuman
        LoadCreatorAvatar();
    }
    else // ghost_dealer
    {
        // Use standard invisible dealer
        SetDealerVisibility(false);
    }
}

void AJustForTheNightController::EnableFounderCosmetics()
{
    // Apply gold particle effects to dealer
    UParticleSystemComponent* GoldParticles = UGameplayStatics::SpawnEmitterAttached(
        GoldSparklesEffect,
        DealerMesh,
        TEXT("spine_03"),
        FVector::ZeroVector,
        FRotator::ZeroRotator,
        EAttachLocation::SnapToTarget
    );
    
    // Apply golden material to dealer outfit
    DealerMesh->SetMaterial(0, FounderGoldMaterial);
}

void AJustForTheNightController::ApplyFounderCardMaterial()
{
    // Apply holographic gold material to cards
    for (ACard* Card : ActiveCards)
    {
        Card->SetCardMaterial(FounderHolographicMaterial);
    }
}
```

---

## Part 4: Integration Checklist

### Backend Setup
- [x] `/api/just-for-the-night/rooms/join-transaction` endpoint
- [x] 70/30 revenue split implemented
- [x] Token deduction/addition working
- [ ] WebSocket `/ws/reveal/{room_id}` endpoint (needs implementation)

### Frontend Setup
- [x] React blur component with Framer Motion
- [x] Payment flow UI
- [x] Challenge game integration points
- [ ] WebSocket connection for real-time reveal

### UE5 Setup
- [ ] Post-Process blur material created
- [ ] Blueprint controller implemented
- [ ] WebSocket client configured
- [ ] Dealer avatar selection system
- [ ] Founder AI cosmetics

---

## Part 5: Testing Flow

### Local Testing (Without UE5)
```bash
# 1. Start backend
cd /app/backend
supervisorctl restart backend

# 2. Test room creation
curl -X POST https://social-connect-953.preview.emergentagent.com/api/just-for-the-night/rooms/create \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Test Room",
    "description": "Testing blur reveal",
    "stream_url": "https://example.com/video.mp4",
    "settings": {
      "dealer_type": "founder_ai",
      "challenge_game": "blackjack",
      "entry_tokens": 100,
      "challenge_difficulty": "medium",
      "room_theme": "neon_nights",
      "enable_watermark": true
    }
  }'

# 3. Test payment
curl -X POST https://social-connect-953.preview.emergentagent.com/api/just-for-the-night/rooms/join-transaction \
  -H "Content-Type: application/json" \
  -d '{"room_id": "room_xxx"}'

# 4. Test challenge completion
curl -X POST https://social-connect-953.preview.emergentagent.com/api/just-for-the-night/rooms/challenge-completed \
  -d 'transaction_id=txn_xxx&won=true'
```

### UE5 Testing
1. Launch UE5 project
2. Open `BP_JustForTheNightController` in scene
3. Play in Editor (PIE)
4. Verify initial blur (BlurStrength = 20.0)
5. Trigger reveal via console: `TriggerReveal`
6. Verify smooth transition to clear (BlurStrength = 0.0)

---

## Performance Optimization

### Blur Quality vs Performance
```cpp
// Low-end devices (mobile, low-spec PC)
BlurQuality = Low; // 3x3 kernel
BlurStrength_Max = 15.0;

// Mid-range
BlurQuality = Medium; // 5x5 kernel (default)
BlurStrength_Max = 20.0;

// High-end (RTX 3070+)
BlurQuality = High; // 7x7 kernel
BlurStrength_Max = 40.0;
```

### Dynamic Quality Adjustment
```cpp
void AJustForTheNightController::AdjustQualityBasedOnFPS()
{
    float CurrentFPS = 1.0f / GetWorld()->GetDeltaSeconds();
    
    if (CurrentFPS < 30.0f)
    {
        // Reduce blur quality
        BlurMaterialInstance->SetScalarParameterValue(TEXT("KernelSize"), 3.0f);
    }
    else if (CurrentFPS > 60.0f)
    {
        // Increase blur quality
        BlurMaterialInstance->SetScalarParameterValue(TEXT("KernelSize"), 7.0f);
    }
}
```

---

## Troubleshooting

### Issue: Blur Not Visible
**Solution:** Check Post Process Volume settings:
- Ensure "Infinite Extent (Unbound)" is enabled
- Blend Weight should be 1.0
- Priority higher than other post-process volumes

### Issue: Jerky Animation
**Solution:** Use curve for easing:
- Create Float Curve asset
- Set ease-out cubic curve (fast start, slow end)
- Apply to timeline

### Issue: WebSocket Connection Fails
**Solution:** 
- Check CORS settings in backend
- Verify WebSocket route is registered
- Use `wss://` not `ws://` for production

---

## Next Steps

1. **Implement WebSocket reveal endpoint** in backend
2. **Test E2E flow** with real payment
3. **Add analytics** tracking for reveal completion rate
4. **Optimize blur shader** for mobile devices
5. **Add alternative reveal animations** (fade, pixelate, etc.)

---

**Status:** Backend ✅ | Frontend ✅ | UE5 🔧 (Ready for integration)

**Last Updated:** December 11, 2025
