FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package.json yarn.lock ./

# Install dependencies
RUN yarn install --frozen-lockfile

# Copy application code
COPY . .

# Lift Node's heap cap so the production webpack build doesn't OOM.
# This codebase compiles 925+ TS/TSX modules + Solana/Three/Privy
# bundles which routinely peak around 4–5 GB during compilation.
# Without this the default ~1.5 GB heap kills the build silently
# and the deploy fails. Using 4096 to stay safely under typical 8 GB
# build-pod limits while still leaving headroom for sourcemap-free
# minification.
ENV NODE_OPTIONS="--max-old-space-size=4096"
ENV GENERATE_SOURCEMAP=false
ENV TSC_COMPILE_ON_ERROR=true
ENV DISABLE_ESLINT_PLUGIN=true
ENV CI=false
ENV REACT_APP_BACKEND_URL="https://global-vibez-dsg-production.up.railway.app"

# Build for production
RUN yarn build

# Install serve to run production build
RUN yarn global add serve

# Expose port
EXPOSE 3000

# Start production server
CMD ["serve", "-s", "build", "-l", "3000"]
