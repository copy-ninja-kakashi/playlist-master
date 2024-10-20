import os
import librosa
import soundfile as sf
import numpy as np
import matplotlib.pyplot as plt
import librosa.display
from tqdm import tqdm
import subprocess
from multiprocessing import cpu_count
from tqdm.contrib.concurrent import process_map
import gc

# Set matplotlib to use 'Agg' backend
plt.switch_backend('agg')




# 1. Audio trimming function
def trim_audio(audio_path, temp_dir, target_sr=22050):
    try:
        y, sr = librosa.load(audio_path, sr=None)  # Keep original sample rate
        if sr != target_sr:
            y = librosa.resample(y, orig_sr=sr, target_sr=target_sr)
            sr = target_sr
        y_trimmed, _ = librosa.effects.trim(y, top_db=20)
        trimmed_audio_path = os.path.join(temp_dir, f"trimmed_{os.path.basename(audio_path)}")
        sf.write(trimmed_audio_path, y_trimmed, sr)

        if not os.path.exists(trimmed_audio_path):
            raise ValueError(f"Trimmed audio file not created at {trimmed_audio_path}")
        
        return trimmed_audio_path

    except Exception as e:
        print(f"Error in trimming audio: {e}")
        return None


# 2. Audio normalization function using FFmpeg
def normalize_audio(filepath):
    FFMPEG_PATH = os.path.join(os.path.dirname(__file__), 'ffmpeg')  # Ensure this is correct

    try:
        normalized_filepath = os.path.join(os.path.dirname(filepath), "normalized_" + os.path.basename(filepath))
        command = [
            FFMPEG_PATH,
            "-i", filepath,
            "-af", "loudnorm=I=-16:TP=-1.5:LRA=11",
            "-ar", "22050",
            normalized_filepath
        ]
        result = subprocess.run(command, check=False, capture_output=True)
        if result.returncode != 0:
            print(f"FFmpeg error: {result.stderr.decode()}")
            return None

        return normalized_filepath

    except Exception as e:
        print(f"Error in normalization: {e}")
        return None
# 3. Segmenting audio by tempo (based on bars)
def segment_audio_by_tempo(audio, sr, tempo, bars=4, time_signature=4):
    beats_per_second = tempo / 60
    duration_of_one_bar = time_signature / beats_per_second
    segment_length = int(bars * duration_of_one_bar * sr)

    segments = [audio[i:i + segment_length] for i in range(0, len(audio), segment_length)]
    return segments

# 4. Convert segments to Mel-Spectrogram
def convert_to_melspectrogram(segment, sr, output_file):
    mel_spectrogram = librosa.feature.melspectrogram(y=segment, sr=sr, n_fft=2048, hop_length=512, n_mels=128)
    mel_spectrogram_db = librosa.power_to_db(mel_spectrogram, ref=np.max)

    plt.figure(figsize=(10, 4))
    librosa.display.specshow(mel_spectrogram_db, sr=sr, hop_length=512, x_axis='time', y_axis='mel')
    plt.colorbar(format='%+2.0f dB')
    plt.title('Mel-Spectrogram')
    plt.tight_layout()
    plt.savefig(output_file)
    plt.close()

# 5. Processing pipeline: Trim, Normalize, Segment, and Convert to Mel-Spectrogram
def process_audio_file_pipeline(file_path, output_directory):
    try:
        # Step 1: Trim the audio
        trimmed_file = trim_audio(file_path)

        # Step 2: Normalize the audio
        normalized_file = normalize_audio(trimmed_file)

        # Step 3: Load normalized audio
        audio, sr = librosa.load(normalized_file, sr=22050)

        # Step 4: Estimate tempo and segment the audio
        tempo, _ = librosa.beat.beat_track(y=audio, sr=sr)
        segments = segment_audio_by_tempo(audio, sr, tempo)

        # Step 5: Convert each segment to Mel-Spectrogram and save
        for i, segment in enumerate(segments):
            output_file = os.path.join(output_directory, f'{os.path.splitext(os.path.basename(file_path))[0]}_segment_{i+1}.png')
            convert_to_melspectrogram(segment, sr, output_file)

        # Remove normalized file after processing
        os.remove(normalized_file)

        # Clear memory
        gc.collect()

    except Exception as e:
        print(f"Error processing {file_path}: {e}")

def process_directory(input_directory, output_directory):
    # Collect all FLAC files
    flac_files = [os.path.join(root, file)
                  for root, dirs, files in os.walk(input_directory)
                  for file in files if file.endswith('.flac')]

    # Process files sequentially
    for file in flac_files:
        process_audio_file_pipeline(file, output_directory)
        print(f"Processed: {file}")



if __name__ == "__main__":
    # Set the input directory and output directory
    input_directory = '/Users/zhangkaihuai/Downloads/test data song'
    output_directory = '/Users/zhangkaihuai/Downloads/test data song1'

    # Process the directory
    process_directory(input_directory, output_directory)
