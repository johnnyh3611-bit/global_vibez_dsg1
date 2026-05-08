# AI Dealer Video Assets

This folder contains video loops for the Nova AI Dealer animations.

## Required Videos

You need 4 video files for full AI Dealer functionality:

### 1. **dealer-idle.mp4**
- **Description**: Dealer standing/waiting at table
- **Duration**: 5-10 seconds (looping)
- **Suggested Sources**:
  - Pexels: https://www.pexels.com/video/casino-dealer-8576832/
  - Mixkit: https://mixkit.co/free-stock-video/dealer-shuffling-cards-22868/
  - Coverr: https://coverr.co/videos/casino

### 2. **dealer-shuffle.mp4**
- **Description**: Dealer shuffling a deck of cards
- **Duration**: 5-10 seconds
- **Suggested Sources**:
  - Pexels: https://www.pexels.com/video/close-up-of-casino-dealer-shuffling-playing-cards-7459201/
  - Mixkit: https://mixkit.co/free-stock-video/shuffling-cards-11781/

### 3. **dealer-dealing.mp4**
- **Description**: Dealer dealing cards to players
- **Duration**: 5-10 seconds
- **Suggested Sources**:
  - Pexels: https://www.pexels.com/video/poker-dealer-shuffling-cards-8921475/
  - Mixkit: https://mixkit.co/free-stock-video/croupier-dealing-cards-100391/

### 4. **dealer-celebrating.mp4**
- **Description**: Dealer celebrating/excited animation
- **Duration**: 3-5 seconds
- **Suggested Sources**:
  - Use any happy/celebratory dealer video
  - Can duplicate dealer-idle.mp4 as a fallback

## How to Download & Add Videos

### Method 1: Manual Download (Recommended)
1. Visit one of the suggested video sources above
2. Download the video in **720p or 1080p MP4 format**
3. Rename the file to match the required names (dealer-idle.mp4, etc.)
4. Place the files in this `/public/videos/` folder
5. Restart the frontend: `sudo supervisorctl restart frontend`

### Method 2: Using AI Video Generation (Advanced)
You can generate custom AI dealer videos using:
- **Runway Gen-2**: https://runwayml.com/
- **Pika Labs**: https://pika.art/
- **Stable Video Diffusion**: https://stability.ai/

Prompt example:
```
Professional casino dealer in suit, shuffling playing cards at green felt table, 
smooth cinematic lighting, realistic human motion, close-up shot, looping animation
```

## Video Requirements
- **Format**: MP4 (H.264 codec)
- **Resolution**: 720p (1280x720) or 1080p (1920x1080)
- **File Size**: Keep under 5MB each for fast loading
- **Duration**: 5-10 seconds (will loop automatically)
- **Orientation**: Landscape (16:9 ratio)

## Current Status
❌ Videos not yet added (component will show fallback)

Once you add the videos, the AI Dealer will display realistic human animations for:
- ✨ Idle state (waiting for bets)
- 🎴 Shuffling cards
- 🃏 Dealing cards
- 🎉 Celebrating wins
