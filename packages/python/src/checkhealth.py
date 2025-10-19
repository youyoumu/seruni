import sys
import json

result = {
    "python_version": sys.version,
    "python_executable": sys.executable,
    "pip": {"available": False, "version": None, "error": None},
    "uv": {"installed": False, "version": None, "error": None},
    "ok": False,
}

# Check pip
try:
    import pip  # type: ignore

    result["pip"]["available"] = True
    result["pip"]["version"] = pip.__version__
except Exception as e:
    result["pip"]["error"] = str(e)


# Check if uv is importable
try:
    import uv  # type: ignore

    result["uv"]["installed"] = True
    result["uv"]["version"] = getattr(uv, "__version__", None)
except Exception as e:
    if result["uv"]["error"] is None:
        result["uv"]["error"] = str(e)

# Overall status
result["ok"] = result["pip"]["available"] and result["uv"]["installed"]

print(json.dumps(result))
