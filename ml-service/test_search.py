import sys
from search_engine import search
import json

if len(sys.argv) < 2:
    print(json.dumps({"error": "No query provided"}))
    sys.exit()

query = sys.argv[1]
results = search(query)

print(json.dumps({"results": results}))
