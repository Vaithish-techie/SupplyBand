#!/bin/bash
# run_all.sh — starts all 6 agents + the FastAPI backend in parallel
# Usage: ./run_all.sh

set -e

echo "Cleaning up any existing agent processes..."
pkill -f "python agents/" || true
pkill -f "backend:app" || true
echo "Waiting 3 seconds to ensure sockets close cleanly..."
sleep 3

echo "Checking Python environment..."
if command -v conda &> /dev/null; then
    echo "Activating conda environment..."
    source "$(conda info --base)/etc/profile.d/conda.sh"
    conda activate aml-agents
elif [ -d "venv" ]; then
    echo "Activating virtual environment (venv)..."
    source venv/Scripts/activate || source venv/bin/activate
else
    echo "Using system python environment..."
fi

echo "Starting Coordinator first (it must be online before others post)..."
python agents/coordinator.py &
sleep 3

echo "Starting Event Intelligence..."
python agents/event_intelligence.py &
sleep 2

echo "Starting Supplier Impact..."
python agents/supplier_impact.py &
sleep 2

echo "Starting Financial Exposure and Regulatory & Trade (in parallel)..."
python agents/financial_exposure.py &
python agents/regulatory_trade.py &
sleep 2

echo "Starting Alternative Sourcing last..."
python agents/alt_sourcing.py &
sleep 2

echo "Starting FastAPI backend on port 8000..."
python -m uvicorn backend:app --reload --port 8000 &

echo ""
echo "=========================================="
echo "All 6 agents + backend are running."
echo "Backend:  http://localhost:8000"
echo "Docs:     http://localhost:8000/docs"
echo "Press Ctrl+C to stop everything."
echo "=========================================="

wait