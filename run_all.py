import subprocess
import time
import sys
import os

print("====================================================================")
print("            Supply Chain Disruption Intelligence Center            ")
print("                    Starting Multi-Agent System                     ")
print("====================================================================")
print()

# Ensure we use the correct virtual environment executable if available
python_executable = sys.executable
print(f"Using Python executable: {python_executable}")

# Start Coordinator first
print("Starting Coordinator...")
coord = subprocess.Popen([python_executable, "-u", "agents/coordinator.py"])

time.sleep(3)

# Start Event Intelligence next
print("Starting Event Intelligence...")
event_intel = subprocess.Popen([python_executable, "-u", "agents/event_intelligence.py"])
time.sleep(1)

# Start Supplier Impact
print("Starting Supplier Impact...")
supplier_impact = subprocess.Popen([python_executable, "-u", "agents/supplier_impact.py"])
time.sleep(1)

# Start the rest of the specialists (Financial, Regulatory, Sourcing)
agents = ["financial_exposure.py", "regulatory_trade.py", "alt_sourcing.py"]
procs = [coord, event_intel, supplier_impact]

for agent in agents:
    print(f"Starting {agent}...")
    procs.append(subprocess.Popen([python_executable, "-u", f"agents/{agent}"]))

time.sleep(2)

print("Starting FastAPI backend on port 8000...")
backend = subprocess.Popen([python_executable, "-m", "uvicorn", "backend:app", "--port", "8000"])
procs.append(backend)

print()
print("====================================================================")
print("           All 6 agents + backend are now running!                  ")
print("                                                                    ")
print("   Backend API:  http://localhost:8000                              ")
print("   API Docs:     http://localhost:8000/docs                         ")
print("                                                                    ")
print("   Keep this process running to keep the system active.             ")
print("   Press Ctrl+C to terminate all components.                        ")
print("====================================================================")
print()

try:
    # Monitor child processes
    while True:
        # Check if any process has exited unexpectedly
        for p in procs:
            if p.poll() is not None:
                print(f"Warning: A subprocess exited with code {p.returncode}")
        time.sleep(2)
except KeyboardInterrupt:
    print("\nShutting down all agents and backend...")
    for p in procs:
        try:
            p.terminate()
            p.wait(timeout=2)
        except Exception:
            try:
                p.kill()
            except Exception:
                pass
    print("Clean shutdown complete.")
