import argparse
import hashlib
import json
from pathlib import Path, PurePosixPath
import re
import shutil
import subprocess
import tarfile
import tempfile
import tomllib

ROOT = Path(__file__).resolve().parents[1]
LOCK = ROOT / "integrations/litellm/source.lock.json"
MANIFEST = ROOT / "integrations/litellm/source.manifest.json"
TARGET = ROOT / "vendor/litellm"
POLICY = json.loads((ROOT / "integrations/litellm/import.json").read_text())


def git(*args, cwd=ROOT):
    return subprocess.check_output(["git", *args], cwd=cwd, text=True).strip()


def write_json(path, value):
    path.write_text(json.dumps(value, indent=2, sort_keys=True) + "\n")


def inventory(directory):
    result = {}
    for path in sorted(directory.rglob("*")):
        if "__pycache__" in path.parts or path.suffix == ".pyc":
            continue
        if path.is_symlink():
            raise ValueError(f"Source symlinks are not supported: {path}")
        if path.is_file():
            result[path.relative_to(directory).as_posix()] = {
                "sha256": hashlib.sha256(path.read_bytes()).hexdigest(),
                "mode": "100755" if path.stat().st_mode & 0o111 else "100644",
            }
    return result


def digest(files):
    return hashlib.sha256(json.dumps(files, sort_keys=True, separators=(",", ":")).encode()).hexdigest()


def inspect_source(lock):
    if lock.get("layout") != "vendored-backend" or (TARGET / ".git").exists():
        raise ValueError("Import the backend source as regular files first.")
    manifest = json.loads(MANIFEST.read_text())
    if manifest["commit"] != lock["commit"] or manifest["repository"] != lock["repository"]:
        raise ValueError("Source provenance differs from the lock.")
    files = inventory(TARGET)
    if not files or digest(files) != lock["contentSha256"] or len(files) != lock["fileCount"]:
        raise ValueError("Source content changed. Review git diff, then run npm run litellm:record.")
    upstream = manifest["upstreamFiles"]
    changed = sorted(p for p in files.keys() | upstream.keys() if files.get(p) != upstream.get(p))
    if len(changed) != lock["localPatchCount"]:
        raise ValueError("Recorded local patch count differs from the source.")
    if (TARGET / "LICENSE").read_text() != manifest["license"]:
        raise ValueError("Preserve the upstream LICENSE without edits.")
    return files, changed


def record(lock):
    manifest = json.loads(MANIFEST.read_text())
    if manifest["commit"] != lock["commit"] or manifest["repository"] != lock["repository"]:
        raise ValueError("Do not change source provenance when recording local edits.")
    files = inventory(TARGET)
    upstream = manifest["upstreamFiles"]
    if (TARGET / "LICENSE").read_text() != manifest["license"]:
        raise ValueError("Preserve the upstream LICENSE without edits.")
    lock.update(contentSha256=digest(files), fileCount=len(files),
                localPatchCount=sum(files.get(p) != upstream.get(p) for p in files.keys() | upstream.keys()))
    write_json(LOCK, lock)
    inspect_source(lock)


def import_source(lock, args):
    revision = args.revision or lock["commit"]
    if not re.fullmatch(r"[a-f0-9]{40}", revision):
        raise ValueError("Use a reviewed, full 40-character commit SHA.")
    repository = lock["repository"]
    if not re.fullmatch(r"https://github\.com/[A-Za-z0-9_.-]+/litellm\.git", repository):
        raise ValueError("Use the verified GitHub LiteLLM fork URL.")
    if args.command == "import" and MANIFEST.exists():
        _, patches = inspect_source(lock)
        if patches:
            raise ValueError("Local patches exist. Use the diff command and merge them explicitly before importing.")
        if git("status", "--porcelain", "--", "vendor/litellm"):
            raise ValueError("Commit source edits before importing an upstream update.")
    if args.command == "import" and (TARGET / ".git").exists():
        raise ValueError("Preserve the old submodule checkout outside vendor/litellm before importing.")
    with tempfile.TemporaryDirectory(prefix="neurofence-litellm-") as temporary:
        temp = Path(temporary)
        source = Path(args.source).resolve() if args.source else temp / "upstream"
        if not args.source:
            git("clone", "--filter=blob:none", "--no-checkout", "--depth=1", repository, str(source))
            git("fetch", "--depth=1", "origin", revision, cwd=source)
            git("sparse-checkout", "set", "litellm", "litellm-rust", ".cargo", "packaging", cwd=source)
            git("checkout", "--detach", revision, cwd=source)
        if git("rev-parse", f"{revision}^{{commit}}", cwd=source) != revision:
            raise ValueError("The requested source commit is unavailable.")
        paths = POLICY["include"] + [f":(exclude){p}" for p in POLICY["exclude"]]
        if args.command == "diff":
            git("fetch", "--depth=1", "origin", lock["commit"], cwd=source)
            patch = subprocess.check_output(["git", "diff", "--binary", lock["commit"], revision, "--", *paths], cwd=source)
            output = ROOT / ".runtime/litellm-upstream.patch"
            output.parent.mkdir(exist_ok=True)
            output.write_bytes(patch)
            print(f"Review {output}. Apply from a clean branch with git apply --3way --directory=vendor/litellm.")
            return
        archive = temp / "source.tar"
        git("archive", "--format=tar", f"--output={archive}", revision, "--", *paths, cwd=source)
        prepared = temp / "prepared"
        prepared.mkdir()
        with tarfile.open(archive) as tar:
            for member in tar:
                name = PurePosixPath(member.name)
                if name.is_absolute() or ".." in name.parts or not (member.isfile() or member.isdir()):
                    raise ValueError(f"Unsupported source archive entry: {member.name}")
                path = prepared.joinpath(*name.parts)
                if member.isdir():
                    path.mkdir(parents=True, exist_ok=True)
                    continue
                path.parent.mkdir(parents=True, exist_ok=True)
                with tar.extractfile(member) as content:
                    path.write_bytes(content.read())
                path.chmod(0o755 if member.mode & 0o111 else 0o644)
        files = inventory(prepared)
        license_text = (prepared / "LICENSE").read_text()
        if "MIT License" not in license_text or "Copyright (c) 2023 Berri AI" not in license_text:
            raise ValueError("Upstream license changed; review it before importing.")
        if TARGET.exists():
            if not MANIFEST.exists() and any(TARGET.iterdir()):
                raise ValueError("The source destination must be empty for its first import.")
            shutil.rmtree(TARGET)
        TARGET.parent.mkdir(exist_ok=True)
        shutil.move(str(prepared), TARGET)
        if git("ls-files", "--stage", "vendor/litellm").startswith("160000 "):
            git("rm", "--cached", "vendor/litellm")
        modules = ROOT / ".gitmodules"
        if modules.exists():
            git("config", "-f", ".gitmodules", "--remove-section", "submodule.vendor/litellm")
            if not modules.read_text().strip():
                modules.unlink()
        write_json(MANIFEST, {"repository": repository, "commit": revision, "license": license_text, "upstreamFiles": files})
        release = "v" + tomllib.loads((TARGET / "pyproject.toml").read_text())["project"]["version"]
        lock.update(layout="vendored-backend", release=release, commit=revision, contentSha256=digest(files),
                    fileCount=len(files), localPatchCount=0, forkStatus="created")
        if "image" in lock:
            lock["runtimeBaseImage"] = lock.pop("image")
        write_json(LOCK, lock)
        inspect_source(lock)
        print(f"Imported {len(files)} backend files at {revision}; SHA-256 {lock['contentSha256']}.")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("command", choices=["check", "record", "import", "diff"], nargs="?", default="check")
    parser.add_argument("--source")
    parser.add_argument("--revision")
    args = parser.parse_args()
    lock = json.loads(LOCK.read_text())
    if args.command == "check":
        files, patches = inspect_source(lock)
        print(f"LiteLLM {lock['release']}: {len(files)} tracked-source files, {len(patches)} local patches; {lock['commit']}.")
    elif args.command == "record":
        record(lock)
        print("Recorded reviewed local source edits; upstream provenance retained.")
    else:
        import_source(lock, args)


if __name__ == "__main__":
    try:
        main()
    except (ValueError, OSError, subprocess.CalledProcessError) as error:
        raise SystemExit(str(error)) from None
