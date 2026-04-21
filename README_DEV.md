# Vital Logic Development Guide

## Overview

This guide provides a foundational understanding of the **Vital Logic** system architecture, core components, and best practices for development. It is intended for all engineers contributing to the Vital Logic codebase.

---

## System Architecture

Vital Logic is built on a microservices architecture, leveraging **Go** for high-performance backend services and **React/TypeScript** for the frontend client. Communication between services is handled via **gRPC** for internal communication and **REST** for external APIs.

### Core Components

| Component | Technology Stack | Purpose |
|---|---|---|
| **Data Ingestion Service** | Go, Kafka, PostgreSQL | Handles real-time data streaming and initial validation. |
| **Processing Engine** | Go, Redis, Kubernetes | Executes core business logic and state management. |
| **API Gateway** | Go, REST, OAuth 2.0 | Manages external traffic, authentication, and routing. |
| **Frontend Client** | React, TypeScript, Redux | User interface for monitoring and configuration. |

### Data Flow Diagram

*(A detailed diagram showing the flow of data from ingestion to presentation should be inserted here.)*

---

## Development Environment Setup

### Prerequisites

- Go (v1.20+)
- Node.js (v18+) and npm
- Docker and Docker Compose
- A valid IDE (VS Code recommended)

### Setup Steps

1. **Clone the repository:**
   ```bash
   git clone git@github.com:vital-logic/monorepo.git
   cd monorepo
   ```

2. **Initialize Submodules:**
   ```bash
   git submodule update --init --recursive
   ```

3. **Local Environment:** Use Docker Compose to spin up local dependencies (e.g., PostgreSQL, Kafka, Redis).
   ```bash
   docker-compose up -d
   ```

4. **Run Backend Services:** Navigate to each service directory and run:
   ```bash
   go run cmd/main.go
   ```

5. **Run Frontend:**
   ```bash
   cd frontend
   npm install
   npm start
   ```

---

## Coding Standards and Practices

### Go (Backend)

- **Error Handling:** Use custom error types and wrap errors for context. Avoid simple `panic()` calls.
  ```go
  // Good:
  return nil, fmt.Errorf("failed to fetch user %d: %w", userID, err)

  // Bad:
  // panic("failed to fetch user")
  ```
- **Concurrency:** Use `sync.WaitGroup` and channels for structured concurrency. Avoid global mutexes where possible.
- **Testing:** Every package must have unit tests covering critical paths. Use table-driven tests for functions with multiple inputs/outputs.

### React/TypeScript (Frontend)

- **Component Structure:** Use functional components and React Hooks. Keep components small and focused (Single Responsibility Principle).
- **State Management:** Use Redux Toolkit for global application state. Avoid prop drilling by leveraging context for localized state sharing.
- **Typing:** Ensure strict TypeScript usage. All function arguments, return values, and component props must be explicitly typed.

---

## Deployment and Operations

### CI/CD Pipeline

We use **GitHub Actions** for our continuous integration and deployment pipeline.

| Stage | Trigger | Action |
|---|---|---|
| **Test** | Push to any branch | Runs unit and integration tests. |
| **Build** | Merge to `main` | Builds Docker images for all services. |
| **Deploy** | Tag push or Manual Trigger | Deploys new images to the Kubernetes cluster. |

### Observability

- **Logging:** Services use structured logging (JSON format) and send logs to **Elasticsearch/Kibana (ELK Stack)**.
- **Metrics:** Utilize Prometheus and Grafana for monitoring key service metrics (latency, error rates, saturation).
- **Tracing:** Implement distributed tracing using Jaeger to profile requests across microservices.

---

## Contribution Guidelines

1. **Feature Branching:** All new work must be done on a dedicated feature branch (`feat/your-feature-name`).
2. **Pull Requests (PRs):** PRs must include a clear description, link to the Jira ticket, and pass all CI checks.
3. **Code Review:** Every PR requires at least one approval from a senior engineer before merging.
4. **Documentation:** Update this guide, API specifications, and READMEs as needed when implementing changes.

---

## Future Roadmap

- [ ] Transition to native Go micro-frontends (long-term exploration).
- [ ] Implement enhanced AI-driven anomaly detection in the Processing Engine (Q3 2026).
- [ ] Migrate database to a managed service (e.g., AWS RDS) for improved scalability (Q4 2026).
