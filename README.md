# PyConDE 2025 OpenControl

This repository contains an OpenControl application for the PyConDE 2025 conference, allowing for schedule queries using Claude 3.7 Sonnet.

## Docker Setup

The application is containerized using Docker, with a two-stage process:
1. First stage builds the SQLite database with conference schedule data
2. Second stage runs the OpenControl application with the built database

### Prerequisites

- Docker and Docker Compose
- An Anthropic API key

### Running with Docker Compose

1. Set your Anthropic API key as an environment variable:
   ```bash
   export ANTHROPIC_API_KEY=your_api_key_here
   ```

2. Build and start the application:
   ```bash
   docker-compose up --build
   ```

3. Access the application at http://localhost:3000

### Running with Docker Directly

1. Build the Docker image:
   ```bash
   docker build -t pycon-opencontrol .
   ```

2. Run the container:
   ```bash
   docker run -p 3000:3000 -e ANTHROPIC_API_KEY=your_api_key_here pycon-opencontrol
   ```

## Project Structure

- `build-schedule/`: Contains code to build the SQLite database with conference data
- `opencontrol/`: Contains the OpenControl application that uses Claude to answer conference schedule queries

## Development

For local development without Docker:

1. Build the database:
   ```bash
   cd build-schedule
   bun install
   bun run index.ts
   ```

2. Run the OpenControl application:
   ```bash
   cd opencontrol
   bun install
   echo "ANTHROPIC_API_KEY=your_api_key_here" > .env
   echo "DB_PATH=../build-schedule/schedule.db" >> .env
   bun run dev
   ```
