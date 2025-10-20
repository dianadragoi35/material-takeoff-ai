#!/bin/bash
# Quick test script for backend health check

echo "🧪 Testing Backend Server..."
echo ""

# Check if backend is running
echo "1️⃣  Checking if backend is accessible..."
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3001/api/python/health)

if [ "$HTTP_CODE" -eq 000 ]; then
    echo "❌ Backend server is NOT running!"
    echo ""
    echo "💡 Start it with: npm run dev:backend"
    exit 1
fi

echo "✅ Backend is responding (HTTP $HTTP_CODE)"
echo ""

# Check Python availability
echo "2️⃣  Checking Python validation status..."
RESPONSE=$(curl -s http://localhost:3001/api/python/health)
echo "$RESPONSE" | jq '.'

STATUS=$(echo "$RESPONSE" | jq -r '.status')
PYTHON=$(echo "$RESPONSE" | jq -r '.python')

if [ "$STATUS" == "ok" ] && [ "$PYTHON" == "available" ]; then
    echo ""
    echo "✅ Python validation is READY!"
    echo ""
    echo "🎉 Everything is working! Open http://localhost:5173 to use the app"
else
    echo ""
    echo "⚠️  Python validation is NOT available"
    echo ""
    echo "💡 Make sure Python and dependencies are installed:"
    echo "   python3 -m venv venv"
    echo "   source venv/bin/activate"
    echo "   pip install -r requirements.txt"
fi
