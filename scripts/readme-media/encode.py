# resample timestamped frames to a constant fps and encode with gifski
import json, sys, subprocess, os
d, out, fps, width = sys.argv[1], sys.argv[2], int(sys.argv[3]), int(sys.argv[4])
speed = float(sys.argv[5]) if len(sys.argv) > 5 else 1.0
tl = json.load(open(f'{d}/timeline.json'))
frames = tl['frames']; t0 = frames[0]['t']; end = frames[-1]['t']
seq, i, t = [], 0, t0
while t <= end:
    while i + 1 < len(frames) and frames[i + 1]['t'] <= t: i += 1
    seq.append(frames[i]['f']); t += speed * 1000 / fps
print(len(seq), 'output frames,', round(len(seq) / fps, 1), 's; source', len(frames))
subprocess.run(['gifski', '--fps', str(fps), '--width', str(width), '--quality', '90', '-o', out, *seq], check=True, stdout=subprocess.DEVNULL)
print(out, round(os.path.getsize(out) / 1e6, 2), 'MB')
