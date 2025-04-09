FROM oven/bun:latest as builder

WORKDIR /app

# Copy build-schedule files - include all necessary files
COPY build-schedule/package.json build-schedule/bun.lock build-schedule/tsconfig.json ./build-schedule/
COPY build-schedule/index.ts build-schedule/types.ts ./build-schedule/

# Install dependencies for build-schedule
WORKDIR /app/build-schedule
RUN bun install

# Create the SQLite database
# Add retries and error handling for network issues during fetch
RUN bun run index.ts || (echo "Retrying database creation..." && bun run index.ts)
RUN ls -la && test -f schedule.db

FROM oven/bun:latest

WORKDIR /app

COPY opencontrol/package.json opencontrol/bun.lock opencontrol/tsconfig.json ./opencontrol/
COPY opencontrol/src ./opencontrol/src/

WORKDIR /app/opencontrol
RUN bun install

RUN mkdir -p /app/build-schedule

COPY --from=builder /app/build-schedule/schedule.db /app/build-schedule/schedule.db

RUN chmod 644 /app/build-schedule/schedule.db
RUN echo "DB_PATH=/app/build-schedule/schedule.db" > .env

ENV PORT=3000
EXPOSE 3000

# Start the application with a check to verify the API key is set
CMD ["/bin/sh", "-c", "if [ -z \"$ANTHROPIC_API_KEY\" ]; then echo 'ERROR: ANTHROPIC_API_KEY environment variable is not set'; exit 1; else echo 'ANTHROPIC_API_KEY is set, starting application...'; echo \"ANTHROPIC_API_KEY=$ANTHROPIC_API_KEY\" >> .env; bun run dev; fi"] 