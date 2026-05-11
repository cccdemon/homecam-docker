#!/usr/bin/env python3
import json
import os
import re
import subprocess
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlparse

CAMERA_DEVICE = os.environ.get("CAMERA_DEVICE", "/dev/video0")
LIST_RE = re.compile(
    r"^\s*(?P<name>\w+)\s+0x[0-9a-fA-F]+\s+\((?P<type>[^)]+)\)\s*:\s*(?P<attrs>.*)$"
)


def run_v4l2(*args):
    proc = subprocess.run(
        ["v4l2-ctl", "-d", CAMERA_DEVICE, *args],
        text=True,
        capture_output=True,
        timeout=5,
        check=False,
    )
    if proc.returncode != 0:
        raise RuntimeError((proc.stderr or proc.stdout or "v4l2-ctl failed").strip())
    return proc.stdout


def parse_attrs(text):
    attrs = {}
    for key, value in re.findall(r"(\w+)=([^\s]+)", text):
        if value.lstrip("-").isdigit():
            attrs[key] = int(value)
        else:
            attrs[key] = value
    if "flags=" in text:
        attrs["flags"] = text.split("flags=", 1)[1].strip()
    return attrs


def list_controls():
    controls = []
    current = None
    output = run_v4l2("--list-ctrls-menus")
    for line in output.splitlines():
        match = LIST_RE.match(line)
        if match:
            attrs = parse_attrs(match.group("attrs"))
            current = {
                "name": match.group("name"),
                "type": match.group("type"),
                "min": attrs.get("min"),
                "max": attrs.get("max"),
                "step": attrs.get("step", 1),
                "default": attrs.get("default"),
                "value": attrs.get("value"),
                "flags": attrs.get("flags", ""),
                "options": [],
            }
            controls.append(current)
            continue

        option = re.match(r"^\s*(?P<value>-?\d+):\s*(?P<label>.+?)\s*$", line)
        if current and option:
            current["options"].append(
                {"value": int(option.group("value")), "label": option.group("label")}
            )
    return controls


def set_control(name, value):
    if not re.fullmatch(r"[A-Za-z0-9_]+", name):
        raise ValueError("invalid control name")
    if not isinstance(value, int):
        raise ValueError("control value must be an integer")
    run_v4l2("--set-ctrl", f"{name}={value}")
    return list_controls()


class Handler(BaseHTTPRequestHandler):
    def send_json(self, status, payload):
        body = json.dumps(payload).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Cache-Control", "no-store")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        path = urlparse(self.path).path
        try:
            if path == "/health":
                self.send_json(200, {"ok": True, "device": CAMERA_DEVICE})
            elif path == "/controls":
                self.send_json(200, {"device": CAMERA_DEVICE, "controls": list_controls()})
            else:
                self.send_json(404, {"error": "not found"})
        except Exception as exc:
            self.send_json(500, {"error": str(exc)})

    def do_POST(self):
        path = urlparse(self.path).path
        if path != "/controls":
            self.send_json(404, {"error": "not found"})
            return

        try:
            length = int(self.headers.get("Content-Length", "0"))
            payload = json.loads(self.rfile.read(length) or b"{}")
            controls = set_control(str(payload.get("name", "")), payload.get("value"))
            self.send_json(200, {"device": CAMERA_DEVICE, "controls": controls})
        except Exception as exc:
            self.send_json(400, {"error": str(exc)})

    def log_message(self, fmt, *args):
        return


if __name__ == "__main__":
    server = ThreadingHTTPServer(("0.0.0.0", 8090), Handler)
    server.serve_forever()
