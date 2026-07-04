import urllib.request
import urllib.error
import json

url = "http://127.0.0.1:8000/api/accounts"
headers = {
    "Authorization": "Bearer U8oo3kXQPCFoiw6FYUf8GjsYZvs=",
    "Content-Type": "application/json"
}

# 1. Test GET /api/accounts
print("--- Sending GET /api/accounts ---")
req = urllib.request.Request(url, headers=headers, method="GET")
try:
    with urllib.request.urlopen(req) as res:
        data = json.loads(res.read().decode())
        print("GET /api/accounts Success!")
        print(f"Account count: {len(data.get('items', []))}")
        if data.get('items'):
            print("First account snippet:", str(data['items'][0])[:150])
except Exception as e:
    print("GET error:", e)

# 2. Test POST /api/accounts with a custom fingerprint and proxy
print("\n--- Sending POST /api/accounts ---")
payload = {
    "tokens": [],
    "accounts": [
        {
            "access_token": "dummy_test_token_123456789",
            "proxy": "http://127.0.0.1:40080",
            "fp": {
                "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36 Edg/148.0.0.0",
                "impersonate": "chrome146",
                "oai-device-id": "custom-device-id-xyz",
                "oai-session-id": "custom-session-id-abc",
                "sec-ch-ua": '"Chromium";v="148", "Microsoft Edge";v="148", "Not/A)Brand";v="99"'
            }
        }
    ]
}

req_post = urllib.request.Request(
    url,
    data=json.dumps(payload).encode(),
    headers=headers,
    method="POST"
)
try:
    with urllib.request.urlopen(req_post) as res:
        data = json.loads(res.read().decode())
        print("POST /api/accounts Success!")
        print(f"Added: {data.get('added')}, Skipped: {data.get('skipped')}")
except Exception as e:
    if isinstance(e, urllib.error.HTTPError):
        print("POST HTTP error details:", e.read().decode())
    else:
        print("POST error:", e)
