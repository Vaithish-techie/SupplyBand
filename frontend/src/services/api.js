const API_BASE_URL = 'http://localhost:8000';

export async function checkHealth() {
  const res = await fetch(`${API_BASE_URL}/health`);
  if (!res.ok) throw new Error(`Health check failed: ${res.statusText}`);
  return res.json();
}

export async function triggerEvent(eventText, caseId = null) {
  const payload = { event_text: eventText };
  if (caseId) payload.case_id = caseId;

  const res = await fetch(`${API_BASE_URL}/trigger-event`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.detail || `Trigger event failed: ${res.statusText}`);
  }
  return res.json();
}

export async function getRoomMessages(caseId = null) {
  const url = caseId 
    ? `${API_BASE_URL}/room-messages?case_id=${encodeURIComponent(caseId)}`
    : `${API_BASE_URL}/room-messages`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Fetch room messages failed: ${res.statusText}`);
  return res.json();
}

export async function getCaseStatus(caseId) {
  const res = await fetch(`${API_BASE_URL}/case-status?case_id=${encodeURIComponent(caseId)}`);
  if (!res.ok) throw new Error(`Fetch case status failed: ${res.statusText}`);
  return res.json();
}

export async function approveAction(caseId, decision, notes = '') {
  const res = await fetch(`${API_BASE_URL}/approve-action`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ case_id: caseId, decision, notes }),
  });
  if (!res.ok) throw new Error(`Action decision submission failed: ${res.statusText}`);
  return res.json();
}
