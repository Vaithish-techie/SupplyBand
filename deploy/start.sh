#!/bin/bash
# deploy/start.sh — container entrypoint for Hugging Face Spaces
# Generates agent_config.yaml from env vars, then launches supervisord.

set -e

echo "=== SupplyBand :: Hugging Face Spaces boot ==="
echo "Timestamp: $(date -u +%Y-%m-%dT%H:%M:%SZ)"

# ── Ensure log directories exist ──────────────────────────────────────────────
mkdir -p /var/log/supervisor
mkdir -p /var/log/nginx
mkdir -p /var/run

# ── Generate agent_config.yaml from HF Space Secrets (env vars) ──────────────
# Each agent needs: agent_id + api_key
# Env var naming convention:
#   BAND_<AGENT_UPPER>_AGENT_ID  and  BAND_<AGENT_UPPER>_API_KEY
#   (coordinator uses BAND_COORDINATOR_API_KEY for its api_key)

CONFIG_FILE="/app/agent_config.yaml"

if [ ! -f "$CONFIG_FILE" ]; then
  echo "Generating $CONFIG_FILE from environment variables..."

  # Validate we have the minimum required vars
  MISSING=""
  for var in \
    BAND_COORDINATOR_AGENT_ID \
    BAND_COORDINATOR_API_KEY \
    BAND_EVENT_INTELLIGENCE_AGENT_ID \
    BAND_EVENT_INTELLIGENCE_API_KEY \
    BAND_SUPPLIER_IMPACT_AGENT_ID \
    BAND_SUPPLIER_IMPACT_API_KEY \
    BAND_FINANCIAL_EXPOSURE_AGENT_ID \
    BAND_FINANCIAL_EXPOSURE_API_KEY \
    BAND_REGULATORY_TRADE_AGENT_ID \
    BAND_REGULATORY_TRADE_API_KEY \
    BAND_ALT_SOURCING_AGENT_ID \
    BAND_ALT_SOURCING_API_KEY; do
    if [ -z "$(eval echo \$$var)" ]; then
      MISSING="$MISSING $var"
    fi
  done

  if [ -n "$MISSING" ]; then
    echo "ERROR: Missing required Band secrets:$MISSING"
    echo "Set them in HF Space Settings → Secrets."
    exit 1
  fi

  cat > "$CONFIG_FILE" <<EOF
coordinator:
  agent_id: "${BAND_COORDINATOR_AGENT_ID}"
  api_key: "${BAND_COORDINATOR_API_KEY}"

event_intelligence:
  agent_id: "${BAND_EVENT_INTELLIGENCE_AGENT_ID}"
  api_key: "${BAND_EVENT_INTELLIGENCE_API_KEY}"

supplier_impact:
  agent_id: "${BAND_SUPPLIER_IMPACT_AGENT_ID}"
  api_key: "${BAND_SUPPLIER_IMPACT_API_KEY}"

financial_exposure:
  agent_id: "${BAND_FINANCIAL_EXPOSURE_AGENT_ID}"
  api_key: "${BAND_FINANCIAL_EXPOSURE_API_KEY}"

regulatory_trade:
  agent_id: "${BAND_REGULATORY_TRADE_AGENT_ID}"
  api_key: "${BAND_REGULATORY_TRADE_API_KEY}"

alt_sourcing:
  agent_id: "${BAND_ALT_SOURCING_AGENT_ID}"
  api_key: "${BAND_ALT_SOURCING_API_KEY}"
EOF

  echo "agent_config.yaml generated successfully."
else
  echo "agent_config.yaml already exists — skipping generation."
fi

echo "Starting supervisord (manages nginx + uvicorn + 6 agents)..."
echo "App will be available on port 7860."

# ── Launch supervisord ────────────────────────────────────────────────────────
exec /usr/bin/supervisord -c /etc/supervisor/conf.d/supervisord.conf
