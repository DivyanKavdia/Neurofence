import json
import os
from pathlib import Path
import sys
import tomllib

ROOT = Path(__file__).resolve().parents[2]
SOURCE = ROOT / "vendor/litellm"
os.environ.setdefault("LITELLM_LOCAL_MODEL_COST_MAP", "True")
os.environ.setdefault("PYTHONDONTWRITEBYTECODE", "1")
os.environ["LITELLM_RUST"] = "false"
sys.dont_write_bytecode = True
sys.path.insert(0, str(ROOT / "scripts"))
from litellm_source import inspect_source

lock = json.loads((ROOT / "integrations/litellm/source.lock.json").read_text())
inspect_source(lock)
sys.path.insert(0, str(SOURCE))
import litellm

if Path(litellm.__file__).resolve() != SOURCE / "litellm/__init__.py":
    raise SystemExit("LiteLLM must load from Neurofence's tracked backend source.")
version = tomllib.loads((SOURCE / "pyproject.toml").read_text())["project"]["version"]
if version != lock["release"].removeprefix("v"):
    raise SystemExit("Imported source release differs from its lock.")
if sys.argv[1:] == ["--check-source"]:
    print(json.dumps({"sourceDirectory": str(SOURCE), "version": version,
                      "sourceSha256": lock["contentSha256"], "localPatchCount": lock["localPatchCount"]}))
else:
    litellm.run_server()
