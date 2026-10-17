#!/usr/bin/env python3
"""Add albums to the wishlist. Usage: python3 tools/wishlist_add.py albums.json
albums.json: [{"artist": "...", "album": "...", "year": "1973"}, ...]
Passphrase is read from $PASSPHRASE or ~/.vinyl-pass. Duplicates (owned or already wishlisted) are skipped server-side."""
import json, os, re, sys, urllib.request

root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
url = re.search(r'VITE_API_URL=(\S+)', open(os.path.join(root, 'client', '.env')).read()).group(1)
secret = os.environ.get('PASSPHRASE') or open(os.path.expanduser('~/.vinyl-pass')).read().strip()
items = json.load(open(sys.argv[1]))
req = urllib.request.Request(url, json.dumps({'action': 'wishlistAdd', 'secret': secret, 'items': items}).encode(), {'Content-Type': 'text/plain'})
r = json.load(urllib.request.urlopen(req))
if 'error' in r: sys.exit(r['error'])
print(f"added {len(r['added'])}, skipped {len(r['skipped'])}")
for s in r['skipped']: print('  skipped:', s['artist'], '-', s['album'], f"({s['reason']})")
