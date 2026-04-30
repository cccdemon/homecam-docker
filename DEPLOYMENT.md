# 🚀 DEPLOYMENT GUIDE - Windows to Proxmox LXC

## Architecture
```
Your Windows PC (files here)
         ↓
   SCP/Git Transfer
         ↓
Proxmox LXC Container (files deployed here)
         ↓
   Docker Services Start
         ↓
WebRTC Stream Active ✅
```

---

## 📋 Pre-Deployment Checklist

- [ ] LXC container created (ID 104)
- [ ] Container is running
- [ ] SSH access verified: `ssh root@proxmox.raumdock.org`
- [ ] USB camera connected to Proxmox host
- [ ] Camera detected: `lsusb | grep -i webcam` (on host)
- [ ] Camera available in container: `/dev/video0`
- [ ] Network connectivity verified from container

---

## 🔄 Deployment Steps

### Option 1: SCP Transfer (Recommended for Small Teams)

**Step 1: Transfer files to container**
```powershell
# From your Windows machine (PowerShell):
$containerIP = "proxmox.raumdock.org"
$projectPath = "c:\Users\streamer\Documents\Server-tech"

# Copy entire project to container
scp -r "$projectPath\*" root@${containerIP}:/root/webcam-stream/
```

**Step 2: SSH into container and setup**
```bash
# SSH into Proxmox host
ssh root@proxmox.raumdock.org

# Enter container (ID 104)
pct exec 104 bash

# Navigate to project
cd /root/webcam-stream

# Run setup
chmod +x setup.sh
./setup.sh

# Start services
docker-compose up -d

# Verify
docker-compose ps
```

**Step 3: Verify deployment**
```bash
# Check logs
docker-compose logs -f mediamtx

# Test API
curl http://localhost:8888/v3/config/global/get

# Access web UI
# Open browser: http://stream.raumdock.org
```

---

### Option 2: Git Clone (Best for Production)

**Step 1: Initialize git repo (optional, skip if not using git)**
```bash
cd /root/Server-tech
git init
git add .
git commit -m "Initial WebRTC streaming setup"
```

**Step 2: Clone on container**
```bash
# On Proxmox host
ssh root@proxmox.raumdock.org
pct exec 104 bash

# Clone repo or use SCP
mkdir -p /root/webcam-stream
cd /root/webcam-stream
# ... copy files here ...
```

---

### Option 3: Docker Compose Directly (If files already in place)

```bash
# In container, from project directory
docker-compose build
docker-compose up -d
```

---

## ✅ Verification Steps

### 1. Check Container Status
```bash
docker-compose ps
```
Expected output:
```
NAME                COMMAND                  SERVICE      STATUS
mediamtx-webcam     "/home/mediamtx/medi…"   mediamtx    Up X seconds (healthy)
webcam-webui        "nginx -g daemon off…"   web-ui       Up X seconds (healthy)
```

### 2. Verify Services
```bash
# Check MediaMTX API
curl -s http://localhost:8888/v3/config/global/get | head -20

# Check available streams
curl -s http://localhost:8888/v3/paths/list

# Check web server
curl -s http://localhost/health
```

### 3. Test Camera Access
```bash
# Verify camera device exists
ls -la /dev/video*

# Verify the LXC cgroup allows V4L2 devices; /dev/video* is usually char major 81.
stat -c '%t:%T %n' /dev/video*

# Test v4l2
v4l2-ctl -d /dev/video0 --all | head -10

# If Docker logs show "Permission denied", add this on the Proxmox host and reboot CT 104:
# pct set 104 -lxc2 "lxc.cgroup2.devices.allow = c 81:* rwm"
# pct set 104 -lxc3 "lxc.mount.entry = /dev/video0 dev/video0 none bind,optional,create=file 0 0"

# Check in MediaMTX logs
docker-compose logs mediamtx | grep -i "webcam\|camera\|v4l2"
```

### 4. Access Web UI
Open your browser and navigate to:
```
http://stream.raumdock.org
```

Click **▶ Connect** to start streaming.

---

## 🔧 Troubleshooting Deployment

### Issue: Container can't see camera
```bash
# Verify USB pass-through on Proxmox host
lsusb | grep -i webcam

# Check container config
cat /proc/mounts | grep video

# Ensure device permissions
ls -la /dev/video*
```

### Issue: Docker not installed
```bash
# In container:
curl -fsSL https://get.docker.com | sh
apt-get install -y docker-compose
```

### Issue: Ports already in use
```bash
# Find what's using the ports
netstat -tuln | grep -E "855[5]|888[8-9]"

# Update .env with different ports and restart
docker-compose restart
```

### Issue: Services failing to start
```bash
# Check logs for errors
docker-compose logs mediamtx
docker-compose logs web-ui

# Verify file permissions
chmod +x setup.sh
chmod 644 *.yml *.conf

# Rebuild containers
docker-compose build --no-cache
docker-compose up -d
```

---

## 📊 Deployment Checklist

After deployment, verify these items:

- [ ] All containers running (`docker-compose ps` shows green)
- [ ] Web UI accessible (`http://stream.raumdock.org`)
- [ ] MediaMTX API responding (`curl http://localhost:8888/v3/config/global/get`)
- [ ] Camera detected by MediaMTX logs
- [ ] Webcam stream visible in browser
- [ ] Can connect/disconnect without errors
- [ ] Screenshot button works
- [ ] Stream info displays correctly
- [ ] Video plays for >30 seconds without stuttering
- [ ] Auto-reconnect works if connection drops

---

## 📞 Support Commands

```bash
# View all logs
docker-compose logs -f

# View MediaMTX only
docker-compose logs -f mediamtx

# View web server only
docker-compose logs -f web-ui

# Show container resource usage
docker stats

# Access MediaMTX container shell
docker-compose exec mediamtx /bin/sh

# Stop services gracefully
docker-compose down

# Remove everything (reset)
docker-compose down -v
docker system prune -f
```

---

## 🔐 Post-Deployment Security

1. **Change root password** (immediately after deployment)
   ```bash
   passwd
   ```

2. **Configure firewall** (on Proxmox host)
   ```bash
   ufw allow 80/tcp
   ufw allow 22/tcp
   ufw deny 1935/tcp  # RTMP access restricted
   ```

3. **Enable MediaMTX authentication** (optional)
   - Edit `mediamtx.yml`
   - Uncomment `authentication` section
   - Restart: `docker-compose restart`

4. **Setup HTTPS** (for remote access)
   - Obtain SSL certificate
   - Update `nginx.conf` with TLS settings
   - Restart Nginx: `docker-compose restart web-ui`

---

## 📈 Performance Tuning (Optional)

Adjust in `.env` for your network:

```bash
# Higher quality (more bandwidth)
CAMERA_FPS=60
VIDEO_BITRATE=5000

# Lower quality (less bandwidth)
CAMERA_FPS=15
VIDEO_BITRATE=1000

# Restart to apply
docker-compose restart mediamtx
```

---

## ✨ Success Indicators

✅ **Deployment is successful when:**
- Web UI loads at `http://stream.raumdock.org`
- "Connect" button works and establishes connection
- Live video appears in the player
- Connection status shows "Connected"
- Stream info displays resolution, FPS, codec
- Service is accessible for >5 minutes without crashes

---

**Status**: Ready for Deployment  
**Date**: 2026-04-30  
**Target**: Proxmox LXC Container (Debian 12)  
**Camera**: Logitech HD Pro Webcam C920
