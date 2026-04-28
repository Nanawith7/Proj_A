"""Standalone server for the Nodeview Editor.

Starts an HTTP server on port 8766 that serves the editor HTML and
proxies template load/save requests to the viewer server (port 8765).

Usage: python server.py [--port 8766] [--viewer-port 8765]
"""

import json
import sys
from pathlib import Path
from http.server import HTTPServer, BaseHTTPRequestHandler

VIEWER_PORT = 8765


class EditorHandler(BaseHTTPRequestHandler):
    def do_GET(self):
        path = self.path.split("?")[0]
        if path == "/" or path == "/index.html":
            self._serve_file("index.html", "text/html")
        elif path.endswith(".css"):
            self._serve_file(path.lstrip("/"), "text/css")
        elif path.endswith(".js"):
            self._serve_file(path.lstrip("/"), "application/javascript")
        elif path == "/api/templates":
            self._proxy_viewer("GET", "/api/typedefs")
        elif path.startswith("/api/nodeview/"):
            self._proxy_viewer("GET", path)
        else:
            self.send_error(404)

    def do_POST(self):
        if self.path == "/api/save":
            content_len = int(self.headers.get("Content-Length", 0))
            data = self.rfile.read(content_len)
            params = json.loads(data)
            name = params.get("name", "untitled")
            nv_json = params.get("nodeview", {})
            result = {
                "name": name,
                "json": json.dumps(nv_json, indent=2, ensure_ascii=False),
            }
            self._serve_json(result)
        else:
            self.send_error(404)

    def _serve_file(self, filename, ct):
        fpath = Path(__file__).parent / filename
        if not fpath.is_file():
            self.send_error(404)
            return
        data = fpath.read_bytes()
        self.send_response(200)
        self.send_header("Content-Type", f"{ct}; charset=utf-8")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def _serve_json(self, data):
        body = json.dumps(data, ensure_ascii=False).encode("utf-8")
        self.send_response(200)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _proxy_viewer(self, method, path):
        import urllib.request
        url = f"http://127.0.0.1:{VIEWER_PORT}{path}"
        try:
            req = urllib.request.Request(url, method=method)
            resp = urllib.request.urlopen(req, timeout=3)
            data = resp.read()
            self.send_response(200)
            self.send_header("Content-Type", resp.headers.get("Content-Type", "application/json"))
            self.send_header("Content-Length", str(len(data)))
            self.end_headers()
            self.wfile.write(data)
        except Exception:
            self.send_error(502, "Viewer server not reachable")

    def log_message(self, format, *args):
        print(f"[Editor] {args[0]}")


def main():
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8766
    global VIEWER_PORT
    VIEWER_PORT = int(sys.argv[2]) if len(sys.argv) > 2 else 8765

    server = HTTPServer(("127.0.0.1", port), EditorHandler)
    print(f"\n[Editor] Nodeview Editor at http://127.0.0.1:{port}/")
    print(f"[Editor] Proxying to viewer server at port {VIEWER_PORT}")
    print(f"[Editor] Press Ctrl+C to stop.\n")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\n[Editor] Stopped.")
        server.shutdown()


if __name__ == "__main__":
    main()
