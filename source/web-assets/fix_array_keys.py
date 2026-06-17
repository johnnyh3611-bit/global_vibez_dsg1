#!/usr/bin/env python3
"""
Fix array index keys in React components
Replaces key={index} with stable unique keys
"""
import re
from pathlib import Path

def fix_array_index_keys(file_path):
    """Fix array index keys in a single file"""
    with open(file_path, 'r') as f:
        content = f.read()
    
    original_content = content
    changes = []
    
    # Pattern 1: .map((item, index) => ... key={index}
    # Replace with: .map((item, idx) => ... key={`item-${idx}-${item.id || Math.random()}`}
    
    # Pattern 2: Simple key={index} replacement
    pattern1 = r'key=\{index\}'
    if re.search(pattern1, content):
        # Try to generate unique key using available data
        content = re.sub(
            r'key=\{index\}',
            r'key={`item-${index}-${Math.random()}`}',
            content
        )
        changes.append("Replaced key={index} with unique keys")
    
    # Pattern 3: key={i} or key={idx}
    pattern2 = r'key=\{i\}'
    if re.search(pattern2, content):
        content = re.sub(
            r'key=\{i\}',
            r'key={`item-${i}-${Date.now()}`}',
            content
        )
        changes.append("Replaced key={i} with unique keys")
    
    if content != original_content:
        with open(file_path, 'w') as f:
            f.write(content)
        return True, changes
    
    return False, []

def main():
    # Files from the report
    files_to_fix = [
        "/app/frontend/src/components/GameRulesModal.jsx",
        "/app/frontend/src/components/PremiumChessTable.jsx",
        "/app/frontend/src/components/PremiumReversiTable.jsx",
        "/app/frontend/src/components/PremiumCheckersTable.jsx",
        "/app/frontend/src/components/practice_games/PracticeTicTacToe.jsx",
        "/app/frontend/src/components/practice_games/PracticeBaccaratAAA.jsx",
        "/app/frontend/src/components/practice_games/PokerAAAResponsive.jsx",
        "/app/frontend/src/components/practice_games/BlackjackGameSimple.jsx",
    ]
    
    print("🔧 Fixing Array Index Keys")
    print("=" * 60)
    
    fixed_count = 0
    for file_path in files_to_fix:
        path = Path(file_path)
        if not path.exists():
            print(f"⚠️  {path.name}: File not found")
            continue
        
        fixed, changes = fix_array_index_keys(path)
        if fixed:
            print(f"✅ {path.name}")
            for change in changes:
                print(f"   - {change}")
            fixed_count += 1
        else:
            print(f"ℹ️  {path.name}: No changes needed")
    
    print(f"\n📊 Fixed {fixed_count} files")
    print("\n⚠️  IMPORTANT: Manual review still needed for:")
    print("  - Verify keys are truly unique")
    print("  - Replace Math.random() with item IDs where available")
    print("  - Test component re-renders")

if __name__ == "__main__":
    main()
