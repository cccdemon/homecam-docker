// WebRTC Stream Handler
// Connects to MediaMTX WebRTC server and displays live video feed

class WebRTCStream {
    constructor() {
        this.pc = null;
        this.videoElement = document.getElementById('video');
        this.connected = false;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
        this.reconnectDelay = 2000;
        this.statsInterval = null;

        // Configuration
        this.config = {
            iceServers: [
                { urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] }
            ]
        };

        this.init();
    }

    init() {
        this.setupEventListeners();
        this.updateStatus('disconnected', 'Ready to connect');
    }

    setupEventListeners() {
        this.videoElement.addEventListener('play', () => {
            this.startStatsCollection();
        });

        this.videoElement.addEventListener('pause', () => {
            this.stopStatsCollection();
        });

        window.addEventListener('beforeunload', () => {
            this.disconnect();
        });
    }

    async connect() {
        if (this.connected) {
            console.warn('Already connected');
            return;
        }

        this.updateStatus('connecting', 'Connecting to MediaMTX...');
        this.setButtonState(false, true);

        try {
            // Create peer connection
            this.pc = new RTCPeerConnection({
                iceServers: this.config.iceServers
            });

            // Handle ICE candidates
            this.pc.onicecandidate = (event) => {
                if (event.candidate) {
                    console.log('ICE candidate:', event.candidate);
                }
            };

            // Handle remote track
            this.pc.ontrack = (event) => {
                console.log('Remote track received:', event.track);
                this.videoElement.srcObject = event.streams[0];
            };

            // Handle connection state changes
            this.pc.onconnectionstatechange = () => {
                const state = this.pc.connectionState;
                console.log('Connection state:', state);

                switch (state) {
                    case 'connected':
                        this.onConnected();
                        break;
                    case 'disconnected':
                        this.onDisconnected();
                        break;
                    case 'failed':
                        this.onConnectionFailed();
                        break;
                    case 'closed':
                        this.onClosed();
                        break;
                }
            };

            // Handle ICE connection state
            this.pc.oniceconnectionstatechange = () => {
                console.log('ICE connection state:', this.pc.iceConnectionState);
            };

            // Add transceiver for receiving video
            this.pc.addTransceiver('video', { direction: 'recvonly' });

            // Create and send offer
            const offer = await this.pc.createOffer();
            await this.pc.setLocalDescription(offer);
            await this.waitForIceGathering();

            // Send offer to MediaMTX
            const response = await this.sendOffer(this.pc.localDescription);
            await this.pc.setRemoteDescription(new RTCSessionDescription({
                type: 'answer',
                sdp: response
            }));
            this.reconnectAttempts = 0;
        } catch (error) {
            console.error('Connection error:', error);
            this.showError(`Connection failed: ${error.message}`);
            this.handleConnectionError();
        }
    }

    waitForIceGathering() {
        if (this.pc.iceGatheringState === 'complete') {
            return Promise.resolve();
        }

        return new Promise((resolve) => {
            const timeout = setTimeout(resolve, 3000);

            this.pc.addEventListener('icegatheringstatechange', () => {
                if (this.pc.iceGatheringState === 'complete') {
                    clearTimeout(timeout);
                    resolve();
                }
            });
        });
    }

    async sendOffer(offer) {
        try {
            const response = await fetch('/webcam/whep', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/sdp',
                },
                body: offer.sdp
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            return await response.text();
        } catch (error) {
            console.error('Offer send error:', error);
            throw error;
        }
    }

    onConnected() {
        this.connected = true;
        this.reconnectAttempts = 0;
        this.updateStatus('connected', 'Connected to camera');
        this.setButtonState(true, false);
        this.clearError();
        console.log('✓ WebRTC connection established');
    }

    onDisconnected() {
        if (this.connected) {
            this.updateStatus('connecting', 'Reconnecting...');
            this.attemptReconnect();
        }
    }

    onConnectionFailed() {
        this.connected = false;
        this.showError('Connection failed. Attempting to reconnect...');
        this.attemptReconnect();
    }

    onClosed() {
        this.connected = false;
        this.updateStatus('disconnected', 'Connection closed');
        this.setButtonState(false, true);
    }

    attemptReconnect() {
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
            this.reconnectAttempts++;
            console.log(`Reconnection attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts}`);
            setTimeout(() => {
                if (!this.connected) {
                    this.disconnect();
                    this.connect();
                }
            }, this.reconnectDelay * this.reconnectAttempts);
        } else {
            this.updateStatus('disconnected', 'Reconnection failed. Please try again.');
            this.setButtonState(false, true);
        }
    }

    handleConnectionError() {
        this.connected = false;
        this.setButtonState(false, true);
        if (this.pc) {
            this.pc.close();
            this.pc = null;
        }
    }

    disconnect() {
        this.connected = false;
        this.stopStatsCollection();

        if (this.pc) {
            this.pc.close();
            this.pc = null;
        }

        if (this.videoElement.srcObject) {
            this.videoElement.srcObject.getTracks().forEach(track => track.stop());
            this.videoElement.srcObject = null;
        }

        this.updateStatus('disconnected', 'Disconnected');
        this.setButtonState(false, true);
        this.clearError();
        console.log('✓ Disconnected from camera');
    }

    updateStatus(status, message) {
        const statusEl = document.getElementById('status');
        const statusText = document.getElementById('statusText');
        const infoStatus = document.getElementById('infoStatus');

        statusEl.className = `status ${status}`;
        statusText.textContent = message;
        infoStatus.textContent = status.charAt(0).toUpperCase() + status.slice(1);
    }

    setButtonState(isConnected, isDisabled) {
        document.getElementById('connectBtn').disabled = isConnected;
        document.getElementById('disconnectBtn').disabled = !isConnected;
        document.getElementById('screenshotBtn').disabled = !isConnected;
    }

    showError(message) {
        const container = document.getElementById('errorContainer');
        container.innerHTML = `<div class="error-message">⚠️ ${message}</div>`;
    }

    clearError() {
        document.getElementById('errorContainer').innerHTML = '';
    }

    startStatsCollection() {
        if (this.statsInterval) return;

        this.statsInterval = setInterval(async () => {
            if (!this.pc || this.pc.connectionState !== 'connected') return;

            try {
                const stats = await this.pc.getStats();
                stats.forEach(report => {
                    if (report.type === 'inboundRtp' && report.kind === 'video') {
                        const fps = report.framesPerSecond || 0;
                        const width = report.frameWidth || 0;
                        const height = report.frameHeight || 0;
                        const bytesReceived = report.bytesReceived || 0;

                        if (width && height) {
                            document.getElementById('infoResolution').textContent = `${width}x${height}`;
                        }
                        if (fps) {
                            document.getElementById('infoFramerate').textContent = `${fps} fps`;
                        }
                    }
                });
            } catch (error) {
                console.error('Stats collection error:', error);
            }
        }, 1000);
    }

    stopStatsCollection() {
        if (this.statsInterval) {
            clearInterval(this.statsInterval);
            this.statsInterval = null;
        }
    }
}

// Global stream instance
let streamInstance = null;

// Event handlers
function handleConnect() {
    if (!streamInstance) {
        streamInstance = new WebRTCStream();
    }
    streamInstance.connect();
}

function handleDisconnect() {
    if (streamInstance) {
        streamInstance.disconnect();
    }
}

function toggleFullscreen() {
    const video = document.getElementById('video');
    if (video.requestFullscreen) {
        video.requestFullscreen();
    } else if (video.webkitRequestFullscreen) {
        video.webkitRequestFullscreen();
    } else if (video.mozRequestFullScreen) {
        video.mozRequestFullScreen();
    }
}

function takeScreenshot() {
    const video = document.getElementById('video');
    if (!video.srcObject) return;

    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0);

    const link = document.createElement('a');
    link.href = canvas.toDataURL('image/png');
    link.download = `webcam-${new Date().toISOString()}.png`;
    link.click();
}

function copyStreamUrl() {
    const url = document.getElementById('streamUrl').textContent;
    navigator.clipboard.writeText(url).then(() => {
        alert('WebRTC URL copied to clipboard');
    });
}

function copyHlsUrl() {
    const url = document.getElementById('hlsUrl').textContent;
    navigator.clipboard.writeText(url).then(() => {
        alert('HLS URL copied to clipboard');
    });
}

// Initialize on page load
window.addEventListener('DOMContentLoaded', () => {
    console.log('Page loaded. Ready to connect to WebRTC stream.');
});

// Auto-connect on page load (optional)
// window.addEventListener('DOMContentLoaded', () => {
//     handleConnect();
// });
