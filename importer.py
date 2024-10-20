import os
import sys
import json
import librosa
import numpy as np
import joblib
import tensorflow as tf
from collections import defaultdict
from collections import Counter
import warnings
import time
import subprocess
import soundfile as sf

warnings.filterwarnings("ignore")

# Get the directory of the current script
base_dir = os.path.dirname(os.path.abspath(__file__))

# Load models and scaler using relative paths
cnn_model = tf.keras.models.load_model(os.path.join(base_dir, 'cnn_model.h5'))
svm = joblib.load(os.path.join(base_dir, 'svm_model.pkl'))
scaler = joblib.load(os.path.join(base_dir, 'scaler.pkl'))
label_encoder = joblib.load(os.path.join(base_dir, 'label_encoder.pkl'))

# Chroma to musical key mapping
chroma_to_key = ['C', 'C# / D♭', 'D', 'D# / E♭', 'E', 'F', 'F# / G♭', 'G', 'G# / A♭', 'A', 'A# / B♭', 'B']

def trim_audio(audio_path, target_sr=22050):
    try:
        y, sr = librosa.load(audio_path, sr=None)  # Keep original sample rate
        if sr != target_sr:
            y = librosa.resample(y, orig_sr=sr, target_sr=target_sr)
            sr = target_sr
        y_trimmed, _ = librosa.effects.trim(y, top_db=20)
        
        # Use directory of audio_path to create the new trimmed file path
        trimmed_audio_path = os.path.join(os.path.dirname(audio_path), f"trimmed_{os.path.basename(audio_path)}")
        
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
        if filepath is None:
            raise ValueError("Invalid file path provided for normalization")

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

# Function to extract mel spectrogram for a new audio file
def extract_mel_spectrogram(file_path):
    try:
        y, sr = librosa.load(file_path)
        
        # Set n_mels to 128 to ensure the feature dimension matches what the scaler expects
        mel_spectrogram = librosa.feature.melspectrogram(y=y, sr=sr, n_mels=128)
        mel_spectrogram_db = librosa.power_to_db(mel_spectrogram, ref=np.max)
        return mel_spectrogram_db
    except Exception as e:
        print(f"Error extracting mel spectrogram: {e}")
        return None
    
# Resize mel-spectrogram for CNN and ensure correct scaling for SVM
# Function to predict genres for audio files
def predict_genres(file_path):
    mel_spectrogram = extract_mel_spectrogram(file_path)
    if mel_spectrogram is not None:
        mel_spectrogram = np.resize(mel_spectrogram, (128, 128))  # Ensure correct shape
        mel_spectrogram = mel_spectrogram[np.newaxis, ..., np.newaxis]  # Add batch and channel dimensions
        prediction = cnn_model.predict(mel_spectrogram, verbose=0)
        genre_index = np.argmax(prediction)
        genre = label_encoder.inverse_transform([genre_index])[0]
        return genre
    return "Unknown"  # Return "Unknown" if no valid features are extracted



# Function to get key and tempo
def get_key_and_tempo(file_path):
    try:
        y, sr = librosa.load(file_path)
        tempo, _ = librosa.beat.beat_track(y=y, sr=sr)
        chroma = librosa.feature.chroma_cqt(y=y, sr=sr)
        key_index = int(librosa.feature.chroma_cens(y=y, sr=sr).mean(axis=1).argmax())
        musical_key = chroma_to_key[key_index]
        return musical_key, int(tempo)
    except Exception as e:
        print(f"Error getting key and tempo: {e}")
        return None, None

# Integrate preprocessing from the first script
def process_audio_file_pipeline(file_path, output_directory):
    # Trim, Normalize, and Save the processed audio to a temporary path
    trimmed_file = trim_audio(file_path)
    normalized_file = normalize_audio(trimmed_file)
    
    # Return the path of the normalized file for further processing
    return trimmed_file, normalized_file

def get_song_list(directory):
    return [f for f in os.listdir(directory) if f.lower().endswith('.flac')]

# Main execution
if __name__ == '__main__':
    if len(sys.argv) < 2:
        sys.stderr.write("Error: No directory provided.\n")
        sys.exit(1)

    directory = sys.argv[1]
    songs = get_song_list(directory)
    
    if not songs:
        sys.stderr.write("No songs found in the directory.\n")
        sys.exit(1)

    song_data = []
    progress_updates = []  # List to accumulate progress updates

    # Process each song
    for index, song in enumerate(songs):
        file_path = os.path.join(directory, song)
        
        # Preprocess audio
        trimmed_file, normalized_file = process_audio_file_pipeline(file_path, directory)

        # Now predict genre and get key and tempo using the normalized audio file
        if normalized_file:
            key, tempo = get_key_and_tempo(normalized_file)
            predicted_genre = predict_genres(normalized_file)

            if key is not None and tempo is not None:
                song_data.append({
                    'name': song,
                    'key': key,
                    'tempo': tempo,
                    'genre': predicted_genre,
                    'file_path': file_path  # Include the file path in the output
                })

            # Delete the normalized file after processing
            try:
                time.sleep(1)
                os.remove(normalized_file)
                os.remove(trimmed_file)
            except Exception as e:
                print(f"Error deleting the file {normalized_file}: {e}")

            # Report progress
            progress = (index + 1) / len(songs) * 100  # Calculate progress percentage
            progress_updates.append({'progress': progress})

    # Output the final data as a single JSON object
    output = {
        'progress_updates': progress_updates,
        'song_data': song_data
    }
    print(json.dumps(output, indent=2))
