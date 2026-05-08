#!/usr/bin/env bash
# Automated Code Quality Fixer - Frontend JavaScript/React
# Fixes critical issues in React components

set -e

BASE_DIR="/app/frontend/src"
BACKUP_DIR="/tmp/frontend_backup_$(date +%s)"

echo "🔧 Frontend Code Quality Fixer"
echo "============================================================"

# Create backup
echo "📦 Creating backup at $BACKUP_DIR..."
mkdir -p "$BACKUP_DIR"
cp -r "$BASE_DIR" "$BACKUP_DIR/"

# Counter variables
CONSOLE_FIXES=0
ARRAY_KEY_DETECTIONS=0

echo ""
echo "🧹 Step 1: Removing console.log statements..."
echo "------------------------------------------------------------"

# Remove console.log, console.error, console.warn (except console.error for actual error handling)
find "$BASE_DIR" -type f \( -name "*.jsx" -o -name "*.js" \) -not -path "*/node_modules/*" | while read file; do
    # Remove console.log and console.warn, keep console.error for error boundaries
    if grep -q "console\.log\|console\.warn" "$file"; then
        sed -i.bak '/console\.log/d; /console\.warn/d' "$file"
        rm "${file}.bak"
        ((CONSOLE_FIXES++)) || true
        echo "  ✅ Cleaned: $(basename $file)"
    fi
done

echo "  📊 Removed console statements from $CONSOLE_FIXES files"

echo ""
echo "🔍 Step 2: Detecting array index keys (needs manual review)..."
echo "------------------------------------------------------------"

# Detect array index used as key
echo "  Scanning for key={index} patterns..."
grep -rn "key={.*index" "$BASE_DIR" --include="*.jsx" --include="*.js" 2>/dev/null | head -20 > /tmp/array_index_keys.txt || true

if [ -s /tmp/array_index_keys.txt ]; then
    echo "  ⚠️  Found files with array index keys:"
    cat /tmp/array_index_keys.txt | while read line; do
        echo "    - $line"
    done
    echo ""
    echo "  💡 Recommendation: Replace key={index} with key={item.id}"
else
    echo "  ✅ No obvious array index keys found"
fi

echo ""
echo "🔍 Step 3: Detecting missing useEffect dependencies..."
echo "------------------------------------------------------------"

# This is complex - just create a report
echo "  Scanning for useEffect with empty dependency arrays..."
grep -rn "useEffect.*\[\s*\]" "$BASE_DIR" --include="*.jsx" --include="*.js" 2>/dev/null | wc -l > /tmp/empty_deps_count.txt || echo "0" > /tmp/empty_deps_count.txt

EMPTY_DEPS=$(cat /tmp/empty_deps_count.txt)
echo "  ⚠️  Found $EMPTY_DEPS useEffect hooks with empty dependency arrays"
echo "  💡 These may need dependencies added - review carefully"

echo ""
echo "📊 SUMMARY"
echo "============================================================"
echo "  ✅ Console statements removed: $CONSOLE_FIXES files"
echo "  ⚠️  Array index keys detected: See /tmp/array_index_keys.txt"
echo "  ⚠️  Empty useEffect deps: $EMPTY_DEPS instances"
echo ""
echo "  📁 Backup location: $BACKUP_DIR"
echo "  📄 Detailed reports:"
echo "     - /tmp/array_index_keys.txt"
echo "     - /tmp/empty_deps_count.txt"
echo ""
echo "✅ Automated fixes complete!"
echo ""
echo "⚠️  IMPORTANT: Please review changes before committing:"
echo "  1. Test your application thoroughly"
echo "  2. Check /tmp/array_index_keys.txt for manual fixes"
echo "  3. Review useEffect hooks for missing dependencies"
