import sys
import json  # built-in, always safe
import subprocess  # built-in, always safe


def healthcheck():
    result = {
        "python": {
            "version": sys.version,
            "executable": sys.executable,
        },
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


def healthcheck_venv():
    """Check that dependencies are installed and working."""

    result = {
        "python": {
            "executable": sys.executable,
            "version": sys.version,
        },
        "venv": {
            "active": hasattr(sys, "real_prefix")
            or (hasattr(sys, "base_prefix") and sys.base_prefix != sys.prefix),
            "prefix": getattr(
                sys, "prefix", None
            ),  # the current Python prefix (venv or system)
            "base_prefix": getattr(
                sys, "base_prefix", None
            ),  # the base/system Python prefix
        },
        "silero_vad": {
            "installed": False,
            "version": None,
            "model_loaded": False,
            "error": None,
        },
        "torch": {
            "installed": False,
            "version": None,
            "cuda_available": False,
            "cuda_version": None,
            "error": None,
        },
        "ok": False,
    }

    # Check Silero VAD
    try:
        from silero_vad import load_silero_vad, __version__ as silero_version

        result["silero_vad"]["installed"] = True
        result["silero_vad"]["version"] = silero_version

        # optional: try loading the model
        try:
            load_silero_vad()
            result["silero_vad"]["model_loaded"] = True
        except Exception as e:
            result["silero_vad"]["error"] = str(e)
    except Exception as e:
        result["silero_vad"]["error"] = str(e)

    try:
        import torch

        result["torch"]["installed"] = True
        result["torch"]["version"] = torch.__version__
        result["torch"]["cuda_available"] = torch.cuda.is_available()
        result["torch"]["cuda_version"] = torch.version.cuda  # type: ignore
    except Exception as e:
        result["torch"]["error"] = str(e)

    # Overall status
    result["ok"] = (
        result["venv"]["active"]
        and result["torch"]["installed"]
        and result["silero_vad"]["installed"]
        and result["silero_vad"]["model_loaded"]
    )
    print(json.dumps(result))


def silero(filename: str):
    from silero_vad import load_silero_vad, read_audio, get_speech_timestamps

    model = load_silero_vad()
    wav = read_audio(filename)
    speech_timestamps = get_speech_timestamps(wav, model, return_seconds=True)
    print(json.dumps(speech_timestamps))


def pip_list():
    # Run pip list from the currently active Python (venv or system)
    result = subprocess.run(
        [sys.executable, "-m", "pip", "list", "--format", "json"],
        capture_output=True,
        text=True,
    )
    print(result.stdout)


if __name__ == "__main__":
    cmd = sys.argv[1].lower()
    if cmd == "healthcheck":
        healthcheck()
    elif cmd == "healthcheck_venv":
        healthcheck_venv()
    elif cmd == "pip_list":
        pip_list()
    elif cmd == "silero":
        silero(sys.argv[2])
    else:
        raise Exception("Unknown command")
