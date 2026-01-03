#!/usr/bin/env python3
"""
MIDImachine - CLI tool for MIDI device control via CC messages.

Uses Windows Multimedia API (WinMM) directly via ctypes.
No external dependencies required on Windows!

Usage:
    python midi_cli.py                    # Interactive mode
    python midi_cli.py --list             # List devices only
    python midi_cli.py --device 0 --cc 74 --value 64  # Direct send
"""

import argparse
import sys
import time
import ctypes
from ctypes import wintypes
from typing import List, Optional, Tuple

# ============================================================================
# Windows Multimedia MIDI API via ctypes
# ============================================================================

# Check if we're on Windows
if sys.platform != 'win32':
    print("This version only supports Windows. For cross-platform, install mido.")
    sys.exit(1)

winmm = ctypes.windll.winmm

# MIDI Out functions
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


def get_output_devices() -> List[str]:
    """Get list of MIDI output device names."""
    devices = []
    num_devices = winmm.midiOutGetNumDevs()
    
    for i in range(num_devices):
        caps = MIDIOUTCAPS()
        result = winmm.midiOutGetDevCapsW(i, ctypes.byref(caps), ctypes.sizeof(caps))
        if result == MMSYSERR_NOERROR:
            devices.append(caps.szPname)
    
    return devices


def get_input_devices() -> List[str]:
    """Get list of MIDI input device names."""
    devices = []
    num_devices = winmm.midiInGetNumDevs()
    
    for i in range(num_devices):
        caps = MIDIINCAPS()
        result = winmm.midiInGetDevCapsW(i, ctypes.byref(caps), ctypes.sizeof(caps))
        if result == MMSYSERR_NOERROR:
            devices.append(caps.szPname)
    
    return devices


class MidiOut:
    """MIDI Output device wrapper."""
    
    def __init__(self, device_id: int):
        self.device_id = device_id
        self.handle = wintypes.HANDLE()
        
        result = winmm.midiOutOpen(
            ctypes.byref(self.handle),
            device_id,
            0,
            0,
            CALLBACK_NULL
        )
        
        if result != MMSYSERR_NOERROR:
            raise RuntimeError(f"Failed to open MIDI device {device_id}, error: {result}")
    
    def close(self):
        """Close the MIDI device."""
        if self.handle:
            winmm.midiOutClose(self.handle)
            self.handle = None
    
    def send_short(self, status: int, data1: int, data2: int):
        """
        Send a short MIDI message (3 bytes).
        
        Args:
            status: Status byte (command + channel)
            data1: First data byte
            data2: Second data byte
        """
        # Pack into DWORD: byte0 | (byte1 << 8) | (byte2 << 16)
        message = status | (data1 << 8) | (data2 << 16)
        result = winmm.midiOutShortMsg(self.handle, message)
        
        if result != MMSYSERR_NOERROR:
            raise RuntimeError(f"Failed to send MIDI message, error: {result}")
    
    def send_cc(self, channel: int, cc: int, value: int):
        """Send Control Change message."""
        # CC status byte: 0xB0 + channel (0-15)
        status = 0xB0 | (channel & 0x0F)
        self.send_short(status, cc & 0x7F, value & 0x7F)
    
    def send_note_on(self, channel: int, note: int, velocity: int):
        """Send Note On message."""
        status = 0x90 | (channel & 0x0F)
        self.send_short(status, note & 0x7F, velocity & 0x7F)
    
    def send_note_off(self, channel: int, note: int, velocity: int = 0):
        """Send Note Off message."""
        status = 0x80 | (channel & 0x0F)
        self.send_short(status, note & 0x7F, velocity & 0x7F)
    
    def send_program_change(self, channel: int, program: int):
        """Send Program Change message."""
        status = 0xC0 | (channel & 0x0F)
        # Program change only has one data byte
        message = status | ((program & 0x7F) << 8)
        winmm.midiOutShortMsg(self.handle, message)
    
    def __enter__(self):
        return self
    
    def __exit__(self, *args):
        self.close()


# ============================================================================
# MIDI CC Reference
# ============================================================================

CC_NAMES = {
    0: "Bank Select MSB",
    1: "Modulation Wheel",
    2: "Breath Controller",
    4: "Foot Controller",
    5: "Portamento Time",
    7: "Volume",
    10: "Pan",
    11: "Expression",
    64: "Sustain Pedal",
    65: "Portamento On/Off",
    66: "Sostenuto",
    67: "Soft Pedal",
    68: "Legato Footswitch",
    71: "Resonance (Filter Q)",
    72: "Release Time",
    73: "Attack Time",
    74: "Brightness (Filter Cutoff)",
    75: "Decay Time",
    76: "Vibrato Rate",
    77: "Vibrato Depth",
    78: "Vibrato Delay",
    91: "Reverb Level",
    93: "Chorus Level",
    94: "Detune",
    95: "Phaser Level",
    120: "All Sound Off",
    121: "Reset All Controllers",
    123: "All Notes Off",
}


def get_cc_name(cc: int) -> str:
    return CC_NAMES.get(cc, f"CC {cc}")


# ============================================================================
# CLI Functions
# ============================================================================

def print_devices():
    """Print formatted list of MIDI devices."""
    inputs = get_input_devices()
    outputs = get_output_devices()
    
    print("\n" + "=" * 60)
    print("  MIDI DEVICES")
    print("=" * 60)
    
    print("\n📥 INPUT DEVICES:")
    if inputs:
        for i, name in enumerate(inputs):
            print(f"   [{i}] {name}")
    else:
        print("   (none found)")
    
    print("\n📤 OUTPUT DEVICES:")
    if outputs:
        for i, name in enumerate(outputs):
            print(f"   [{i}] {name}")
    else:
        print("   (none found)")
    
    print()


def select_output_device() -> Optional[int]:
    """Interactive device selection."""
    outputs = get_output_devices()
    
    if not outputs:
        print("❌ No MIDI output devices found!")
        return None
    
    print("\n📤 OUTPUT DEVICES:")
    for i, name in enumerate(outputs):
        print(f"   [{i}] {name}")
    print()
    
    while True:
        try:
            choice = input("Select output device [0]: ").strip()
            if choice == "":
                choice = "0"
            idx = int(choice)
            if 0 <= idx < len(outputs):
                return idx
            print(f"Invalid selection. Enter 0-{len(outputs)-1}")
        except ValueError:
            print("Enter a number.")
        except KeyboardInterrupt:
            return None


def send_cc(device_id: int, channel: int, cc: int, value: int) -> bool:
    """Send a MIDI CC message."""
    try:
        with MidiOut(device_id) as midi:
            midi.send_cc(channel - 1, cc, value)  # Convert ch 1-16 to 0-15
            print(f"✅ Sent: Ch{channel} {get_cc_name(cc)} = {value}")
            return True
    except Exception as e:
        print(f"❌ Error: {e}")
        return False


def send_note(device_id: int, channel: int, note: int, velocity: int, duration: float = 0.5) -> bool:
    """Send note on/off pair."""
    try:
        with MidiOut(device_id) as midi:
            midi.send_note_on(channel - 1, note, velocity)
            time.sleep(duration)
            midi.send_note_off(channel - 1, note)
            print(f"✅ Sent: Ch{channel} Note {note} vel={velocity}")
            return True
    except Exception as e:
        print(f"❌ Error: {e}")
        return False


def sweep_cc(device_id: int, channel: int, cc: int, start: int, end: int, duration: float = 2.0):
    """Sweep a CC value."""
    steps = abs(end - start)
    if steps == 0:
        return
    
    delay = duration / steps
    direction = 1 if end > start else -1
    
    print(f"🎚️  Sweeping {get_cc_name(cc)} from {start} to {end}...")
    
    try:
        with MidiOut(device_id) as midi:
            for value in range(start, end + direction, direction):
                midi.send_cc(channel - 1, cc, value)
                time.sleep(delay)
        print(f"✅ Sweep complete")
    except Exception as e:
        print(f"❌ Error: {e}")


def panic(device_id: int, channel: int):
    """Send All Notes Off and Reset."""
    try:
        with MidiOut(device_id) as midi:
            midi.send_cc(channel - 1, 123, 0)  # All Notes Off
            midi.send_cc(channel - 1, 121, 0)  # Reset Controllers
            midi.send_cc(channel - 1, 120, 0)  # All Sound Off
        print("🛑 PANIC: All notes off, controllers reset")
    except Exception as e:
        print(f"❌ Error: {e}")


def print_help():
    """Print command help."""
    print("""
┌─────────────────────────────────────────────────────────────────────┐
│  COMMANDS                                                           │
├─────────────────────────────────────────────────────────────────────┤
│  cc <cc#> <value> [channel]   Send Control Change                  │
│  note <note#> <velocity>      Send Note (middle C = 60)            │
│  pc <program#> [channel]      Send Program Change                  │
│                                                                     │
│  cutoff <0-127>               CC74 - Filter Cutoff                 │
│  resonance <0-127>            CC71 - Filter Resonance              │
│  attack <0-127>               CC73 - Attack Time                   │
│  release <0-127>              CC72 - Release Time                  │
│  volume <0-127>               CC7  - Channel Volume                │
│  pan <0-127>                  CC10 - Pan (64=center)               │
│  mod <0-127>                  CC1  - Modulation Wheel              │
│                                                                     │
│  sweep <cc#> <start> <end>    Sweep CC value over 2 seconds        │
│  panic                        All Notes Off + Reset Controllers    │
│                                                                     │
│  device                       Change MIDI device                   │
│  list                         List all MIDI devices                │
│  channel <1-16>               Set default MIDI channel             │
│  help                         Show this help                       │
│  quit / exit                  Exit program                         │
└─────────────────────────────────────────────────────────────────────┘
""")


def interactive_mode(initial_device: Optional[int] = None):
    """Run interactive CLI session."""
    print("\n" + "=" * 60)
    print("  MIDImachine - MIDI CC Controller")
    print("  Type 'help' for commands, 'quit' to exit")
    print("=" * 60)
    
    outputs = get_output_devices()
    
    if initial_device is not None:
        device_id = initial_device
    else:
        device_id = select_output_device()
        if device_id is None:
            return
    
    device_name = outputs[device_id] if device_id < len(outputs) else f"Device {device_id}"
    channel = 1
    
    print(f"\n🎹 Connected to: {device_name}")
    print(f"📺 Channel: {channel}")
    print()
    
    while True:
        try:
            cmd = input(f"midi[ch{channel}]> ").strip().lower()
            
            if not cmd:
                continue
            
            parts = cmd.split()
            action = parts[0]
            
            if action in ('quit', 'exit', 'q'):
                print("👋 Goodbye!")
                break
            
            elif action == 'help':
                print_help()
            
            elif action == 'list':
                print_devices()
            
            elif action == 'device':
                new_device = select_output_device()
                if new_device is not None:
                    device_id = new_device
                    outputs = get_output_devices()
                    device_name = outputs[device_id] if device_id < len(outputs) else f"Device {device_id}"
                    print(f"🎹 Now connected to: {device_name}")
            
            elif action == 'channel':
                if len(parts) >= 2:
                    ch = int(parts[1])
                    if 1 <= ch <= 16:
                        channel = ch
                        print(f"📺 Channel set to: {channel}")
                    else:
                        print("Channel must be 1-16")
                else:
                    print(f"Current channel: {channel}")
            
            elif action == 'cc':
                if len(parts) >= 3:
                    cc = int(parts[1])
                    value = int(parts[2])
                    ch = int(parts[3]) if len(parts) >= 4 else channel
                    send_cc(device_id, ch, cc, max(0, min(127, value)))
                else:
                    print("Usage: cc <cc#> <value> [channel]")
            
            elif action == 'cutoff':
                if len(parts) >= 2:
                    send_cc(device_id, channel, 74, max(0, min(127, int(parts[1]))))
            elif action == 'resonance':
                if len(parts) >= 2:
                    send_cc(device_id, channel, 71, max(0, min(127, int(parts[1]))))
            elif action == 'attack':
                if len(parts) >= 2:
                    send_cc(device_id, channel, 73, max(0, min(127, int(parts[1]))))
            elif action == 'release':
                if len(parts) >= 2:
                    send_cc(device_id, channel, 72, max(0, min(127, int(parts[1]))))
            elif action == 'volume':
                if len(parts) >= 2:
                    send_cc(device_id, channel, 7, max(0, min(127, int(parts[1]))))
            elif action == 'pan':
                if len(parts) >= 2:
                    send_cc(device_id, channel, 10, max(0, min(127, int(parts[1]))))
            elif action == 'mod':
                if len(parts) >= 2:
                    send_cc(device_id, channel, 1, max(0, min(127, int(parts[1]))))
            
            elif action == 'note':
                if len(parts) >= 3:
                    send_note(device_id, channel, int(parts[1]), int(parts[2]))
                else:
                    print("Usage: note <note#> <velocity>")
            
            elif action == 'pc':
                if len(parts) >= 2:
                    prog = int(parts[1])
                    ch = int(parts[3]) if len(parts) >= 3 else channel
                    try:
                        with MidiOut(device_id) as midi:
                            midi.send_program_change(ch - 1, prog)
                        print(f"✅ Sent: Ch{ch} Program Change = {prog}")
                    except Exception as e:
                        print(f"❌ Error: {e}")
                else:
                    print("Usage: pc <program#> [channel]")
            
            elif action == 'sweep':
                if len(parts) >= 4:
                    sweep_cc(device_id, channel, int(parts[1]), int(parts[2]), int(parts[3]))
                else:
                    print("Usage: sweep <cc#> <start> <end>")
            
            elif action == 'panic':
                panic(device_id, channel)
            
            else:
                print(f"Unknown command: {action}. Type 'help' for commands.")
        
        except ValueError as e:
            print(f"Invalid number: {e}")
        except KeyboardInterrupt:
            print("\n👋 Goodbye!")
            break
        except Exception as e:
            print(f"Error: {e}")


def main():
    parser = argparse.ArgumentParser(
        description='MIDImachine - MIDI CC Controller CLI',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python midi_cli.py                     # Interactive mode
  python midi_cli.py --list              # List all MIDI devices
  python midi_cli.py -d 0 --cc 74 -v 100 # Send CC74=100 to device 0
        """
    )
    
    parser.add_argument('--list', '-l', action='store_true', help='List all MIDI devices')
    parser.add_argument('--device', '-d', type=int, help='Output device index')
    parser.add_argument('--channel', '-c', type=int, default=1, help='MIDI channel (1-16)')
    parser.add_argument('--cc', type=int, help='CC controller number (0-127)')
    parser.add_argument('--value', '-v', type=int, help='CC value (0-127)')
    parser.add_argument('--cutoff', type=int, help='Filter cutoff (CC74)')
    parser.add_argument('--resonance', type=int, help='Filter resonance (CC71)')
    
    args = parser.parse_args()
    
    if args.list:
        print_devices()
        return
    
    if args.device is not None:
        outputs = get_output_devices()
        if args.device >= len(outputs):
            print(f"❌ Invalid device index. Max: {len(outputs)-1}")
            return
        
        if args.cc is not None and args.value is not None:
            send_cc(args.device, args.channel, args.cc, args.value)
        elif args.cutoff is not None:
            send_cc(args.device, args.channel, 74, args.cutoff)
        elif args.resonance is not None:
            send_cc(args.device, args.channel, 71, args.resonance)
        else:
            interactive_mode(args.device)
        return
    
    interactive_mode()


if __name__ == '__main__':
    main()
