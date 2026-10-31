import { describe, it, expect } from "vitest";
import {
  SAM_ENGINES,
  SAM_PEDIA_ENGINE,
  SAM_ADOLESCENT_ENGINE,
  SAM_ADULT_ENGINE,
  SAM_OLD_PEOPLE_ENGINE,
  SAM_HOME_OBJECTS_ENGINE,
  SAM_SCHOOL_OBJECTS_ENGINE,
  SAM_KITCHEN_ITEMS_ENGINE,
  getSamEngineByCategory,
  getSamEnginePayload,
  validateSamKeywords,
  SamEngineCategory,
} from "../src/lib/meta/sam-engines";
import { assertSamTextConcept } from "../src/lib/meta/sam";

describe("SAM 3.1 Clinical & Environmental Keyword Engines", () => {
  const categories: SamEngineCategory[] = [
    "pedia",
    "adolescent",
    "adult",
    "old_people",
    "home_objects",
    "school_objects",
    "kitchen_items",
  ];

  it("exports all 7 engines with exactly 100 keywords each", () => {
    for (const cat of categories) {
      const engine = SAM_ENGINES[cat];
      expect(engine, `Engine for ${cat} must exist`).toBeDefined();
      expect(engine.keywords.length, `${cat} engine must have exactly 100 keywords`).toBe(100);
      expect(engine.items.length, `${cat} items must have exactly 100 items`).toBe(100);
      expect(engine.targetCount, `${cat} targetCount must be 100`).toBe(100);

      // Verify uniqueness
      const uniqueKeywords = new Set(engine.keywords);
      expect(uniqueKeywords.size, `${cat} keywords must all be distinct`).toBe(100);
    }
  });

  it("ensures every keyword passes assertSamTextConcept validation", () => {
    for (const cat of categories) {
      const engine = SAM_ENGINES[cat];
      for (const keyword of engine.keywords) {
        expect(() => assertSamTextConcept(keyword), `Keyword "${keyword}" in ${cat} must be valid`).not.toThrow();
      }
    }
  });

  it("passes validateSamKeywords internal validation with zero errors", () => {
    for (const cat of categories) {
      const engine = SAM_ENGINES[cat];
      const validation = validateSamKeywords([...engine.keywords]);
      expect(validation.valid, `Engine ${cat} should be valid: ${validation.errors.join(", ")}`).toBe(true);
      expect(validation.errors).toHaveLength(0);
    }
  });

  it("covers all 3 clinical disciplines (OT, PT, SLP) in each engine", () => {
    for (const cat of categories) {
      const engine = SAM_ENGINES[cat];
      const disciplines = new Set(engine.items.map((i) => i.discipline));
      expect(disciplines.has("OT"), `${cat} must contain OT items`).toBe(true);
      expect(disciplines.has("PT"), `${cat} must contain PT items`).toBe(true);
      expect(disciplines.has("SLP"), `${cat} must contain SLP items`).toBe(true);

      // Verify clinical condition metadata
      expect(engine.clinicalConditions.occupationalTherapy.length).toBeGreaterThan(0);
      expect(engine.clinicalConditions.physicalTherapy.length).toBeGreaterThan(0);
      expect(engine.clinicalConditions.speechPathology.length).toBeGreaterThan(0);
    }
  });

  it("encompasses all 9 OTPF-4 occupations across all 7 engines", () => {
    const requiredOccupations = [
      "ADLs",
      "IADLs",
      "Health Management",
      "Rest and Sleep",
      "Education",
      "Work",
      "Play",
      "Leisure",
      "Social Participation",
    ];

    for (const cat of categories) {
      const engine = SAM_ENGINES[cat];
      for (const occ of requiredOccupations) {
        expect(
          engine.otpfFrameworkCoverage,
          `Engine ${cat} must cover OTPF-4 occupation "${occ}"`
        ).toContain(occ);
      }
    }
  });

  it("generates a valid comma-separated payload for direct SAM requests", () => {
    for (const cat of categories) {
      const payload = getSamEnginePayload(cat);
      expect(payload).toBeDefined();
      const split = payload.split(",").map((s) => s.trim());
      expect(split.length).toBe(100);
      expect(split).toEqual(SAM_ENGINES[cat].keywords);
    }
  });

  it("resolves engines with alias fallbacks including environmental engines", () => {
    expect(getSamEngineByCategory("pedia").category).toBe("pedia");
    expect(getSamEngineByCategory("pediatric").category).toBe("pedia");
    expect(getSamEngineByCategory("adolescent").category).toBe("adolescent");
    expect(getSamEngineByCategory("teen").category).toBe("adolescent");
    expect(getSamEngineByCategory("adult").category).toBe("adult");
    expect(getSamEngineByCategory("old_people").category).toBe("old_people");
    expect(getSamEngineByCategory("elderly").category).toBe("old_people");
    expect(getSamEngineByCategory("senior").category).toBe("old_people");
    expect(getSamEngineByCategory("geriatric").category).toBe("old_people");
    expect(getSamEngineByCategory("home").category).toBe("home_objects");
    expect(getSamEngineByCategory("home_objects").category).toBe("home_objects");
    expect(getSamEngineByCategory("school").category).toBe("school_objects");
    expect(getSamEngineByCategory("school_objects").category).toBe("school_objects");
    expect(getSamEngineByCategory("kitchen").category).toBe("kitchen_items");
    expect(getSamEngineByCategory("kitchen_items").category).toBe("kitchen_items");
    expect(getSamEngineByCategory(null).category).toBe("adult");
  });

  it("supports discipline filtering and subsetting across all engines", () => {
    for (const cat of categories) {
      const engine = SAM_ENGINES[cat];
      const otItems = engine.items.filter((i) => i.discipline === "OT");
      const ptItems = engine.items.filter((i) => i.discipline === "PT");
      const slpItems = engine.items.filter((i) => i.discipline === "SLP");

      expect(otItems.length).toBeGreaterThan(0);
      expect(ptItems.length).toBeGreaterThan(0);
      expect(slpItems.length).toBeGreaterThan(0);

      const otKeywords = otItems.map((i) => i.keyword);
      expect(new Set(otKeywords).size).toBe(otItems.length);
    }
  });

  it("allows switching seamlessly between engines and preserves distinct targets", () => {
    const pediaPayload = getSamEnginePayload("pedia");
    const oldPeoplePayload = getSamEnginePayload("old_people");
    const homePayload = getSamEnginePayload("home_objects");
    const schoolPayload = getSamEnginePayload("school_objects");
    const kitchenPayload = getSamEnginePayload("kitchen_items");

    expect(pediaPayload).not.toEqual(oldPeoplePayload);
    expect(homePayload).not.toEqual(schoolPayload);
    expect(kitchenPayload).not.toEqual(homePayload);

    // Verify Everyday Objects at Home payload contains key domestic targets
    expect(homePayload).toContain("front door knob");
    expect(homePayload).toContain("television remote control");
    expect(homePayload).toContain("shower head wand");
    expect(homePayload).toContain("vacuum cleaner handle");

    // Verify Everyday Objects at School payload contains key school targets
    expect(schoolPayload).toContain("student backpack strap");
    expect(schoolPayload).toContain("wooden number two pencil");
    expect(schoolPayload).toContain("aac communication tablet");
    expect(schoolPayload).toContain("gymnasium basketball rim");

    // Verify Kitchen Items payload contains key culinary targets
    expect(kitchenPayload).toContain("chef knife handle");
    expect(kitchenPayload).toContain("wooden cutting board");
    expect(kitchenPayload).toContain("silicone spatula blade");
    expect(kitchenPayload).toContain("angled nose cut dysphagia cup");
  });
});


