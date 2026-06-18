#!/bin/bash

# Event 1
echo "Triggering Event 1..."
E1=$(curl -s -X POST http://localhost:8000/trigger-event -H "Content-Type: application/json" -d '{"event_text": "Magnitude 7.4 earthquake strikes Hsinchu, Taiwan suspending TSMC production."}')
echo $E1
C1=$(echo $E1 | grep -o '"case_id":"[^"]*' | grep -o '[^"]*$')
sleep 30

# Event 2
echo "Triggering Event 2..."
E2=$(curl -s -X POST http://localhost:8000/trigger-event -H "Content-Type: application/json" -d '{"event_text": "Dockworkers at Port of Rotterdam announce indefinite strike starting immediately, paralyzing European logistics."}')
echo $E2
C2=$(echo $E2 | grep -o '"case_id":"[^"]*' | grep -o '[^"]*$')
sleep 30

# Event 3
echo "Triggering Event 3..."
E3=$(curl -s -X POST http://localhost:8000/trigger-event -H "Content-Type: application/json" -d '{"event_text": "New 40% tariff imposed on all semiconductor components imported from China, effective immediately."}')
echo $E3
C3=$(echo $E3 | grep -o '"case_id":"[^"]*' | grep -o '[^"]*$')
sleep 45

echo "Checking statuses..."
echo "Status for $C1:"
curl -s "http://localhost:8000/case-status?case_id=$C1" | grep -o '"investigation_complete":[^,]*'
echo "Status for $C2:"
curl -s "http://localhost:8000/case-status?case_id=$C2" | grep -o '"investigation_complete":[^,]*'
echo "Status for $C3:"
curl -s "http://localhost:8000/case-status?case_id=$C3" | grep -o '"investigation_complete":[^,]*'

echo "$C1" > test_cases.txt
echo "$C2" >> test_cases.txt
echo "$C3" >> test_cases.txt
