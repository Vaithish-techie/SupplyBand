#!/bin/bash
# run_all.sh — starts all 6 agents + the FastAPI backend in parallel
# Usage: ./run_all.sh

set -e

echo "Checking Python environment..."
if command -v conda &> /dev/null; then
    echo "Activating conda environment..."
    source "$(conda info --base)/etc/profile.d/conda.sh"
    conda activate aml-agents
elif [ -d ".venv" ]; then
    echo "Activating virtual environment (.venv)..."
    source .venv/Scripts/activate || source .venv/bin/activate
else
    echo "Using system python environment..."
fi

echo "Starting Coordinator first (it must be online before others post)..."
python agents/coordinator.py &
COORD_PID=$!
sleep 3

echo "Starting all 5 specialist agents..."
python agents/event_intelligence.py &
python agents/supplier_impact.py &
python agents/financial_exposure.py &
python agents/regulatory_trade.py &
python agents/alt_sourcing.py &

sleep 2

echo "Starting FastAPI backend on port 8000..."
uvicorn backend:app --reload --port 8000 &

echo ""
echo "=========================================="
echo "All 6 agents + backend are running."
echo "Backend:  http://localhost:8000"
echo "Docs:     http://localhost:8000/docs"
echo "Press Ctrl+C to stop everything."
echo "=========================================="

wait