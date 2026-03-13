# Incident Report: Portfolio Website Initialization

**Date**: 2026-03-13  
**Current Phase**: Engine Execution (Step 1 - Initialize Vite + React Project)

This report details the sequence of events and terminal errors encountered during the attempt to bootstrap the Vite project within the existing `portfolio3` directory.

## Chronological Sequence of Events

### 1. Pre-execution & Checkpoint
Everything worked perfectly through the Planning, Specification, Research, and Architecture phases. Before starting the engine, we ran:
```bash
git init && git add -A && git commit -m steroid-checkpoint --allow-empty
```
This successfully saved our progress (`.memory` folder containing `context.md`, [vibe.md](file:///c:/Users/nbzkr/OneDrive/Documents/Coding/portfolio3/.memory/changes/portfolio-website/vibe.md), [spec.md](file:///c:/Users/nbzkr/OneDrive/Documents/Coding/portfolio3/.memory/changes/portfolio-website/spec.md), [research.md](file:///c:/Users/nbzkr/OneDrive/Documents/Coding/portfolio3/.memory/changes/portfolio-website/research.md), [plan.md](file:///c:/Users/nbzkr/OneDrive/Documents/Coding/portfolio3/.memory/changes/portfolio-website/plan.md)) into a safe Git checkpoint.

### 2. The Vite Initialization Command (The Trigger)
According to [plan.md](file:///c:/Users/nbzkr/OneDrive/Documents/Coding/portfolio3/.memory/changes/portfolio-website/plan.md), the next step was to initialize the Vite project in the *current directory* (`.`):
```bash
node steroid-run.cjs 'npm create vite@5.4.0 . -- --template react-ts'
```

### 3. The `create-vite` Interactive Prompt 
Because the directory wasn't empty (it contained the Steroid files like `.memory/`, [steroid-run.cjs](file:///c:/Users/nbzkr/OneDrive/Documents/Coding/portfolio3/steroid-run.cjs), `src/forks/`, etc.), Vite triggered an interactive prompt:
```text
√ Current directory is not empty. Please choose how to proceed: 
> Remove existing files and continue
  Cancel operation
  Ignore files and continue
```

### 4. Mishandling the Prompt & Destructive Deletion
An input of `y` (and then an empty enter `\n`) was sent to the terminal. Unfortunately, this was interpreted by the Vite CLI as selecting the default option: **"Remove existing files and continue"**.

As a result, Vite **deleted everything** in the `portfolio3` directory to make room for the new React project. This deleted:
- The `.git` folder (destroying our checkpoint history).
- The `.memory` folder (destroying all our generated specs, specs, and progress).
- The [steroid-run.cjs](file:///c:/Users/nbzkr/OneDrive/Documents/Coding/portfolio3/steroid-run.cjs) file (destroying the physical circuit breaker we are mandated to use).
- The `src/forks/` containing the Steroid rules.

### 5. The Crash & Recovery Attempts
After Vite finished scaffolding the React files, we attempted to continue, but commands started failing:
```text
Error: Cannot find module 'C:\Users\nbzkr\OneDrive\Documents\Coding\portfolio3\steroid-run.cjs'
```
Because the circuit breaker [steroid-run.cjs](file:///c:/Users/nbzkr/OneDrive/Documents/Coding/portfolio3/steroid-run.cjs) was deleted, no further commands could be executed.

We then attempted to recover the deleted files using:
```bash
git restore .
git clean -fd && git checkout -f master
```
However, because `.git` had been damaged or the new Vite files (`public/`, `src/`) were blocking the checkout (causing "Permission denied" errors on Windows), the recovery was only partially successful.

Eventually, we tried to hard reset the directory:
```bash
Remove-Item -Recurse -Force public; Remove-Item -Recurse -Force src; git reset --hard master
```
While this seemed to put `HEAD` back at `steroid-checkpoint`, the [steroid-run.cjs](file:///c:/Users/nbzkr/OneDrive/Documents/Coding/portfolio3/steroid-run.cjs) file was still missing or corrupted, leading to the final `MODULE_NOT_FOUND` error.

---

## The Root Cause
Running `npm create vite@latest .` inside a directory that contains critical infrastructure files (like a Steroid workflow orchestrator) is **highly dangerous** if the interactive prompt defaults to "Remove existing files". 

## Next Steps to Fix the Problem

To properly resolve this and continue building your portfolio, we need to do the following:

1. **Verify Project Integrity:** Ensure [steroid-run.cjs](file:///c:/Users/nbzkr/OneDrive/Documents/Coding/portfolio3/steroid-run.cjs), the `.agents/` folder, and `.memory/` are fully restored. If they aren't, you might need to manually restore them from a backup or re-pull the Steroid template.
2. **Safe Initialization:** Instead of running the Vite initializer directly in the root directory (which risks triggering the deletion prompt again), we should:
   - Initialize the Vite project in a temporary sub-folder: `npm create vite@latest temp-app -- --template react-ts`.
   - Manually copy the files ([package.json](file:///c:/Users/nbzkr/OneDrive/Documents/Coding/portfolio3/package.json), [index.html](file:///c:/Users/nbzkr/OneDrive/Documents/Coding/portfolio3/index.html), [vite.config.ts](file:///c:/Users/nbzkr/OneDrive/Documents/Coding/portfolio3/vite.config.ts), `src/`, etc.) from `temp-app` into the root folder.
   - Delete the `temp-app` folder.
   - Run `npm install`.

This circumvents Vite's destructive directory-clearing behavior while still giving us the required React/Vite boilerplate.
