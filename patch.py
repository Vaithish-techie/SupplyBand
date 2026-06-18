import os
import re

agents_dir = "/home/vaiunix_111/College/Hackathon/supply-chain-agent/agents"

def patch_file(filename):
    filepath = os.path.join(agents_dir, filename)
    with open(filepath, "r") as f:
        content = f.read()

    # Find where on_message starts
    if "async def on_message" not in content:
        return
        
    # Replace plain 'return' with 'return {"status": "skipped"}' inside the file.
    # Be careful not to replace return statements that are returning a value.
    # We look for 'return' followed by a newline, or 'return None'.
    
    # We only want to patch inside Custom*Adapter.
    # To be safe, we just regex replace 'return\s*\n' -> 'return {"status": "skipped"}\n'
    # and 'return None' -> 'return {"status": "skipped"}'
    
    new_content = re.sub(r'\breturn\s*\n', 'return {"status": "skipped"}\n', content)
    new_content = re.sub(r'\breturn\s+None\b', 'return {"status": "skipped"}', new_content)
    
    # Also fix financial_exposure.py's specific case
    if filename == "financial_exposure.py":
        new_content = new_content.replace(
            "pass  # no-op: upstream not yet available",
            'return {"status": "skipped"}  # no-op: upstream not yet available'
        )

    if new_content != content:
        with open(filepath, "w") as f:
            f.write(new_content)
        print(f"Patched {filename}")

for filename in os.listdir(agents_dir):
    if filename.endswith(".py"):
        patch_file(filename)
