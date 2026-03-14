import { useCallback } from "react";
import confetti from "canvas-confetti";

export function useConfetti() {
  /** Small burst — completing a single challenge */
  const popChallenge = useCallback(() => {
    confetti({
      particleCount: 60,
      spread: 55,
      origin: { y: 0.75 },
      colors: ["#7DD87A", "#0D9C6B", "#C5F07A", "#ffffff"],
      scalar: 0.9,
      startVelocity: 28,
      gravity: 1.1,
      ticks: 160,
    });
  }, []);

  /** Big full-screen shower — finishing ALL challenges */
  const showerComplete = useCallback(() => {
    const duration = 2800;
    const end = Date.now() + duration;

    const frame = () => {
      confetti({
        particleCount: 5,
        angle: 60,
        spread: 55,
        origin: { x: 0 },
        colors: ["#7DD87A", "#0D9C6B", "#C5F07A", "#B5F5D8", "#ffffff"],
        scalar: 1.1,
      });
      confetti({
        particleCount: 5,
        angle: 120,
        spread: 55,
        origin: { x: 1 },
        colors: ["#7DD87A", "#0D9C6B", "#C5F07A", "#B5F5D8", "#ffffff"],
        scalar: 1.1,
      });
      if (Date.now() < end) requestAnimationFrame(frame);
    };

    frame();
  }, []);

  /** Star-shaped burst — AI praise / progress photo reward */
  const starBurst = useCallback(() => {
    const star = confetti.shapeFromPath({
      path: "M0,-10 L2.4,-3.1 L9.5,-3.1 L3.8,1.2 L6.2,8.1 L0,4 L-6.2,8.1 L-3.8,1.2 L-9.5,-3.1 L-2.4,-3.1 Z",
    });

    confetti({
      shapes: [star],
      particleCount: 40,
      spread: 80,
      origin: { y: 0.6 },
      colors: ["#C5F07A", "#FFD700", "#7DD87A", "#ffffff"],
      scalar: 1.4,
      startVelocity: 35,
      gravity: 0.9,
      ticks: 200,
    });
  }, []);

  return { popChallenge, showerComplete, starBurst };
}
