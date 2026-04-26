import os, json, urllib.request, sys

token = os.environ.get('CF_TOKEN', '')
if not token:
    print('No CF_TOKEN set, skipping')
    sys.exit(0)

headers = {'Authorization': f'Bearer {token}', 'Content-Type': 'application/json'}

def cf(path, method='GET', data=None):
    url = f'https://api.cloudflare.com/client/v4{path}'
    body = json.dumps(data).encode() if data else None
    req = urllib.request.Request(url, headers=headers, data=body, method=method)
    try:
        with urllib.request.urlopen(req) as r:
            return json.loads(r.read())
    except Exception as e:
        print(f'Error: {e}')
        return {}

# Use known account ID from error logs
account_id = 'b152573734243835c48e3394a91dad3b'

# List all projects to find correct name
projects = cf(f'/accounts/{account_id}/pages/projects').get('result', [])
print('Projects found:', [p['name'] for p in projects])

project = next((p['name'] for p in projects if 'takumi' in p['name'].lower()), None)
if not project:
    print('No Takumi project found')
    sys.exit(0)
print(f'Using project: {project}')

result = cf(f'/accounts/{account_id}/pages/projects/{project}', 'PATCH', {
    'deployment_configs': {'production': {'env_vars': {
        'GOOGLE_CLIENT_ID':     {'value': os.environ.get('GOOGLE_CLIENT_ID', '')},
        'GOOGLE_CLIENT_SECRET': {'value': os.environ.get('GOOGLE_CLIENT_SECRET', '')},
        'JWT_SECRET':           {'value': os.environ.get('JWT_SECRET', '')},
    }}}
})
print('Secrets:', 'OK' if result.get('success') else result.get('errors'))
