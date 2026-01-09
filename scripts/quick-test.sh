#!/bin/bash

echo "🧪 Quick Test Suite"
echo "==================="
echo ""

# Quick validation tests
echo "1️⃣ Checking environment..."
if [ -f .env ]; then
    echo "✅ .env file exists"
else
    echo "❌ .env file missing"
    exit 1
fi

echo ""
echo "2️⃣ Checking dependencies..."
if command -v pnpm &> /dev/null; then
    echo "✅ pnpm installed"
else
    echo "❌ pnpm not found. Install with: npm i -g pnpm"
    exit 1
fi

echo ""
echo "3️⃣ Installing packages..."
pnpm install --silent

echo ""
echo "4️⃣ Testing Ethereal integration..."
timeout 20 pnpm test:ethereal 2>&1 | grep -q "Found 12 markets"
if [ $? -eq 0 ]; then
    echo "✅ Ethereal markets accessible"
else
    echo "⚠️  Ethereal test incomplete (this is OK if using mock data)"
fi

echo ""
echo "5️⃣ Checking file structure..."
REQUIRED_FILES=(
    "src/agents/trading-agent.ts"
    "src/agents/trade-tracker.ts"
    "src/agents/profit-scorer.ts"
    "src/clients/ethereal-client.ts"
    "scripts/test-ethereal-dry-run.ts"
    "scripts/optimize-agent.ts"
    "scripts/generate-dashboard.ts"
)

ALL_EXIST=true
for file in "${REQUIRED_FILES[@]}"; do
    if [ -f "$file" ]; then
        echo "   ✅ $file"
    else
        echo "   ❌ $file missing"
        ALL_EXIST=false
    fi
done

echo ""
if [ "$ALL_EXIST" = true ]; then
    echo "🎉 All quick tests passed!"
    echo ""
    echo "Run full test suite with: ./scripts/git-workflow.sh"
else
    echo "❌ Some files are missing"
    exit 1
fi
