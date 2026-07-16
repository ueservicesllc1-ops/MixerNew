import subprocess
import os
import wave

def pull_and_analyze():
    adb_path = r"C:\Users\Freedom Labs\AppData\Local\Android\Sdk\platform-tools\adb.exe"
    cmd = [adb_path, "exec-out", "run-as", "com.zionstagelive.app", "cat", "files/iRFVmGvkUVvrW16Yw4gP_GE.mp3"]
    print("Pulling file from device...")
    try:
        data = subprocess.check_output(cmd)
    except Exception as e:
        print(f"Error running adb: {e}")
        return
    
    print(f"Pulled {len(data)} bytes.")
    if len(data) == 0:
        print("Empty file retrieved.")
        return
        
    local_path = "scratch/ge_real.wav"
    with open(local_path, "wb") as f:
        f.write(data)
    print(f"Saved to {local_path}.")
    
    # Try parsing with wave module
    try:
        with wave.open(local_path, "rb") as w:
            print("Wave file parsed successfully by Python wave module!")
            print(f"  Channels: {w.getnchannels()}")
            print(f"  Sample width: {w.getsampwidth()} bytes ({w.getsampwidth()*8} bits)")
            print(f"  Frame rate (Sample rate): {w.getframerate()} Hz")
            print(f"  Number of frames: {w.getnframes()}")
            print(f"  Duration: {w.getnframes() / w.getframerate()} seconds")
    except Exception as e:
        print(f"Python wave module failed to parse: {e}")

if __name__ == '__main__':
    pull_and_analyze()
