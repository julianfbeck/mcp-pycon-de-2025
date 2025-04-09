FROM oven/bun:latest as builder

WORKDIR /app

# Copy build-schedule files - include all necessary files
COPY build-schedule/package.json build-schedule/bun.lock build-schedule/tsconfig.json ./build-schedule/
COPY build-schedule/index.ts build-schedule/types.ts ./build-schedule/
# If example.json is used as a fallback, copy it too
COPY build-schedule/example.json ./build-schedule/

# Install dependencies for build-schedule
WORKDIR /app/build-schedule
RUN bun install

# Create the SQLite database
# Add retries and error handling for network issues during fetch
RUN bun run index.ts || (echo "Retrying database creation..." && bun run index.ts)
# Verify the database was created successfully
RUN ls -la && test -f schedule.db

# Final image
FROM oven/bun:latest

WORKDIR /app

# Copy opencontrol files 
COPY opencontrol/package.json opencontrol/bun.lock opencontrol/tsconfig.json ./opencontrol/
COPY opencontrol/src ./opencontrol/src/

# Install dependencies for opencontrol
WORKDIR /app/opencontrol
RUN bun install

# Create directory for the database
RUN mkdir -p /app/build-schedule

# Copy the database from the builder stage
COPY --from=builder /app/build-schedule/schedule.db /app/build-schedule/schedule.db

# Set proper permissions for the database file
RUN chmod 644 /app/build-schedule/schedule.db

# Create .env file with the correct DB_PATH but without the API key
# The API key should be provided at runtime as an environment variable
RUN echo "DB_PATH=/app/build-schedule/schedule.db" > .env

# Set the port for the application
ENV PORT=3000
EXPOSE 3000

# Start the application with a check to verify the API key is set
CMD ["/bin/sh", "-c", "if [ -z \"$ANTHROPIC_API_KEY\" ]; then echo 'ERROR: ANTHROPIC_API_KEY environment variable is not set'; exit 1; else echo 'ANTHROPIC_API_KEY is set, starting application...'; echo \"ANTHROPIC_API_KEY=$ANTHROPIC_API_KEY\" >> .env; bun run dev; fi"] 