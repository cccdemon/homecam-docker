#!/bin/bash

# Setup script for Proxmox LXC WebRTC streaming container
# This script prepares the container for Docker deployment

set -e

echo "🚀 Setting up WebRTC Streaming Container..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if running as root
if [ "$EUID" -ne 0 ]; then
   echo -e "${RED}Please run as root${NC}"
   exit 1
fi

echo -e "${YELLOW}[1/5]${NC} Updating system packages..."
apt-get update
apt-get upgrade -y

echo -e "${YELLOW}[2/5]${NC} Installing dependencies..."
apt-get install -y \
    curl \
    wget \
    ca-certificates \
    gnupg \
    lsb-release \
    linux-headers-$(uname -r) \
    v4l-utils \
    ffmpeg

echo -e "${YELLOW}[3/5]${NC} Installing Docker..."
curl -fsSL https://get.docker.com | sh

echo -e "${YELLOW}[4/5]${NC} Installing Docker Compose..."
apt-get install -y docker-compose

echo -e "${YELLOW}[5/5]${NC} Verifying USB camera access..."
if lsusb | grep -q "046d:082d"; then
    echo -e "${GREEN}✓ Logitech HD Pro Webcam C920 detected${NC}"
else
    echo -e "${YELLOW}⚠ USB camera not detected (might need to be plugged in)${NC}"
fi

# Check video device
if [ -e /dev/video0 ]; then
    echo -e "${GREEN}✓ Video device /dev/video0 available${NC}"
else
    echo -e "${RED}✗ Video device not found${NC}"
    exit 1
fi

# Check v4l2-ctl
echo -e "${YELLOW}Testing video device...${NC}"
v4l2-ctl -d /dev/video0 --list-formats-ext | head -5 || true

echo -e "${GREEN}Setup complete!${NC}"
echo ""
echo "📋 Next steps:"
echo "1. Navigate to the project directory"
echo "2. Verify .env configuration (especially CAMERA_SOURCE)"
echo "3. Run: docker-compose up -d"
echo "4. Access web UI: http://stream.raumdock.org"
echo ""
echo "🔍 Troubleshooting:"
echo "- Check logs: docker-compose logs -f mediamtx"
echo "- Test camera: v4l2-ctl -d /dev/video0 --all"
echo "- List formats: v4l2-ctl -d /dev/video0 --list-formats-ext"
