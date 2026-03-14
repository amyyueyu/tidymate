 import { useEffect, useState } from "react";
 import { supabase } from "@/integrations/supabase/client";
 import { useAuth } from "./useAuth";
 
 export interface Profile {
   id: string;
   user_id: string;
   display_name: string | null;
   total_points: number;
   current_level: number;
   current_streak: number;
   longest_streak: number;
   last_activity_date: string | null;
   created_at: string;
   updated_at: string;
 }
 
 export function useProfile() {
   const { user } = useAuth();
   const [profile, setProfile] = useState<Profile | null>(null);
   const [loading, setLoading] = useState(true);
 
   useEffect(() => {
     if (!user) {
       setProfile(null);
       setLoading(false);
       return;
     }
 
     const fetchProfile = async () => {
       const { data, error } = await supabase
         .from("profiles")
         .select("*")
         .eq("user_id", user.id)
         .maybeSingle();
 
       if (error) {
         console.error("Error fetching profile:", error);
       } else {
         setProfile(data);
       }
       setLoading(false);
     };
 
     fetchProfile();
   }, [user]);
 
   const updateProfile = async (updates: Partial<Profile>) => {
     if (!user) return;
 
     const { data, error } = await supabase
       .from("profiles")
       .update(updates)
       .eq("user_id", user.id)
       .select()
       .single();
 
     if (error) {
       console.error("Error updating profile:", error);
       throw error;
     }
 
     setProfile(data);
     return data;
   };
 
  const addPoints = async (_points: number, challengeId: string) => {
    if (!user) return;

    const { error } = await supabase.rpc("complete_challenge_add_points", {
      p_challenge_id: challengeId,
    });

    if (error) {
      console.error("Error adding points via RPC:", error);
      throw error;
    }

    // Re-fetch so local state reflects server-computed streak + level
    const { data } = await supabase
      .from("profiles")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();

    if (data) {
      console.log("Profile after points update:", {
        total_points: data.total_points,
        current_streak: data.current_streak,
        last_activity_date: data.last_activity_date,
      });
      setProfile(data);
    }
  };
 
   return { profile, loading, updateProfile, addPoints };
 }