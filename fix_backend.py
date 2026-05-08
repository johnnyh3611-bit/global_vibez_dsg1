#!/usr/bin/env python3
"""
Automated Code Quality Fixer - Backend Python
Fixes critical security and code quality issues
"""
import re
import os
from pathlib import Path
from typing import List, Tuple

class BackendFixer:
    def __init__(self, base_path: str = "/app/backend"):
        self.base_path = Path(base_path)
        self.fixes_applied = []
        
    def fix_random_to_secrets(self, file_path: Path) -> bool:
        """Replace random module with secrets for cryptographic security"""
        with open(file_path, 'r') as f:
            content = f.read()
        
        original_content = content
        
        # Replace import random with import secrets
        content = re.sub(
            r'^import random$',
            'import secrets\nsecure_random = secrets.SystemRandom()',
            content,
            flags=re.MULTILINE
        )
        
        # Replace random.choice() with secure_random.choice()
        content = re.sub(r'random\.choice\(', 'secure_random.choice(', content)
        
        # Replace random.shuffle() with secure_random.shuffle()
        content = re.sub(r'random\.shuffle\(', 'secure_random.shuffle(', content)
        
        # Replace random.randint() with secrets.randbelow()
        # Note: random.randint(a, b) -> a + secrets.randbelow(b - a + 1)
        # This is more complex, flag for manual review
        if 'random.randint' in content:
            self.fixes_applied.append(f"⚠️  {file_path}: random.randint() needs manual conversion")
        
        if content != original_content:
            with open(file_path, 'w') as f:
                f.write(content)
            return True
        return False
    
    def fix_is_literal_comparisons(self, file_path: Path) -> bool:
        """Replace 'is' with '==' for literal comparisons"""
        with open(file_path, 'r') as f:
            content = f.read()
        
        original_content = content
        
        # Fix: if x is "string" -> if x == "string"
        content = re.sub(
            r'\bis\s+(["\'])',
            r'== \1',
            content
        )
        
        # Fix: if x is not "string" -> if x != "string"
        content = re.sub(
            r'\bis\s+not\s+(["\'])',
            r'!= \1',
            content
        )
        
        # Fix numeric literals: if x is 0 -> if x == 0
        content = re.sub(
            r'\bis\s+(\d+)',
            r'== \1',
            content
        )
        
        if content != original_content:
            with open(file_path, 'w') as f:
                f.write(content)
            return True
        return False
    
    def detect_mutable_defaults(self, file_path: Path) -> List[Tuple[int, str]]:
        """Detect mutable default arguments"""
        issues = []
        with open(file_path, 'r') as f:
            lines = f.readlines()
        
        for i, line in enumerate(lines, 1):
            # Match def func(arg=[] or arg={} or arg=set())
            if re.search(r'def\s+\w+\([^)]*=\s*(\[\]|\{\}|set\(\))', line):
                issues.append((i, line.strip()))
        
        return issues
    
    def run_all_fixes(self) -> dict:
        """Run all automated fixes on backend files"""
        stats = {
            'random_to_secrets': 0,
            'is_comparisons': 0,
            'mutable_defaults_detected': []
        }
        
        # Process all Python files
        for file_path in self.base_path.rglob('*.py'):
            # Skip migrations, __pycache__, etc.
            if '__pycache__' in str(file_path) or 'migrations' in str(file_path):
                continue
            
            # Fix random -> secrets
            if self.fix_random_to_secrets(file_path):
                stats['random_to_secrets'] += 1
                self.fixes_applied.append(f"✅ {file_path.relative_to(self.base_path)}: random → secrets")
            
            # Fix is literal comparisons
            if self.fix_is_literal_comparisons(file_path):
                stats['is_comparisons'] += 1
                self.fixes_applied.append(f"✅ {file_path.relative_to(self.base_path)}: fixed 'is' literals")
            
            # Detect mutable defaults
            mutable_issues = self.detect_mutable_defaults(file_path)
            if mutable_issues:
                stats['mutable_defaults_detected'].append((file_path, mutable_issues))
        
        return stats

if __name__ == "__main__":
    print("🔧 Backend Code Quality Fixer")
    print("=" * 60)
    
    fixer = BackendFixer()
    stats = fixer.run_all_fixes()
    
    print("\n📊 RESULTS:")
    print(f"  ✅ Files fixed (random → secrets): {stats['random_to_secrets']}")
    print(f"  ✅ Files fixed ('is' literals): {stats['is_comparisons']}")
    print(f"  ⚠️  Files with mutable defaults: {len(stats['mutable_defaults_detected'])}")
    
    print("\n📋 FIXES APPLIED:")
    for fix in fixer.fixes_applied[:20]:  # Show first 20
        print(f"  {fix}")
    
    if len(fixer.fixes_applied) > 20:
        print(f"  ... and {len(fixer.fixes_applied) - 20} more")
    
    if stats['mutable_defaults_detected']:
        print("\n⚠️  MUTABLE DEFAULT ARGUMENTS (Manual Fix Needed):")
        for file_path, issues in stats['mutable_defaults_detected'][:5]:
            print(f"\n  {file_path.relative_to(Path('/app/backend'))}:")
            for line_num, line in issues:
                print(f"    Line {line_num}: {line}")
    
    print("\n✅ Automated fixes complete!")
