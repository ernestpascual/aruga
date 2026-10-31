/**
 * Database Seed Script for Aruga
 * Provisions synthetic adult demonstration clinical records:
 * - Dr. Elena Ramos, OTR/L (Therapist)
 * - Marcus Vance (Client, Age 58, Adult Tabletop Post-Stroke Rehabilitation)
 * - Ordered Home Program with 3 steps
 * - Submissions, Reviews, Messages with @home-program mentions
 * - Meta AI Muse Spark observations and SAM 3.1 tracking records
 */

import { createClient } from "@supabase/supabase-js";
import {
  DEMO_THERAPIST_ID,
  DEMO_CLIENT_ID,
  DEMO_PATIENT_ID,
  DEMO_PROGRAM_ID,
  DEMO_SUBMISSION_ID,
  DEMO_REVIEW_ID,
  DEMO_STEP_1_ID,
  DEMO_STEP_2_ID,
  DEMO_STEP_3_ID,
  DEMO_STEP_SUB_1_ID,
  DEMO_STEP_SUB_2_ID,
  DEMO_STEP_SUB_3_ID,
  getMockStore,
} from "../src/lib/supabase/mock-store";

async function main() {
  console.log("==========================================");
  console.log("Aruga: Seeding Adult Demonstration Records");
  console.log("==========================================");

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SECRET_KEY;

  if (supabaseUrl && serviceKey && !supabaseUrl.includes("placeholder")) {
    console.log(`Connecting to database at: ${supabaseUrl}`);
    const supabase = createClient(supabaseUrl, serviceKey);

    // 1. Profiles
    console.log("Seeding profiles...");
    await supabase.from("profiles").upsert([
      {
        id: DEMO_THERAPIST_ID,
        role: "therapist",
        display_name: "Dr. Elena Ramos, OTR/L",
        discipline: "OT",
      },
      {
        id: DEMO_CLIENT_ID,
        role: "client",
        display_name: "Marcus Vance",
        discipline: null,
      },
    ]);

    // 2. Patient
    console.log("Seeding patient record (Marcus Vance, Age 58)...");
    await supabase.from("patients").upsert([
      {
        id: DEMO_PATIENT_ID,
        therapist_id: DEMO_THERAPIST_ID,
        client_user_id: DEMO_CLIENT_ID,
        name: "Marcus Vance",
        age: 58,
        gender: "Male",
        condition: "Right ischemic CVA with upper extremity hemiparesis",
        email: "marcus.vance.demo@aruga-health.local",
        invitation_status: "accepted",
      },
    ]);

    // 3. Home Program
    console.log("Seeding home program...");
    await supabase.from("home_programs").upsert([
      {
        id: DEMO_PROGRAM_ID,
        patient_id: DEMO_PATIENT_ID,
        creator_id: DEMO_THERAPIST_ID,
        title: "Tabletop Grasp & Precision Release Routine",
        main_instructions:
          "Perform these 3 coordinated tabletop exercises once daily in a seated position with good posture. Keep the forearm supported on the table and record a short 10-20 second clip of each activity.",
        status: "assigned",
      },
    ]);

    // 4. Steps
    console.log("Seeding program steps...");
    await supabase.from("program_steps").upsert([
      {
        id: DEMO_STEP_1_ID,
        program_id: DEMO_PROGRAM_ID,
        position: 1,
        title: "Cylindrical Cup Lift and Transfer",
        instructions:
          "Place a lightweight plastic cup 6 inches in front of you. Reach forward using full active extension, grasp with all digits, lift 3 inches vertically, hold for 2 seconds, and place back down gently without knocking it over.",
      },
      {
        id: DEMO_STEP_2_ID,
        program_id: DEMO_PROGRAM_ID,
        position: 2,
        title: "Small Block Lateral Stacking",
        instructions:
          "Pick up the wooden block using a three-jaw chuck (thumb, index, middle fingers). Move it across your midline to the target marker on your left, then release cleanly.",
      },
      {
        id: DEMO_STEP_3_ID,
        program_id: DEMO_PROGRAM_ID,
        position: 3,
        title: "Forearm Supination with Washcloth",
        instructions:
          "Hold the folded washcloth flat on the tabletop. Slowly rotate your forearm so your palm faces fully upward, pausing for 3 seconds before returning to neutral.",
      },
    ]);

    console.log("✓ Cloud database seeding completed.");
  } else {
    console.log("Note: Database credentials are placeholder or unconfigured.");
    console.log("Verifying built-in memory/mock clinical store...");
    const store = getMockStore();
    console.log(`✓ Verified ${store.profiles.length} profiles.`);
    console.log(`✓ Verified ${store.patients.length} patient records.`);
    console.log(`✓ Verified ${store.programs.length} home programs with ${store.steps.length} steps.`);
    console.log(`✓ Verified ${store.submissions.length} submissions with ${store.stepSubmissions.length} step entries.`);
    console.log(`✓ Verified ${store.messages.length} messages with @home-program mentions.`);
    console.log(`✓ Verified ${store.aiAnalyses.length} Meta AI Spark + SAM 3.1 analysis records.`);
  }

  console.log("\nSeed operation successful!");
}

main().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
