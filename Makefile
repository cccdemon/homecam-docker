.PHONY: help setup build up down logs logs-mediamtx logs-web status restart clean test-camera info

# Default target
help:
	@echo "🎥 Proxmox LXC WebRTC Streaming - Available Commands"
	@echo ""
	@echo "Setup & Deployment:"
	@echo "  make setup          - Initial setup (install dependencies, prepare dirs)"
	@echo "  make build          - Build Docker images"
	@echo "  make up             - Start all services"
	@echo "  make down           - Stop all services"
	@echo ""
	@echo "Monitoring:"
	@echo "  make logs           - Show all logs (follow)"
	@echo "  make logs-mediamtx  - Show MediaMTX logs (follow)"
	@echo "  make logs-web       - Show Nginx logs (follow)"
	@echo "  make status         - Show container status"
	@echo ""
	@echo "Maintenance:"
	@echo "  make restart        - Restart all services"
	@echo "  make clean          - Remove containers and volumes"
	@echo "  make prune          - Remove dangling images/volumes"
	@echo ""
	@echo "Testing & Diagnostics:"
	@echo "  make test-camera    - Test USB camera access"
	@echo "  make info           - Show system & streaming info"
	@echo "  make test-stream    - Test WebRTC stream connectivity"
	@echo ""

# Setup initial environment
setup:
	@echo "📦 Setting up environment..."
	mkdir -p logs recordings web
	[ -f .env ] || cp .env.example .env
	@echo "✓ Directories created"
	@echo "✓ .env file ready"
	@echo ""
	@echo "Next steps:"
	@echo "  1. Review .env configuration"
	@echo "  2. Run: make build"
	@echo "  3. Run: make up"

# Build Docker images
build:
	@echo "🔨 Building Docker images..."
	docker-compose build --no-cache

# Start services
up:
	@echo "🚀 Starting services..."
	docker-compose up -d
	@sleep 5
	@echo "✓ Services started"
	@echo ""
	@echo "Access the stream at:"
	@echo "  http://stream.raumdock.org"
	@echo ""
	@make status

# Stop services
down:
	@echo "⏹ Stopping services..."
	docker-compose down
	@echo "✓ Services stopped"

# Show all logs
logs:
	docker-compose logs -f

# Show MediaMTX logs
logs-mediamtx:
	docker-compose logs -f mediamtx

# Show Nginx logs
logs-web:
	docker-compose logs -f web-ui

# Show service status
status:
	@echo "📊 Service Status:"
	@echo ""
	@docker-compose ps

# Restart services
restart:
	@echo "🔄 Restarting services..."
	docker-compose restart
	@sleep 3
	@make status

# Clean up containers and volumes
clean:
	@echo "🧹 Cleaning up..."
	docker-compose down -v
	@echo "✓ Containers and volumes removed"

# Remove dangling resources
prune:
	@echo "🧹 Pruning Docker resources..."
	docker system prune -f
	docker volume prune -f
	@echo "✓ Pruned"

# Test camera access
test-camera:
	@echo "🎥 Testing camera access..."
	@echo ""
	@echo "1. USB devices detected:"
	@lsusb | grep -i webcam || echo "   No webcam detected"
	@echo ""
	@echo "2. Video device access:"
	@ls -la /dev/video* 2>/dev/null || echo "   No video devices found"
	@echo ""
	@echo "3. Camera capabilities:"
	@v4l2-ctl -d /dev/video0 --all 2>/dev/null | head -20 || echo "   Cannot access camera"
	@echo ""
	@echo "4. Supported formats:"
	@v4l2-ctl -d /dev/video0 --list-formats-ext 2>/dev/null | head -10 || echo "   Cannot query formats"

# Show system & streaming info
info:
	@echo "ℹ️  System Information"
	@echo ""
	@echo "Container Info:"
	@uname -a
	@echo ""
	@echo "Docker Info:"
	@docker --version
	@docker-compose --version
	@echo ""
	@echo "Memory:"
	@free -h | head -2
	@echo ""
	@echo "Disk Space:"
	@df -h / | tail -1
	@echo ""
	@echo "Network:"
	@hostname -I
	@echo ""
	@echo "Services:"
	@make status

# Test WebRTC stream
test-stream:
	@echo "🧪 Testing WebRTC stream..."
	@echo ""
	@echo "MediaMTX API Status:"
	@curl -s http://localhost:8888/api/v1/config/get > /dev/null && echo "✓ API is responding" || echo "✗ API not responding"
	@echo ""
	@echo "Available paths:"
	@curl -s http://localhost:8888/api/v1/paths/list 2>/dev/null | grep -o '"key":"[^"]*' | cut -d'"' -f4 || echo "   Cannot retrieve paths"
	@echo ""
	@echo "WebRTC endpoint:"
	@echo "  webrtc://stream.raumdock.org:8555/webcam"
	@echo ""
	@echo "HLS endpoint:"
	@echo "  http://stream.raumdock.org:8889/webcam/index.m3u8"

# Development: Watch logs
watch:
	@echo "👁️  Watching logs (press Ctrl+C to stop)..."
	@docker-compose logs -f

# Shell access to MediaMTX
shell-mediamtx:
	docker-compose exec mediamtx /bin/sh

# Shell access to web container
shell-web:
	docker-compose exec web-ui /bin/sh

# Emergency stop all containers
stop-all:
	@echo "🛑 Stopping all containers..."
	docker stop $$(docker ps -q) 2>/dev/null || true
	@echo "✓ Stopped"

# Show this help
print-help: help
