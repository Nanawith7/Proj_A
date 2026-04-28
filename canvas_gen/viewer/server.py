"""HTTP server for the Canvas Viewer.

Provides:
  GET  /           — serves the viewer frontend
  POST /api/filter — accepts filter JSON, returns filtered nodes + edges
  GET  /api/icon?name=X — serves icon PNG from _icons/

Start with: python -m canvas_gen.viewer.server --vault <path> [--port 8765]
"""

from __future__ import annotations

import json
from pathlib import Path
from http.server import HTTPServer, BaseHTTPRequestHandler
from typing import Any
from urllib.parse import parse_qs, urlparse

from ..extractor import parse_frontmatter

# Global state (initialized once)
VAULT_PATH: str = ""
CANVAS_DATA: dict[str, Any] = {}
VAULT_CONTENT: dict[str, dict[str, Any]] = {}
FILE_NODES: list[dict[str, Any]] = []
ALL_EDGES: list[dict[str, Any]] = []


def init_server(vault_path: str, canvas_path: str) -> None:
    """Load canvas + vault data into global state."""
    global VAULT_PATH, CANVAS_DATA, VAULT_CONTENT, FILE_NODES, ALL_EDGES

    VAULT_PATH = vault_path

    # Load canvas JSON
    with open(canvas_path, "r", encoding="utf-8") as f:
        CANVAS_DATA = json.load(f)

    # Separate file nodes from icon nodes
    all_nodes = CANVAS_DATA.get("nodes", [])
    FILE_NODES.clear()
    FILE_NODES.extend(n for n in all_nodes if "_icon" not in n.get("id", ""))
    ALL_EDGES.clear()
    ALL_EDGES.extend(CANVAS_DATA.get("edges", []))

    # Scan vault for content
    VAULT_CONTENT.clear()
    vault = Path(vault_path)
    if vault.is_dir():
        for md_file in vault.rglob("*.md"):
            try:
                text = md_file.read_text(encoding="utf-8")
            except (OSError, UnicodeDecodeError):
                continue
            props, body = parse_frontmatter(text)
            stem = md_file.stem
            VAULT_CONTENT[stem] = {
                "file": str(md_file.relative_to(vault)).replace("\\", "/"),
                "props": props,
                "body": body.strip(),
            }


# ═══════════════ Filter engine (server-side, calls pipeline) ═══════════════


def _match_condition(node_data: dict, key: str, expected: Any) -> bool:
    """JS port: identical logic to filter_sort.py"""
    if key == "$or" and isinstance(expected, list):
        return any(
            all(_match_condition(node_data, k, v) for k, v in cond.items())
            for cond in expected
        )
    stem = (node_data.get("file", "").replace(".md", "").split("/"))[-1]
    v = VAULT_CONTENT.get(stem)
    if not v:
        return False
    actual = (v.get("props") or {}).get(key)
    if actual is None:
        return False

    if isinstance(actual, list):
        if expected in actual:
            return True
        return ("[[" + expected + "]]") in actual
    if isinstance(expected, list):
        if actual in expected:
            return True
        if actual.startswith("[[") and actual.endswith("]]"):
            return actual[2:-2] in expected
        return False
    if actual == expected:
        return True
    if isinstance(actual, str) and actual.startswith("[[") and actual.endswith("]]"):
        return actual[2:-2] == expected
    if isinstance(expected, str) and expected.startswith("[[") and expected.endswith("]]"):
        return actual == expected[2:-2]
    return False


def _apply_filter(nodes, conditions):
    if not conditions:
        return nodes
    return [n for n in nodes if all(_match_condition(n, k, v) for k, v in conditions.items())]


def _apply_exclude(nodes, conditions):
    if not conditions:
        return nodes
    return [n for n in nodes if not all(_match_condition(n, k, v) for k, v in conditions.items())]


def _apply_sort(nodes, sort_key, desc):
    if not sort_key:
        return nodes
    def key_fn(n):
        stem = (n.get("file", "").replace(".md", "").split("/"))[-1]
        v = VAULT_CONTENT.get(stem, {})
        return (v.get("props") or {}).get(sort_key, "")
    return sorted(nodes, key=key_fn, reverse=desc)


def _prune_orphans(nodes, edges):
    connected = set()
    for e in edges:
        connected.add(e.get("fromNode", ""))
        connected.add(e.get("toNode", ""))
    return [n for n in nodes if n.get("id") in connected]


def run_filter(params: dict[str, Any]) -> dict[str, Any]:
    """Execute filter pipeline and return result."""
    nodes = list(FILE_NODES)  # shallow copy
    edges = list(ALL_EDGES)

    filter_raw = params.get("filter", "")
    exclude_raw = params.get("exclude", "")
    sort_key = params.get("sortKey", "")
    sort_desc = params.get("sortDesc", False)
    prune = params.get("prune", False)

    # Parse filter/exclude
    filter_cond = _parse_simple(filter_raw)
    exclude_cond = _parse_simple(exclude_raw)

    nodes = _apply_filter(nodes, filter_cond)
    nodes = _apply_exclude(nodes, exclude_cond)
    nodes = _apply_sort(nodes, sort_key, sort_desc)
    if prune:
        nodes = _prune_orphans(nodes, edges)

    # Filter edges to remaining nodes
    remaining = {n["id"] for n in nodes}
    edges = [e for e in edges if e["fromNode"] in remaining and e["toNode"] in remaining]

    return {"nodes": nodes, "edges": edges}


def _parse_simple(raw: str) -> dict[str, Any]:
    """Parse key=value,key=value or key=val1|val2 format."""
    if not raw:
        return {}
    result: dict[str, Any] = {}
    for pair in raw.split(","):
        pair = pair.strip()
        if "=" not in pair:
            continue
        key, _, val = pair.partition("=")
        key = key.strip()
        val = val.strip().strip("\"'")
        if "|" in val:
            val = [v.strip() for v in val.split("|")]
        existing = result.get(key)
        if existing is not None:
            if isinstance(existing, list):
                if isinstance(val, list):
                    existing.extend(val)
                else:
                    existing.append(val)
            else:
                result[key] = [existing] + (val if isinstance(val, list) else [val])
        else:
            result[key] = val
    return result


# ═══════════════ HTTP Handler ═══════════════


class ViewerHandler(BaseHTTPRequestHandler):
    def do_GET(self):
        parsed = urlparse(self.path)
        path = parsed.path

        if path == "/" or path == "/index.html":
            self._serve_static("index.html", "text/html")
        elif path in ("/viewer.css", "/viewer.js"):
            ct = "text/css" if path.endswith(".css") else "application/javascript"
            self._serve_static(path.lstrip("/"), ct)
        elif path == "/api/data":
            self._serve_json({
                "nodes": FILE_NODES,
                "edges": ALL_EDGES,
                "vault": VAULT_CONTENT,
            })
        elif path == "/api/icon":
            qs = parse_qs(parsed.query)
            name = qs.get("name", [""])[0]
            self._serve_icon(name)
        elif path == "/api/typedefs":
            self._serve_typedefs()
        elif path.startswith("/api/nodeview/"):
            name = path.split("/api/nodeview/", 1)[1]
            self._serve_nodeview(name)
        else:
            self.send_error(404)

    def do_POST(self):
        if self.path == "/api/filter":
            length = int(self.headers.get("Content-Length", 0))
            body = self.rfile.read(length) if length > 0 else b"{}"
            params = json.loads(body.decode("utf-8"))
            result = run_filter(params)
            self._serve_json(result)
        else:
            self.send_error(404)

    def _serve_static(self, filename, content_type):
        fpath = Path(__file__).parent / filename
        if not fpath.is_file():
            self.send_error(404)
            return
        data = fpath.read_bytes()
        self.send_response(200)
        self.send_header("Content-Type", content_type + "; charset=utf-8")
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

    def _serve_icon(self, name):
        icon_path = Path(VAULT_PATH) / "_icons" / name
        if not icon_path.is_file() or ".." in name:
            self.send_error(404)
            return
        data = icon_path.read_bytes()
        self.send_response(200)
        self.send_header("Content-Type", "image/png")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def _serve_nodeview(self, name):
        nv_path = Path(VAULT_PATH) / "nodeview" / name
        if not nv_path.is_file() or ".." in name:
            self.send_error(404)
            return
        data = nv_path.read_bytes()
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def _serve_typedefs(self):
        import yaml
        td_path = Path(VAULT_PATH) / "_types" / "type_definitions.yml"
        if not td_path.is_file():
            self._serve_json({})
            return
        with open(td_path, "r", encoding="utf-8") as f:
            raw = yaml.safe_load(f) or {}
        self._serve_json(raw)

    def log_message(self, format, *args):
        print(f"[Viewer] {args[0]}")


def serve(vault_path: str, canvas_path: str, port: int = 8765) -> None:
    """Start the viewer HTTP server."""
    init_server(vault_path, canvas_path)
    server = HTTPServer(("127.0.0.1", port), ViewerHandler)
    print(f"\n[Viewer] Serving at http://127.0.0.1:{port}/")
    print(f"[Viewer] Vault: {vault_path}")
    print(f"[Viewer] Canvas: {canvas_path}")
    print(f"[Viewer] Nodes: {len(FILE_NODES)}, Edges: {len(ALL_EDGES)}")
    print(f"[Viewer] Press Ctrl+C to stop.\n")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\n[Viewer] Shutting down.")
        server.shutdown()
