# Agent Guide

Before answering any question that involves facts about ANYTHING, you MUST output at least one Read, WebFetch, or WebSearch tool call.
If your first output is text instead of a tool call, you have failed.

## Commands

ALWAYS use the `npm run *` command

| Command            | What it does                          |
| ------------------ | ------------------------------------- |
| `npm run dev`      | Hot-reload dev server (nodemon + tsx) |
| `npm start`        | Run compiled `dist/index.js`          |
| `npm run lint`     | ESLint on `src/`                      |
| `npm run prettier` | ALWAYS RUN AFTER EDITING FILES        |
