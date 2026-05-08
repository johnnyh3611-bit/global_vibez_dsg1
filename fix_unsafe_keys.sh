#!/bin/bash
# Fix all unsafe _.id and i.id patterns in game components

echo "Fixing unsafe key patterns in game components..."

# Fix pattern: key={_.id || _.name || \`item-${i}\`} -> key={\`item-${i}\`}
find /app/frontend/src/pages/games /app/frontend/src/components/practice_games -name "*.jsx" -type f -exec sed -i 's/key={_\.id || _\.name || `item-\${i}`}/key={`item-${i}`}/g' {} \;
find /app/frontend/src/pages/games /app/frontend/src/components/practice_games -name "*.jsx" -type f -exec sed -i 's/key={_\.id || `.*-\${i}`}/key={`item-${i}`}/g' {} \;

# Fix pattern: key={i.id || i.name || \`item-${i}\`} -> key={\`item-${i}\`}
find /app/frontend/src/pages/games /app/frontend/src/components/practice_games -name "*.jsx" -type f -exec sed -i 's/key={i\.id || i\.name || `item-\${i}`}/key={`item-${i}`}/g' {} \;
find /app/frontend/src/pages/games /app/frontend/src/components/practice_games -name "*.jsx" -type f -exec sed -i 's/key={i\.id || i\.name || `.*-\${i}`}/key={`item-${i}`}/g' {} \;

echo "Fixed unsafe key patterns!"
