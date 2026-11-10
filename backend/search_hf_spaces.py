import urllib.request
import json

url = 'https://huggingface.co/api/spaces?search=try-on&limit=25'
req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
try:
    with urllib.request.urlopen(req) as resp:
        spaces = json.loads(resp.read().decode('utf-8'))
        for s in spaces:
            print(s['id'], 'likes:', s.get('likes'), 'sdk:', s.get('sdk'))
except Exception as e:
    print('Error:', e)
