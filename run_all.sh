#!/bin/bash
# run_all.sh — starts all 6 agents in parallel

echo "Starting Supply Chain Intelligence System..."

conda activate aml-agents

python agents/coordinator.py &
sleep 2  # let coordinator connect first

python agents/event_intelligence.py &
python agents/supplier_impact.py &
python agents/financial_exposure.py &
python agents/regulatory_trade.py &
python agents/alt_sourcing.py &

echo "All 6 agents running."
echo "Press Ctrl+C to stop all agents."

wait  # keeps script running until Ctrl+C