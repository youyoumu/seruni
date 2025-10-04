from silero_vad import load_silero_vad, read_audio, get_speech_timestamps
import os

filename = os.path.join(os.path.dirname(__file__), "sample.wav")
print(f"DEBUG[670]: filename={filename}")

model = load_silero_vad()
wav = read_audio(filename)
speech_timestamps = get_speech_timestamps(
    wav,
    model,
    return_seconds=True,  # Return speech timestamps in seconds (default is samples)
)
print(speech_timestamps)
