"""Package current deliverables and a filtered working-tree snapshot (stdlib only)."""

import hashlib
import json
from pathlib import Path, PurePosixPath
import subprocess
from datetime import datetime, timezone, timedelta
import zipfile


ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "submission"
BLOCKED_DIRS = {
    ".git", ".agents", ".codex", ".aws", ".tmp", "node_modules", "target",
    ".next", ".next-e2e", "dist", "build", ".gradle", ".idea", ".vscode",
    "coverage", "test-results", "playwright-report", "submission", "output",
}
BLOCKED_SUFFIXES = {
    ".pem", ".key", ".p12", ".pfx", ".jks", ".keystore", ".log", ".dump",
    ".sqlite", ".sqlite3", ".bson", ".zip", ".exe", ".jar", ".apk", ".aab",
    ".tsbuildinfo", ".pdf", ".tex",
}


def git(*args):
    return subprocess.check_output(["git", *args], cwd=ROOT)


def source_allowed(name):
    p = PurePosixPath(name)
    if set(p.parts) & BLOCKED_DIRS or p.suffix.lower() in BLOCKED_SUFFIXES:
        return False
    if p.name.startswith(".env") and not p.name.endswith(".example"):
        return False
    if p.name.startswith(("client_secret", "hs_err_pid")):
        return False
    if p.name == "google-oauth-local.json" or p.name.startswith("BAO_CAO_"):
        return False
    return True


def main():
    now = datetime.now(timezone(timedelta(hours=7)))
    destination = OUT / f"Dike_Submission_{now:%Y-%m-%d}.zip"
    files = {}

    def add(path, archive_name):
        if not path.is_file() or path.is_symlink():
            raise RuntimeError(f"Missing file or symbolic link: {path}")
        path.resolve().relative_to(ROOT)
        files[archive_name] = path

    add(OUT / "README.md", "README.md")
    for name in ["Dike.pdf", "Dike_Web.pdf", "Dike_Mobile.pdf",
                 "BAO_CAO_CUOI_KY_IEEE.tex", "BAO_CAO_WEB_IEEE.tex",
                 "BAO_CAO_MOBILE_IEEE.tex", "BAO_CAO_CUOI_KY_WEB_BACKEND.md"]:
        add(ROOT / name, f"01-report/{name}")
    add(OUT / "TESTING.md", "02-testing/TESTING.md")
    for path in sorted((OUT / "evidence").iterdir()):
        if path.suffix in {".md", ".log", ".json"}:
            add(path, f"02-testing/evidence/{path.name}")
    add(OUT / "DEPLOYMENT.md", "03-deployment/DEPLOYMENT.md")
    names = git("ls-files", "-z", "--cached", "--others", "--exclude-standard")
    for name in sorted(set(names.decode("utf-8").split("\0")) - {""}):
        path = ROOT / name
        if source_allowed(name) and path.is_file() and not path.is_symlink():
            add(path, f"04-source/{name}")

    manifest = {
        "prepared_at": now.isoformat(),
        "repository": "https://github.com/hlqkhanh/Dike-v2",
        "head": git("rev-parse", "HEAD").decode().strip(),
        "branch": git("branch", "--show-current").decode().strip(),
        "snapshot": "working tree including tracked edits and non-ignored new files",
        "git_status": git("status", "--porcelain").decode("utf-8"),
        "files": {},
    }
    # Read once so the recorded hashes match the bytes written to the archive.
    with zipfile.ZipFile(destination, "w", zipfile.ZIP_DEFLATED) as archive:
        for name, path in sorted(files.items()):
            data = path.read_bytes()
            archive.writestr(name, data)
            manifest["files"][name] = {
                "bytes": len(data), "sha256": hashlib.sha256(data).hexdigest()
            }
        archive.writestr("MANIFEST.json", json.dumps(manifest, ensure_ascii=False, indent=2))
    with zipfile.ZipFile(destination) as archive:
        if archive.testzip() is not None:
            raise RuntimeError("ZIP integrity check failed")
        for name, record in manifest["files"].items():
            if hashlib.sha256(archive.read(name)).hexdigest() != record["sha256"]:
                raise RuntimeError(f"Hash mismatch: {name}")
    print(f"Created: {destination}")
    print(f"Files: {len(files) + 1}; bytes: {destination.stat().st_size}")


if __name__ == "__main__":
    main()
