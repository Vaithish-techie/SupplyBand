@echo off
setlocal

echo ====================================================================
echo             Supply Chain Disruption Intelligence Center            
echo                     Starting Multi-Agent System                     
echo ====================================================================
echo.

echo Starting Coordinator first (it must be online before others post)...
start /B python agents/coordinator.py
if %ERRORLEVEL% neq 0 (
    echo Error: Failed to start Coordinator agent.
    exit /b 1
)
timeout /t 3 /nobreak >nul

echo Starting all 5 specialist agents...
start /B python agents/event_intelligence.py
start /B python agents/supplier_impact.py
start /B python agents/financial_exposure.py
start /B python agents/regulatory_trade.py
start /B python agents/alt_sourcing.py
timeout /t 2 /nobreak >nul

echo Starting FastAPI backend on port 8000...
echo.
echo ====================================================================
echo            All 6 agents + backend are now launching!               
echo.
echo    Backend API:  http://localhost:8000                             
echo    API Docs:     http://localhost:8000/docs                        
echo.
echo    Press Ctrl+C in this terminal window to stop all components.    
echo ====================================================================
echo.

uvicorn backend:app --reload --port 8001

endlocal
