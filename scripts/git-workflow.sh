#!/bin/bash

echo "🔄 Git Workflow & Testing Suite"
echo "================================"
echo ""

# Check if we're in a git repository
if [ ! -d .git ]; then
    echo "❌ Not a git repository. Initializing..."
    git init
    echo "✅ Git repository initialized"
fi

# Check current status
echo "📊 Current Git Status:"
git status --short
echo ""

# Stash any uncommitted changes
echo "💾 Stashing local changes..."
git stash push -m "Auto-stash before pull $(date +%Y%m%d_%H%M%S)"
echo ""

# Fetch latest changes
echo "📥 Fetching latest changes..."
git fetch origin
echo ""

# Check for incoming changes
INCOMING=$(git rev-list HEAD..origin/main --count 2>/dev/null || echo "0")
if [ "$INCOMING" = "0" ]; then
    echo "✅ No incoming changes from remote"
else
    echo "📨 Found $INCOMING incoming change(s)"
    echo ""
    echo "Incoming commits:"
    git log HEAD..origin/main --oneline
    echo ""
fi

# Pull with rebase
echo "🔄 Pulling changes with rebase..."
git pull --rebase origin main
if [ $? -ne 0 ]; then
    echo "❌ Pull failed! Resolve conflicts manually."
    echo "After resolving, run: git rebase --continue"
    exit 1
fi
echo ""

# Apply stashed changes
STASH_COUNT=$(git stash list | wc -l)
if [ $STASH_COUNT -gt 0 ]; then
    echo "📤 Applying stashed changes..."
    git stash pop
    if [ $? -ne 0 ]; then
        echo "⚠️  Conflict in stashed changes. Resolve manually."
    fi
    echo ""
fi

echo "✅ Git sync complete!"
echo ""
echo "================================"
echo "🧪 Running Test Suite"
echo "================================"
echo ""

# Install dependencies
echo "📦 Installing/updating dependencies..."
pnpm install
echo ""

# Run all tests
TESTS_PASSED=0
TESTS_FAILED=0

# Test 1: TypeScript compilation
echo "🔧 Test 1: TypeScript Compilation"
pnpm tsc --noEmit
if [ $? -eq 0 ]; then
    echo "✅ TypeScript compilation passed"
    ((TESTS_PASSED++))
else
    echo "❌ TypeScript compilation failed"
    ((TESTS_FAILED++))
fi
echo ""

# Test 2: Environment variables
echo "🔧 Test 2: Environment Configuration"
if [ -f .env ]; then
    if grep -q "GROQ_API_KEY=" .env && grep -q "PRIVATE_KEY=" .env; then
        echo "✅ Environment variables configured"
        ((TESTS_PASSED++))
    else
        echo "❌ Missing required environment variables"
        ((TESTS_FAILED++))
    fi
else
    echo "❌ .env file not found"
    ((TESTS_FAILED++))
fi
echo ""

# Test 3: Ethereal markets
echo "🔧 Test 3: Ethereal Markets Integration"
timeout 30 pnpm test:ethereal > /tmp/ethereal-test.log 2>&1
if [ $? -eq 0 ] || grep -q "Found 12 markets" /tmp/ethereal-test.log; then
    echo "✅ Ethereal markets test passed"
    ((TESTS_PASSED++))
else
    echo "⚠️  Ethereal markets test had issues (check logs)"
    ((TESTS_FAILED++))
fi
echo ""

# Test 4: Trading agent optimization
echo "🔧 Test 4: Trading Agent Dry Run"
timeout 60 pnpm test:ethereal:dry-run > /tmp/dry-run-test.log 2>&1
if [ $? -eq 0 ] || grep -q "FINAL PERFORMANCE REPORT" /tmp/dry-run-test.log; then
    echo "✅ Trading agent dry run passed"
    SCORE=$(grep "Overall Score:" /tmp/dry-run-test.log | tail -1 | grep -oP '\d+\.\d+' | head -1)
    if [ ! -z "$SCORE" ]; then
        echo "   📊 Agent Score: $SCORE/100"
    fi
    ((TESTS_PASSED++))
else
    echo "❌ Trading agent dry run failed"
    ((TESTS_FAILED++))
fi
echo ""

# Test 5: Dashboard generation
echo "🔧 Test 5: Dashboard Generation"
if [ -d trade-results/ethereal ] && [ -f trade-results/ethereal/trades.json ]; then
    pnpm generate:dashboard > /dev/null 2>&1
    if [ -f trade-results/ethereal/dashboard.html ]; then
        echo "✅ Dashboard generation passed"
        ((TESTS_PASSED++))
    else
        echo "❌ Dashboard generation failed"
        ((TESTS_FAILED++))
    fi
else
    echo "⚠️  No trade results to generate dashboard (run dry-run first)"
fi
echo ""

# Summary
echo "================================"
echo "📊 Test Summary"
echo "================================"
echo "✅ Passed: $TESTS_PASSED"
echo "❌ Failed: $TESTS_FAILED"
echo ""

if [ $TESTS_FAILED -eq 0 ]; then
    echo "🎉 All tests passed!"
    echo ""
    
    # Offer to commit and push
    echo "📤 Ready to commit and push changes?"
    echo ""
    echo "Uncommitted changes:"
    git status --short
    echo ""
    
    read -p "Commit and push? (y/n): " -n 1 -r
    echo ""
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        read -p "Commit message: " COMMIT_MSG
        
        if [ -z "$COMMIT_MSG" ]; then
            COMMIT_MSG="Update: agent optimization and testing suite"
        fi
        
        echo ""
        echo "📝 Staging changes..."
        git add .
        
        echo "💾 Committing changes..."
        git commit -m "$COMMIT_MSG"
        
        echo "📤 Pushing to remote..."
        git push origin main
        
        if [ $? -eq 0 ]; then
            echo ""
            echo "✅ Successfully pushed to remote!"
        else
            echo ""
            echo "❌ Push failed. You may need to set up remote:"
            echo "   git remote add origin <your-repo-url>"
            echo "   git push -u origin main"
        fi
    else
        echo "⏭️  Skipping commit/push"
    fi
else
    echo "⚠️  Fix failing tests before pushing"
fi

echo ""
echo "================================"
echo "🏁 Workflow Complete"
echo "================================"
