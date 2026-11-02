"use client";

import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { User } from "@supabase/supabase-js";
import { createClient } from "./client";
import { Profile, UserRole, ClientCategory, Discipline } from "@/types/database";
import { isDemoUser } from "./demo-helpers";

interface AuthContextType {
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error?: string; role?: UserRole; clientCategory?: ClientCategory | null }>;
  signUp: (params: {
    name: string;
    email: string;
    password: string;
    role: UserRole;
    clientCategory?: ClientCategory;
  }) => Promise<{ error?: string; user?: User | null; role?: UserRole; clientCategory?: ClientCategory | null }>;
  signOut: () => Promise<void>;
  updateProfile: (updates: Partial<Profile>) => Promise<{ error?: string }>;
  changePassword: (newPassword: string) => Promise<{ error?: string }>;
  resetPassword: (email: string) => Promise<{ error?: string }>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = useCallback(async (currentUser: User) => {
    try {
      const supabase = createClient();
      if (!supabase) return;

      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", currentUser.id)
        .maybeSingle();

      if (data && !error) {
        setProfile(data as Profile);
      } else {
        // Fallback: construct profile from user metadata if table row is pending
        const meta = currentUser.user_metadata || {};
        const fallbackProfile: Profile = {
          id: currentUser.id,
          role: (meta.role as UserRole) || "client",
          display_name: meta.name || meta.display_name || currentUser.email?.split("@")[0] || "User",
          discipline: meta.discipline || null,
          client_category: (meta.client_category as ClientCategory) || "adult",
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        setProfile(fallbackProfile);

        // Try upserting to database
        try {
          await supabase.from("profiles").upsert(fallbackProfile);
        } catch {}
      }
    } catch (err) {
      console.warn("Could not fetch user profile:", err);
    }
  }, []);

  const refreshProfile = useCallback(async () => {
    if (user) {
      await fetchProfile(user);
    }
  }, [user, fetchProfile]);

  useEffect(() => {
    const supabase = createClient();
    if (!supabase) {
      setLoading(false);
      return;
    }

    // Check active session
    supabase.auth.getSession().then(({ data: { session } }) => {
      const activeUser = session?.user ?? null;
      setUser(activeUser);
      if (activeUser) {
        fetchProfile(activeUser).finally(() => setLoading(false));
      } else {
        setLoading(false);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      const activeUser = session?.user ?? null;
      setUser(activeUser);
      if (activeUser) {
        fetchProfile(activeUser);
      } else {
        setProfile(null);
      }
      setLoading(false);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [fetchProfile]);

  const signIn = async (email: string, password: string) => {
    const supabase = createClient();
    if (!supabase) return { error: "Authentication service not initialized" };

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      return { error: error.message };
    }

    if (data.user) {
      setUser(data.user);
      await fetchProfile(data.user);
      const meta = data.user.user_metadata || {};
      const role = (meta.role as UserRole) || profile?.role || "client";
      const clientCategory = (meta.client_category as ClientCategory) || profile?.client_category || "adult";

      // If a client logs in, permanently delete temporary credentials from therapist view
      if (role === "client") {
        fetch("/api/auth/clear-temp-credentials", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userId: data.user.id,
            email: data.user.email,
            reason: "first_login",
          }),
        }).catch((err) => console.warn("Failed to clear temp credentials on signin:", err));
      }

      return { role, clientCategory };
    }

    return {};
  };

  const signUp = async ({
    name,
    email,
    password,
    role,
    clientCategory,
  }: {
    name: string;
    email: string;
    password: string;
    role: UserRole;
    clientCategory?: ClientCategory;
  }) => {
    const supabase = createClient();
    if (!supabase) return { error: "Authentication service not initialized" };

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          name,
          display_name: name,
          role,
          client_category: role === "client" ? (clientCategory || "adult") : null,
        },
      },
    });

    if (error) {
      return { error: error.message };
    }

    if (data.user) {
      setUser(data.user);

      // Create profile row in profiles table
      const newProfile: Partial<Profile> = {
        id: data.user.id,
        role,
        display_name: name,
        email: email.trim().toLowerCase(),
        discipline: role === "therapist" ? "OT" : null,
        client_category: role === "client" ? (clientCategory || "adult") : null,
      };

      try {
        await supabase.from("profiles").upsert(newProfile);
      } catch (e) {
        console.warn("Could not immediately upsert profile:", e);
      }

      await fetchProfile(data.user);

      return {
        user: data.user,
        role,
        clientCategory: role === "client" ? (clientCategory || "adult") : null,
      };
    }

    return {};
  };

  const signOut = async () => {
    const supabase = createClient();
    if (supabase) {
      await supabase.auth.signOut();
    }
    setUser(null);
    setProfile(null);
  };

  const updateProfile = async (updates: Partial<Profile>) => {
    if (!user) return { error: "Not authenticated" };
    const supabase = createClient();
    if (!supabase) return { error: "Authentication service not initialized" };

    // Demo / mock users have no real auth session — update local state only
    // (no DB row, RLS would reject empty auth.uid()).
    if (isDemoUser(user, profile)) {
      const localUpdates: Partial<Profile> & { updated_at: string } = {
        ...updates,
        updated_at: new Date().toISOString(),
      };
      setProfile((prev) => (prev ? { ...prev, ...localUpdates } : prev));
      return {};
    }

    // Ensure required columns are present — upsert path inserts a new row if none exists yet,
    // and Postgres rejects NULL for `role`/`display_name` (schema NOT NULL).
    const fallbackRole = (profile?.role || (user.user_metadata as Record<string, unknown>)?.role || "client") as UserRole;
    const fallbackDisplayName =
      profile?.display_name ||
      (user.user_metadata as Record<string, unknown>)?.display_name as string ||
      (user.user_metadata as Record<string, unknown>)?.name as string ||
      user.email?.split("@")[0] ||
      "User";

    const cleanUpdates: Partial<Profile> & { id: string; updated_at: string } = {
      ...updates,
      id: user.id,
      role: (updates.role as UserRole) ?? fallbackRole,
      display_name: updates.display_name ?? fallbackDisplayName,
      updated_at: new Date().toISOString(),
    };

    // Prefer update (profile row should already exist via auth trigger). Fall back to insert
    // only if the update matched zero rows — preserves self-heal without risking null `role`.
    // With 20261102 RLS fix, INSERT is now allowed for id = auth.uid().
    const { data: updatedRow, error: updateError } = await supabase
      .from("profiles")
      .update(cleanUpdates)
      .eq("id", user.id)
      .select("id")
      .maybeSingle();

    let error = updateError;
    if (!updateError && !updatedRow) {
      const { error: insertError } = await supabase.from("profiles").insert(cleanUpdates);
      error = insertError ?? null;
      // If insert failed due to conflict (row was created concurrently), retry update once
      if (error && error.message.includes("duplicate key")) {
        const retry = await supabase.from("profiles").update(cleanUpdates).eq("id", user.id).select("id").maybeSingle();
        error = retry.error ?? null;
      }
    }

    if (error) {
      // Surface actionable hint for stale local RLS
      const hint = error.message.includes("row-level security")
        ? `${error.message} — run supabase/RUN_ONCE_FIX_PROFILES_RLS.sql in Supabase SQL Editor, then retry.`
        : error.message;
      return { error: hint };
    }

    // Sync demographic changes to linked patients record
    try {
      const patientUpdates: Record<string, unknown> = {
        updated_at: new Date().toISOString(),
      };
      if (updates.display_name) patientUpdates.name = updates.display_name;
      if (updates.age !== undefined && updates.age !== null) patientUpdates.age = Number(updates.age);
      if (updates.primary_condition !== undefined && updates.primary_condition !== null) patientUpdates.condition = updates.primary_condition;
      if (updates.caregiver_name !== undefined) patientUpdates.caregiver_name = updates.caregiver_name;
      if (updates.client_category !== undefined) patientUpdates.client_category = updates.client_category;

      if (Object.keys(patientUpdates).length > 1) {
        await supabase.from("patients").update(patientUpdates).eq("client_user_id", user.id);
      }
    } catch (patientSyncErr) {
      console.warn("Could not sync profile to patients table:", patientSyncErr);
    }

    setProfile((prev) => (prev ? { ...prev, ...cleanUpdates } : null));
    return {};
  };

  const changePassword = async (newPassword: string) => {
    if (!user) return { error: "Not authenticated" };
    const supabase = createClient();
    if (!supabase) return { error: "Authentication service not initialized" };

    const { error } = await supabase.auth.updateUser({
      password: newPassword,
    });

    if (error) {
      return { error: error.message };
    }

    // Always permanently delete temporary credentials from therapist view when password is changed
    fetch("/api/auth/clear-temp-credentials", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId: user.id,
        email: user.email,
        reason: "password_changed",
      }),
    }).catch((err) => console.warn("Failed to clear temp credentials on password change:", err));

    return {};
  };

  const resetPassword = async (email: string) => {
    const supabase = createClient();
    if (!supabase) return { error: "Authentication service not initialized" };

    const redirectTo =
      typeof window !== "undefined"
        ? `${window.location.origin}/login?mode=reset`
        : undefined;

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo,
    });

    if (error) {
      return { error: error.message };
    }

    return {};
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        loading,
        signIn,
        signUp,
        signOut,
        updateProfile,
        changePassword,
        resetPassword,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
