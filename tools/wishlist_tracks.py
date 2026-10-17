#!/usr/bin/env python3
"""Attach tracklists to wishlist albums. Usage: python3 tools/wishlist_tracks.py tracks_cache.json
Cache format: {"Artist|Album": {"tracks": [{"side","position","title"}]}}. Passphrase from $PASSPHRASE or ~/.vinyl-pass."""
import json, os, re, sys, urllib.request
root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
url = re.search(r'VITE_API_URL=(\S+)', open(os.path.join(root, 'client', '.env')).read()).group(1)
secret = os.environ.get('PASSPHRASE') or open(os.path.expanduser('~/.vinyl-pass')).read().strip()
def call(**p):
    req = urllib.request.Request(url, json.dumps({'secret': secret, **p}).encode(), {'Content-Type': 'text/plain'})
    r = json.load(urllib.request.urlopen(req))
    if 'error' in r: sys.exit(r['error'])
    return r
cache = json.load(open(sys.argv[1]))
items = [{'id': w['id'], 'tracks': cache[w['artist'] + '|' + w['album']]['tracks']}
         for w in call(action='list')['wishlist']
         if (cache.get(w['artist'] + '|' + w['album']) or {}).get('tracks')]
done = 0
for i in range(0, len(items), 40):
    done += call(action='wishlistSetTracks', items=items[i:i + 40])['updated']
print(f'tracklists saved for {done} of {len(items)} matched albums')
