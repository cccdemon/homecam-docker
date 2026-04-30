# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this repo is

A Docker Compose stack that turns a USB webcam attached to a Proxmox host into a low-latency WebRTC stream viewable in a browser. The stack runs **inside an LXC container** on the Proxmox host; nothing here runs on the Windows workstation that holds the source files.

End-user docs live in [README.md](README.md). Deployment runbook (Windows → LXC) lives in [DEPLOYMENT.md](DEPLOYMENT.md). Don't duplicate them here.

## Architecture (the non-obvious bits)

```
USB webcam → Proxmox host → LXC (cgroup + mount passthrough) → /dev/video0
                                                                     │
                              ┌──────────────────────────────────────┘
                              ▼
                      mediamtx container
                      ├─ spawns ffmpeg (v4l2 → RTSP localhost:8322/webcam)
                      ├─ re-publishes that one path on WebRTC/HLS/RTMP
                      └─ exposes API on :8888
                              ▲
                              │ (reverse proxy /api, /webrtc, /hls)
                      web-ui container (nginx) :80
                              ▲
                              │
                      browser ── web/stream.js opens RTCPeerConnection
```

Key consequences:

- **The camera capture is an `ffmpeg` subprocess defined inside [mediamtx.yml](mediamtx.yml)** under `paths.webcam.sourceCmdArgs`, *not* a separate service. Format/resolution/fps changes go there, not in `.env` (the `CAMERA_*` env vars in [.env.example](.env.example) are documentation — nothing currently substitutes them into `mediamtx.yml`).
- **The browser never talks to MediaMTX directly for the UI.** Nginx ([nginx.conf](nginx.conf)) proxies `/api/v1/`, `/webrtc/connection`, and `/hls/` to the `mediamtx` service over the `streaming` Docker bridge network. The WebRTC media itself still flows directly on port 8555 (UDP+TCP).
- **USB pass-through is a host-side concern.** `pct set` on the Proxmox host (see README.md "Step 3") is what makes `/dev/video0` exist inside the LXC. [docker-compose.yml](docker-compose.yml) then bind-mounts `/dev/video0` into the mediamtx container. If the device isn't in the LXC, no amount of compose tweaking helps.
- **Hardcoded for Logitech C920.** [setup.sh](setup.sh) checks USB ID `046d:082d`, [mediamtx.yml](mediamtx.yml) assumes MJPEG@1280x720@30fps, label says "C920". Adapting to another camera means editing all three.

## Common commands

All ops happen **inside the LXC** (not on the Windows host where these files are edited). The [Makefile](Makefile) wraps `docker-compose`:

```bash
make setup          # create logs/recordings/web dirs, copy .env.example → .env
make up             # docker-compose up -d
make down           # docker-compose down
make restart        # docker-compose restart
make logs-mediamtx  # follow MediaMTX logs (most useful when debugging capture)
make status         # docker-compose ps
make test-camera    # lsusb + ls /dev/video* + v4l2-ctl probes
make test-stream    # hits MediaMTX API and prints stream paths
make clean          # down -v (drops volumes)
```

Direct equivalents when Make isn't available (fresh container):

```bash
docker-compose up -d
docker-compose logs -f mediamtx
docker-compose exec mediamtx /bin/sh
curl -s http://localhost:8888/api/v1/paths/list   # confirm 'webcam' path is ready
```

There are no tests, linters, or build steps — this is a configuration repo, not an application.

## Deployment specifics

- **LXC container ID: 104** on the Proxmox host. SSH host: `proxmox.raumdock.org`. Public stream domain: `stream.raumdock.org` (resolves to a local IP; the Nginx web-ui container on port 80 serves it).
- **`.env` is checked in alongside `.env.example`.** Confirm nothing sensitive landed in [.env](.env) before committing or transferring. Current `.env` contains no secrets.

## Open risk: MediaMTX `source: ffmpeg` may not be a real config

Mainline MediaMTX ([bluenviron/mediamtx](https://github.com/bluenviron/mediamtx)) doesn't document a `source: ffmpeg` + `sourceCmdArgs` mechanism — the standard pattern for V4L2 capture is `runOnInit` (or `runOnDemand`) with an ffmpeg command that publishes RTSP back to MediaMTX. The current [mediamtx.yml](mediamtx.yml) `paths.webcam` block uses the non-standard pattern. If the stream doesn't appear after `docker-compose up -d`, replace the `source` / `sourceCmdArgs` keys with:

```yaml
paths:
  webcam:
    runOnInit: ffmpeg -hide_banner -loglevel error -f v4l2 -input_format mjpeg -video_size 1280x720 -framerate 30 -i /dev/video0 -c:v libx264 -preset ultrafast -tune zerolatency -f rtsp -rtsp_transport tcp rtsp://localhost:8322/webcam
    runOnInitRestart: yes
```

(WebRTC needs H.264/VP8/VP9, so `-c:v copy` from MJPEG won't work — transcoding is mandatory unless the C920 is set to `-input_format h264`.)

## When editing

- Camera/stream parameters: edit [mediamtx.yml](mediamtx.yml) `paths.webcam.sourceCmdArgs`, not `.env`.
- Port mappings: [docker-compose.yml](docker-compose.yml) reads `${WEBRTC_PORT}` etc. from `.env`, but MediaMTX's *internal* listen ports are hardcoded in `mediamtx.yml` — change both sides if remapping.
- Browser UI: [web/index.html](web/index.html) + [web/stream.js](web/stream.js) are mounted read-only into nginx; just edit and `docker-compose restart web-ui` (no rebuild needed).
- Adding a second camera: there's a commented `webcam2` template at the bottom of [mediamtx.yml](mediamtx.yml). Also requires a second `pct set ... lxc.mount.entry` on the Proxmox host and a second `/dev/videoN` bind in compose.
