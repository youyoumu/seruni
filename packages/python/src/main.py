import typer
import json
from silero_vad import load_silero_vad, read_audio, get_speech_timestamps

app = typer.Typer()


@app.command()
def detect(filename: str):
    """Detect speech timestamps from an audio file."""
    model = load_silero_vad()
    wav = read_audio(filename)
    speech_timestamps = get_speech_timestamps(wav, model, return_seconds=True)
    print(json.dumps(speech_timestamps))  # easy for Node to parse


if __name__ == "__main__":
    app()
