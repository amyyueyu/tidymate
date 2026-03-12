import { createContext, useContext, useState, ReactNode } from "react";

export interface GuestChallenge {
  id: string;
  title: string;
  description: string | null;
  time_estimate_minutes: number;
  points: number;
  status: "pending" | "completed" | "skipped";
  sort_order: number;
}

export interface GuestRoom {
  id: string;
  name: string;
  before_image_url: string;
  after_image_url: string | null;
  intent: string;
  total_challenges: number;
  completed_challenges: number;
  status: string;
}

interface GuestModeContextValue {
  isGuest: boolean;
  guestRoom: GuestRoom | null;
  guestChallenges: GuestChallenge[];
  startGuestMode: () => void;
  setGuestSession: (room: GuestRoom, challenges: GuestChallenge[]) => void;
  updateGuestChallenge: (id: string, updates: Partial<GuestChallenge>) => void;
  updateGuestRoom: (updates: Partial<GuestRoom>) => void;
  clearGuestSession: () => void;
  sessionUsed: boolean;
  markSessionUsed: () => void;
}

const GuestModeContext = createContext<GuestModeContextValue | null>(null);

export const GuestModeProvider = ({ children }: { children: ReactNode }) => {
  const [isGuest, setIsGuest] = useState(() => sessionStorage.getItem("guestMode") === "true");
  const [guestRoom, setGuestRoom] = useState<GuestRoom | null>(null);
  const [guestChallenges, setGuestChallenges] = useState<GuestChallenge[]>([]);
  const [sessionUsed, setSessionUsed] = useState(false);

  const setGuestSession = (room: GuestRoom, challenges: GuestChallenge[]) => {
    setIsGuest(true);
    sessionStorage.setItem("guestMode", "true");
    setGuestRoom(room);
    setGuestChallenges(challenges);
  };

  const updateGuestChallenge = (id: string, updates: Partial<GuestChallenge>) => {
    setGuestChallenges(prev => prev.map(c => c.id === id ? { ...c, ...updates } : c));
  };

  const updateGuestRoom = (updates: Partial<GuestRoom>) => {
    setGuestRoom(prev => prev ? { ...prev, ...updates } : prev);
  };

  const clearGuestSession = () => {
    setIsGuest(false);
    sessionStorage.removeItem("guestMode");
    setGuestRoom(null);
    setGuestChallenges([]);
    setSessionUsed(false);
  };

  const markSessionUsed = () => setSessionUsed(true);

  return (
    <GuestModeContext.Provider value={{
      isGuest,
      guestRoom,
      guestChallenges,
      setGuestSession,
      updateGuestChallenge,
      updateGuestRoom,
      clearGuestSession,
      sessionUsed,
      markSessionUsed,
    }}>
      {children}
    </GuestModeContext.Provider>
  );
};

export const useGuestMode = () => {
  const ctx = useContext(GuestModeContext);
  if (!ctx) throw new Error("useGuestMode must be used within GuestModeProvider");
  return ctx;
};
