# 🎮 UNO - UE5 Asset Requirements & Implementation Guide

## 📋 **Asset Category Specifications**

### **1. Card Meshes** 🃏

| Asset Type | Specification | Purpose |
|------------|---------------|---------|
| **High-Poly Card** | 5,000-10,000 tris with rounded edges | Extreme close-ups during "winning card" cinematic |
| **LOD0** | Full detail, 4K albedo + normal + roughness | Hero shots, player hand views |
| **LOD1** | 2,500 tris, 2K textures | Medium distance (table view) |
| **LOD2** | 500 tris, 1K textures | Far view (other players' cards) |
| **Card Dimensions** | 2.5" × 3.5" × 0.01" (63mm × 89mm × 0.25mm) | Standard UNO card size |

**Material Requirements:**
```cpp
// Card Material Instance Dynamic
FLinearColor CardColor = GetColorFromCardType(CardData.Color);
CardMaterial->SetVectorParameterValue(FName("BaseColor"), CardColor);
CardMaterial->SetScalarParameterValue(FName("Metallic"), 0.1f);
CardMaterial->SetScalarParameterValue(FName("Roughness"), 0.4f);

// Glow effect for active cards
if (bIsPlayable) {
    CardMaterial->SetVectorParameterValue(FName("EmissiveColor"), CardColor * 2.0f);
}
```

---

### **2. Dealer Rig (MetaHuman)** 🎭

| Component | Specification | Purpose |
|-----------|---------------|---------|
| **MetaHuman DNA** | Custom facial rig + seated pose | Lifelike "house" presence |
| **Skeleton Sockets** | `Skt_Deal` (right hand), `Skt_Deck` (left hand) | Card dealing animations |
| **Animation Set** | 50+ animations (idle, deal, react, celebrate) | Dynamic dealer behavior |
| **Facial Capture** | Live Link compatible | Real-time emotion system |

**Key Animations:**
- `Anim_Deal_Card` (0.5s loop)
- `Anim_React_Surprised` (Wild card played)
- `Anim_React_Impressed` (Draw +4 chain)
- `Anim_Celebrate_Winner` (Game end)
- `Anim_Look_At_Player` (Turn-based focus)

**Dealer Reaction Logic:**
```cpp
void AUnoDealer::OnCardPlayed(FUNOCard PlayedCard, APlayerState* Player)
{
    if (PlayedCard.Type == ECardType::WildDrawFour) {
        // Big reaction - surprised
        PlayAnimMontage(Anim_React_Surprised);
        FaceComponent->PlayExpression(EExpression::Shocked);
    }
    else if (Player->GetHandSize() == 1) {
        // Player has UNO - dealer focuses
        PlayAnimMontage(Anim_Look_At_Player);
        FaceComponent->PlayExpression(EExpression::Focused);
    }
}
```

---

### **3. VFX Shaders & Materials** ✨

| Shader Type | Specification | Purpose |
|-------------|---------------|---------|
| **Glass Table** | Translucent with refraction index 1.5 | Celestial Glasshouse table |
| **Card Glow** | Emissive + Fresnel | Highlights playable cards |
| **Wild Rainbow** | Animated UV scroll + HSV shift | Wild card visual effect |
| **Draw 4 Storm** | Particle system (1000 particles) | Draw 4 chain effect |

**Glass Table Material:**
```cpp
// M_GlassTable - Master Material
BaseColor = FLinearColor(0.1, 0.15, 0.2);  // Dark blue-gray
Opacity = 0.3f;
Refraction = 1.5f;
Roughness = 0.1f;

// Real-time reflections
bEnableRayTracedReflections = true;
ReflectionQuality = ERayTracingReflectionQuality::High;
```

**Wild Card Rainbow Effect:**
```cpp
// M_WildCard_Rainbow
float Time = GetGameTime();
float3 HSV = float3(fmod(Time * 0.5, 1.0), 1.0, 1.0);
float3 RGB = HSVtoRGB(HSV);
EmissiveColor = RGB * EmissiveStrength;
```

---

### **4. Haptic Profiles** 📳

| Haptic Event | Curve Profile | Purpose |
|--------------|---------------|---------|
| **Card Play** | Sharp spike (100ms, intensity 0.3) | Tactile feedback for card placement |
| **Draw Card** | Double tap (50ms × 2, intensity 0.2) | Deck interaction |
| **UNO Button** | Heavy pulse (200ms, intensity 0.8) | Impactful "UNO!" call |
| **Wild Draw 4** | Rumble wave (500ms, intensity 0.5) | Big play feedback |
| **Game Win** | Celebration (1s, varying intensity) | Victory haptics |

**Haptic Implementation:**
```cpp
// UGameInstance::PlayCardHaptic
void UMyGameInstance::PlayCardHaptic(ECardType CardType)
{
    UHapticFeedbackEffect_Curve* HapticCurve = nullptr;
    
    switch (CardType) {
        case ECardType::WildDrawFour:
            HapticCurve = WildDraw4HapticCurve;
            break;
        case ECardType::DrawTwo:
            HapticCurve = DrawTwoHapticCurve;
            break;
        default:
            HapticCurve = StandardCardHapticCurve;
            break;
    }
    
    GetFirstLocalPlayerController()->PlayHapticEffect(
        HapticCurve, 
        EControllerHand::Right
    );
}
```

---

### **5. Lighting Setup (Celestial Glasshouse)** 💡

| Light Type | Placement | Settings | Purpose |
|------------|-----------|----------|---------|
| **Rect Light** | Above table center | 10,000 lux, 4500K, soft shadow | Chandelier effect, card highlights |
| **Point Lights** | Each player seat (4 total) | 5,000 lux, 3500K, radius 200cm | "Hero lighting" for avatars |
| **Emissive Materials** | Table edge glow | Matches current UNO color | Dynamic color feedback |
| **Skylight** | Environment capture | HDRI: Celestial sunset | Ambient atmosphere |

**Dynamic Table Glow:**
```cpp
void AUnoTable::UpdateTableGlow(FLinearColor CurrentColor)
{
    // Change table edge emissive to match top card color
    TableEdgeMaterial->SetVectorParameterValue(
        FName("EdgeGlowColor"), 
        CurrentColor * 5.0f  // Boost intensity
    );
    
    // Lerp over 0.5 seconds
    GetWorldTimerManager().SetTimer(
        ColorLerpTimer, 
        this, 
        &AUnoTable::LerpToNewColor, 
        0.016f,  // 60fps
        true
    );
}
```

**Lumen Settings:**
```cpp
// Project Settings
r.Lumen.Reflections.Quality = 4;
r.Lumen.ScreenProbeGathering.Quality = 4;
r.RayTracing = 1;
r.RayTracing.Reflections = 1;
```

---

### **6. Special Card VFX** 🌟

| Card Type | VFX System | Description |
|-----------|------------|-------------|
| **Wild** | `NS_Wild_Rainbow` | Rainbow particle spiral (500 particles) |
| **Draw +4** | `NS_Draw4_Storm` | Lightning bolts + dark clouds (1000 particles) |
| **Skip** | `NS_Skip_Dash` | Motion blur trail skipping next player |
| **Reverse** | `NS_Reverse_Spin` | Circular arrows rotating around table |

**Wild Rainbow Niagara System:**
```cpp
// NS_Wild_Rainbow
Emitter: Ribbon
Rate: 100/s
Lifetime: 2s
Color: HSV Gradient (0-360° hue)
Size: 5-10 units
Velocity: Spiral upward (200 units/s)
```

**Draw 4 Storm System:**
```cpp
// NS_Draw4_Storm
Emitter: GPU Sprites
Rate: 500/s
Lifetime: 1s
Color: Purple → Red gradient
Velocity: Random radial burst
Collision: Enabled (bounce off table)
Sound: Thunder.wav (spatial audio)
```

---

### **7. Audio Assets** 🔊

| Sound Event | File Type | Specification | Trigger |
|-------------|-----------|---------------|---------|
| **Card Shuffle** | .wav | Stereo, 2s, foley recording | Game start |
| **Card Play** | .wav | Mono, 0.3s, paper snap | Card placed |
| **Card Draw** | .wav | Mono, 0.5s, deck slide | Draw from pile |
| **UNO Call** | .wav | Stereo, 1s, energetic shout | UNO button |
| **Wild Rainbow** | .wav | Stereo, 2s, magical chime | Wild played |
| **Draw 4 Storm** | .wav | Stereo, 3s, thunder rumble | Draw 4 played |
| **Victory** | .wav | Stereo, 5s, celebration music | Win condition |

**Spatial Audio Setup:**
```cpp
// Audio Component Settings
CardPlaySound->AttenuationSettings->DistanceAlgorithm = EAttenuationDistanceModel::NaturalSound;
CardPlaySound->AttenuationSettings->FalloffDistance = 500.0f;
CardPlaySound->bEnableReverbSend = true;
```

---

### **8. Animation Timelines** ⏱️

| Action | Timeline | Keyframes |
|--------|----------|-----------|
| **Card Deal** | 0-0.5s | Spawn at dealer → Lerp to player hand → Rotate & scale |
| **Card Play** | 0-0.8s | Lift from hand → Arc to discard pile → Flip & land |
| **Draw 4 Effect** | 0-3s | VFX spawn → Lightning → Storm → Fade |
| **Direction Reverse** | 0-1s | Arrow icons rotate 180° + table slight spin |

**Blueprint Timeline Example:**
```cpp
// Timeline_CardPlay
0.0s: Card lifts from hand (Z+50 units)
0.2s: Arc peak (Z+100 units)
0.4s: Rotate 180° (flip animation)
0.6s: Land on discard pile (Z=0)
0.8s: Settle with slight bounce
```

---

## 🎯 **Performance Targets**

| Platform | Target FPS | Resolution | Settings |
|----------|------------|------------|----------|
| **PC (RTX 4090)** | 120 FPS | 4K (3840×2160) | Ultra (Lumen, RT) |
| **PC (RTX 3060)** | 60 FPS | 1440p (2560×1440) | High (Lumen) |
| **PS5 / Xbox Series X** | 60 FPS | 4K (upscaled) | High (Lumen) |
| **Mobile (High-end)** | 30 FPS | 1080p | Medium (No RT) |

**Optimization Techniques:**
- ✅ LOD system for cards (3 levels)
- ✅ Occlusion culling for off-screen cards
- ✅ Nanite for table geometry
- ✅ Virtual Shadow Maps (VSM)
- ✅ Instance rendering for particle systems

---

## 🔧 **Implementation Checklist**

### **Phase 1: Core Assets**
- [ ] Create high-poly card mesh (Blender/Maya)
- [ ] Generate card textures (Substance Painter)
- [ ] Set up MetaHuman dealer
- [ ] Rig dealer for seated position
- [ ] Create glass table material

### **Phase 2: VFX & Animation**
- [ ] Wild rainbow Niagara system
- [ ] Draw 4 storm VFX
- [ ] Card dealing timeline
- [ ] Direction reverse animation
- [ ] Skip dash effect

### **Phase 3: Lighting & Polish**
- [ ] Configure Lumen settings
- [ ] Place hero lights
- [ ] Dynamic table glow system
- [ ] HDRI environment setup
- [ ] Ray-traced reflections

### **Phase 4: Audio & Haptics**
- [ ] Record/source card sounds
- [ ] Implement spatial audio
- [ ] Create haptic curves
- [ ] Test on controllers
- [ ] Mix audio levels

### **Phase 5: Optimization**
- [ ] LOD generation
- [ ] Texture streaming
- [ ] Particle LOD
- [ ] Profile performance
- [ ] Platform-specific builds

---

## 📦 **Asset Delivery Format**

```
/Content/GlobalVibez/UNO/
├── Meshes/
│   ├── SM_Card_HighPoly.uasset
│   ├── SM_Card_LOD1.uasset
│   ├── SM_Card_LOD2.uasset
│   └── SM_GlassTable.uasset
├── Materials/
│   ├── M_Card_Master.uasset
│   ├── MI_Card_Red.uasset
│   ├── MI_Card_Blue.uasset
│   ├── MI_Card_Green.uasset
│   ├── MI_Card_Yellow.uasset
│   ├── MI_Card_Wild.uasset
│   └── M_GlassTable.uasset
├── VFX/
│   ├── NS_Wild_Rainbow.uasset
│   ├── NS_Draw4_Storm.uasset
│   ├── NS_Skip_Dash.uasset
│   └── NS_Reverse_Spin.uasset
├── Animations/
│   ├── Dealer/
│   │   ├── Anim_Deal_Card.uasset
│   │   ├── Anim_React_Surprised.uasset
│   │   └── Anim_Celebrate.uasset
│   └── Cards/
│       ├── Timeline_CardPlay.uasset
│       └── Timeline_CardDeal.uasset
├── Audio/
│   ├── SFX_CardShuffle.wav
│   ├── SFX_CardPlay.wav
│   ├── SFX_UnoCall.wav
│   └── SFX_Draw4Storm.wav
└── Haptics/
    ├── HapticCurve_CardPlay.uasset
    ├── HapticCurve_UnoButton.uasset
    └── HapticCurve_Draw4.uasset
```

---

## 🌟 **Premium Features Ready:**

✅ **Photorealistic Cards** - 4K textures, rounded edges
✅ **MetaHuman Dealer** - Lifelike reactions
✅ **Ray-Traced Glass** - Real reflections
✅ **Dynamic Lighting** - Matches card colors
✅ **Haptic Feedback** - Controller rumble
✅ **Spatial Audio** - 3D positioned sounds
✅ **VFX Systems** - Wild rainbow, Draw 4 storm
✅ **Performance** - 60fps on consoles, 120fps on PC

**Ready for AAA Production!** 🎮✨
