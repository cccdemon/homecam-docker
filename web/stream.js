// WebRTC Stream Handler
// Connects to MediaMTX WebRTC server and displays live video feed

const CAMERA_PATH = 'webcam';

let recorder = null;
let recordedChunks = [];
let cameraRunOnInitCommand = '';
let cameraControlsByName = new Map();

const CONTROL_LABELS = {
    brightness: 'Brightness',
    contrast: 'Contrast',
    saturation: 'Saturation',
    hue: 'Hue',
    sharpness: 'Sharpness',
    gamma: 'Gamma',
    gain: 'Gain',
    backlight_compensation: 'Backlight',
    power_line_frequency: 'Power Hz',
    white_balance_temperature_auto: 'WB Auto',
    white_balance_temperature: 'WB Temp',
    auto_exposure: 'Exposure',
    exposure_auto: 'Exposure',
    exposure_dynamic_framerate: 'Exp FPS',
    exposure_time_absolute: 'Exp Time',
    focus_automatic_continuous: 'Focus Auto',
    focus_auto: 'Focus Auto',
    focus_absolute: 'Focus',
    zoom_absolute: 'Zoom',
    pan_absolute: 'Pan',
    tilt_absolute: 'Tilt',
};

const PREFERRED_CONTROLS = [
    'brightness',
    'contrast',
    'saturation',
    'sharpness',
    'gain',
    'backlight_compensation',
    'power_line_frequency',
    'white_balance_temperature_auto',
    'white_balance_temperature',
    'auto_exposure',
    'exposure_auto',
    'exposure_time_absolute',
    'focus_automatic_continuous',
    'focus_auto',
    'focus_absolute',
    'zoom_absolute',
];

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

            // Add transceivers for receiving media
            this.pc.addTransceiver('audio', { direction: 'recvonly' });
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

        if (recorder && recorder.state !== 'inactive') {
            recorder.stop();
        }

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
        document.getElementById('recordBtn').disabled = !isConnected;
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

function getSupportedRecordingType() {
    const types = [
        'video/webm;codecs=vp9',
        'video/webm;codecs=vp8',
        'video/webm',
    ];

    return types.find(type => MediaRecorder.isTypeSupported(type)) || '';
}

function toggleRecording() {
    if (recorder && recorder.state === 'recording') {
        recorder.stop();
        return;
    }

    startRecording();
}

function startRecording() {
    const video = document.getElementById('video');
    const recordBtn = document.getElementById('recordBtn');

    if (!video.srcObject) {
        return;
    }

    if (!window.MediaRecorder) {
        alert('Recording is not supported by this browser.');
        return;
    }

    recordedChunks = [];

    const mimeType = getSupportedRecordingType();
    recorder = new MediaRecorder(video.srcObject, mimeType ? { mimeType } : undefined);

    recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
            recordedChunks.push(event.data);
        }
    };

    recorder.onstop = () => {
        const blob = new Blob(recordedChunks, { type: recorder.mimeType || 'video/webm' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');

        link.href = url;
        link.download = `webcam-recording-${new Date().toISOString()}.webm`;
        link.click();

        URL.revokeObjectURL(url);
        recordBtn.textContent = 'Record';
        recordBtn.classList.add('btn-gold');
        recordBtn.classList.remove('btn-red');
        recordedChunks = [];
        recorder = null;
    };

    recorder.start(1000);
    recordBtn.textContent = 'Stop Rec';
    recordBtn.classList.remove('btn-gold');
    recordBtn.classList.add('btn-red');
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

function updateEndpointUrls() {
    const origin = window.location.origin;
    const streamUrl = document.getElementById('streamUrl');
    const hlsUrl = document.getElementById('hlsUrl');

    if (streamUrl) {
        streamUrl.textContent = `${origin}/${CAMERA_PATH}/whep`;
    }

    if (hlsUrl) {
        hlsUrl.textContent = `${origin}/${CAMERA_PATH}/index.m3u8`;
    }
}

function formatControlName(name) {
    return CONTROL_LABELS[name] || name.replace(/_/g, ' ').replace(/\b\w/g, char => char.toUpperCase());
}

function isControlWritable(control) {
    return !String(control.flags || '').includes('inactive') && control.value !== null && control.value !== undefined;
}

function sortControls(controls) {
    return controls
        .filter(control => CONTROL_LABELS[control.name] && isControlWritable(control))
        .sort((a, b) => {
            const ai = PREFERRED_CONTROLS.indexOf(a.name);
            const bi = PREFERRED_CONTROLS.indexOf(b.name);
            return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
        });
}

function renderCameraControls(controls) {
    const container = document.getElementById('cameraControls');
    if (!container) return;

    const visibleControls = sortControls(controls);
    cameraControlsByName = new Map(visibleControls.map(control => [control.name, control]));

    if (!visibleControls.length) {
        container.innerHTML = '<div class="info-value">No writable controls</div>';
        return;
    }

    container.innerHTML = visibleControls.map(control => {
        const value = Number(control.value);
        const min = Number.isFinite(Number(control.min)) ? Number(control.min) : 0;
        const max = Number.isFinite(Number(control.max)) ? Number(control.max) : 1;
        const step = Number.isFinite(Number(control.step)) && Number(control.step) > 0 ? Number(control.step) : 1;
        const label = formatControlName(control.name);

        if (control.type === 'bool') {
            return `
                <label class="camera-control-row">
                    <span>${label}</span>
                    <input type="checkbox" ${value ? 'checked' : ''} onchange="setCameraControl('${control.name}', this.checked ? 1 : 0)">
                    <span class="camera-control-value">${value ? 'ON' : 'OFF'}</span>
                </label>
            `;
        }

        if (Array.isArray(control.options) && control.options.length) {
            const options = control.options.map(option => {
                const selected = Number(option.value) === value ? 'selected' : '';
                return `<option value="${option.value}" ${selected}>${option.label}</option>`;
            }).join('');

            return `
                <label class="camera-control-row">
                    <span>${label}</span>
                    <select onchange="setCameraControl('${control.name}', Number(this.value))">${options}</select>
                    <span class="camera-control-value">${value}</span>
                </label>
            `;
        }

        return `
            <label class="camera-control-row">
                <span>${label}</span>
                <input type="range" min="${min}" max="${max}" step="${step}" value="${value}" oninput="previewCameraControlValue('${control.name}', this.value)" onchange="setCameraControl('${control.name}', Number(this.value))">
                <span id="ctrlValue-${control.name}" class="camera-control-value">${value}</span>
            </label>
        `;
    }).join('');
}

function previewCameraControlValue(name, value) {
    const valueEl = document.getElementById(`ctrlValue-${name}`);
    if (valueEl) valueEl.textContent = value;
}

async function loadCameraControls() {
    const container = document.getElementById('cameraControls');
    if (container) {
        container.innerHTML = '<div class="info-value">Loading</div>';
    }

    try {
        const response = await fetch('/api/camera/controls', { cache: 'no-store' });
        if (!response.ok) {
            throw new Error(`Camera API ${response.status}`);
        }

        const payload = await response.json();
        renderCameraControls(payload.controls || []);
    } catch (error) {
        console.error('Camera controls failed:', error);
        if (container) {
            container.innerHTML = '<div class="error-message">Camera controls unavailable</div>';
        }
    }
}

async function setCameraControl(name, value) {
    try {
        const response = await fetch('/api/camera/controls', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ name, value }),
        });

        if (!response.ok) {
            const text = await response.text();
            throw new Error(text || `Camera API ${response.status}`);
        }

        const payload = await response.json();
        renderCameraControls(payload.controls || []);
        clearControlError();
    } catch (error) {
        console.error('Camera control update failed:', error);
        showControlError(`Camera control failed: ${error.message}`);
        loadCameraControls();
    }
}

function setCameraControlsDisabled(disabled) {
    const onBtn = document.getElementById('cameraOnBtn');
    const offBtn = document.getElementById('cameraOffBtn');

    if (onBtn) onBtn.disabled = disabled;
    if (offBtn) offBtn.disabled = disabled;
}

function updateCameraPowerState(state, message) {
    const stateEl = document.getElementById('cameraPowerState');
    const badgeEl = document.getElementById('cameraPowerBadge');
    const infoEl = document.getElementById('infoCameraPower');

    if (stateEl) {
        stateEl.className = state === 'on' ? 'badge on' : 'badge off';
        stateEl.textContent = message;
    }

    if (badgeEl) {
        const className = state === 'on' ? 'health-svc ok' : state === 'off' ? 'health-svc error' : 'health-svc loading';
        badgeEl.className = className;
        badgeEl.innerHTML = `<span class="health-dot"></span>CAMERA ${message}`;
    }

    if (infoEl) {
        infoEl.textContent = message.charAt(0).toUpperCase() + message.slice(1).toLowerCase();
    }
}

async function patchCameraPath(body) {
    let response = await fetch(`/v3/config/paths/patch/${CAMERA_PATH}`, {
        method: 'PATCH',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
    });

    if (response.status === 404 || response.status === 405) {
        response = await fetch(`/v3/config/paths/edit/${CAMERA_PATH}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(body),
        });
    }

    if (!response.ok) {
        const text = await response.text();
        throw new Error(`MediaMTX API ${response.status}: ${text || response.statusText}`);
    }
}

async function refreshCameraPowerState() {
    try {
        const response = await fetch(`/v3/config/paths/get/${CAMERA_PATH}`, {
            cache: 'no-store',
        });

        if (!response.ok) {
            throw new Error(`MediaMTX API ${response.status}`);
        }

        const config = await response.json();
        if (config.runOnInit) {
            cameraRunOnInitCommand = config.runOnInit;
        }
        updateCameraPowerState(config.runOnInit ? 'on' : 'off', config.runOnInit ? 'ON' : 'OFF');
    } catch (error) {
        console.error('Camera state check failed:', error);
        updateCameraPowerState('unknown', 'UNKNOWN');
    }
}

async function handleCameraOn() {
    setCameraControlsDisabled(true);
    updateCameraPowerState('unknown', 'STARTING');

    try {
        if (!cameraRunOnInitCommand) {
            await refreshCameraPowerState();
        }

        if (!cameraRunOnInitCommand) {
            throw new Error('No camera start command is available from MediaMTX config');
        }

        await patchCameraPath({
            runOnInit: cameraRunOnInitCommand,
            runOnInitRestart: true,
        });
        updateCameraPowerState('on', 'ON');
        clearControlError();
    } catch (error) {
        console.error('Camera on failed:', error);
        showControlError(`Camera on failed: ${error.message}`);
        await refreshCameraPowerState();
    } finally {
        setCameraControlsDisabled(false);
    }
}

async function handleCameraOff() {
    setCameraControlsDisabled(true);
    updateCameraPowerState('unknown', 'STOPPING');

    if (streamInstance) {
        streamInstance.disconnect();
    }

    try {
        await refreshCameraPowerState();
        await patchCameraPath({
            runOnInit: '',
            runOnInitRestart: false,
        });
        updateCameraPowerState('off', 'OFF');
        clearControlError();
    } catch (error) {
        console.error('Camera off failed:', error);
        showControlError(`Camera off failed: ${error.message}`);
        await refreshCameraPowerState();
    } finally {
        setCameraControlsDisabled(false);
    }
}

function showControlError(message) {
    const container = document.getElementById('errorContainer');
    container.innerHTML = `<div class="error-message">${message}</div>`;
}

function clearControlError() {
    document.getElementById('errorContainer').innerHTML = '';
}

// Initialize on page load
window.addEventListener('DOMContentLoaded', () => {
    console.log('Page loaded. Ready to connect to WebRTC stream.');
    updateEndpointUrls();
    refreshCameraPowerState();
    loadCameraControls();
});

// Auto-connect on page load (optional)
// window.addEventListener('DOMContentLoaded', () => {
//     handleConnect();
// });
