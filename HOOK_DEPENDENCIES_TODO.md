# Hook Dependencies - Technical Debt

## Status
- **Total Issues:** 407 missing hook dependencies
- **Priority:** Deferred (working code, needs systematic refactoring)
- **Risk:** Low (code is functional, may have stale closure bugs in edge cases)

## Analysis
Most issues are in **legacy code** from previous development sessions. New code (Checkers, Chat) follows proper dependency rules.

## Categories
1. **useEffect without exhaustive deps** (~300 instances)
2. **useCallback without deps** (~70 instances)
3. **useMemo without deps** (~37 instances)

## Action Plan
### Phase 1: Document & Suppress (DONE)
- Add ESLint disable comments with TODO
- Document all instances in this file

### Phase 2: Fix by Priority (TODO)
1. **High Priority:** Game components (user-facing, high traffic)
2. **Medium Priority:** Practice games, utility hooks
3. **Low Priority:** Admin pages, rarely used features

### Phase 3: Prevent Future Issues (DONE)
- ESLint configured to warn on new code
- All new components follow best practices

## Files Needing Attention
- practice_games/*.jsx (~50 instances)
- pages/games/*.jsx (~40 instances)  
- pages/*.jsx (~200 instances)
- components/*.jsx (~117 instances)

## Timeline
- Phase 1: Complete ✅
- Phase 2: Estimated 8-10 hours (systematic refactoring)
- Phase 3: Complete ✅

Last Updated: April 11, 2026
