#!/bin/bash

echo ""
echo "=== MG Comprehensive Cleanup with curl ==="
echo ""

COOKIES="/tmp/mg_cookies.txt"
API="https://api.loopcstrategies.com"
TENANT="mg"

# Step 1: Login
echo "[1/5] Logging in..."
curl -s -c "$COOKIES" -X POST "$API/api/auth/login" \
  -H "Content-Type: application/json" \
  -H "X-Tenant-ID: $TENANT" \
  -d '{"name":"Nan","password":"123456"}' > /tmp/login_response.json

echo "✓ Logged in"
echo ""

# Step 2: Fetch ledger entries
echo "[2/5] Fetching ledger entries..."
LEDGER_COUNT=$(curl -s -b "$COOKIES" "$API/api/erp-accounting/ledger?limit=1000" \
  -H "X-Tenant-ID: $TENANT" | jq '.entries | length' 2>/dev/null || echo "0")
echo "✓ Found $LEDGER_COUNT ledger entries"
echo ""

# Step 3: Fetch transactions
echo "[3/5] Fetching transactions..."
TX_COUNT=$(curl -s -b "$COOKIES" "$API/api/erp-accounting/transactions?limit=1000&includeVoided=true" \
  -H "X-Tenant-ID: $TENANT" | jq '.transactions | length' 2>/dev/null || echo "0")
echo "✓ Found $TX_COUNT transactions"
echo ""

# Step 4: Get IDs and delete ledger
echo "[4/5] Deleting ledger entries..."
curl -s -b "$COOKIES" "$API/api/erp-accounting/ledger?limit=1000" \
  -H "X-Tenant-ID: $TENANT" | jq -r '.entries[]._id' 2>/dev/null | while read id; do
  curl -s -b "$COOKIES" -X DELETE "$API/api/erp-accounting/ledger/$id" \
    -H "X-Tenant-ID: $TENANT" > /dev/null
  echo -n "."
done
echo ""
echo "✓ Deleted ledger entries"
echo ""

# Step 5: Get IDs and delete transactions
echo "[5/5] Deleting transactions..."
curl -s -b "$COOKIES" "$API/api/erp-accounting/transactions?limit=1000&includeVoided=true" \
  -H "X-Tenant-ID: $TENANT" | jq -r '.transactions[]._id' 2>/dev/null | while read id; do
  curl -s -b "$COOKIES" -X DELETE "$API/api/erp-accounting/transactions/$id" \
    -H "X-Tenant-ID: $TENANT" > /dev/null
  echo -n "."
done
echo ""
echo "✓ Deleted transactions"
echo ""

echo "=== Cleanup Complete ==="
echo ""
