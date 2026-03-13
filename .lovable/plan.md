

# TidyMind - ADHD-Friendly Declutter Assistant

## Overview
An AI-powered app that transforms tidying and decluttering from overwhelming chores into dopamine-boosting, achievable challenges. Users photograph their spaces, and AI breaks down the chaos into fun, timed micro-tasks while showing them an inspiring vision of the outcome.

---

## Core User Flow

### 1. Onboarding & Sign Up
- Simple account creation (email/password or Google sign-in)
- Brief "What's your biggest challenge?" selector (tidying, decluttering, organizing)
- Set notification preferences for gentle reminders

### 2. Capture Your Space
- Camera interface to photograph a messy area
- Select intent: "Tidy Up" / "Declutter" / "Redesign"
- Optional: Add context ("I have 15 minutes" or "Weekend project")

### 3. AI Analysis & Vision
- AI analyzes the image to identify items and clutter patterns
- Generates an inspiring "after" visualization of the transformed space
- Side-by-side before/after view to spark motivation

### 4. Gamified Challenges
- AI breaks the task into small, ADHD-friendly micro-challenges
- Each challenge has:
  - Clear, single-action instruction ("Clear the coffee table surface")
  - Time estimate (5-10 min chunks)
  - Optional timer for beat-the-clock mode
  - Point value based on difficulty
- Progress bar showing journey to completion

### 5. Rewards & Progress
- Points earned for each completed challenge
- Daily streaks with gentle celebration
- Level system unlocking achievement badges
- Room transformation history gallery

---

## Key Screens

| Screen | Purpose |
|--------|---------|
| **Home Dashboard** | Quick-start camera, streak counter, active challenges |
| **Capture & Analyze** | Camera view with intent selector |
| **Vision Board** | Before/after comparison with AI visualization |
| **Challenge Mode** | Active task with timer, progress, encouragement |
| **Progress Profile** | Points, level, badges, streak history, completed rooms |

---

## Design Philosophy
- **Calm & minimal**: Soft, muted color palette with plenty of whitespace
- **Low cognitive load**: One action per screen, clear visual hierarchy
- **Encouraging tone**: Supportive microcopy ("You've got this!" not "You must...")
- **Visual rewards**: Subtle animations for completions, not overwhelming

---

## Technical Approach
- **Backend**: Lovable Cloud for authentication, database (user profiles, challenges, progress)
- **AI**: Lovable AI for image analysis and generating personalized challenges
- **Image Generation**: AI-powered before/after visualization using the image generation model
- **Mobile-optimized**: Responsive design that works great on phones for easy photo capture

---

## MVP Scope Summary
✅ User accounts with progress persistence  
✅ Photo capture and AI room analysis  
✅ Before/after transformation visualization  
✅ Gamified micro-challenges with timers  
✅ Points, levels, and streak tracking  

