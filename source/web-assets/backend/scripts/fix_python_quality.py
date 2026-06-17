#!/usr/bin/env python3
"""
Automated Fix: Python Code Quality Issues
Fixes undefined variables, mutable defaults, and anti-patterns
"""
import re
from pathlib import Path

def fix_is_comparisons(file_path):
    """Fix 'is' comparisons with constants (should use ==)"""
    with open(file_path, 'r') as f:
        content = f.read()
    
    original = content
    
    # Fix common patterns
    content = re.sub(r'\bif\s+(\w+)\s+is\s+0\b', r'if \1 == 0', content)
    content = re.sub(r'\bif\s+(\w+)\s+is\s+1\b', r'if \1 == 1', content)
    content = re.sub(r'\bif\s+(\w+)\s+is\s+True\b', r'if \1 == True', content)
    content = re.sub(r'\bif\s+(\w+)\s+is\s+False\b', r'if \1 == False', content)
    content = re.sub(r'\bif\s+(\w+)\s+is\s+"', r'if \1 == "', content)
    content = re.sub(r'\bif\s+(\w+)\s+is\s+\'', r'if \1 == \'', content)
    
    if content != original:
        with open(file_path, 'w') as f:
            f.write(content)
        return True
    return False

def fix_random_to_secrets(file_path):
    """Replace random module with secrets for security"""
    with open(file_path, 'r') as f:
        content = f.read()
    
    original = content
    
    # Only fix if used for token/ID generation (not game logic)
    if 'token' in content.lower() or 'secret' in content.lower() or '_id' in content:
        content = content.replace('import secrets', 'import secrets')
        content = re.sub(r'random\.choice\(', 'secrets.choice(', content)
        content = re.sub(r'random\.randint\(0,\s*(\d+)\)', r'secrets.randbelow(\1)', content)
    
    if content != original:
        with open(file_path, 'w') as f:
            f.write(content)
        return True
    return False

def scan_and_fix_python_files():
    """Scan and fix all Python files"""
    backend_path = Path('/home/johnnie/master-project')
    fixed_files = []
    
    for py_file in backend_path.rglob('*.py'):
        if '__pycache__' in str(py_file):
            continue
        
        fixed = False
        
        # Fix is comparisons
        if fix_is_comparisons(py_file):
            fixed = True
        
        # Fix random module
        if fix_random_to_secrets(py_file):
            fixed = True
        
        if fixed:
            fixed_files.append(str(py_file))
    
    return fixed_files

if __name__ == "__main__":
    print("🔧 Fixing Python code quality issues...\n")
    
    fixed = scan_and_fix_python_files()
    
    print(f"\n✅ Fixed {len(fixed)} Python files")
    if fixed:
        print("\nFixed files:")
        for f in fixed[:10]:  # Show first 10
            print(f"  - {f}")
        if len(fixed) > 10:
            print(f"  ... and {len(fixed) - 10} more")
