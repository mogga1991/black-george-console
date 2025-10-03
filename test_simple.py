import os
import requests

# Load credentials
url = None
key = None

env_file = ".env.local"
if os.path.exists(env_file):
    with open(env_file, 'r') as f:
        for line in f:
            if 'NEXT_PUBLIC_SUPABASE_URL=' in line:
                url = line.split('=')[1].strip()
            elif 'NEXT_PUBLIC_SUPABASE_ANON_KEY=' in line:
                key = line.split('=')[1].strip()

if not url or not key:
    print("Missing credentials in .env.local")
    exit(1)

print(f"Testing connection to: {url}")

# Test table access
headers = {
    'apikey': key,
    'Authorization': f'Bearer {key}',
    'Content-Type': 'application/json'
}

try:
    response = requests.get(f"{url}/rest/v1/cre_properties?limit=1", headers=headers)
    
    if response.status_code == 200:
        print("✅ SUCCESS! Table exists and is accessible")
        print("🚀 Ready to import data!")
    else:
        print(f"❌ Error: {response.status_code}")
        print(f"Response: {response.text}")
        
except Exception as e:
    print(f"❌ Connection error: {e}")