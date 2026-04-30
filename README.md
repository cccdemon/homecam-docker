# 🎥 Proxmox LXC WebRTC Webcam Streaming

A complete Docker-based WebRTC streaming solution for your Proxmox LXC container using MediaMTX.

**Supported Camera**: Logitech HD Pro Webcam C920 (or compatible USB cameras)

## 📋 Quick Start

### 1. Prerequisites
- Proxmox VE with LXC container (Debian 12 recommended)
- USB webcam connected to Proxmox host
- Docker & Docker Compose installed in container
- Network access to container

### 2. Configuration
```bash
# Copy the environment template
cp .env.example .env

# Edit .env if needed (usually works as-is for C920)
nano .env
```

### 3. Deploy
```bash
# Create directories
mkdir -p web logs recordings

# Start services
docker-compose up -d

# Check status
docker-compose ps
docker-compose logs -f mediamtx
```

### 4. Access Stream
Open your browser:
```
http://stream.raumdock.org
```

---

## 📁 Project Structure

```
webcam-stream/
├── docker-compose.yml      # Main Docker orchestration
├── mediamtx.yml            # MediaMTX server config
├── nginx.conf              # Web server configuration
├── .env                    # Environment variables (created from .env.example)
├── .env.example            # Template with all options
├── setup.sh                # Container setup script
├── claude.md               # Architecture documentation
├── web/
│   ├── index.html          # Web UI (responsive design)
│   └── stream.js           # WebRTC client (auto-reconnect)
├── logs/                   # MediaMTX logs (created at runtime)
└── recordings/             # HLS recordings (optional)
```

---

## 🔧 Configuration Guide

### Camera Settings (.env)
```bash
CAMERA_SOURCE=/dev/video0         # V4L2 device path
CAMERA_WIDTH=1920                 # Resolution width
CAMERA_HEIGHT=1080                # Resolution height
CAMERA_FPS=30                      # Frame rate
CAMERA_FORMAT=MJPEG                # Input format (MJPEG or YUYV)
```

### Port Mappings
| Port | Protocol | Purpose |
|------|----------|---------|
| 8555 | WebRTC   | Low-latency peer-to-peer streaming |
| 8888 | HTTP     | API & Dashboard |
| 1935 | RTMP     | RTMP ingest (if pushing streams) |
| 8322 | RTSP     | Internal protocol |
| 8889 | HLS      | HTTP Live Streaming fallback |
| 80   | HTTP     | Web UI (Nginx) |

### Resource Limits
Configured in docker-compose.yml and .env:
```bash
MEMORY_LIMIT=1024m   # Adjust for your LXC limits
CPUS_LIMIT=4         # CPU cores allocated
```

---

## 🚀 Deployment Steps on Proxmox

### Step 1: Create LXC Container
```bash
# SSH into Proxmox host
ssh root@proxmox.raumdock.org

# Create container
pct create 104 local:vztmpl/debian-12-standard_12.2-1_amd64.tar.zst \
  -hostname webcam-stream \
  -memory 512 \
  -cores 2 \
  -storage local-lvm \
  -net0 name=eth0,bridge=vmbr0,ip=dhcp

pct start 104
```

### Step 2: Install Docker
```bash
# Enter container
pct exec 104 bash

# Install Docker & Docker Compose
curl -fsSL https://get.docker.com | sh
apt-get install -y docker-compose

# Add user to docker group (optional)
usermod -aG docker root
```

### Step 3: USB Pass-Through
```bash
# From Proxmox host, find USB device
lsusb
# Output: Bus 001 Device 002: ID 046d:082d Logitech, Inc.

# Configure USB and V4L2 pass-through by editing the CT config
cp /etc/pve/lxc/104.conf /etc/pve/lxc/104.conf.bak
grep -qxF 'lxc.cgroup2.devices.allow: c 189:* rwm' /etc/pve/lxc/104.conf || echo 'lxc.cgroup2.devices.allow: c 189:* rwm' >> /etc/pve/lxc/104.conf
grep -qxF 'lxc.mount.entry: /dev/bus/usb/001/002 dev/bus/usb/001/002 none bind,optional,create=dir 0 0' /etc/pve/lxc/104.conf || echo 'lxc.mount.entry: /dev/bus/usb/001/002 dev/bus/usb/001/002 none bind,optional,create=dir 0 0' >> /etc/pve/lxc/104.conf
grep -qxF 'lxc.cgroup2.devices.allow: c 81:* rwm' /etc/pve/lxc/104.conf || echo 'lxc.cgroup2.devices.allow: c 81:* rwm' >> /etc/pve/lxc/104.conf
grep -qxF 'lxc.mount.entry: /dev/video0 dev/video0 none bind,optional,create=file 0 0' /etc/pve/lxc/104.conf || echo 'lxc.mount.entry: /dev/video0 dev/video0 none bind,optional,create=file 0 0' >> /etc/pve/lxc/104.conf

# Restart container
pct reboot 104
```

### Step 4: Verify Camera Access
```bash
# In container, verify camera
lsusb          # Should show C920
ls -la /dev/video*  # Should show video0+
v4l2-ctl --list-devices
```

### Step 5: Deploy Streaming Stack
```bash
# Copy project files to container or clone repo
# Then:
chmod +x setup.sh
./setup.sh

# Start services
docker-compose up -d

# Verify
docker-compose ps
```

---

## 📊 Monitoring & Troubleshooting

### Check Logs
```bash
# MediaMTX logs
docker-compose logs -f mediamtx

# Nginx logs
docker-compose logs -f web-ui

# All services
docker-compose logs -f
```

### Test Camera
```bash
# List supported formats
v4l2-ctl -d /dev/video0 --list-formats-ext

# Test capture
ffmpeg -f v4l2 -i /dev/video0 -t 5 test.mp4

# Check camera capabilities
v4l2-ctl -d /dev/video0 --all
```

### Common Issues

#### Camera Not Detected
```bash
# Verify USB device
lsusb | grep -i webcam

# Check permissions
ls -la /dev/video*

# Check mount in container
cat /proc/mounts | grep video
```

#### No Stream Visible
```bash
# Check MediaMTX status
docker-compose exec mediamtx curl -s http://localhost:8888/v3/paths/list

# Check web console
docker-compose logs mediamtx | grep -i error

# Test direct connection
ffmpeg -f v4l2 -i /dev/video0 -c:v copy -t 10 output.mp4
```

#### Port Conflicts
```bash
# Check port usage
netstat -tuln | grep 855[5]
netstat -tuln | grep 888[8-9]

# Update ports in .env and restart
docker-compose restart
```

---

## 🎬 Access Methods

### Web UI (Recommended)
```
http://stream.raumdock.org
- Interactive player with controls
- Connection status monitoring
- Screenshot capability
- Auto-reconnect
```

### Direct WebRTC
```
webrtc://stream.raumdock.org:8555/webcam
- Use with compatible players
- Lowest latency (<1s)
```

### HLS Fallback
```
http://stream.raumdock.org/hls/webcam/index.m3u8
- Standard HTTP Live Streaming
- Good for Safari/iOS
- 3-5 second latency
```

### RTMP Ingest
```
rtmp://stream.raumdock.org:1935/live
- Push external streams here
- Supports multiple encoders
```

---

## 🔒 Security Recommendations

### Immediate Actions
- [ ] Change Proxmox root password
- [ ] Configure firewall rules
- [ ] Enable basic auth in MediaMTX (if exposed)

### Network Setup
```bash
# Restrict port access (example with ufw)
sudo ufw allow 80/tcp
sudo ufw allow 22/tcp
sudo ufw allow 8555/tcp
sudo ufw allow 8555/udp
sudo ufw allow 8888/tcp
sudo ufw deny from any to any port 1935
```

### HTTPS/WSS (Optional)
For secure remote access:
1. Obtain SSL certificate (Let's Encrypt)
2. Set `TLS_ENABLED=true` in .env
3. Update mediamtx.yml with cert paths
4. Use `wss://` and `https://` URLs

---

## 📈 Performance Notes

| Metric | Value | Notes |
|--------|-------|-------|
| Codec | H.264 | Efficient, widely supported |
| Resolution | 1920×1080 | Full HD |
| Frame Rate | 30 fps | Smooth motion |
| Bitrate | 30000 kbps | ~30 Mbps cap with light denoise for LAN streaming |
| Latency | <1s (WebRTC) | Peer-to-peer advantage |
| Memory Usage | ~150-300MB | Depends on bitrate & connections |
| CPU Usage | Moderate | x264 medium preset uses CPU for cleaner 1080p |

---

## 🔄 Docker Commands Reference

```bash
# Start services
docker-compose up -d

# Stop services
docker-compose down

# View logs
docker-compose logs -f mediamtx

# Restart service
docker-compose restart mediamtx

# Execute command in container
docker-compose exec mediamtx ffmpeg -version

# Rebuild containers
docker-compose build --no-cache

# Remove containers and volumes
docker-compose down -v
```

---

## 🆘 Support & Resources

- **MediaMTX Docs**: https://github.com/bluenviron/mediamtx
- **WebRTC Info**: https://webrtc.org/
- **V4L2 Guide**: https://www.kernel.org/doc/html/latest/userspace-api/media/v4l/
- **Docker Docs**: https://docs.docker.com/

---

## 📝 License & Attribution

- **MediaMTX**: Open source, MPPL v2
- **Nginx**: Open source, BSD license
- **This setup**: Use freely, modify as needed

---

**Last Updated**: 2026-04-30  
**Status**: ✅ Production Ready
