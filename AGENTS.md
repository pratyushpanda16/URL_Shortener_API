# URL Shortener API - Project Instructions

## Objective

Build a clean, production-oriented URL Shortener REST API using:

- Node.js
- Express.js
- MongoDB
- Mongoose

The project is primarily for learning backend development and demonstrating backend engineering concepts.

## Architecture

Use a clean MVC-style architecture.

Separate:

- routes
- controllers
- models
- middleware
- configuration
- utilities

Business logic should not be placed directly inside route handlers.

## Development Rules

- Inspect existing code before modifying it.
- Prefer small, focused changes.
- Do not rewrite working code unnecessarily.
- Do not install unnecessary dependencies.
- Do not modify unrelated files.
- Use environment variables for configuration.
- Never hardcode secrets.
- Validate external input.
- Use appropriate HTTP status codes.
- Use centralized error handling.
- Use meaningful logging.

## API Quality

The API should have:

- consistent JSON responses
- input validation
- proper HTTP status codes
- centralized error handling
- request logging
- MongoDB indexes where appropriate
- pagination for list endpoints

## Development Workflow

Before implementing a significant feature:

1. Inspect the relevant code.
2. Explain the current structure.
3. Create a short implementation plan.
4. Implement only the requested feature.
5. Run tests/build checks.
6. Fix errors.
7. Summarize the changes.

Do not implement future features unless explicitly requested.