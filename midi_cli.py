#!/usr/bin/env python3
"""
MIDImachine - Advanced MIDI CC Controller CLI

Features:
- Device enumeration and selection
- CC, Note, Program Change sending
- NRPN (Non-Registered Parameter Numbers)
- SysEx (System Exclusive) messages
- Preset save/load
- Script automation
- LFO modulation

Uses Windows WinMM API - no external dependencies.
"""

import argparse
import sys
import time
import json
import os
import threading
import ctypes
from ctypes import wintypes
from typing import List, Optional, Dict, Any
from pathlib import Path

# ============================================================================
# Windows Multimedia MIDI API
# ============================================================================

if sys.platform != 'win32':
    print("This version only supports Windows.")
    sys.exit(1)

winmm = ctypes.windll.winmm

CALLBACK_NULL = 0x00000000
MMSYSERR_NOERROR = 0

class MIDIOUTCAPS(ctypes.Structure):
    _fields_ = [
        ('wMid', wintypes.WORD),
        ('wPid', wintypes.WORD),
        ('vDriverVersion', wintypes.UINT),
        ('szPname', wintypes.WCHAR * 32),
        ('wTechnology', wintypes.WORD),
        ('wVoices', wintypes.WORD),
        ('wNotes', wintypes.WORD),
        ('wChannelMask', wintypes.WORD),
        ('dwSupport', wintypes.DWORD),
    ]

class MIDIINCAPS(ctypes.Structure):
    _fields_ = [
        ('wMid', wintypes.WORD),
        ('wPid', wintypes.WORD),
        ('vDriverVersion', wintypes.UINT),
        ('szPname', wintypes.WCHAR * 32),
        ('dwSupport', wintypes.DWORD),
    ]

class MIDIHDR(ctypes.Structure):
    pass

MIDIHDR._fields_ = [
    ('lpData', ctypes.POINTER(ctypes.c_char)),
    ('dwBufferLength', wintypes.DWORD),
    ('dwBytesRecorded', wintypes.DWORD),
    ('dwUser', wintypes.DWORD),
    ('dwFlags', wintypes.DWORD),
    ('lpNext', ctypes.POINTER(MIDIHDR)),
    ('reserved', wintypes.DWORD),
    ('dwOffset', wintypes.DWORD),
    ('dwReserved', wintypes.DWORD * 4),
]


def get_output_devices() -> List[str]:
    devices = []
    num_devices = winmm.midiOutGetNumDevs()
    for i in range(num_devices):
        caps = MIDIOUTCAPS()
        if winmm.midiOutGetDevCapsW(i, ctypes.byref(caps), ctypes.sizeof(caps)) == MMSYSERR_NOERROR:
            devices.append(caps.szPname)
    return devices


def get_input_devices() -> List[str]:
    devices = []
    num_devices = winmm.midiInGetNumDevs()
    for i in range(num_devices):
        caps = MIDIINCAPS()
        if winmm.midiInGetDevCapsW(i, ctypes.byref(caps), ctypes.sizeof(caps)) == MMSYSERR_NOERROR:
            devices.append(caps.szPname)
    return devices


class MidiOut:
    """MIDI Output device wrapper with full message support."""
    
    def __init__(self, device_id: int):
        self.device_id = device_id
        self.handle = wintypes.HANDLE()
        result = winmm.midiOutOpen(ctypes.byref(self.handle), device_id, 0, 0, CALLBACK_NULL)
        if result != MMSYSERR_NOERROR:
            raise RuntimeError(f"Failed to open MIDI device {device_id}, error: {result}")
    
    def close(self):
        if self.handle:
            winmm.midiOutClose(self.handle)
            self.handle = None
    
    def send_short(self, status: int, data1: int, data2: int):
        message = status | (data1 << 8) | (data2 << 16)
        winmm.midiOutShortMsg(self.handle, message)
    
    def send_cc(self, channel: int, cc: int, value: int):
        self.send_short(0xB0 | (channel & 0x0F), cc & 0x7F, value & 0x7F)
    
    def send_note_on(self, channel: int, note: int, velocity: int):
        self.send_short(0x90 | (channel & 0x0F), note & 0x7F, velocity & 0x7F)
    
    def send_note_off(self, channel: int, note: int, velocity: int = 0):
        self.send_short(0x80 | (channel & 0x0F), note & 0x7F, velocity & 0x7F)
    
    def send_program_change(self, channel: int, program: int):
        message = (0xC0 | (channel & 0x0F)) | ((program & 0x7F) << 8)
        winmm.midiOutShortMsg(self.handle, message)
    
    def send_pitch_bend(self, channel: int, value: int):
        """Send pitch bend. Value 0-16383, center = 8192."""
        lsb = value & 0x7F
        msb = (value >> 7) & 0x7F
        self.send_short(0xE0 | (channel & 0x0F), lsb, msb)
    
    def send_nrpn(self, channel: int, param: int, value: int):
        """Send NRPN (Non-Registered Parameter Number)."""
        param_msb = (param >> 7) & 0x7F
        param_lsb = param & 0x7F
        value_msb = (value >> 7) & 0x7F
        value_lsb = value & 0x7F
        
        self.send_cc(channel, 99, param_msb)  # NRPN MSB
        self.send_cc(channel, 98, param_lsb)  # NRPN LSB
        self.send_cc(channel, 6, value_msb)   # Data Entry MSB
        self.send_cc(channel, 38, value_lsb)  # Data Entry LSB
    
    def send_rpn(self, channel: int, param: int, value: int):
        """Send RPN (Registered Parameter Number)."""
        param_msb = (param >> 7) & 0x7F
        param_lsb = param & 0x7F
        value_msb = (value >> 7) & 0x7F
        value_lsb = value & 0x7F
        
        self.send_cc(channel, 101, param_msb)  # RPN MSB
        self.send_cc(channel, 100, param_lsb)  # RPN LSB
        self.send_cc(channel, 6, value_msb)    # Data Entry MSB
        self.send_cc(channel, 38, value_lsb)   # Data Entry LSB
    
    def send_sysex(self, data: bytes):
        """Send System Exclusive message."""
        # Ensure proper framing
        if not data.startswith(b'\xF0'):
            data = b'\xF0' + data
        if not data.endswith(b'\xF7'):
            data = data + b'\xF7'
        
        # Prepare buffer
        buffer = ctypes.create_string_buffer(data)
        header = MIDIHDR()
        header.lpData = ctypes.cast(buffer, ctypes.POINTER(ctypes.c_char))
        header.dwBufferLength = len(data)
        header.dwFlags = 0
        
        # Prepare and send
        winmm.midiOutPrepareHeader(self.handle, ctypes.byref(header), ctypes.sizeof(header))
        winmm.midiOutLongMsg(self.handle, ctypes.byref(header), ctypes.sizeof(header))
        time.sleep(0.01)  # Brief delay for transmission
        winmm.midiOutUnprepareHeader(self.handle, ctypes.byref(header), ctypes.sizeof(header))
    
    def __enter__(self):
        return self
    
    def __exit__(self, *args):
        self.close()


# ============================================================================
# CC Names Reference
# ============================================================================

CC_NAMES = {
    0: "Bank Select MSB", 1: "Modulation", 2: "Breath", 4: "Foot Controller",
    5: "Portamento Time", 7: "Volume", 10: "Pan", 11: "Expression",
    64: "Sustain", 65: "Portamento", 66: "Sostenuto", 67: "Soft Pedal",
    71: "Resonance", 72: "Release", 73: "Attack", 74: "Cutoff",
    91: "Reverb", 93: "Chorus", 120: "All Sound Off", 121: "Reset All",
    123: "All Notes Off",
}

def get_cc_name(cc: int) -> str:
    return CC_NAMES.get(cc, f"CC{cc}")


# ============================================================================
# Preset Management
# ============================================================================

PRESETS_DIR = Path(__file__).parent / "presets"


def ensure_presets_dir():
    PRESETS_DIR.mkdir(exist_ok=True)


def save_preset(name: str, data: Dict[str, Any]):
    """Save preset to JSON file."""
    ensure_presets_dir()
    filepath = PRESETS_DIR / f"{name}.json"
    with open(filepath, 'w') as f:
        json.dump(data, f, indent=2)
    print(f"💾 Saved preset: {filepath}")


def load_preset(name: str) -> Optional[Dict[str, Any]]:
    """Load preset from JSON file."""
    filepath = PRESETS_DIR / f"{name}.json"
    if filepath.exists():
        with open(filepath, 'r') as f:
            return json.load(f)
    return None


def list_presets() -> List[str]:
    """List available presets."""
    ensure_presets_dir()
    return [f.stem for f in PRESETS_DIR.glob("*.json")]


def apply_preset(device_id: int, channel: int, preset: Dict[str, Any]):
    """Apply preset to device."""
    with MidiOut(device_id) as midi:
        for key, value in preset.get('cc', {}).items():
            cc = int(key)
            midi.send_cc(channel - 1, cc, value)
            print(f"  CC{cc} = {value}")
            time.sleep(0.01)
        
        if 'program' in preset:
            midi.send_program_change(channel - 1, preset['program'])
            print(f"  Program = {preset['program']}")


# ============================================================================
# LFO Engine
# ============================================================================

class LFO:
    """Software LFO for continuous CC modulation."""
    
    def __init__(self, device_id: int, channel: int, cc: int, 
                 min_val: int, max_val: int, rate: float):
        self.device_id = device_id
        self.channel = channel
        self.cc = cc
        self.min_val = min_val
        self.max_val = max_val
        self.rate = rate  # Hz
        self.running = False
        self.thread = None
    
    def start(self):
        self.running = True
        self.thread = threading.Thread(target=self._run, daemon=True)
        self.thread.start()
        print(f"🌊 LFO started: CC{self.cc} [{self.min_val}-{self.max_val}] @ {self.rate}Hz")
    
    def stop(self):
        self.running = False
        if self.thread:
            self.thread.join(timeout=1)
        print(f"🛑 LFO stopped")
    
    def _run(self):
        period = 1.0 / self.rate
        step_time = 0.02  # 50 updates per cycle
        steps = int(period / step_time)
        
        with MidiOut(self.device_id) as midi:
            phase = 0
            while self.running:
                # Triangle wave
                if phase < 0.5:
                    t = phase * 2
                else:
                    t = 2 - phase * 2
                
                value = int(self.min_val + t * (self.max_val - self.min_val))
                midi.send_cc(self.channel - 1, self.cc, value)
                
                phase = (phase + 1.0 / steps) % 1.0
                time.sleep(step_time)


# Global LFO instance
active_lfo: Optional[LFO] = None


# ============================================================================
# Script Runner
# ============================================================================

def run_script(device_id: int, channel: int, filepath: str):
    """Run a script file with MIDI commands."""
    path = Path(filepath)
    if not path.exists():
        print(f"❌ Script not found: {filepath}")
        return
    
    print(f"📜 Running script: {filepath}")
    
    with open(path, 'r') as f:
        lines = f.readlines()
    
    with MidiOut(device_id) as midi:
        for i, line in enumerate(lines, 1):
            line = line.strip()
            
            # Skip comments and empty lines
            if not line or line.startswith('#'):
                continue
            
            try:
                parts = line.split()
                cmd = parts[0].lower()
                
                if cmd == 'cc':
                    cc, value = int(parts[1]), int(parts[2])
                    midi.send_cc(channel - 1, cc, value)
                    print(f"  [{i}] CC{cc} = {value}")
                
                elif cmd == 'note':
                    note, vel = int(parts[1]), int(parts[2])
                    dur = float(parts[3]) if len(parts) > 3 else 0.5
                    midi.send_note_on(channel - 1, note, vel)
                    time.sleep(dur)
                    midi.send_note_off(channel - 1, note)
                    print(f"  [{i}] Note {note} vel={vel}")
                
                elif cmd == 'pc':
                    prog = int(parts[1])
                    midi.send_program_change(channel - 1, prog)
                    print(f"  [{i}] Program = {prog}")
                
                elif cmd == 'nrpn':
                    param, value = int(parts[1]), int(parts[2])
                    midi.send_nrpn(channel - 1, param, value)
                    print(f"  [{i}] NRPN {param} = {value}")
                
                elif cmd == 'wait' or cmd == 'sleep':
                    delay = float(parts[1])
                    time.sleep(delay)
                    print(f"  [{i}] Wait {delay}s")
                
                elif cmd == 'channel':
                    channel = int(parts[1])
                    print(f"  [{i}] Channel = {channel}")
                
                else:
                    print(f"  [{i}] Unknown: {cmd}")
            
            except Exception as e:
                print(f"  [{i}] Error: {e}")
    
    print("✅ Script complete")


# ============================================================================
# CLI Interface
# ============================================================================

def print_devices():
    inputs = get_input_devices()
    outputs = get_output_devices()
    
    print("\n" + "=" * 60)
    print("  MIDI DEVICES")
    print("=" * 60)
    
    print("\n📥 INPUT:")
    for i, name in enumerate(inputs):
        print(f"   [{i}] {name}")
    if not inputs:
        print("   (none)")
    
    print("\n📤 OUTPUT:")
    for i, name in enumerate(outputs):
        print(f"   [{i}] {name}")
    if not outputs:
        print("   (none)")
    print()


def select_device() -> Optional[int]:
    outputs = get_output_devices()
    if not outputs:
        print("❌ No MIDI output devices found!")
        return None
    
    print("\n📤 OUTPUT DEVICES:")
    for i, name in enumerate(outputs):
        print(f"   [{i}] {name}")
    
    while True:
        try:
            choice = input("\nSelect device [0]: ").strip() or "0"
            idx = int(choice)
            if 0 <= idx < len(outputs):
                return idx
            print(f"Enter 0-{len(outputs)-1}")
        except ValueError:
            print("Enter a number")
        except KeyboardInterrupt:
            return None


def print_help():
    print("""
┌─────────────────────────────────────────────────────────────────────────┐
│  MIDIMACHINE COMMANDS                                                   │
├─────────────────────────────────────────────────────────────────────────┤
│  BASIC:                                                                 │
│    cc <cc#> <value>           Send Control Change                      │
│    note <note> <vel> [dur]    Send Note                                │
│    pc <program>               Program Change                           │
│    bend <0-16383>             Pitch Bend (8192=center)                 │
│                                                                         │
│  SHORTCUTS:                                                             │
│    cutoff/resonance/attack/release/volume/pan/mod <0-127>              │
│                                                                         │
│  ADVANCED:                                                              │
│    nrpn <param> <value>       Non-Registered Parameter (14-bit)        │
│    rpn <param> <value>        Registered Parameter                     │
│    sysex <F0 xx xx ... F7>    System Exclusive (hex bytes)             │
│                                                                         │
│  PRESETS:                                                               │
│    save <name>                Save current CC values                   │
│    load <name>                Load and apply preset                    │
│    presets                    List saved presets                       │
│                                                                         │
│  AUTOMATION:                                                            │
│    lfo <cc> <min> <max> <hz>  Start LFO modulation                     │
│    lfo stop                   Stop LFO                                 │
│    sweep <cc> <start> <end>   Sweep CC over 2 seconds                  │
│    script <file.txt>          Run command script                       │
│                                                                         │
│  SYSTEM:                                                                │
│    device                     Change MIDI device                       │
│    channel <1-16>             Set MIDI channel                         │
│    list                       List MIDI devices                        │
│    panic                      All Notes Off + Reset                    │
│    help                       This help                                │
│    quit                       Exit                                     │
└─────────────────────────────────────────────────────────────────────────┘
""")


def interactive_mode(initial_device: Optional[int] = None):
    global active_lfo
    
    print("\n" + "=" * 60)
    print("  MIDImachine v2.0 - MIDI CC Controller")
    print("  Type 'help' for commands")
    print("=" * 60)
    
    outputs = get_output_devices()
    device_id = initial_device if initial_device is not None else select_device()
    if device_id is None:
        return
    
    device_name = outputs[device_id] if device_id < len(outputs) else f"Device {device_id}"
    channel = 1
    current_cc = {}  # Track sent CC values for preset saving
    
    print(f"\n🎹 {device_name}")
    print(f"📺 Channel {channel}\n")
    
    while True:
        try:
            cmd = input(f"midi[ch{channel}]> ").strip()
            if not cmd:
                continue
            
            parts = cmd.split()
            action = parts[0].lower()
            
            # Exit
            if action in ('quit', 'exit', 'q'):
                if active_lfo:
                    active_lfo.stop()
                print("👋 Goodbye!")
                break
            
            # Help
            elif action == 'help':
                print_help()
            
            # List devices
            elif action == 'list':
                print_devices()
            
            # Change device
            elif action == 'device':
                if active_lfo:
                    active_lfo.stop()
                    active_lfo = None
                new_id = select_device()
                if new_id is not None:
                    device_id = new_id
                    outputs = get_output_devices()
                    device_name = outputs[device_id]
                    print(f"🎹 {device_name}")
            
            # Channel
            elif action == 'channel':
                if len(parts) >= 2:
                    ch = int(parts[1])
                    if 1 <= ch <= 16:
                        channel = ch
                        print(f"📺 Channel {channel}")
            
            # CC
            elif action == 'cc':
                if len(parts) >= 3:
                    cc, value = int(parts[1]), max(0, min(127, int(parts[2])))
                    with MidiOut(device_id) as m:
                        m.send_cc(channel - 1, cc, value)
                    current_cc[str(cc)] = value
                    print(f"✅ {get_cc_name(cc)} = {value}")
            
            # Shortcuts
            elif action in ('cutoff', 'brightness'):
                if len(parts) >= 2:
                    v = max(0, min(127, int(parts[1])))
                    with MidiOut(device_id) as m:
                        m.send_cc(channel - 1, 74, v)
                    current_cc['74'] = v
                    print(f"✅ Cutoff = {v}")
            
            elif action == 'resonance':
                if len(parts) >= 2:
                    v = max(0, min(127, int(parts[1])))
                    with MidiOut(device_id) as m:
                        m.send_cc(channel - 1, 71, v)
                    current_cc['71'] = v
                    print(f"✅ Resonance = {v}")
            
            elif action == 'attack':
                if len(parts) >= 2:
                    v = max(0, min(127, int(parts[1])))
                    with MidiOut(device_id) as m:
                        m.send_cc(channel - 1, 73, v)
                    current_cc['73'] = v
                    print(f"✅ Attack = {v}")
            
            elif action == 'release':
                if len(parts) >= 2:
                    v = max(0, min(127, int(parts[1])))
                    with MidiOut(device_id) as m:
                        m.send_cc(channel - 1, 72, v)
                    current_cc['72'] = v
                    print(f"✅ Release = {v}")
            
            elif action == 'volume':
                if len(parts) >= 2:
                    v = max(0, min(127, int(parts[1])))
                    with MidiOut(device_id) as m:
                        m.send_cc(channel - 1, 7, v)
                    current_cc['7'] = v
                    print(f"✅ Volume = {v}")
            
            elif action == 'pan':
                if len(parts) >= 2:
                    v = max(0, min(127, int(parts[1])))
                    with MidiOut(device_id) as m:
                        m.send_cc(channel - 1, 10, v)
                    current_cc['10'] = v
                    print(f"✅ Pan = {v}")
            
            elif action == 'mod':
                if len(parts) >= 2:
                    v = max(0, min(127, int(parts[1])))
                    with MidiOut(device_id) as m:
                        m.send_cc(channel - 1, 1, v)
                    current_cc['1'] = v
                    print(f"✅ Modulation = {v}")
            
            # Note
            elif action == 'note':
                if len(parts) >= 3:
                    note, vel = int(parts[1]), int(parts[2])
                    dur = float(parts[3]) if len(parts) > 3 else 0.5
                    with MidiOut(device_id) as m:
                        m.send_note_on(channel - 1, note, vel)
                        time.sleep(dur)
                        m.send_note_off(channel - 1, note)
                    print(f"✅ Note {note} vel={vel}")
            
            # Program Change
            elif action == 'pc':
                if len(parts) >= 2:
                    prog = int(parts[1])
                    with MidiOut(device_id) as m:
                        m.send_program_change(channel - 1, prog)
                    print(f"✅ Program = {prog}")
            
            # Pitch Bend
            elif action == 'bend':
                if len(parts) >= 2:
                    v = max(0, min(16383, int(parts[1])))
                    with MidiOut(device_id) as m:
                        m.send_pitch_bend(channel - 1, v)
                    print(f"✅ Pitch Bend = {v}")
            
            # NRPN
            elif action == 'nrpn':
                if len(parts) >= 3:
                    param, value = int(parts[1]), int(parts[2])
                    with MidiOut(device_id) as m:
                        m.send_nrpn(channel - 1, param, value)
                    print(f"✅ NRPN {param} = {value}")
            
            # RPN
            elif action == 'rpn':
                if len(parts) >= 3:
                    param, value = int(parts[1]), int(parts[2])
                    with MidiOut(device_id) as m:
                        m.send_rpn(channel - 1, param, value)
                    print(f"✅ RPN {param} = {value}")
            
            # SysEx
            elif action == 'sysex':
                if len(parts) >= 2:
                    hex_str = ''.join(parts[1:])
                    data = bytes.fromhex(hex_str.replace('0x', '').replace(',', ''))
                    with MidiOut(device_id) as m:
                        m.send_sysex(data)
                    print(f"✅ SysEx sent ({len(data)} bytes)")
            
            # Sweep
            elif action == 'sweep':
                if len(parts) >= 4:
                    cc, start, end = int(parts[1]), int(parts[2]), int(parts[3])
                    dur = float(parts[4]) if len(parts) > 4 else 2.0
                    steps = abs(end - start)
                    if steps > 0:
                        delay = dur / steps
                        direction = 1 if end > start else -1
                        print(f"🎚️ Sweeping CC{cc} {start}→{end}...")
                        with MidiOut(device_id) as m:
                            for v in range(start, end + direction, direction):
                                m.send_cc(channel - 1, cc, v)
                                time.sleep(delay)
                        print("✅ Sweep complete")
            
            # LFO
            elif action == 'lfo':
                if len(parts) >= 2 and parts[1].lower() == 'stop':
                    if active_lfo:
                        active_lfo.stop()
                        active_lfo = None
                elif len(parts) >= 5:
                    if active_lfo:
                        active_lfo.stop()
                    cc = int(parts[1])
                    min_v, max_v = int(parts[2]), int(parts[3])
                    rate = float(parts[4])
                    active_lfo = LFO(device_id, channel, cc, min_v, max_v, rate)
                    active_lfo.start()
                else:
                    print("Usage: lfo <cc> <min> <max> <hz>  or  lfo stop")
            
            # Presets
            elif action == 'save':
                if len(parts) >= 2:
                    name = parts[1]
                    preset = {'cc': current_cc, 'channel': channel}
                    save_preset(name, preset)
            
            elif action == 'load':
                if len(parts) >= 2:
                    name = parts[1]
                    preset = load_preset(name)
                    if preset:
                        print(f"📂 Loading preset: {name}")
                        apply_preset(device_id, channel, preset)
                        current_cc.update(preset.get('cc', {}))
                        print("✅ Preset applied")
                    else:
                        print(f"❌ Preset not found: {name}")
            
            elif action == 'presets':
                names = list_presets()
                if names:
                    print("📂 Saved presets:")
                    for n in names:
                        print(f"   • {n}")
                else:
                    print("No presets saved yet")
            
            # Script
            elif action == 'script':
                if len(parts) >= 2:
                    run_script(device_id, channel, parts[1])
            
            # Panic
            elif action == 'panic':
                with MidiOut(device_id) as m:
                    m.send_cc(channel - 1, 123, 0)
                    m.send_cc(channel - 1, 121, 0)
                    m.send_cc(channel - 1, 120, 0)
                print("🛑 PANIC: All notes off")
            
            else:
                print(f"Unknown: {action}. Type 'help'")
        
        except ValueError as e:
            print(f"Invalid number: {e}")
        except KeyboardInterrupt:
            if active_lfo:
                active_lfo.stop()
            print("\n👋 Goodbye!")
            break
        except Exception as e:
            print(f"Error: {e}")


def main():
    parser = argparse.ArgumentParser(description='MIDImachine - MIDI CC Controller')
    parser.add_argument('--list', '-l', action='store_true', help='List MIDI devices')
    parser.add_argument('--device', '-d', type=int, help='Device index')
    parser.add_argument('--channel', '-c', type=int, default=1, help='MIDI channel')
    parser.add_argument('--cc', type=int, help='CC number')
    parser.add_argument('--value', '-v', type=int, help='CC value')
    
    args = parser.parse_args()
    
    if args.list:
        print_devices()
        return
    
    if args.device is not None and args.cc is not None and args.value is not None:
        with MidiOut(args.device) as m:
            m.send_cc(args.channel - 1, args.cc, args.value)
        print(f"✅ {get_cc_name(args.cc)} = {args.value}")
        return
    
    interactive_mode(args.device)


if __name__ == '__main__':
    main()
