#!/bin/bash
# Create placeholder video using ffmpeg (if available)
# This creates a simple animated placeholder

if command -v ffmpeg &> /dev/null; then
    # Create a 5-second placeholder with animated gradient
    ffmpeg -f lavfi -i color=c=purple:s=1280x720:d=5 -vf "drawtext=text='AI Dealer Video Placeholder':fontsize=48:fontcolor=white:x=(w-text_w)/2:y=(h-text_h)/2" -pix_fmt yuv420p -y dealer-idle.mp4
    cp dealer-idle.mp4 dealer-shuffle.mp4
    cp dealer-idle.mp4 dealer-dealing.mp4
    cp dealer-idle.mp4 dealer-celebrating.mp4
    echo "Placeholder videos created!"
else
    echo "ffmpeg not available - videos need to be added manually"
fi
