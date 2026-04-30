# 📦 Project Files Generated

## Overview
Complete Docker-based WebRTC streaming stack for Proxmox LXC using MediaMTX.

---

## 📂 File Structure

```
webcam-stream/
│
├── 📋 CONFIGURATION FILES
│   ├── .env                    - Environment variables (active config)
│   ├── .env.example            - Template with all options
│   ├── docker-compose.yml      - Docker orchestration
│   ├── mediamtx.yml            - MediaMTX server config
│   ├── nginx.conf              - Web server configuration
│   └── .gitignore              - Git exclusions
│
├── 🌐 WEB UI
│   ├── web/index.html          - Responsive web interface
│   └── web/stream.js           - WebRTC client logic
│
├── 📚 DOCUMENTATION
│   ├── claude.md               - Architecture & planning
│   ├── README.md               - Complete deployment guide
│   └── FILE_MANIFEST.md        - This file
│
├── 🔧 AUTOMATION & TOOLS
│   ├── setup.sh                - Container setup script
│   ├── Makefile                - Common commands
│   └── docker-compose.yml      - Complete stack definition
│
└── 📁 RUNTIME DIRECTORIES (created at runtime)
    ├── logs/                   - MediaMTX logs
    ├── recordings/             - HLS recordings (optional)
    └── web/                    - Web UI files
```

---

## 📄 File Descriptions

### Core Configuration

**docker-compose.yml**
- Orchestrates MediaMTX (streaming) and Nginx (web UI)
- Defines container networking, volumes, ports
- Health checks and resource limits
- Auto-restart policy

**mediamtx.yml**
- MediaMTX server configuration
- V4L2 USB camera source setup (Logitech C920)
- Streaming protocols: WebRTC, RTSP, HLS, RTMP
- FFmpeg integration for camera capture

**nginx.conf**
- Reverse proxy for MediaMTX API
- Static file serving for web UI
- HLS stream proxying
- Gzip compression enabled

**.env**
- Active environment variables
- Camera source: `/dev/video0`
- Port mappings (8555=WebRTC, 8888=API, 8889=HLS)
- Resource limits (512MB memory, 2 CPU cores)
- Codec & bitrate settings

**.env.example**
- Template with documented options
- Reference for all available configuration
- Safe to commit to version control

### Web Interface

**web/index.html**
- Responsive, modern web UI
- Real-time connection status
- Stream controls (connect, disconnect, fullscreen, screenshot)
- Live stream info display
- Stream URL reference

**web/stream.js**
- WebRTC client implementation
- Auto-reconnection logic
- Stats collection (resolution, FPS, bitrate)
- Error handling and user feedback
- Fallback mechanisms

### Documentation

**claude.md**
- Architecture overview
- LXC container creation guide
- USB camera pass-through setup
- MediaMTX benefits & features
- Performance specifications

**README.md**
- Step-by-step deployment guide
- Complete troubleshooting section
- Command reference
- Security recommendations
- Access methods documentation

**FILE_MANIFEST.md**
- File inventory (this document)
- Purpose & contents of each file
- Quick reference guide

### Automation

**setup.sh**
- One-time container initialization
- Installs Docker & Docker Compose
- Verifies USB camera
- Creates required directories
- Executable: `chmod +x setup.sh && ./setup.sh`

**Makefile**
- Convenient command shortcuts
- `make up` → Start services
- `make down` → Stop services
- `make logs` → View logs
- `make test-camera` → Verify camera
- `make info` → System information
- Run `make help` to see all options

**.gitignore**
- Excludes .env files (sensitive data)
- Ignores logs, recordings, temp files
- Excludes Docker artifacts
- Safe for version control

---

## 🚀 Quick Start Commands

```bash
# 1. Navigate to project directory
cd /path/to/webcam-stream

# 2. Setup (one-time)
chmod +x setup.sh
./setup.sh

# 3. Configure (if needed)
cp .env.example .env
# Edit .env with your settings

# 4. Deploy
make up

# 5. Access
# Open browser: http://stream.raumdock.org

# 6. Monitor
make logs

# 7. Stop
make down
```

---

## 📊 Configuration Summary

| Parameter | Value | File |
|-----------|-------|------|
| Camera | Logitech C920 (/dev/video0) | mediamtx.yml, .env |
| Resolution | 1280×720 | mediamtx.yml, .env |
| Framerate | 30 fps | mediamtx.yml, .env |
| Codec | H.264 MJPEG input | mediamtx.yml |
| WebRTC Port | 8555 | .env, docker-compose.yml |
| API Port | 8888 | .env, docker-compose.yml |
| Web Port | 80 | docker-compose.yml |
| HLS Port | 8889 | .env, docker-compose.yml |
| Memory Limit | 512MB | .env, docker-compose.yml |
| CPU Limit | 2 cores | .env, docker-compose.yml |

---

## 🔄 Deployment Workflow

```
1. Create LXC Container (Proxmox)
   ↓
2. Install Docker (in container)
   ↓
3. Configure USB Pass-Through (Proxmox)
   ↓
4. Clone/Copy Project Files
   ↓
5. Review .env Configuration
   ↓
6. Run Setup Script (setup.sh)
   ↓
7. Start Services (make up)
   ↓
8. Access Web UI
   ↓
9. Verify Stream
```

---

## 📋 Pre-Deployment Checklist

- [ ] LXC container created with at least 512MB memory
- [ ] Docker installed in container
- [ ] USB camera connected to Proxmox host
- [ ] Camera identified: `lsusb | grep -i webcam`
- [ ] Camera passed through to container: `/dev/video0`
- [ ] Network connectivity verified
- [ ] Port 8555, 8888, 8889 available
- [ ] .env file configured
- [ ] Directory structure created (logs/, recordings/)

---

## 🔐 Security Checklist

- [ ] Proxmox root credentials rotated
- [ ] Docker credentials secured
- [ ] .env not committed to public repos
- [ ] Firewall rules configured
- [ ] Consider enabling TLS for remote access
- [ ] Basic auth enabled if exposed externally

---

## 🆘 Troubleshooting Quick Links

| Issue | File/Section | Command |
|-------|-------------|---------|
| Camera not detected | README.md § Troubleshooting | `make test-camera` |
| No stream visible | README.md § Common Issues | `make logs-mediamtx` |
| Port conflicts | README.md § Port Conflicts | `netstat -tuln` |
| WebRTC not working | web/stream.js, README | Browser console |
| Service won't start | docker-compose.yml | `docker-compose logs` |

---

## 📞 Support Resources

- MediaMTX: https://github.com/bluenviron/mediamtx
- WebRTC: https://webrtc.org/
- Docker: https://docs.docker.com/
- V4L2: https://www.kernel.org/doc/html/latest/

---

**Generated**: 2026-04-30
**Status**: ✅ Ready for Deployment
**Camera**: Logitech HD Pro Webcam C920
**Container**: Proxmox LXC (Debian 12)
