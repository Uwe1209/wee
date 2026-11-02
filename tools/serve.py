#!/usr/bin/env python3
"""Static file server for the portfolio and its capture tools.

Threaded, keep-alive, and answers byte-range requests: video seeking breaks
without ranges, and the stock http.server drops connections when several
capture browsers hit it at once.

    python3 tools/serve.py                 # serves site/ on http://localhost:8080
    python3 tools/serve.py workbench 8090  # any folder, any port
"""
import os
import re
import sys
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
QUIET_ERRORS = (BrokenPipeError, ConnectionResetError, ConnectionAbortedError)


class RangeHandler(SimpleHTTPRequestHandler):
    protocol_version = "HTTP/1.1"
    extensions_map = {
        **SimpleHTTPRequestHandler.extensions_map,
        ".js": "text/javascript",
        ".mjs": "text/javascript",
        ".json": "application/json",
        ".wasm": "application/wasm",
        ".glb": "model/gltf-binary",
        ".mp4": "video/mp4",
        ".webm": "video/webm",
        ".woff2": "font/woff2",
        ".webp": "image/webp",
        ".avif": "image/avif",
    }

    def end_headers(self):
        self.send_header("Accept-Ranges", "bytes")
        self.send_header("Cache-Control", "no-cache")
        super().end_headers()

    def send_head(self):
        self._range = None
        header = self.headers.get("Range")
        path = self.translate_path(self.path)
        if not header or not os.path.isfile(path):
            return super().send_head()

        size = os.path.getsize(path)
        match = re.match(r"bytes=(\d*)-(\d*)$", header.strip())
        if not match or match.groups() == ("", ""):
            return self._unsatisfiable(size)
        first, last = match.groups()
        if first == "":
            start, end = max(0, size - int(last)), size - 1
        else:
            start = int(first)
            end = min(int(last), size - 1) if last else size - 1
        if start >= size or end < start:
            return self._unsatisfiable(size)

        handle = open(path, "rb")
        handle.seek(start)
        self.send_response(206)
        self.send_header("Content-Type", self.guess_type(path))
        self.send_header("Content-Range", f"bytes {start}-{end}/{size}")
        self.send_header("Content-Length", str(end - start + 1))
        self.send_header("Last-Modified", self.date_time_string(os.path.getmtime(path)))
        self.end_headers()
        self._range = (start, end)
        return handle

    def _unsatisfiable(self, size):
        self.send_response(416)
        self.send_header("Content-Range", f"bytes */{size}")
        self.send_header("Content-Length", "0")
        self.end_headers()
        return None

    def copyfile(self, source, outputfile):
        span = getattr(self, "_range", None)
        self._range = None
        if span is None:
            return super().copyfile(source, outputfile)
        remaining = span[1] - span[0] + 1
        while remaining > 0:
            chunk = source.read(min(1 << 16, remaining))
            if not chunk:
                break
            outputfile.write(chunk)
            remaining -= len(chunk)

    def log_message(self, fmt, *args):
        if os.environ.get("SERVE_LOG"):
            super().log_message(fmt, *args)


class Server(ThreadingHTTPServer):
    daemon_threads = True
    allow_reuse_address = True
    request_queue_size = 256

    def handle_error(self, request, client_address):
        if isinstance(sys.exc_info()[1], QUIET_ERRORS):
            return
        super().handle_error(request, client_address)


def main():
    folder = sys.argv[1] if len(sys.argv) > 1 else "site"
    port = int(sys.argv[2]) if len(sys.argv) > 2 else 8080
    directory = folder if os.path.isabs(folder) else os.path.join(ROOT, folder)

    def handler(*args, **kwargs):
        return RangeHandler(*args, directory=directory, **kwargs)

    with Server(("0.0.0.0", port), handler) as httpd:
        print(f"serving {directory} at http://localhost:{port}", flush=True)
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            pass


if __name__ == "__main__":
    main()
