
## Bug: Timer Not Counting Down

**Root Cause**: The timer `useEffect` has `timeRemaining` in its dependency array. This means:
1. Timer starts → interval fires → `timeRemaining` decrements by 1
2. State change triggers re-render → `useEffect` cleanup runs → **interval is cleared**
3. New interval is created → but the render cycle and interval timing are out of sync
4. Net result: the interval is torn down and recreated on every tick, causing missed ticks and the appearance of the timer being frozen

**Fix**: Remove `timeRemaining` from the dependency array. The `setTimeRemaining((prev) => prev - 1)` already uses the functional updater form, so it doesn't need `timeRemaining` as a captured closure value. The `timeRemaining === 0` check for "time's up" can be handled inside the interval callback itself.

**File to change**: `src/pages/Challenge.tsx`, lines 108–120

**Before**:
```ts
useEffect(() => {
  let interval: NodeJS.Timeout;
  if (timerActive && timeRemaining > 0) {
    interval = setInterval(() => {
      setTimeRemaining((prev) => prev - 1);
    }, 1000);
  } else if (timeRemaining === 0 && timerActive) {
    setTimerActive(false);
    toast("⏰ Time's up! How did it go?");
  }
  return () => clearInterval(interval);
}, [timerActive, timeRemaining]);
```

**After**:
```ts
useEffect(() => {
  if (!timerActive) return;
  const interval = setInterval(() => {
    setTimeRemaining((prev) => {
      if (prev <= 1) {
        clearInterval(interval);
        setTimerActive(false);
        toast("⏰ Time's up! How did it go?");
        return 0;
      }
      return prev - 1;
    });
  }, 1000);
  return () => clearInterval(interval);
}, [timerActive]);
```

This way:
- The effect only re-runs when `timerActive` changes (start/pause/stop)
- The interval runs stably for its full lifetime without being torn down each second
- "Time's up" is handled inside the callback using the latest `prev` value
