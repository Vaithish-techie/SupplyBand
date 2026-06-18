import re

with open("agents/alt_sourcing.py", "r") as f:
    code = f.read()

print("Contains httpx?", "httpx" in code)
print("Contains asyncio?", "asyncio" in code)
