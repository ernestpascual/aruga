/**
 * SAM 3.1 Clinical Keyword Engines per Age Demographic
 *
 * Provides specialized 100-keyword payloads for Meta SAM 3.1 video tracking
 * across the four human lifespan rehabilitation demographics:
 * 1. Pediatric (1-11)
 * 2. Adolescent (12-17)
 * 3. Adult (18-54)
 * 4. Old People (55+)
 *
 * Each engine:
 * - Contains EXACTLY 100 distinct physical noun-phrase keywords.
 * - Targets the core clinical conditions in Occupational Therapy (OT),
 *   Physical Therapy (PT), and Speech-Language Pathology (SLP).
 * - Encompasses all 9 OTPF-4 occupations (ADLs, IADLs, Health Management,
 *   Rest & Sleep, Education, Work, Play, Leisure, Social Participation).
 * - Is formatted for 1-click execution in Meta SAM 3.1 video segmentation.
 */

import { ClientCategory } from "@/types/database";

export type SamAgeCategory = "pedia" | "adolescent" | "adult" | "old_people";
export type SamEnvironmentCategory = "home_objects" | "school_objects" | "kitchen_items";
export type SamEngineCategory = SamAgeCategory | SamEnvironmentCategory;

export interface SamKeywordItem {
  keyword: string;
  discipline: "OT" | "PT" | "SLP" | "Interdisciplinary";
  otpfCategory:
    | "ADLs"
    | "IADLs"
    | "Health Management"
    | "Rest and Sleep"
    | "Education"
    | "Work"
    | "Play"
    | "Leisure"
    | "Social Participation";
  clinicalContext: string;
}

export interface SamEngineMetadata {
  category: SamEngineCategory;
  name: string;
  ageRange: string;
  engineType?: "demographic" | "environment";
  targetCount: number;
  clinicalConditions: {
    occupationalTherapy: string[];
    physicalTherapy: string[];
    speechPathology: string[];
  };
  otpfFrameworkCoverage: string[];
  keywords: readonly string[];
  payload: string;
  items: readonly SamKeywordItem[];
}

// -----------------------------------------------------------------------------
// 1. PEDIATRIC ENGINE (Ages 1–11)
// -----------------------------------------------------------------------------
const PEDIA_ITEMS: SamKeywordItem[] = [
  { keyword: "therapy putty", discipline: "OT", otpfCategory: "Play", clinicalContext: "Sensory regulation and intrinsic hand strengthening" },
  { keyword: "wooden peg", discipline: "OT", otpfCategory: "Play", clinicalContext: "Pincer grasp and radial digital manipulation" },
  { keyword: "peg board", discipline: "OT", otpfCategory: "Play", clinicalContext: "Bilateral integration and visual-motor coordination" },
  { keyword: "sippy cup", discipline: "OT", otpfCategory: "ADLs", clinicalContext: "Pediatric feeding and self-drinking transition" },
  { keyword: "cheerio", discipline: "OT", otpfCategory: "ADLs", clinicalContext: "Pincer grasp finger feeding milestone" },
  { keyword: "spoon", discipline: "OT", otpfCategory: "ADLs", clinicalContext: "Utensil feeding milestone and self-care" },
  { keyword: "toddler fork", discipline: "OT", otpfCategory: "ADLs", clinicalContext: "Adaptive feeding and self-nourishment" },
  { keyword: "suction bowl", discipline: "OT", otpfCategory: "ADLs", clinicalContext: "Mealtime stabilization for uncoordinated reach" },
  { keyword: "sensory brush", discipline: "OT", otpfCategory: "Health Management", clinicalContext: "Wilbarger brushing protocol for sensory defensiveness" },
  { keyword: "bubble wand", discipline: "SLP", otpfCategory: "Play", clinicalContext: "Oral motor breath control and lip rounding" },
  { keyword: "play dough", discipline: "OT", otpfCategory: "Play", clinicalContext: "Sensorimotor hand strength and tactile modulation" },
  { keyword: "foam block", discipline: "PT", otpfCategory: "Play", clinicalContext: "Gross motor stacking and dynamic trunk stability" },
  { keyword: "wooden block", discipline: "OT", otpfCategory: "Play", clinicalContext: "Constructive tabletop play and block stacking" },
  { keyword: "stacking ring", discipline: "OT", otpfCategory: "Play", clinicalContext: "Eye-hand coordination and size grading" },
  { keyword: "shape sorter", discipline: "OT", otpfCategory: "Play", clinicalContext: "Spatial orientation and cognitive grasp rotation" },
  { keyword: "jumbo crayon", discipline: "OT", otpfCategory: "Education", clinicalContext: "Palmar supinate grasp to digital pronate transition" },
  { keyword: "child scissors", discipline: "OT", otpfCategory: "Education", clinicalContext: "Scissor skills and bimanual paper cutting" },
  { keyword: "pincer grip", discipline: "OT", otpfCategory: "Play", clinicalContext: "Index-thumb opposition kinematic landmark" },
  { keyword: "hand", discipline: "Interdisciplinary", otpfCategory: "ADLs", clinicalContext: "Anatomical tracking landmark" },
  { keyword: "finger", discipline: "Interdisciplinary", otpfCategory: "ADLs", clinicalContext: "Digital isolation and point landmark" },
  { keyword: "thumb", discipline: "Interdisciplinary", otpfCategory: "ADLs", clinicalContext: "Thumb opposition and radial stability landmark" },
  { keyword: "tongue", discipline: "SLP", otpfCategory: "ADLs", clinicalContext: "Lingual elevation and articulation placement" },
  { keyword: "lip", discipline: "SLP", otpfCategory: "ADLs", clinicalContext: "Bilabial seal and straw suction landmark" },
  { keyword: "chin", discipline: "SLP", otpfCategory: "ADLs", clinicalContext: "Jaw grading and chin stability landmark" },
  { keyword: "mouth", discipline: "SLP", otpfCategory: "ADLs", clinicalContext: "Oral cavity feeding and articulation aperture" },
  { keyword: "balance stone", discipline: "PT", otpfCategory: "Play", clinicalContext: "Dynamic balance and motor planning stepping" },
  { keyword: "therapy ball", discipline: "PT", otpfCategory: "Health Management", clinicalContext: "Core tone facilitation and vestibular righting" },
  { keyword: "peanut ball", discipline: "PT", otpfCategory: "Health Management", clinicalContext: "Bilateral stability and transitional kneeling" },
  { keyword: "sensory tunnel", discipline: "PT", otpfCategory: "Play", clinicalContext: "Four-point quadruped crawling and sensory navigation" },
  { keyword: "weighted vest", discipline: "OT", otpfCategory: "Health Management", clinicalContext: "Proprioceptive calming and postural grounding" },
  { keyword: "chew necklace", discipline: "OT", otpfCategory: "Health Management", clinicalContext: "Oral sensory seeking regulation" },
  { keyword: "oral motor chew tube", discipline: "SLP", otpfCategory: "Health Management", clinicalContext: "Jaw rehabilitation and lateral tongue movement" },
  { keyword: "tongue depressor", discipline: "SLP", otpfCategory: "Health Management", clinicalContext: "Oral-motor examination and tactile guidance" },
  { keyword: "finger puppet", discipline: "SLP", otpfCategory: "Social Participation", clinicalContext: "Joint attention and social imitation" },
  { keyword: "flashcard", discipline: "SLP", otpfCategory: "Education", clinicalContext: "Expressive vocabulary and articulation drills" },
  { keyword: "picture board", discipline: "SLP", otpfCategory: "Social Participation", clinicalContext: "Low-tech picture exchange communication" },
  { keyword: "aac tablet", discipline: "SLP", otpfCategory: "Social Participation", clinicalContext: "High-tech speech-generating augmentative device" },
  { keyword: "zipper", discipline: "OT", otpfCategory: "ADLs", clinicalContext: "Jacket dressing and bilateral pull integration" },
  { keyword: "large button", discipline: "OT", otpfCategory: "ADLs", clinicalContext: "Fastener manipulation and finger buttoning" },
  { keyword: "velcro strap", discipline: "OT", otpfCategory: "ADLs", clinicalContext: "Adaptive footwear fastening independence" },
  { keyword: "sock", discipline: "OT", otpfCategory: "ADLs", clinicalContext: "Lower extremity dressing and ankle dorsiflexion" },
  { keyword: "shoe", discipline: "OT", otpfCategory: "ADLs", clinicalContext: "Footwear don/doff milestone" },
  { keyword: "toddler shirt", discipline: "OT", otpfCategory: "ADLs", clinicalContext: "Overhead upper body dressing" },
  { keyword: "toothbrush", discipline: "OT", otpfCategory: "ADLs", clinicalContext: "Oral hygiene and sensory tolerance" },
  { keyword: "washcloth", discipline: "OT", otpfCategory: "ADLs", clinicalContext: "Face and body washing ADL" },
  { keyword: "bath toy", discipline: "OT", otpfCategory: "Play", clinicalContext: "Bathing engagement and water play grasp" },
  { keyword: "straw cup", discipline: "SLP", otpfCategory: "ADLs", clinicalContext: "Oral suction feeding and liquid intake" },
  { keyword: "food puree", discipline: "SLP", otpfCategory: "ADLs", clinicalContext: "Dysphagia texture management and spoon swallow" },
  { keyword: "spill mat", discipline: "OT", otpfCategory: "IADLs", clinicalContext: "Meal cleanup routines and environmental containment" },
  { keyword: "high chair tray", discipline: "OT", otpfCategory: "ADLs", clinicalContext: "Tabletop feeding surface and postural boundary" },
  { keyword: "stepping bucket", discipline: "PT", otpfCategory: "Play", clinicalContext: "Single leg stance balance and step coordination" },
  { keyword: "balance beam", discipline: "PT", otpfCategory: "Play", clinicalContext: "Tandem heel-to-toe gait progression" },
  { keyword: "foam roller", discipline: "PT", otpfCategory: "Health Management", clinicalContext: "Vestibular equilibrium and trunk stability" },
  { keyword: "slant board", discipline: "OT", otpfCategory: "Education", clinicalContext: "Wrist extension facilitation during drawing" },
  { keyword: "pencil grip", discipline: "OT", otpfCategory: "Education", clinicalContext: "Adaptive ergonomics for tripod finger posture" },
  { keyword: "lined paper", discipline: "OT", otpfCategory: "Education", clinicalContext: "Pre-writing strokes and visual-spatial boundaries" },
  { keyword: "sticker sheet", discipline: "OT", otpfCategory: "Play", clinicalContext: "Pincer grasp peeling and bilateral paper hold" },
  { keyword: "puzzle piece", discipline: "OT", otpfCategory: "Play", clinicalContext: "Form constancy and cognitive shape fitting" },
  { keyword: "bead", discipline: "OT", otpfCategory: "Play", clinicalContext: "In-hand manipulation and fingertip translation" },
  { keyword: "stringing lace", discipline: "OT", otpfCategory: "Play", clinicalContext: "Bilateral eye-hand stringing task" },
  { keyword: "tweezer", discipline: "OT", otpfCategory: "Play", clinicalContext: "Thenar webspace opening and finger strengthening" },
  { keyword: "squeeze ball", discipline: "OT", otpfCategory: "Health Management", clinicalContext: "Gross grasp and isometric hand squeeze" },
  { keyword: "bean bag", discipline: "PT", otpfCategory: "Play", clinicalContext: "Proprioceptive toss and bilateral catching" },
  { keyword: "target bucket", discipline: "OT", otpfCategory: "Work", clinicalContext: "Classroom chore duties and clean-up task participation" },
  { keyword: "scooter board", discipline: "PT", otpfCategory: "Play", clinicalContext: "Prone extension and bilateral upper extremity propulsion" },
  { keyword: "prone wedge", discipline: "PT", otpfCategory: "Health Management", clinicalContext: "Tummy time elevation and cervical extensor strength" },
  { keyword: "foam wedge", discipline: "PT", otpfCategory: "Health Management", clinicalContext: "Therapeutic positioning for hypotonia" },
  { keyword: "crawling mat", discipline: "PT", otpfCategory: "Play", clinicalContext: "Floor gross motor mobility surface" },
  { keyword: "orthotic boot", discipline: "PT", otpfCategory: "Health Management", clinicalContext: "Talipes equinovarus corrective support" },
  { keyword: "afo brace", discipline: "PT", otpfCategory: "Health Management", clinicalContext: "Ankle-foot orthosis for foot drop / toe walking" },
  { keyword: "gait belt", discipline: "PT", otpfCategory: "Health Management", clinicalContext: "Pediatric clinician transfer and walking guard" },
  { keyword: "posterior walker", discipline: "PT", otpfCategory: "Health Management", clinicalContext: "Reverse posture walker for independent ambulation" },
  { keyword: "tricycle pedal", discipline: "PT", otpfCategory: "Play", clinicalContext: "Reciprocal lower extremity motor planning" },
  { keyword: "jump rope", discipline: "PT", otpfCategory: "Play", clinicalContext: "Rhythmic motor jumping and coordination" },
  { keyword: "hopscotch mat", discipline: "PT", otpfCategory: "Play", clinicalContext: "Single leg hopping balance and dynamic agility" },
  { keyword: "musical shaker", discipline: "OT", otpfCategory: "Leisure", clinicalContext: "Rhythmic grasping and auditory feedback" },
  { keyword: "tambourine", discipline: "OT", otpfCategory: "Leisure", clinicalContext: "Bilateral arm clapping and musical play" },
  { keyword: "xylophone mallet", discipline: "OT", otpfCategory: "Leisure", clinicalContext: "Radial-palmar mallet strike and targeted reach" },
  { keyword: "plush animal", discipline: "OT", otpfCategory: "Play", clinicalContext: "Pretend feeding play and comfort regulation" },
  { keyword: "pretend kitchen pot", discipline: "OT", otpfCategory: "Play", clinicalContext: "Symbolic pretend cooking and bilateral stirring" },
  { keyword: "toy food", discipline: "SLP", otpfCategory: "Play", clinicalContext: "Receptive vocabulary naming and pretend feeding" },
  { keyword: "doll", discipline: "OT", otpfCategory: "Play", clinicalContext: "Body part identification and doll dressing" },
  { keyword: "crayon box", discipline: "OT", otpfCategory: "Education", clinicalContext: "Bilateral lid opening and color selection" },
  { keyword: "glue stick", discipline: "OT", otpfCategory: "Education", clinicalContext: "Twist mechanism and paper crafting" },
  { keyword: "water bottle", discipline: "OT", otpfCategory: "Health Management", clinicalContext: "School hydration container opening" },
  { keyword: "snack pouch", discipline: "OT", otpfCategory: "ADLs", clinicalContext: "Squeeze feeding and oral motor compression" },
  { keyword: "nap mat", discipline: "OT", otpfCategory: "Rest and Sleep", clinicalContext: "Preschool rest time transition" },
  { keyword: "weighted lap pad", discipline: "OT", otpfCategory: "Rest and Sleep", clinicalContext: "Deep pressure input during circle time rest" },
  { keyword: "sensory bottle", discipline: "OT", otpfCategory: "Rest and Sleep", clinicalContext: "Visual calming and self-regulation" },
  { keyword: "mirror", discipline: "SLP", otpfCategory: "Health Management", clinicalContext: "Visual speech biofeedback for phonemic imitation" },
  { keyword: "blowing whistle", discipline: "SLP", otpfCategory: "Play", clinicalContext: "Respiratory breath force and oral constriction" },
  { keyword: "straw", discipline: "SLP", otpfCategory: "ADLs", clinicalContext: "Oral motor suction straw drinking" },
  { keyword: "pinwheel", discipline: "SLP", otpfCategory: "Play", clinicalContext: "Visual feedback for sustained expiration" },
  { keyword: "feeding spoon", discipline: "SLP", otpfCategory: "ADLs", clinicalContext: "Oral bolus delivery and lip strip" },
  { keyword: "finger toothbrush", discipline: "OT", otpfCategory: "ADLs", clinicalContext: "Oral sensory desensitization" },
  { keyword: "backpack", discipline: "OT", otpfCategory: "IADLs", clinicalContext: "School bag carrying and zipper retrieval" },
  { keyword: "lunchbox", discipline: "OT", otpfCategory: "IADLs", clinicalContext: "School meal independence and latch opening" },
  { keyword: "turn taking token", discipline: "SLP", otpfCategory: "Social Participation", clinicalContext: "Peer conversation and game turn taking" },
  { keyword: "caregiver hand", discipline: "Interdisciplinary", otpfCategory: "Social Participation", clinicalContext: "Hand-over-hand co-activity and parental support" },
  { keyword: "foot", discipline: "PT", otpfCategory: "ADLs", clinicalContext: "Weight bearing and arch position landmark" },
];

// -----------------------------------------------------------------------------
// 2. ADOLESCENT ENGINE (Ages 12–17)
// -----------------------------------------------------------------------------
const ADOLESCENT_ITEMS: SamKeywordItem[] = [
  { keyword: "slant board", discipline: "OT", otpfCategory: "Education", clinicalContext: "Ergonomic writing angle and neck alignment" },
  { keyword: "ergonomic pen", discipline: "OT", otpfCategory: "Education", clinicalContext: "Handwriting fatigue and hypermobility support" },
  { keyword: "mechanical pencil", discipline: "OT", otpfCategory: "Education", clinicalContext: "Grasp pressure modulation to avoid lead breaking" },
  { keyword: "writing grip", discipline: "OT", otpfCategory: "Education", clinicalContext: "Dynamic tripod grasp stabilization" },
  { keyword: "college ruled notebook", discipline: "OT", otpfCategory: "Education", clinicalContext: "Handwriting sizing and line alignment" },
  { keyword: "graph paper", discipline: "OT", otpfCategory: "Education", clinicalContext: "Dysgraphia spatial orientation and math columns" },
  { keyword: "binder ring", discipline: "OT", otpfCategory: "Education", clinicalContext: "Bilateral pinch strength for opening 3-ring binder" },
  { keyword: "highlighter", discipline: "OT", otpfCategory: "Education", clinicalContext: "Visual scanning and text highlighting" },
  { keyword: "metal ruler", discipline: "OT", otpfCategory: "Education", clinicalContext: "Bilateral holding and straight edge drafting" },
  { keyword: "student desk", discipline: "OT", otpfCategory: "Education", clinicalContext: "School workstation posture and 90-90 seating" },
  { keyword: "ergonomic chair", discipline: "OT", otpfCategory: "Education", clinicalContext: "Lumbar support and pelvic stability" },
  { keyword: "laptop keyboard", discipline: "OT", otpfCategory: "Work", clinicalContext: "Bimanual typing velocity and wrist posture" },
  { keyword: "computer mouse", discipline: "OT", otpfCategory: "Work", clinicalContext: "Forearm pronation and digital clicking" },
  { keyword: "mouse wrist rest", discipline: "OT", otpfCategory: "Work", clinicalContext: "Repetitive strain prevention at computer desk" },
  { keyword: "tablet stylus", discipline: "OT", otpfCategory: "Education", clinicalContext: "Precision digital drawing and school note taking" },
  { keyword: "heavy backpack", discipline: "PT", otpfCategory: "IADLs", clinicalContext: "Scoliosis and postural spinal load evaluation" },
  { keyword: "backpack strap", discipline: "PT", otpfCategory: "IADLs", clinicalContext: "Symmetrical shoulder strap adjustment" },
  { keyword: "locker combination lock", discipline: "OT", otpfCategory: "Education", clinicalContext: "In-hand dexterity and rotational digit torque" },
  { keyword: "water tumbler", discipline: "Interdisciplinary", otpfCategory: "Health Management", clinicalContext: "School hydration and lid twist" },
  { keyword: "sports hydration bottle", discipline: "Interdisciplinary", otpfCategory: "Health Management", clinicalContext: "Athletic hydration squeeze valve" },
  { keyword: "elastic resistance band", discipline: "PT", otpfCategory: "Health Management", clinicalContext: "Rotator cuff strengthening and scapular retraction" },
  { keyword: "loop exercise band", discipline: "PT", otpfCategory: "Health Management", clinicalContext: "Gluteus medius activation and knee valgus control" },
  { keyword: "foam roller", discipline: "PT", otpfCategory: "Health Management", clinicalContext: "Thoracic spine extension and IT band mobility" },
  { keyword: "lacrosse massage ball", discipline: "PT", otpfCategory: "Health Management", clinicalContext: "Trigger point release for rhomboids and glutes" },
  { keyword: "tennis ball", discipline: "PT", otpfCategory: "Health Management", clinicalContext: "Plantar fascia rolling and hand squeeze" },
  { keyword: "hand dynamometer", discipline: "OT", otpfCategory: "Health Management", clinicalContext: "Isometric grip force measurement" },
  { keyword: "grip strengthener", discipline: "OT", otpfCategory: "Health Management", clinicalContext: "Forearm flexor conditioning for athletics" },
  { keyword: "finger extensor band", discipline: "OT", otpfCategory: "Health Management", clinicalContext: "Antagonist finger extensor training for gamers" },
  { keyword: "therapy putty", discipline: "OT", otpfCategory: "Health Management", clinicalContext: "Intrinsic muscle strengthening post-fracture" },
  { keyword: "wrist brace", discipline: "OT", otpfCategory: "Health Management", clinicalContext: "Gymnastics or esports wrist stabilization" },
  { keyword: "thumb spica splint", discipline: "OT", otpfCategory: "Health Management", clinicalContext: "Texting tenosynovitis and MCP ligament support" },
  { keyword: "kinesiology tape", discipline: "PT", otpfCategory: "Health Management", clinicalContext: "Proprioceptive joint taping for sports rehab" },
  { keyword: "ice pack", discipline: "PT", otpfCategory: "Health Management", clinicalContext: "Acute knee/ankle swelling cryotherapy" },
  { keyword: "gel heat pack", discipline: "PT", otpfCategory: "Health Management", clinicalContext: "Cervical and trapezius spasm relaxation" },
  { keyword: "knee brace", discipline: "PT", otpfCategory: "Health Management", clinicalContext: "ACL reconstruction and patellar tracking" },
  { keyword: "patellar strap", discipline: "PT", otpfCategory: "Health Management", clinicalContext: "Osgood-Schlatter tendon pressure relief" },
  { keyword: "ankle stabilizing brace", discipline: "PT", otpfCategory: "Health Management", clinicalContext: "Inversion sprain prevention on court" },
  { keyword: "balance wobble board", discipline: "PT", otpfCategory: "Health Management", clinicalContext: "Ankle mechanoreceptor proprioception training" },
  { keyword: "bosu ball", discipline: "PT", otpfCategory: "Health Management", clinicalContext: "Single leg dynamic knee stability" },
  { keyword: "agility ladder", discipline: "PT", otpfCategory: "Play", clinicalContext: "Coordination drills and quick footwork" },
  { keyword: "jump rope", discipline: "PT", otpfCategory: "Play", clinicalContext: "Ankle stiffness and aerobic conditioning" },
  { keyword: "dumbbell", discipline: "PT", otpfCategory: "Health Management", clinicalContext: "Bilateral upper extremity progressive loading" },
  { keyword: "kettlebell", discipline: "PT", otpfCategory: "Health Management", clinicalContext: "Posterior chain deadlift form" },
  { keyword: "yoga mat", discipline: "PT", otpfCategory: "Health Management", clinicalContext: "Hamstring and hip flexor stretching floor base" },
  { keyword: "posture corrector harness", discipline: "PT", otpfCategory: "Health Management", clinicalContext: "Biofeedback reminder against kyphotic slumping" },
  { keyword: "speech biofeedback mirror", discipline: "SLP", otpfCategory: "Health Management", clinicalContext: "Visual mirror biofeedback for stuttering" },
  { keyword: "voice pitch tuner", discipline: "SLP", otpfCategory: "Health Management", clinicalContext: "Vocal nodule pitch modification in choir/cheer" },
  { keyword: "digital metronome", discipline: "SLP", otpfCategory: "Health Management", clinicalContext: "Rhythmic speech pacing for fluency breakdown" },
  { keyword: "respiratory flow meter", discipline: "SLP", otpfCategory: "Health Management", clinicalContext: "Breath support measurement for projection" },
  { keyword: "fluency pacing board", discipline: "SLP", otpfCategory: "Health Management", clinicalContext: "Tactile syllable pacing technique" },
  { keyword: "acoustic straw", discipline: "SLP", otpfCategory: "Health Management", clinicalContext: "SOVTE straw phonation for vocal cord rehabilitation" },
  { keyword: "water resistance tube", discipline: "SLP", otpfCategory: "Health Management", clinicalContext: "Bubbling vocal tract therapy (Lax Vox)" },
  { keyword: "reading textbook", discipline: "SLP", otpfCategory: "Education", clinicalContext: "Concussion recovery reading tolerance" },
  { keyword: "flashcard deck", discipline: "SLP", otpfCategory: "Education", clinicalContext: "Cognitive-communication recall drills" },
  { keyword: "desk organizer", discipline: "OT", otpfCategory: "Education", clinicalContext: "Executive function ADHD task structure" },
  { keyword: "planner notebook", discipline: "OT", otpfCategory: "Education", clinicalContext: "Assignment scheduling and organizational routine" },
  { keyword: "stopwatch", discipline: "OT", otpfCategory: "Education", clinicalContext: "Timed writing stamina and pacing assessment" },
  { keyword: "digital timer", discipline: "OT", otpfCategory: "Education", clinicalContext: "Pomodoro study interval pacing" },
  { keyword: "smartphone screen", discipline: "OT", otpfCategory: "IADLs", clinicalContext: "Social media and text communication device" },
  { keyword: "noise cancelling headphone", discipline: "OT", otpfCategory: "Education", clinicalContext: "Classroom sensory filtering and study focus" },
  { keyword: "hand", discipline: "Interdisciplinary", otpfCategory: "ADLs", clinicalContext: "Anatomical tracking landmark" },
  { keyword: "wrist", discipline: "Interdisciplinary", otpfCategory: "ADLs", clinicalContext: "Wrist flexion-extension tracking" },
  { keyword: "forearm", discipline: "Interdisciplinary", otpfCategory: "ADLs", clinicalContext: "Pronation and supination landmark" },
  { keyword: "elbow", discipline: "Interdisciplinary", otpfCategory: "ADLs", clinicalContext: "Elbow flexion angle measurement" },
  { keyword: "shoulder", discipline: "Interdisciplinary", otpfCategory: "ADLs", clinicalContext: "Shoulder elevation and hike compensation" },
  { keyword: "cervical spine", discipline: "PT", otpfCategory: "Health Management", clinicalContext: "Forward head posture and tech neck landmark" },
  { keyword: "thoracic spine", discipline: "PT", otpfCategory: "Health Management", clinicalContext: "Kyphosis and scoliosis curvature landmark" },
  { keyword: "knee joint", discipline: "PT", otpfCategory: "Health Management", clinicalContext: "Patellar tracking and ligament landmark" },
  { keyword: "patella", discipline: "PT", otpfCategory: "Health Management", clinicalContext: "Patellofemoral tracking during squats" },
  { keyword: "ankle joint", discipline: "PT", otpfCategory: "Health Management", clinicalContext: "Dorsiflexion and inversion landmark" },
  { keyword: "achilles tendon", discipline: "PT", otpfCategory: "Health Management", clinicalContext: "Heel cord tight cord assessment" },
  { keyword: "foot", discipline: "PT", otpfCategory: "Health Management", clinicalContext: "Pronation and arch collapse tracking" },
  { keyword: "lip", discipline: "SLP", otpfCategory: "Health Management", clinicalContext: "Speech articulation labial position" },
  { keyword: "jaw", discipline: "SLP", otpfCategory: "Health Management", clinicalContext: "Mandibular excursion and TMJ motion" },
  { keyword: "throat", discipline: "SLP", otpfCategory: "Health Management", clinicalContext: "Laryngeal elevation during vocalization" },
  { keyword: "athletic sneaker", discipline: "OT", otpfCategory: "ADLs", clinicalContext: "Shoe don/doff and athletic readiness" },
  { keyword: "shoelace", discipline: "OT", otpfCategory: "ADLs", clinicalContext: "Bilateral knot tying and fine motor agility" },
  { keyword: "hoodie zipper", discipline: "OT", otpfCategory: "ADLs", clinicalContext: "Zipping fastener on school sweatshirt" },
  { keyword: "jacket button", discipline: "OT", otpfCategory: "ADLs", clinicalContext: "Formal dress shirt button manipulation" },
  { keyword: "belt buckle", discipline: "OT", otpfCategory: "ADLs", clinicalContext: "Pants fastening and midline coordination" },
  { keyword: "hairbrush", discipline: "OT", otpfCategory: "ADLs", clinicalContext: "Personal hygiene and shoulder abduction" },
  { keyword: "toothbrush", discipline: "OT", otpfCategory: "ADLs", clinicalContext: "Oral hygiene self-care" },
  { keyword: "face wash dispenser", discipline: "OT", otpfCategory: "ADLs", clinicalContext: "Pump dispensing hygiene routine" },
  { keyword: "reusable food container", discipline: "OT", otpfCategory: "IADLs", clinicalContext: "School lunch food prep and lid snap" },
  { keyword: "kitchen knife", discipline: "OT", otpfCategory: "IADLs", clinicalContext: "Snack preparation cutting safety" },
  { keyword: "cutting board", discipline: "OT", otpfCategory: "IADLs", clinicalContext: "Food preparation stability base" },
  { keyword: "eating fork", discipline: "OT", otpfCategory: "ADLs", clinicalContext: "Mealtime dining utensil use" },
  { keyword: "drinking glass", discipline: "OT", otpfCategory: "ADLs", clinicalContext: "Open cup drinking control" },
  { keyword: "microwave door handle", discipline: "OT", otpfCategory: "IADLs", clinicalContext: "After-school snack reheating" },
  { keyword: "video game controller", discipline: "OT", otpfCategory: "Play", clinicalContext: "Recreational gaming thumb-stick bilateral grip" },
  { keyword: "musical instrument neck", discipline: "OT", otpfCategory: "Leisure", clinicalContext: "Guitar/violin fretting hand dexterity" },
  { keyword: "guitar pick", discipline: "OT", otpfCategory: "Leisure", clinicalContext: "Precision pincer grip strumming" },
  { keyword: "sketchbook", discipline: "OT", otpfCategory: "Leisure", clinicalContext: "Artistic drawing and creative expression" },
  { keyword: "drawing pencil", discipline: "OT", otpfCategory: "Leisure", clinicalContext: "Shading and fine pressure regulation" },
  { keyword: "cervical support pillow", discipline: "OT", otpfCategory: "Rest and Sleep", clinicalContext: "Ergonomic sleep posture for neck strain" },
  { keyword: "weighted compression blanket", discipline: "OT", otpfCategory: "Rest and Sleep", clinicalContext: "Deep sensory pressure for sleep onset" },
  { keyword: "retail barcode scanner", discipline: "OT", otpfCategory: "Work", clinicalContext: "Part-time job cashiering grip" },
  { keyword: "card swipe terminal", discipline: "OT", otpfCategory: "Work", clinicalContext: "First job retail register operation" },
  { keyword: "board game card", discipline: "SLP", otpfCategory: "Social Participation", clinicalContext: "Tabletop gaming card holding and social play" },
  { keyword: "fidget roller", discipline: "OT", otpfCategory: "Health Management", clinicalContext: "Sensory focus tool during homework" },
];

// -----------------------------------------------------------------------------
// 3. ADULT ENGINE (Ages 18–54)
// -----------------------------------------------------------------------------
const ADULT_ITEMS: SamKeywordItem[] = [
  { keyword: "universal cuff", discipline: "OT", otpfCategory: "ADLs", clinicalContext: "Spinal cord injury and stroke adaptive utensil holder" },
  { keyword: "adaptive spoon", discipline: "OT", otpfCategory: "ADLs", clinicalContext: "Swivel/built-up spoon for hemiparetic eating" },
  { keyword: "rocker knife", discipline: "OT", otpfCategory: "ADLs", clinicalContext: "Single-handed downward rocking mealtime cutting" },
  { keyword: "scooped plate", discipline: "OT", otpfCategory: "ADLs", clinicalContext: "High-walled plate for food gathering with one hand" },
  { keyword: "plate guard", discipline: "OT", otpfCategory: "ADLs", clinicalContext: "Clip-on plate barrier preventing food spillage" },
  { keyword: "two handled mug", discipline: "OT", otpfCategory: "ADLs", clinicalContext: "Bimanual tremor stabilization while drinking" },
  { keyword: "nose cutout cup", discipline: "SLP", otpfCategory: "ADLs", clinicalContext: "Drinking without neck extension for dysphagia" },
  { keyword: "straw", discipline: "SLP", otpfCategory: "ADLs", clinicalContext: "Fluid velocity control and lip compression" },
  { keyword: "thickened beverage cup", discipline: "SLP", otpfCategory: "ADLs", clinicalContext: "Nectar or honey consistency hydration" },
  { keyword: "food bolus", discipline: "SLP", otpfCategory: "ADLs", clinicalContext: "Oral bolus formation and pharyngeal transit" },
  { keyword: "puree bowl", discipline: "SLP", otpfCategory: "ADLs", clinicalContext: "Texture modified dysphagia nutrition" },
  { keyword: "pill organizer", discipline: "OT", otpfCategory: "Health Management", clinicalContext: "Weekly medication sorting and compliance" },
  { keyword: "blister pack", discipline: "OT", otpfCategory: "Health Management", clinicalContext: "Fine motor pill popping from foil" },
  { keyword: "pill splitter", discipline: "OT", otpfCategory: "Health Management", clinicalContext: "Tablet splitting leverage assist" },
  { keyword: "blood pressure cuff", discipline: "Interdisciplinary", otpfCategory: "Health Management", clinicalContext: "Post-stroke autonomic monitoring" },
  { keyword: "pulse oximeter", discipline: "Interdisciplinary", otpfCategory: "Health Management", clinicalContext: "Cardiopulmonary vitals monitoring" },
  { keyword: "button hook", discipline: "OT", otpfCategory: "ADLs", clinicalContext: "One-handed button fastening post-hemiparesis" },
  { keyword: "zipper puller", discipline: "OT", otpfCategory: "ADLs", clinicalContext: "Extended loop tool for jacket zipping" },
  { keyword: "sock aid", discipline: "OT", otpfCategory: "ADLs", clinicalContext: "Donning socks without lumbar or hip flexion" },
  { keyword: "shoe horn", discipline: "OT", otpfCategory: "ADLs", clinicalContext: "Heel guide for dress shoes" },
  { keyword: "elastic shoelace", discipline: "OT", otpfCategory: "ADLs", clinicalContext: "Slip-on shoe conversion avoiding tying" },
  { keyword: "reacher grabber", discipline: "OT", otpfCategory: "IADLs", clinicalContext: "Floor object retrieval and high shelf access" },
  { keyword: "long handled sponge", discipline: "OT", otpfCategory: "ADLs", clinicalContext: "Back and lower extremity washing in shower" },
  { keyword: "faucet turn extender", discipline: "OT", otpfCategory: "ADLs", clinicalContext: "Lever adapter for rotary bathroom knobs" },
  { keyword: "jar opener", discipline: "OT", otpfCategory: "IADLs", clinicalContext: "Mechanical jar lid torque reduction" },
  { keyword: "dycem non slip mat", discipline: "OT", otpfCategory: "IADLs", clinicalContext: "High-friction mat securing kitchen bowls" },
  { keyword: "cutting board with spikes", discipline: "OT", otpfCategory: "IADLs", clinicalContext: "One-handed potato and vegetable food prep" },
  { keyword: "ergonomic chef knife", discipline: "OT", otpfCategory: "IADLs", clinicalContext: "Vertical handle knife for wrist neutral cutting" },
  { keyword: "cooking spatula", discipline: "OT", otpfCategory: "IADLs", clinicalContext: "Meal preparation pan flipping" },
  { keyword: "pan handle", discipline: "OT", otpfCategory: "IADLs", clinicalContext: "Two-handed kitchen cooking transfer" },
  { keyword: "kettle handle", discipline: "OT", otpfCategory: "IADLs", clinicalContext: "Safe hot water pouring" },
  { keyword: "spray bottle", discipline: "OT", otpfCategory: "IADLs", clinicalContext: "Hand trigger squeezing during cleaning" },
  { keyword: "dustpan handle", discipline: "OT", otpfCategory: "IADLs", clinicalContext: "Sweeping and household debris cleanup" },
  { keyword: "key turner", discipline: "OT", otpfCategory: "IADLs", clinicalContext: "Enlarged key grip for arthritic fingers" },
  { keyword: "doorknob lever adapter", discipline: "OT", otpfCategory: "IADLs", clinicalContext: "Lever assist converting twist knobs" },
  { keyword: "wallet", discipline: "OT", otpfCategory: "IADLs", clinicalContext: "Financial cash and receipt management" },
  { keyword: "bank card", discipline: "OT", otpfCategory: "IADLs", clinicalContext: "Pinch precision card insertion into POS" },
  { keyword: "pen", discipline: "OT", otpfCategory: "Work", clinicalContext: "Signature writing and clerical duties" },
  { keyword: "signature guide card", discipline: "OT", otpfCategory: "Work", clinicalContext: "Tactile cutout card for signing documents" },
  { keyword: "car steering wheel cover", discipline: "OT", otpfCategory: "IADLs", clinicalContext: "Padded driving wheel grip" },
  { keyword: "car transfer handle", discipline: "PT", otpfCategory: "IADLs", clinicalContext: "Doorframe anchor assist for car entry" },
  { keyword: "ergonomic keyboard", discipline: "OT", otpfCategory: "Work", clinicalContext: "Split mechanical keyboard for RSI relief" },
  { keyword: "vertical mouse", discipline: "OT", otpfCategory: "Work", clinicalContext: "Neutral handshake mouse for carpal tunnel" },
  { keyword: "trackball mouse", discipline: "OT", otpfCategory: "Work", clinicalContext: "Thumb trackball eliminating wrist movement" },
  { keyword: "wrist rest pad", discipline: "OT", otpfCategory: "Work", clinicalContext: "Gel cushioning at keyboard edge" },
  { keyword: "document slant board", discipline: "OT", otpfCategory: "Education", clinicalContext: "Vocational education and in-line reading posture" },
  { keyword: "task chair lumbar roll", discipline: "PT", otpfCategory: "Work", clinicalContext: "Lumbar lordosis support during desk hours" },
  { keyword: "monitor riser", discipline: "OT", otpfCategory: "Work", clinicalContext: "Eye-level screen positioning" },
  { keyword: "therapist peg board", discipline: "OT", otpfCategory: "Health Management", clinicalContext: "Fine motor grasp, transport, and release" },
  { keyword: "pinch clothespin", discipline: "OT", otpfCategory: "Health Management", clinicalContext: "Graded resistance lateral pinch strengthening" },
  { keyword: "therapy putty", discipline: "OT", otpfCategory: "Health Management", clinicalContext: "Post-stroke intrinsic hand strengthening" },
  { keyword: "hand exerciser web", discipline: "OT", otpfCategory: "Health Management", clinicalContext: "Elastic web for finger flexion and extension" },
  { keyword: "grip dynamometer", discipline: "OT", otpfCategory: "Health Management", clinicalContext: "Jamar hydraulic grip assessment" },
  { keyword: "finger ladder", discipline: "PT", otpfCategory: "Health Management", clinicalContext: "Wall-mounted active shoulder flexion climbing" },
  { keyword: "shoulder pulley", discipline: "PT", otpfCategory: "Health Management", clinicalContext: "Over-door reciprocal shoulder range of motion" },
  { keyword: "resistance theraband", discipline: "PT", otpfCategory: "Health Management", clinicalContext: "Upper extremity kinetic chain strengthening" },
  { keyword: "latex exercise tubing", discipline: "PT", otpfCategory: "Health Management", clinicalContext: "Internal and external rotator cuff rehab" },
  { keyword: "foam roller", discipline: "PT", otpfCategory: "Health Management", clinicalContext: "Thoracic mobilization for desk workers" },
  { keyword: "slant board for calf", discipline: "PT", otpfCategory: "Health Management", clinicalContext: "Gastrocnemius and Achilles tendon stretching" },
  { keyword: "wobble balance board", discipline: "PT", otpfCategory: "Health Management", clinicalContext: "Ankle stability and weight shifting" },
  { keyword: "gait belt", discipline: "PT", otpfCategory: "Health Management", clinicalContext: "Caregiver assisted transfer safety strap" },
  { keyword: "single point cane", discipline: "PT", otpfCategory: "Health Management", clinicalContext: "Contralateral lower limb offloading" },
  { keyword: "forearm crutch", discipline: "PT", otpfCategory: "Health Management", clinicalContext: "Lofstrand crutch for neurological gait" },
  { keyword: "standard walker", discipline: "PT", otpfCategory: "Health Management", clinicalContext: "Post-surgical non-weight bearing ambulation" },
  { keyword: "wheelchair hand rim", discipline: "PT", otpfCategory: "Health Management", clinicalContext: "Manual wheelchair self-propulsion" },
  { keyword: "transfer board", discipline: "PT", otpfCategory: "Health Management", clinicalContext: "Sliding lateral transfer between surfaces" },
  { keyword: "bed rail", discipline: "PT", otpfCategory: "Health Management", clinicalContext: "Bedside pull handle for supine-to-sit" },
  { keyword: "wrist cock up splint", discipline: "OT", otpfCategory: "Health Management", clinicalContext: "Radial nerve palsy and wrist drop support" },
  { keyword: "resting hand splint", discipline: "OT", otpfCategory: "Health Management", clinicalContext: "Post-stroke spasticity inhibition orthosis" },
  { keyword: "carpal tunnel wrist brace", discipline: "OT", otpfCategory: "Health Management", clinicalContext: "Nocturnal neutral wrist immobilization" },
  { keyword: "elbow strap", discipline: "PT", otpfCategory: "Health Management", clinicalContext: "Counterforce brace for lateral epicondylitis" },
  { keyword: "shoulder immobilizer sling", discipline: "PT", otpfCategory: "Health Management", clinicalContext: "Post-operative shoulder protection" },
  { keyword: "lumbar support belt", discipline: "PT", otpfCategory: "Health Management", clinicalContext: "Intra-abdominal pressure for lifting tasks" },
  { keyword: "gel ice pack", discipline: "PT", otpfCategory: "Health Management", clinicalContext: "Post-exercise cryotherapy" },
  { keyword: "moist heating pad", discipline: "PT", otpfCategory: "Health Management", clinicalContext: "Cervical and lumbar muscle spasm relief" },
  { keyword: "aphasia communication board", discipline: "SLP", otpfCategory: "Social Participation", clinicalContext: "Core word icons for expressive aphasia" },
  { keyword: "picture exchange booklet", discipline: "SLP", otpfCategory: "Social Participation", clinicalContext: "Visual communication binder for needs" },
  { keyword: "speech therapy mirror", discipline: "SLP", otpfCategory: "Health Management", clinicalContext: "Visual biofeedback for apraxia and dysarthria" },
  { keyword: "oral motor tongue blade", discipline: "SLP", otpfCategory: "Health Management", clinicalContext: "Lingual resistance and bolus manipulation" },
  { keyword: "emst respiratory trainer", discipline: "SLP", otpfCategory: "Health Management", clinicalContext: "Expiratory muscle strength for cough and voice" },
  { keyword: "voice amplifier microphone", discipline: "SLP", otpfCategory: "Social Participation", clinicalContext: "Personal microphone for hypophonic speech" },
  { keyword: "drinking straw cup", discipline: "SLP", otpfCategory: "ADLs", clinicalContext: "Controlled liquid bolus volume" },
  { keyword: "swallowing posture wedge", discipline: "SLP", otpfCategory: "ADLs", clinicalContext: "Neck flexion positioning during meals" },
  { keyword: "cervical contour pillow", discipline: "PT", otpfCategory: "Rest and Sleep", clinicalContext: "Cervical spine neutrality during sleep" },
  { keyword: "wedge elevation pillow", discipline: "PT", otpfCategory: "Rest and Sleep", clinicalContext: "Lower extremity elevation for edema reduction" },
  { keyword: "gardening trowel with grip", discipline: "OT", otpfCategory: "Leisure", clinicalContext: "Ergonomic horticultural leisure tool" },
  { keyword: "hand pruner", discipline: "OT", otpfCategory: "Leisure", clinicalContext: "Spring-loaded garden tool for reduced hand force" },
  { keyword: "paint brush", discipline: "OT", otpfCategory: "Leisure", clinicalContext: "Adaptive wide-handle painting brush" },
  { keyword: "woodworking sandpaper block", discipline: "OT", otpfCategory: "Leisure", clinicalContext: "Bilateral sanding stroke rehabilitation" },
  { keyword: "chess piece", discipline: "OT", otpfCategory: "Play", clinicalContext: "Tabletop strategic chess play and three-jaw chuck pinch" },
  { keyword: "playing card holder", discipline: "OT", otpfCategory: "Leisure", clinicalContext: "Slotted wooden rack holding cards" },
  { keyword: "hand", discipline: "Interdisciplinary", otpfCategory: "ADLs", clinicalContext: "Anatomical tracking landmark" },
  { keyword: "wrist", discipline: "Interdisciplinary", otpfCategory: "ADLs", clinicalContext: "Wrist extension-flexion tracking" },
  { keyword: "forearm", discipline: "Interdisciplinary", otpfCategory: "ADLs", clinicalContext: "Pronation and supination landmark" },
  { keyword: "shoulder", discipline: "Interdisciplinary", otpfCategory: "ADLs", clinicalContext: "Shoulder abduction and hike tracking" },
  { keyword: "lip", discipline: "SLP", otpfCategory: "ADLs", clinicalContext: "Labial seal and dysarthria speech tracking" },
  { keyword: "tongue", discipline: "SLP", otpfCategory: "ADLs", clinicalContext: "Lingual coordination and bolus sweep" },
  { keyword: "neck", discipline: "Interdisciplinary", otpfCategory: "ADLs", clinicalContext: "Cervical alignment and swallowing posture" },
  { keyword: "knee", discipline: "PT", otpfCategory: "ADLs", clinicalContext: "Knee flexion and extension gait angle" },
  { keyword: "foot", discipline: "PT", otpfCategory: "ADLs", clinicalContext: "Heel strike and foot flat gait tracking" },
];

// -----------------------------------------------------------------------------
// 4. OLD PEOPLE ENGINE (Ages 55 and Above)
// -----------------------------------------------------------------------------
const OLD_PEOPLE_ITEMS: SamKeywordItem[] = [
  { keyword: "four wheeled rollator", discipline: "PT", otpfCategory: "Health Management", clinicalContext: "Community ambulation with seat and hand brakes" },
  { keyword: "wheeled walker", discipline: "PT", otpfCategory: "Health Management", clinicalContext: "Front-wheeled walker for indoor fall prevention" },
  { keyword: "walker tennis ball", discipline: "PT", otpfCategory: "Health Management", clinicalContext: "Glide feet on rear walker legs" },
  { keyword: "quad cane", discipline: "PT", otpfCategory: "Health Management", clinicalContext: "Four-point base cane for stroke and balance deficits" },
  { keyword: "single point cane", discipline: "PT", otpfCategory: "Health Management", clinicalContext: "Unilateral offloading for knee osteoarthritis" },
  { keyword: "gait belt", discipline: "PT", otpfCategory: "Health Management", clinicalContext: "Caregiver safety belt for transfer assistance" },
  { keyword: "transfer bench", discipline: "OT", otpfCategory: "ADLs", clinicalContext: "Sliding over tub ledge without hip flexion past 90" },
  { keyword: "shower chair", discipline: "OT", otpfCategory: "ADLs", clinicalContext: "Seated bathing for fatigue and balance impairment" },
  { keyword: "bathroom grab bar", discipline: "OT", otpfCategory: "ADLs", clinicalContext: "Wall-mounted anchor for wet surface safety" },
  { keyword: "raised toilet seat", discipline: "OT", otpfCategory: "ADLs", clinicalContext: "Elevating toilet surface to protect hip replacement" },
  { keyword: "toilet safety frame", discipline: "OT", otpfCategory: "ADLs", clinicalContext: "Dual armrests for sit-to-stand leverage" },
  { keyword: "bed assist rail", discipline: "PT", otpfCategory: "Health Management", clinicalContext: "Bedside handle preventing nocturnal roll-out and falls" },
  { keyword: "transfer slide board", discipline: "PT", otpfCategory: "Health Management", clinicalContext: "Frictionless transfer between bed and wheelchair" },
  { keyword: "reacher grabber tool", discipline: "OT", otpfCategory: "IADLs", clinicalContext: "Floor object pickup avoiding spinal bending" },
  { keyword: "sock aid device", discipline: "OT", otpfCategory: "ADLs", clinicalContext: "Curved plastic shell for donning socks independently" },
  { keyword: "long handled shoehorn", discipline: "OT", otpfCategory: "ADLs", clinicalContext: "Extended horn for sliding into shoes without stooping" },
  { keyword: "dressing stick", discipline: "OT", otpfCategory: "ADLs", clinicalContext: "Hooked wooden rod pulling pants and coats" },
  { keyword: "button hook tool", discipline: "OT", otpfCategory: "ADLs", clinicalContext: "Wire loop pulling buttons through small holes" },
  { keyword: "zipper loop", discipline: "OT", otpfCategory: "ADLs", clinicalContext: "Enlarged ring on zipper sliders for arthritic hands" },
  { keyword: "elastic shoelace", discipline: "OT", otpfCategory: "ADLs", clinicalContext: "Pre-tied stretch laces turning shoes into slip-ons" },
  { keyword: "velcro strap shoe", discipline: "OT", otpfCategory: "ADLs", clinicalContext: "Wide aperture orthopedic footwear" },
  { keyword: "non skid slipper", discipline: "PT", otpfCategory: "ADLs", clinicalContext: "Treaded rubber sole slipper preventing indoor slips" },
  { keyword: "built up handle spoon", discipline: "OT", otpfCategory: "ADLs", clinicalContext: "Foam cylindrical grip accommodating contracted fingers" },
  { keyword: "weighted fork", discipline: "OT", otpfCategory: "ADLs", clinicalContext: "Heavy utensil damping Parkinsonian resting tremors" },
  { keyword: "scoop dish", discipline: "OT", otpfCategory: "ADLs", clinicalContext: "Overhanging rim plate for easy one-handed loading" },
  { keyword: "plate guard ring", discipline: "OT", otpfCategory: "ADLs", clinicalContext: "Plastic rim barrier preventing food sliding off plate" },
  { keyword: "two handled cup with lid", discipline: "OT", otpfCategory: "ADLs", clinicalContext: "Bilateral drinking cup preventing spills from tremors" },
  { keyword: "weighted mug", discipline: "OT", otpfCategory: "ADLs", clinicalContext: "Calibrated weight mug providing stability during sips" },
  { keyword: "straw with valve", discipline: "SLP", otpfCategory: "ADLs", clinicalContext: "One-way liquid valve keeping fluid at straw top" },
  { keyword: "nectar thick liquid cup", discipline: "SLP", otpfCategory: "ADLs", clinicalContext: "Swallowing safety cup for thickened liquids" },
  { keyword: "thickened water glass", discipline: "SLP", otpfCategory: "ADLs", clinicalContext: "Viscous fluid preventing airway aspiration" },
  { keyword: "dysphagia cup", discipline: "SLP", otpfCategory: "ADLs", clinicalContext: "Controlled flow rate cup delivering measured bolus" },
  { keyword: "pureed meal plate", discipline: "SLP", otpfCategory: "ADLs", clinicalContext: "Smooth texture meal for chewing and pharyngeal ease" },
  { keyword: "oral swab", discipline: "SLP", otpfCategory: "ADLs", clinicalContext: "Moisturizing oral cavity and tongue cleaning" },
  { keyword: "denture cleaning cup", discipline: "OT", otpfCategory: "ADLs", clinicalContext: "Soaking bath for full and partial dentures" },
  { keyword: "denture brush", discipline: "OT", otpfCategory: "ADLs", clinicalContext: "Dual-headed stiff bristle brush for prosthetics" },
  { keyword: "long handled bath sponge", discipline: "OT", otpfCategory: "ADLs", clinicalContext: "Curved handle sponge reaching lower legs and feet" },
  { keyword: "long handled hairbrush", discipline: "OT", otpfCategory: "ADLs", clinicalContext: "Extended reach grooming tool for frozen shoulder" },
  { keyword: "faucet knob turner", discipline: "OT", otpfCategory: "ADLs", clinicalContext: "Lever adapter making water handles easy to twist" },
  { keyword: "weekly pill organizer", discipline: "OT", otpfCategory: "Health Management", clinicalContext: "Seven-day morning/noon/night compartment box" },
  { keyword: "automated pill dispenser", discipline: "OT", otpfCategory: "Health Management", clinicalContext: "Locked motorized carousel with alarm for dementia" },
  { keyword: "pill blister pack", discipline: "OT", otpfCategory: "Health Management", clinicalContext: "Carded blister dosages for easy daily verification" },
  { keyword: "magnifying glass with light", discipline: "OT", otpfCategory: "Education", clinicalContext: "Illuminated optical magnifier for low vision" },
  { keyword: "large print book", discipline: "SLP", otpfCategory: "Education", clinicalContext: "High-contrast reading material for cognitive health" },
  { keyword: "reading spectacles", discipline: "OT", otpfCategory: "Work", clinicalContext: "Presbyopia corrective eyeglasses for volunteer clerical duties" },
  { keyword: "eyeglass cord", discipline: "OT", otpfCategory: "ADLs", clinicalContext: "Neck lanyard preventing spectacles loss" },
  { keyword: "hearing aid case", discipline: "SLP", otpfCategory: "Health Management", clinicalContext: "Protective drying case for hearing aids" },
  { keyword: "hearing aid battery", discipline: "SLP", otpfCategory: "Health Management", clinicalContext: "Zinc-air miniature battery change" },
  { keyword: "medical alert pendant", discipline: "Interdisciplinary", otpfCategory: "Health Management", clinicalContext: "Wearable neck button for emergency fall alert" },
  { keyword: "emergency call button", discipline: "Interdisciplinary", otpfCategory: "Health Management", clinicalContext: "Wall-mounted call switch in bedroom/bathroom" },
  { keyword: "telephone with large buttons", discipline: "SLP", otpfCategory: "IADLs", clinicalContext: "High-contrast speed dial phone for low vision" },
  { keyword: "jar opener gripper", discipline: "OT", otpfCategory: "IADLs", clinicalContext: "Textured cone rubber grip for twisting stubborn jars" },
  { keyword: "bottle twist opener", discipline: "OT", otpfCategory: "IADLs", clinicalContext: "Plastic lever tool popping carbonated soda caps" },
  { keyword: "can opener with knob", discipline: "OT", otpfCategory: "IADLs", clinicalContext: "Extra-large turn key can opener" },
  { keyword: "dycem non slip coaster", discipline: "OT", otpfCategory: "IADLs", clinicalContext: "Anchor coaster keeping glassware stable" },
  { keyword: "non slip kitchen mat", discipline: "PT", otpfCategory: "IADLs", clinicalContext: "Anti-fatigue rubber mat with beveled edges" },
  { keyword: "lightweight plastic kettle", discipline: "OT", otpfCategory: "IADLs", clinicalContext: "Low tare weight kettle for safe tea pouring" },
  { keyword: "reach extender pole", discipline: "OT", otpfCategory: "IADLs", clinicalContext: "Long reach curtain and window hook" },
  { keyword: "shopping cart with wheels", discipline: "PT", otpfCategory: "IADLs", clinicalContext: "Rolling market cart offloading grocery carrying" },
  { keyword: "grocery tote bag", discipline: "OT", otpfCategory: "IADLs", clinicalContext: "Padded handle shopping bag" },
  { keyword: "key turner aid", discipline: "OT", otpfCategory: "IADLs", clinicalContext: "Thick plastic lever turning deadbolts smoothly" },
  { keyword: "door handle lever", discipline: "OT", otpfCategory: "IADLs", clinicalContext: "Easy downward push door handle" },
  { keyword: "theraband exercise loop", discipline: "PT", otpfCategory: "Health Management", clinicalContext: "Seated hip abduction resistance for sarcopenia" },
  { keyword: "light ankle weight", discipline: "PT", otpfCategory: "Health Management", clinicalContext: "Quadriceps knee extension cuff weight" },
  { keyword: "seated pedal exerciser", discipline: "PT", otpfCategory: "Health Management", clinicalContext: "Floor pedal cycle for gentle cardio and leg rehab" },
  { keyword: "soft squeeze ball", discipline: "OT", otpfCategory: "Health Management", clinicalContext: "Gentle grip maintenance for osteoarthritic digits" },
  { keyword: "hand therapy putty", discipline: "OT", otpfCategory: "Health Management", clinicalContext: "Softest grade putty for finger extension" },
  { keyword: "cmc thumb arthritis brace", discipline: "OT", otpfCategory: "Health Management", clinicalContext: "Rigid basal thumb support for osteoarthritis" },
  { keyword: "resting hand orthosis", discipline: "OT", otpfCategory: "Health Management", clinicalContext: "Nighttime resting pan splint for contracture control" },
  { keyword: "neoprene knee support", discipline: "PT", otpfCategory: "Health Management", clinicalContext: "Compressive knee sleeve for joint warmth and pain" },
  { keyword: "hip abduction pillow", discipline: "PT", otpfCategory: "Health Management", clinicalContext: "Wedge maintaining legs apart post-hip arthroplasty" },
  { keyword: "lumbar roll cushion", discipline: "PT", otpfCategory: "Health Management", clinicalContext: "McKenzie cylindrical cushion for armchair posture" },
  { keyword: "orthopedic knee spacer pillow", discipline: "PT", otpfCategory: "Rest and Sleep", clinicalContext: "Hourglass foam cushion between knees during sleep" },
  { keyword: "wedge positioning pillow", discipline: "PT", otpfCategory: "Rest and Sleep", clinicalContext: "Incline bed wedge for acid reflux and breathing" },
  { keyword: "bedside commode bucket", discipline: "OT", otpfCategory: "Rest and Sleep", clinicalContext: "Nighttime toilet beside bed preventing dark falls" },
  { keyword: "voice decibel sound meter", discipline: "SLP", otpfCategory: "Health Management", clinicalContext: "Objective feedback for Parkinsonian hypophonia" },
  { keyword: "speech biofeedback mirror", discipline: "SLP", otpfCategory: "Health Management", clinicalContext: "Mirror practicing lip rounding and mouth opening" },
  { keyword: "respiratory incentive spirometer", discipline: "PT", otpfCategory: "Health Management", clinicalContext: "Inhalation chamber preventing atelectasis" },
  { keyword: "lsvt voice prompt card", discipline: "SLP", otpfCategory: "Social Participation", clinicalContext: "'Think Loud!' prompt card for voice intensity" },
  { keyword: "large print playing card", discipline: "OT", otpfCategory: "Social Participation", clinicalContext: "Bridge and rummy deck with enlarged indices" },
  { keyword: "playing card holder stand", discipline: "OT", otpfCategory: "Leisure", clinicalContext: "Hands-free curved rack holding game cards" },
  { keyword: "jigsaw puzzle with large pieces", discipline: "OT", otpfCategory: "Leisure", clinicalContext: "Cognitive hobby with tactile easy-grip pieces" },
  { keyword: "bingo dauber marker", discipline: "OT", otpfCategory: "Play", clinicalContext: "Recreational bingo play and palmar grip stamping" },
  { keyword: "domino tile", discipline: "OT", otpfCategory: "Leisure", clinicalContext: "Tactile dots and fine tabletop tile positioning" },
  { keyword: "crochet hook with ergonomic grip", discipline: "OT", otpfCategory: "Leisure", clinicalContext: "Thick soft silicone handle for arthritic crochet" },
  { keyword: "thick knitting needle", discipline: "OT", otpfCategory: "Leisure", clinicalContext: "Jumbo wooden knitting needles for low dexterity" },
  { keyword: "yarn ball", discipline: "OT", otpfCategory: "Leisure", clinicalContext: "Knitting yarn manipulation and bilateral winding" },
  { keyword: "watering can with double handle", discipline: "OT", otpfCategory: "IADLs", clinicalContext: "Two-handed balance for indoor plant watering" },
  { keyword: "gardening kneeling pad", discipline: "PT", otpfCategory: "Leisure", clinicalContext: "Padded knee cushion for outdoor leisure" },
  { keyword: "prayer bead strand", discipline: "OT", otpfCategory: "Social Participation", clinicalContext: "Rosary/prayer beads for spiritual participation" },
  { keyword: "photo album", discipline: "SLP", otpfCategory: "Social Participation", clinicalContext: "Reminiscence conversation photos with grandchildren" },
  { keyword: "hand", discipline: "Interdisciplinary", otpfCategory: "ADLs", clinicalContext: "Anatomical tracking landmark" },
  { keyword: "tremor hand", discipline: "Interdisciplinary", otpfCategory: "ADLs", clinicalContext: "Parkinsonian tremor oscillation tracking" },
  { keyword: "finger", discipline: "Interdisciplinary", otpfCategory: "ADLs", clinicalContext: "Finger contracture and dexterity landmark" },
  { keyword: "wrist", discipline: "Interdisciplinary", otpfCategory: "ADLs", clinicalContext: "Wrist deviation and arthritis tracking" },
  { keyword: "shoulder", discipline: "Interdisciplinary", otpfCategory: "ADLs", clinicalContext: "Shoulder flexion and reach limits" },
  { keyword: "knee", discipline: "PT", otpfCategory: "ADLs", clinicalContext: "Knee replacement alignment and extension deficit" },
  { keyword: "foot", discipline: "PT", otpfCategory: "ADLs", clinicalContext: "Foot clearance and shuffle gait landmark" },
  { keyword: "lip", discipline: "SLP", otpfCategory: "ADLs", clinicalContext: "Oral closure and swallow seal landmark" },
  { keyword: "throat", discipline: "SLP", otpfCategory: "ADLs", clinicalContext: "Thyroid cartilage elevation during swallowing" },
];

// Helper to build engine metadata
function buildEngine(
  category: SamEngineCategory,
  name: string,
  ageRange: string,
  conditions: {
    occupationalTherapy: string[];
    physicalTherapy: string[];
    speechPathology: string[];
  },
  items: SamKeywordItem[],
  engineType: "demographic" | "environment" = "demographic"
): SamEngineMetadata {
  const keywords = Object.freeze(items.map((i) => i.keyword));
  const payload = keywords.join(", ");
  const otpfSet = Array.from(new Set(items.map((i) => i.otpfCategory)));

  return {
    category,
    name,
    ageRange,
    engineType,
    targetCount: items.length,
    clinicalConditions: conditions,
    otpfFrameworkCoverage: otpfSet,
    keywords,
    payload,
    items: Object.freeze(items),
  };
}

export const SAM_PEDIA_ENGINE: SamEngineMetadata = buildEngine(
  "pedia",
  "Pediatric SAM Engine",
  "Ages 1–11",
  {
    occupationalTherapy: [
      "Autism Spectrum Disorder (ASD)",
      "Sensory Processing Disorder (SPD)",
      "Cerebral Palsy (CP)",
      "Developmental Coordination Disorder (Dyspraxia)",
      "Down Syndrome",
      "Fine Motor and Bilateral Integration Delay",
    ],
    physicalTherapy: [
      "Congenital Muscular Torticollis",
      "Clubfoot (Talipes Equinovarus)",
      "Idiopathic Toe Walking",
      "Spina Bifida",
      "Hypotonia and Motor Milestone Delays",
      "Muscular Dystrophy",
    ],
    speechPathology: [
      "Pediatric Dysphagia and Feeding Aversion",
      "Childhood Apraxia of Speech (CAS)",
      "Speech Sound Disorder (Articulation/Phonology)",
      "Receptive and Expressive Language Delay",
      "Augmentative and Alternative Communication (AAC)",
    ],
  },
  PEDIA_ITEMS
);

export const SAM_ADOLESCENT_ENGINE: SamEngineMetadata = buildEngine(
  "adolescent",
  "Adolescent SAM Engine",
  "Ages 12–17",
  {
    occupationalTherapy: [
      "Dysgraphia and Handwriting Fatigue",
      "Executive Dysfunction (ADHD)",
      "Hypermobility Spectrum Disorder (Ehlers-Danlos)",
      "Post-Concussion Visual-Motor Fatigue",
      "Repetitive Strain Injury (Texting/Gaming)",
      "Postural Kyphosis and Ergonomic Fatigue",
    ],
    physicalTherapy: [
      "Adolescent Idiopathic Scoliosis",
      "Anterior Cruciate Ligament (ACL) Rehab",
      "Osgood-Schlatter Disease",
      "Inversion Ankle Sprains",
      "Patellofemoral Pain Syndrome",
      "Overuse Sports Tendinopathies",
    ],
    speechPathology: [
      "Stuttering and Fluency Pacing",
      "Vocal Nodules and Vocal Cord Strain",
      "Cognitive-Communication Deficits Post-TBI/Concussion",
      "Social Communication Pragmatic Disorder",
      "High-Tech AAC Device Navigation",
    ],
  },
  ADOLESCENT_ITEMS
);

export const SAM_ADULT_ENGINE: SamEngineMetadata = buildEngine(
  "adult",
  "Adult SAM Engine",
  "Ages 18–54",
  {
    occupationalTherapy: [
      "Cerebrovascular Accident (CVA / Stroke Hemiparesis)",
      "Traumatic Brain Injury (TBI)",
      "Carpal Tunnel Syndrome and RSI",
      "Lateral and Medial Epicondylitis",
      "De Quervain's Tenosynovitis",
      "Spinal Cord Injury (Paraplegia/Tetraplegia)",
    ],
    physicalTherapy: [
      "Lumbar Disc Herniation and Sciatica",
      "Rotator Cuff Tear and Shoulder Impingement",
      "Cervical Radiculopathy",
      "ACL / Meniscal Post-Surgical Recovery",
      "Plantar Fasciitis",
      "Total Joint Preservation",
    ],
    speechPathology: [
      "Aphasia (Broca's / Wernicke's / Anomic)",
      "Motor Speech Dysarthria",
      "Adult Neurogenic Dysphagia (Aspiration Risks)",
      "Voice Disorders and Vocal Hyperfunction",
      "Cognitive-Linguistic Rehabilitation",
    ],
  },
  ADULT_ITEMS
);

export const SAM_OLD_PEOPLE_ENGINE: SamEngineMetadata = buildEngine(
  "old_people",
  "Old People (55+) SAM Engine",
  "Ages 55 and Above",
  {
    occupationalTherapy: [
      "Osteoarthritis (Thumb CMC and Hand Joints)",
      "Rheumatoid Arthritis and Joint Deformity",
      "Chronic Stroke Hemiparesis and Neglect",
      "Parkinson's Disease (Tremors and Bradykinesia)",
      "Mild Cognitive Impairment and Alzheimer's Dementia",
      "Low Vision and Age-Related Macular Degeneration",
    ],
    physicalTherapy: [
      "High Fall Risk and Balance Dysfunction",
      "Parkinsonian Freezing of Gait",
      "Total Hip Arthroplasty (Posterior Precautions)",
      "Total Knee Arthroplasty (TKA)",
      "Lumbar Spinal Stenosis and Spondylosis",
      "Osteoporosis with Kyphosis and Sarcopenia",
    ],
    speechPathology: [
      "Presbyphagia (Age-Related Swallowing Sarcopenia)",
      "Chronic Dysphagia with Thickened Fluid Management",
      "Parkinsonian Hypophonia (LSVT Loud Voice Training)",
      "Vascular Dementia Cognitive-Communication",
      "Denture-Related Speech Articulation Changes",
    ],
  },
  OLD_PEOPLE_ITEMS
);

// -----------------------------------------------------------------------------
// 5. EVERYDAY OBJECTS AT HOME ENGINE (All Ages / Domestic Living)
// -----------------------------------------------------------------------------
const HOME_OBJECTS_ITEMS: SamKeywordItem[] = [
  { keyword: "front door knob", discipline: "OT", otpfCategory: "IADLs", clinicalContext: "Grip strength and forearm supination during door opening" },
  { keyword: "door handle lever", discipline: "OT", otpfCategory: "IADLs", clinicalContext: "Adaptive gross grasp for arthritic or paretic upper limb" },
  { keyword: "light switch plate", discipline: "OT", otpfCategory: "IADLs", clinicalContext: "Index finger extension and fine motor toggle control" },
  { keyword: "wall outlet cover", discipline: "OT", otpfCategory: "Health Management", clinicalContext: "Electrical safety landmark and fine pinch coordination" },
  { keyword: "window latch", discipline: "OT", otpfCategory: "IADLs", clinicalContext: "Thumb opposition and radial wrist extension" },
  { keyword: "window blind cord", discipline: "OT", otpfCategory: "IADLs", clinicalContext: "Bimanual grasp and pull cord coordination" },
  { keyword: "curtain rod", discipline: "OT", otpfCategory: "IADLs", clinicalContext: "Overhead shoulder flexion and reaching kinematics" },
  { keyword: "sofa cushion", discipline: "OT", otpfCategory: "Rest and Sleep", clinicalContext: "Postural support and sit to stand cushion compression" },
  { keyword: "living room armchair", discipline: "PT", otpfCategory: "Rest and Sleep", clinicalContext: "Armchair armrest landmark for functional transfers" },
  { keyword: "coffee table", discipline: "PT", otpfCategory: "IADLs", clinicalContext: "Obstacle navigation and domestic environmental buffer" },
  { keyword: "television remote control", discipline: "OT", otpfCategory: "Leisure", clinicalContext: "Isolated finger pointing and cognitive device operation" },
  { keyword: "table lamp switch", discipline: "OT", otpfCategory: "IADLs", clinicalContext: "Rotary knob twist or touch sensor activation" },
  { keyword: "floor rug edge", discipline: "PT", otpfCategory: "Health Management", clinicalContext: "High-risk trip hazard detection and foot clearance height" },
  { keyword: "doormat", discipline: "PT", otpfCategory: "Health Management", clinicalContext: "Threshold transition and dynamic balance adjustment" },
  { keyword: "stair handrail", discipline: "PT", otpfCategory: "Health Management", clinicalContext: "Upper extremity support during stair ascent and descent" },
  { keyword: "stair step edge", discipline: "PT", otpfCategory: "Health Management", clinicalContext: "Step edge contrast and visual-motor foot placement" },
  { keyword: "hallway nightlight", discipline: "OT", otpfCategory: "Health Management", clinicalContext: "Nocturnal fall prevention and ambient navigation cue" },
  { keyword: "ceiling fan pull chain", discipline: "OT", otpfCategory: "IADLs", clinicalContext: "Overhead reach and fine pinch pull tracking" },
  { keyword: "bookshelf ledge", discipline: "OT", otpfCategory: "Leisure", clinicalContext: "Graded shoulder reaching at varying heights" },
  { keyword: "throw pillow", discipline: "OT", otpfCategory: "Rest and Sleep", clinicalContext: "Positioning support for hemiplegic limb or back comfort" },
  { keyword: "fleece blanket", discipline: "OT", otpfCategory: "Rest and Sleep", clinicalContext: "Sensory comfort and bimanual tucking coordination" },
  { keyword: "bed mattress edge", discipline: "PT", otpfCategory: "Rest and Sleep", clinicalContext: "Sitting edge balance and supine to sit bed mobility" },
  { keyword: "bed sheet corner", discipline: "OT", otpfCategory: "ADLs", clinicalContext: "Bed making grasp and bilateral pulling strength" },
  { keyword: "bed pillow", discipline: "OT", otpfCategory: "Rest and Sleep", clinicalContext: "Cervical spine alignment and restful sleep support" },
  { keyword: "nightstand drawer knob", discipline: "OT", otpfCategory: "ADLs", clinicalContext: "Lateral pinch grasp and reaching from seated bed edge" },
  { keyword: "alarm clock button", discipline: "OT", otpfCategory: "Rest and Sleep", clinicalContext: "Morning orientation and palmar press movement" },
  { keyword: "closet hanger", discipline: "OT", otpfCategory: "ADLs", clinicalContext: "Clothing hanging and overhead bilateral manipulation" },
  { keyword: "closet sliding door track", discipline: "OT", otpfCategory: "ADLs", clinicalContext: "Lateral sliding door pull and door glide resistance" },
  { keyword: "clothing drawer handle", discipline: "OT", otpfCategory: "ADLs", clinicalContext: "Dressing independence and pull drawer ergonomics" },
  { keyword: "bedroom slipper", discipline: "OT", otpfCategory: "ADLs", clinicalContext: "Footwear donning and slip-resistant base inspection" },
  { keyword: "laundry hamper basket", discipline: "OT", otpfCategory: "IADLs", clinicalContext: "Lifting mechanics and two-handed laundry transport" },
  { keyword: "ironing board lever", discipline: "OT", otpfCategory: "IADLs", clinicalContext: "Height adjustment and folding mechanism operation" },
  { keyword: "clothes iron handle", discipline: "OT", otpfCategory: "IADLs", clinicalContext: "Repetitive rhythmic forward backward arm gliding" },
  { keyword: "spray bottle trigger", discipline: "OT", otpfCategory: "IADLs", clinicalContext: "Multi-finger flexion trigger squeeze and grip strength" },
  { keyword: "vacuum cleaner handle", discipline: "PT", otpfCategory: "IADLs", clinicalContext: "Dynamic standing weight shift during cleaning passes" },
  { keyword: "broom handle", discipline: "PT", otpfCategory: "IADLs", clinicalContext: "Bimanual push-pull sweeping and core rotation" },
  { keyword: "dustpan rim", discipline: "OT", otpfCategory: "IADLs", clinicalContext: "Floor reach and stoop-and-sweep posture" },
  { keyword: "trash can foot pedal", discipline: "PT", otpfCategory: "IADLs", clinicalContext: "Single leg standing balance during pedal depression" },
  { keyword: "bathroom sink faucet", discipline: "OT", otpfCategory: "ADLs", clinicalContext: "Water temperature control and hand hygiene landmark" },
  { keyword: "faucet knob", discipline: "OT", otpfCategory: "ADLs", clinicalContext: "Rotational wrist pronation and torque generation" },
  { keyword: "soap dispenser pump", discipline: "OT", otpfCategory: "ADLs", clinicalContext: "Downward palmar depression and hand washing sequence" },
  { keyword: "bar soap dish", discipline: "OT", otpfCategory: "ADLs", clinicalContext: "Frictional wet grasp and soap lathering coordination" },
  { keyword: "manual toothbrush", discipline: "OT", otpfCategory: "ADLs", clinicalContext: "Digital grasp and fine repetitive circular brushing" },
  { keyword: "electric toothbrush base", discipline: "OT", otpfCategory: "ADLs", clinicalContext: "Adaptive thick grip and motor vibration tolerance" },
  { keyword: "toothpaste tube cap", discipline: "OT", otpfCategory: "ADLs", clinicalContext: "Tip pinch unscrewing and bilateral tube squeeze" },
  { keyword: "dental floss container", discipline: "OT", otpfCategory: "ADLs", clinicalContext: "Intricate fine pincer grasp and string cutting" },
  { keyword: "bathroom mirror surface", discipline: "SLP", otpfCategory: "ADLs", clinicalContext: "Visual biofeedback for facial symmetry and lip seal" },
  { keyword: "hair comb", discipline: "OT", otpfCategory: "ADLs", clinicalContext: "Shoulder external rotation and scalp grooming reach" },
  { keyword: "hairbrush bristle pad", discipline: "OT", otpfCategory: "ADLs", clinicalContext: "Palmar cylindrical grip and hair detangling pull" },
  { keyword: "hair dryer handle", discipline: "OT", otpfCategory: "ADLs", clinicalContext: "Sustained isometric upper limb holding while styling" },
  { keyword: "bathroom towel rack", discipline: "PT", otpfCategory: "ADLs", clinicalContext: "Reaching balance and avoidance of non-weight-bearing rails" },
  { keyword: "bath towel loop", discipline: "OT", otpfCategory: "ADLs", clinicalContext: "Bimanual drying and torso wrapping coordination" },
  { keyword: "washcloth", discipline: "OT", otpfCategory: "ADLs", clinicalContext: "Tactile face cleaning and bilateral cloth wringing" },
  { keyword: "toilet flush lever", discipline: "OT", otpfCategory: "ADLs", clinicalContext: "Post-toileting hygiene and flush lever activation" },
  { keyword: "toilet seat lid", discipline: "PT", otpfCategory: "ADLs", clinicalContext: "Sit to stand transition and toilet transfer balance" },
  { keyword: "toilet paper roll holder", discipline: "OT", otpfCategory: "ADLs", clinicalContext: "Reach distance and paper roll tearing precision" },
  { keyword: "shower curtain ring", discipline: "OT", otpfCategory: "ADLs", clinicalContext: "Horizontal gliding pull to prevent water pooling" },
  { keyword: "shower head wand", discipline: "OT", otpfCategory: "ADLs", clinicalContext: "Handheld showering for seated bathing independence" },
  { keyword: "shower mixing valve", discipline: "OT", otpfCategory: "ADLs", clinicalContext: "Anti-scald water temperature grading" },
  { keyword: "non slip bathtub mat", discipline: "PT", otpfCategory: "Health Management", clinicalContext: "Bathtub floor traction and wet transfer safety" },
  { keyword: "bathroom scale platform", discipline: "PT", otpfCategory: "Health Management", clinicalContext: "Bilateral standing posture and weight distribution" },
  { keyword: "medicine cabinet latch", discipline: "OT", otpfCategory: "Health Management", clinicalContext: "Finger pinch opening and cognitive medication routine" },
  { keyword: "first aid kit box", discipline: "OT", otpfCategory: "Health Management", clinicalContext: "Emergency preparedness and box clasp release" },
  { keyword: "thermometer digital screen", discipline: "OT", otpfCategory: "Health Management", clinicalContext: "Health monitoring read-out and oral temperature tracking" },
  { keyword: "band aid wrapper", discipline: "OT", otpfCategory: "Health Management", clinicalContext: "Fine motor bilateral tab pulling for wound dressing" },
  { keyword: "house key ring", discipline: "OT", otpfCategory: "IADLs", clinicalContext: "Key separation and lock insertion orientation" },
  { keyword: "deadbolt latch knob", discipline: "OT", otpfCategory: "IADLs", clinicalContext: "Radial twist deadbolt locking for home security" },
  { keyword: "front porch step", discipline: "PT", otpfCategory: "Health Management", clinicalContext: "Outdoor step negotiation and elevation transition" },
  { keyword: "handrail bracket", discipline: "PT", otpfCategory: "Health Management", clinicalContext: "Exterior grip stability on home entrance ramp or steps" },
  { keyword: "mailbox door latch", discipline: "PT", otpfCategory: "IADLs", clinicalContext: "Curbside reaching and community ambulation milestone" },
  { keyword: "envelope flap", discipline: "OT", otpfCategory: "IADLs", clinicalContext: "Mail opening and paper finger coordination" },
  { keyword: "landline telephone handset", discipline: "SLP", otpfCategory: "Social Participation", clinicalContext: "Auditory phone reception and verbal communication" },
  { keyword: "smartphone touchscreen", discipline: "OT", otpfCategory: "Social Participation", clinicalContext: "Capacitive touch tap, swipe, and telehealth engagement" },
  { keyword: "tablet computer stand", discipline: "SLP", otpfCategory: "Social Participation", clinicalContext: "Eye-level video call communication and tele-rehab" },
  { keyword: "charging cable plug", discipline: "OT", otpfCategory: "IADLs", clinicalContext: "Intricate orientation and port insertion fine motor skill" },
  { keyword: "wall clock face", discipline: "OT", otpfCategory: "Health Management", clinicalContext: "Cognitive temporal orientation and daily routine tracking" },
  { keyword: "thermostat dial", discipline: "OT", otpfCategory: "IADLs", clinicalContext: "Home climate adjustment and tactile rotary dial control" },
  { keyword: "air conditioner remote", discipline: "OT", otpfCategory: "IADLs", clinicalContext: "Button targeting and home comfort self-advocacy" },
  { keyword: "umbrella handle", discipline: "PT", otpfCategory: "IADLs", clinicalContext: "Hooked cane-like grip and rainy day walking balance" },
  { keyword: "coat rack hook", discipline: "PT", otpfCategory: "ADLs", clinicalContext: "Upper extremity reach and jacket suspension" },
  { keyword: "shoe rack shelf", discipline: "PT", otpfCategory: "ADLs", clinicalContext: "Lower body bending and footwear storage retrieval" },
  { keyword: "shoehorn blade", discipline: "OT", otpfCategory: "ADLs", clinicalContext: "Adaptive footwear donning without deep hip flexion" },
  { keyword: "wallet zipper", discipline: "OT", otpfCategory: "IADLs", clinicalContext: "Money management and fine bilateral pocket opening" },
  { keyword: "coin purse clasp", discipline: "OT", otpfCategory: "IADLs", clinicalContext: "Squeeze frame or kiss lock thumb-finger manipulation" },
  { keyword: "reading glasses frame", discipline: "OT", otpfCategory: "Work", clinicalContext: "Eyewear donning and visual acuity optimization" },
  { keyword: "eyeglass cleaning cloth", discipline: "OT", otpfCategory: "Work", clinicalContext: "Bilateral fingertip friction rubbing and lens care" },
  { keyword: "magnifying glass lens", discipline: "OT", otpfCategory: "Work", clinicalContext: "Low vision adaptation for print reading and bill paying" },
  { keyword: "paper notebook spine", discipline: "OT", otpfCategory: "Education", clinicalContext: "Home journaling and cognitive memory compensation" },
  { keyword: "ballpoint pen clicker", discipline: "OT", otpfCategory: "Education", clinicalContext: "Thumb push activation and handwriting grip initiation" },
  { keyword: "desk study lamp", discipline: "OT", otpfCategory: "Education", clinicalContext: "Task lighting adjustment for reading and writing" },
  { keyword: "home office desk chair", discipline: "PT", otpfCategory: "Work", clinicalContext: "Ergonomic seating and lumbar posture during home desk tasks" },
  { keyword: "board game token", discipline: "OT", otpfCategory: "Play", clinicalContext: "Pincer grasp tabletop piece placement in home games" },
  { keyword: "jigsaw puzzle box", discipline: "OT", otpfCategory: "Play", clinicalContext: "Cognitive visual-spatial piece sorting and recreation" },
  { keyword: "knitting basket", discipline: "OT", otpfCategory: "Leisure", clinicalContext: "Bimanual crafting storage and yarn handling" },
  { keyword: "stereo volume knob", discipline: "OT", otpfCategory: "Leisure", clinicalContext: "Auditory stimulation and rotary dial volume control" },
  { keyword: "wastebasket rim", discipline: "OT", otpfCategory: "IADLs", clinicalContext: "Trash disposal precision toss and room cleanliness" },
  { keyword: "pet food bowl", discipline: "PT", otpfCategory: "IADLs", clinicalContext: "Bending and lowering bowl for domestic pet care" },
  { keyword: "hand", discipline: "Interdisciplinary", otpfCategory: "ADLs", clinicalContext: "Anatomical tracking landmark for home living tasks" },
  { keyword: "finger", discipline: "Interdisciplinary", otpfCategory: "ADLs", clinicalContext: "Fine motor digital manipulation landmark" },
  { keyword: "foot", discipline: "Interdisciplinary", otpfCategory: "Health Management", clinicalContext: "Locomotion and weight acceptance landmark" },
];

export const SAM_HOME_OBJECTS_ENGINE: SamEngineMetadata = buildEngine(
  "home_objects",
  "Everyday Objects at Home",
  "All Ages (Home Rehab)",
  {
    occupationalTherapy: [
      "Home Safety & Environmental Adaptation",
      "ADL Grooming & Dressing Independence",
      "IADL Domestic Chores (Sweeping, Laundry, Ironing)",
      "Low Vision Home Print Reading",
    ],
    physicalTherapy: [
      "Domestic Fall Prevention & Trip Hazards",
      "Threshold & Doorway Transition Balance",
      "Stair Ascent & Descent Handrail Support",
      "Bed & Armchair Sit-to-Stand Mobility",
    ],
    speechPathology: [
      "Home Telehealth & Video Calling Communication",
      "Mirror-Assisted Facial Symmetry & Lip Seal",
      "Telephone Auditory Comprehension",
    ],
  },
  HOME_OBJECTS_ITEMS,
  "environment"
);

// -----------------------------------------------------------------------------
// 6. EVERYDAY OBJECTS AT SCHOOL ENGINE (Ages 3–21 / Academic Participation)
// -----------------------------------------------------------------------------
const SCHOOL_OBJECTS_ITEMS: SamKeywordItem[] = [
  { keyword: "student backpack strap", discipline: "OT", otpfCategory: "Education", clinicalContext: "Bilateral shoulder suspension and backpack donning" },
  { keyword: "backpack zipper pull", discipline: "OT", otpfCategory: "Education", clinicalContext: "Pincer grasp and horizontal zipper closure" },
  { keyword: "lunchbox zipper", discipline: "OT", otpfCategory: "ADLs", clinicalContext: "Mealtime preparation and adaptive fastener independence" },
  { keyword: "thermos flask lid", discipline: "OT", otpfCategory: "ADLs", clinicalContext: "Rotary unscrewing and bilateral hand strength" },
  { keyword: "pencil case zipper", discipline: "OT", otpfCategory: "Education", clinicalContext: "Classroom organization and school supply retrieval" },
  { keyword: "wooden number two pencil", discipline: "OT", otpfCategory: "Education", clinicalContext: "Dynamic tripod handwriting grip milestone" },
  { keyword: "pencil grip sleeve", discipline: "OT", otpfCategory: "Education", clinicalContext: "Ergonomic tactile finger positioning adaptation" },
  { keyword: "pencil eraser tip", discipline: "OT", otpfCategory: "Education", clinicalContext: "Fine motor inversion and controlled rubbing pressure" },
  { keyword: "manual pencil sharpener receptacle", discipline: "OT", otpfCategory: "Education", clinicalContext: "Bimanual twist and stabilization coordination" },
  { keyword: "electric pencil sharpener slot", discipline: "OT", otpfCategory: "Education", clinicalContext: "Direct target insertion and vibration resistance" },
  { keyword: "student safety scissors", discipline: "OT", otpfCategory: "Education", clinicalContext: "Bimanual paper cutting and scissor loop opening" },
  { keyword: "glue stick twist base", discipline: "OT", otpfCategory: "Education", clinicalContext: "Radial digital turn and graded stick elevation" },
  { keyword: "liquid glue squeeze bottle", discipline: "OT", otpfCategory: "Education", clinicalContext: "Graded isometric finger squeeze and dot dispensing" },
  { keyword: "wax crayon", discipline: "OT", otpfCategory: "Education", clinicalContext: "Coloring grasp and intrinsic hand arch activation" },
  { keyword: "crayon box flap", discipline: "OT", otpfCategory: "Education", clinicalContext: "Fine tip pinch tucking and supply management" },
  { keyword: "felt tip marker cap", discipline: "OT", otpfCategory: "Education", clinicalContext: "Two-handed pull separation and click closure" },
  { keyword: "dry erase marker barrel", discipline: "OT", otpfCategory: "Education", clinicalContext: "Whiteboard writing and vertical surface wrist extension" },
  { keyword: "whiteboard eraser felt", discipline: "OT", otpfCategory: "Education", clinicalContext: "Shoulder reaching and planar erasure movement" },
  { keyword: "classroom whiteboard tray", discipline: "OT", otpfCategory: "Education", clinicalContext: "Marker selection and classroom supply return" },
  { keyword: "chalkboard eraser", discipline: "OT", otpfCategory: "Education", clinicalContext: "Repetitive vertical stroke and shoulder endurance" },
  { keyword: "dustless chalk stick", discipline: "OT", otpfCategory: "Education", clinicalContext: "Tactile tolerance and broad strokes on blackboard" },
  { keyword: "classroom desk chair", discipline: "PT", otpfCategory: "Education", clinicalContext: "Seated posture, core tone, and 90-90 pelvic alignment" },
  { keyword: "student desk surface", discipline: "OT", otpfCategory: "Education", clinicalContext: "Forearm desk resting and upper limb writing workspace" },
  { keyword: "desk book compartment", discipline: "OT", otpfCategory: "Education", clinicalContext: "Spatial reach under desk without losing seated balance" },
  { keyword: "loose leaf lined paper", discipline: "OT", otpfCategory: "Education", clinicalContext: "Visual-spatial line tracking and margin awareness" },
  { keyword: "construction paper sheet", discipline: "OT", otpfCategory: "Education", clinicalContext: "Scissor cutting stability and craft folding" },
  { keyword: "spiral notebook wire", discipline: "OT", otpfCategory: "Education", clinicalContext: "Page turning across spiral binding milestone" },
  { keyword: "composition notebook cover", discipline: "OT", otpfCategory: "Education", clinicalContext: "Book opening and tactile firm cover manipulation" },
  { keyword: "three ring binder ring", discipline: "OT", otpfCategory: "Education", clinicalContext: "Bimanual pull lever to open and snap close binder" },
  { keyword: "two pocket folder", discipline: "OT", otpfCategory: "Education", clinicalContext: "Paper insertion and organizational school sorting" },
  { keyword: "plastic ruler edge", discipline: "OT", otpfCategory: "Education", clinicalContext: "Non-dominant holding stabilization during straight line drawing" },
  { keyword: "wooden yardstick", discipline: "PT", otpfCategory: "Education", clinicalContext: "Bimanual reach and gross measurement posture" },
  { keyword: "desktop stapler lever", discipline: "OT", otpfCategory: "Education", clinicalContext: "Downward palmar strike for document fastening" },
  { keyword: "staple remover jaw", discipline: "OT", otpfCategory: "Education", clinicalContext: "Pincer grasp pinch force to pry staple ends" },
  { keyword: "paper clip bend", discipline: "OT", otpfCategory: "Education", clinicalContext: "Fine motor digital slide over paper sheaf" },
  { keyword: "binder clip lever", discipline: "OT", otpfCategory: "Education", clinicalContext: "Finger spring compression and heavy paper clamping" },
  { keyword: "two hole paper punch", discipline: "OT", otpfCategory: "Education", clinicalContext: "Bilateral downward lever press and paper alignment" },
  { keyword: "clear tape dispenser wheel", discipline: "OT", otpfCategory: "Education", clinicalContext: "Unrolling pull and serrated edge tape tearing" },
  { keyword: "masking tape roll", discipline: "OT", otpfCategory: "Education", clinicalContext: "Bimanual peel and tape application" },
  { keyword: "highlighter felt chisel", discipline: "OT", otpfCategory: "Education", clinicalContext: "Visual tracking and linear text highlighting" },
  { keyword: "math counting block", discipline: "OT", otpfCategory: "Education", clinicalContext: "Fine motor grasp release and mathematical counting" },
  { keyword: "base ten plastic rod", discipline: "OT", otpfCategory: "Education", clinicalContext: "Pincer manipulation of elongated unit rods" },
  { keyword: "plastic pattern block", discipline: "OT", otpfCategory: "Education", clinicalContext: "Geometric rotation and 2D spatial puzzle assembly" },
  { keyword: "abacus sliding bead", discipline: "OT", otpfCategory: "Education", clinicalContext: "Isolated index finger slide across horizontal rod" },
  { keyword: "flashcard deck", discipline: "SLP", otpfCategory: "Education", clinicalContext: "Vocabulary drills and speech articulation cards" },
  { keyword: "aac communication tablet", discipline: "SLP", otpfCategory: "Social Participation", clinicalContext: "Direct selection of high-tech speech generating icons" },
  { keyword: "communication board binder", discipline: "SLP", otpfCategory: "Social Participation", clinicalContext: "Low-tech picture exchange communication system" },
  { keyword: "core vocabulary word chart", discipline: "SLP", otpfCategory: "Social Participation", clinicalContext: "Communication symbol point and language formulation" },
  { keyword: "visual picture schedule strip", discipline: "OT", otpfCategory: "Education", clinicalContext: "Classroom transition predictability and task completion" },
  { keyword: "laminated token board", discipline: "OT", otpfCategory: "Education", clinicalContext: "Behavior reinforcement and velcro token attachment" },
  { keyword: "reward star sticker sheet", discipline: "OT", otpfCategory: "Education", clinicalContext: "Peeling sticker from backing paper with fingernail pincer" },
  { keyword: "student locker latch", discipline: "OT", otpfCategory: "IADLs", clinicalContext: "Upward lever lift and locker door pull resistance" },
  { keyword: "combination padlock dial", discipline: "OT", otpfCategory: "IADLs", clinicalContext: "Rotary knob turning and numerical spatial alignment" },
  { keyword: "hall pass lanyard", discipline: "OT", otpfCategory: "IADLs", clinicalContext: "Neck loop donning and school independence pass" },
  { keyword: "student id card badge", discipline: "OT", otpfCategory: "Social Participation", clinicalContext: "Cafeteria barcode scan and card orientation" },
  { keyword: "water fountain push bar", discipline: "PT", otpfCategory: "Health Management", clinicalContext: "Downward push force and sustained bending hydration posture" },
  { keyword: "classroom door push bar", discipline: "PT", otpfCategory: "Education", clinicalContext: "Hallway transition and emergency door bar activation" },
  { keyword: "auditorium seat folding hinge", discipline: "PT", otpfCategory: "Social Participation", clinicalContext: "Seat lowering balance and assembly participation" },
  { keyword: "school bus handrail", discipline: "PT", otpfCategory: "Health Management", clinicalContext: "Bus stair ascent and high step balance stability" },
  { keyword: "school bus step tread", discipline: "PT", otpfCategory: "Health Management", clinicalContext: "Elevation clearance and community transportation mobility" },
  { keyword: "cafeteria tray divider", discipline: "OT", otpfCategory: "ADLs", clinicalContext: "Bimanual tray carrying and cafeteria food balance" },
  { keyword: "disposable cafeteria spork", discipline: "OT", otpfCategory: "ADLs", clinicalContext: "School self-feeding and scoop-spear utensil control" },
  { keyword: "milk carton spout flap", discipline: "OT", otpfCategory: "ADLs", clinicalContext: "Bilateral thumb push-pull carton opening" },
  { keyword: "juice box straw wrapper", discipline: "OT", otpfCategory: "ADLs", clinicalContext: "Cellophane wrapper peel and straw insertion hole target" },
  { keyword: "applesauce squeeze pouch cap", discipline: "OT", otpfCategory: "ADLs", clinicalContext: "Rotary cap twist and oral suction feeding" },
  { keyword: "granola bar tear wrapper", discipline: "OT", otpfCategory: "ADLs", clinicalContext: "Bimanual lateral pinch pull for snack opening" },
  { keyword: "reusable sandwich container latch", discipline: "OT", otpfCategory: "ADLs", clinicalContext: "Snap latch lift and mealtime independence" },
  { keyword: "cafeteria bench seat", discipline: "PT", otpfCategory: "Social Participation", clinicalContext: "Straddle bench transfer and peer social eating" },
  { keyword: "library book spine label", discipline: "OT", otpfCategory: "Education", clinicalContext: "Book retrieval from shelf and visual scanning" },
  { keyword: "book bookmark ribbon", discipline: "OT", otpfCategory: "Education", clinicalContext: "Fine ribbon placement for reading comprehension" },
  { keyword: "computer keyboard spacebar", discipline: "OT", otpfCategory: "Education", clinicalContext: "Bilateral thumb typing and assistive computer access" },
  { keyword: "computer mouse scroll wheel", discipline: "OT", otpfCategory: "Education", clinicalContext: "Isolated index finger scrolling and web navigation" },
  { keyword: "student headphones headband", discipline: "SLP", otpfCategory: "Education", clinicalContext: "Auditory listening device donning and sensory comfort" },
  { keyword: "speech microphone boom", discipline: "SLP", otpfCategory: "Education", clinicalContext: "Microphone mouth distance and voice articulation" },
  { keyword: "sensory wobble stool", discipline: "OT", otpfCategory: "Health Management", clinicalContext: "Active vestibular core seating for sensory seekers" },
  { keyword: "inflatable balance disc cushion", discipline: "PT", otpfCategory: "Health Management", clinicalContext: "Dynamic seating stability and core posture endurance" },
  { keyword: "weighted lap pad seam", discipline: "OT", otpfCategory: "Health Management", clinicalContext: "Proprioceptive calming during seat work" },
  { keyword: "fidget spinner bearing", discipline: "OT", otpfCategory: "Health Management", clinicalContext: "Self-regulation tactile tool and finger spin motion" },
  { keyword: "sensory squeeze stress ball", discipline: "OT", otpfCategory: "Health Management", clinicalContext: "Tension modulation and isometric hand squeeze" },
  { keyword: "chewable necklace pendant", discipline: "OT", otpfCategory: "Health Management", clinicalContext: "Oral sensory regulation and safe biting alternative" },
  { keyword: "noise cancelling ear muff", discipline: "OT", otpfCategory: "Health Management", clinicalContext: "Auditory defensiveness protection in loud assemblies" },
  { keyword: "gymnasium basketball rim", discipline: "PT", otpfCategory: "Play", clinicalContext: "Target accuracy and gross motor overhead throwing" },
  { keyword: "gym floor line stripe", discipline: "PT", otpfCategory: "Play", clinicalContext: "Tandem balance walking and spatial boundary awareness" },
  { keyword: "rubber dodgeball", discipline: "PT", otpfCategory: "Play", clinicalContext: "Two-handed catching, throwing, and motor planning" },
  { keyword: "plastic jump rope handle", discipline: "PT", otpfCategory: "Play", clinicalContext: "Bilateral arm circling and rhythmic jump timing" },
  { keyword: "sports agility cone", discipline: "PT", otpfCategory: "Play", clinicalContext: "Obstacle weaving, dynamic gait, and sprint stops" },
  { keyword: "balance beam edge", discipline: "PT", otpfCategory: "Play", clinicalContext: "Narrow base dynamic equilibrium and vestibular righting" },
  { keyword: "tumbling floor mat seam", discipline: "PT", otpfCategory: "Play", clinicalContext: "Gross motor rolling, floor gymnastics, and safe landing" },
  { keyword: "playground swing chain", discipline: "PT", otpfCategory: "Play", clinicalContext: "Vestibular pumping and bilateral grip on chains" },
  { keyword: "playground slide handrail", discipline: "PT", otpfCategory: "Play", clinicalContext: "Ladder climbing reciprocal steps and upper body pull" },
  { keyword: "monkey bar rung", discipline: "PT", otpfCategory: "Play", clinicalContext: "Brachiation grip and alternating overhead suspension" },
  { keyword: "playground merry go round handle", discipline: "PT", otpfCategory: "Play", clinicalContext: "Rotational vestibular stimulation and grip holding" },
  { keyword: "recess kickball", discipline: "PT", otpfCategory: "Play", clinicalContext: "Single limb stance, kicking swing, and eye-foot coordination" },
  { keyword: "recess sidewalk chalk", discipline: "OT", otpfCategory: "Play", clinicalContext: "Outdoor hopscotch drawing and gross finger grasp" },
  { keyword: "instrument music stand desk", discipline: "OT", otpfCategory: "Leisure", clinicalContext: "Music sheet placement and height adjustment" },
  { keyword: "orchestra violin bow", discipline: "OT", otpfCategory: "Leisure", clinicalContext: "Pinch grip control and fine rhythmic forearm bowing" },
  { keyword: "art easel frame", discipline: "OT", otpfCategory: "Leisure", clinicalContext: "Vertical canvas painting and shoulder girdle stability" },
  { keyword: "classroom chore clipboard", discipline: "OT", otpfCategory: "Work", clinicalContext: "Student vocational chore checkoff and paper clip hold" },
  { keyword: "recycling bin rim", discipline: "PT", otpfCategory: "Work", clinicalContext: "Classroom job duty paper disposal and carrying" },
  { keyword: "quiet corner beanbag chair", discipline: "OT", otpfCategory: "Rest and Sleep", clinicalContext: "Sensory decompression quiet area for restorative break" },
];

export const SAM_SCHOOL_OBJECTS_ENGINE: SamEngineMetadata = buildEngine(
  "school_objects",
  "Everyday Objects at School",
  "Ages 3–21 (School-Based Therapy)",
  {
    occupationalTherapy: [
      "Handwriting Tripod Grasp & Scissor Skills",
      "Desk Posture & Visual Motor Spatial Alignment",
      "Sensory Regulation & Classroom Modulation Tools",
      "School Lunchbox & Fastener Independence",
    ],
    physicalTherapy: [
      "Hallway Walking & School Bus Boarding Mobility",
      "Playground & Recess Gross Motor Navigation",
      "Physical Education Sports Agility & Coordination",
      "Cafeteria Seating & Standing Fountain Balance",
    ],
    speechPathology: [
      "Classroom AAC Tablet & Board Communication",
      "Vocabulary Articulation Drills with Flashcards",
      "Speech Intelligibility & Microphone Targeting",
      "Peer Social Participation in Assemblies",
    ],
  },
  SCHOOL_OBJECTS_ITEMS,
  "environment"
);

// -----------------------------------------------------------------------------
// 7. KITCHEN ITEMS ENGINE (Adolescent to Geriatric / Culinary Rehabilitation)
// -----------------------------------------------------------------------------
const KITCHEN_ITEMS_ITEMS: SamKeywordItem[] = [
  { keyword: "chef knife handle", discipline: "OT", otpfCategory: "IADLs", clinicalContext: "Pinch or wrap grip on culinary knife for meal prep cutting" },
  { keyword: "serrated bread knife", discipline: "OT", otpfCategory: "IADLs", clinicalContext: "Reciprocal sawing motion for crusty food slicing" },
  { keyword: "paring knife grip", discipline: "OT", otpfCategory: "IADLs", clinicalContext: "Precision peeling and close thumb stabilization" },
  { keyword: "wooden cutting board", discipline: "OT", otpfCategory: "IADLs", clinicalContext: "Food preparation work surface and stabilization" },
  { keyword: "flexible cutting mat", discipline: "OT", otpfCategory: "IADLs", clinicalContext: "Bimanual funneling of chopped produce into pan" },
  { keyword: "kitchen shears handle", discipline: "OT", otpfCategory: "IADLs", clinicalContext: "Heavy food package trimming and cutting force" },
  { keyword: "vegetable peeler swivel blade", discipline: "OT", otpfCategory: "IADLs", clinicalContext: "Distal downward pull and wrist radial deviation" },
  { keyword: "box grater handle", discipline: "OT", otpfCategory: "IADLs", clinicalContext: "Top stabilization grip and downward food grating strokes" },
  { keyword: "garlic press lever", discipline: "OT", otpfCategory: "IADLs", clinicalContext: "High force palmar squeeze and isometric crushing" },
  { keyword: "rolling pin handle", discipline: "OT", otpfCategory: "IADLs", clinicalContext: "Bilateral symmetrical push-pull rolling mechanics" },
  { keyword: "silicone spatula blade", discipline: "OT", otpfCategory: "IADLs", clinicalContext: "Bowl scraping and forearm rotary supination" },
  { keyword: "slotted cooking spoon", discipline: "OT", otpfCategory: "IADLs", clinicalContext: "Skimming and lifting solids from cooking liquid" },
  { keyword: "wooden stirring spoon", discipline: "OT", otpfCategory: "IADLs", clinicalContext: "Stove stirring with cylindrical grip and heat resistance" },
  { keyword: "soup ladle bowl", discipline: "OT", otpfCategory: "IADLs", clinicalContext: "Deep scooping and wrist flexion transfer into soup bowl" },
  { keyword: "stainless steel tongs handle", discipline: "OT", otpfCategory: "IADLs", clinicalContext: "Sustained spring pinch to grasp and turn hot food" },
  { keyword: "balloon wire whisk", discipline: "OT", otpfCategory: "IADLs", clinicalContext: "Rapid circular wrist circumduction and forearm stamina" },
  { keyword: "potato masher grid", discipline: "OT", otpfCategory: "IADLs", clinicalContext: "Vertical downward palmar crushing force" },
  { keyword: "meat tenderizer mallet face", discipline: "OT", otpfCategory: "IADLs", clinicalContext: "Controlled vertical arm hammering precision" },
  { keyword: "frying pan handle", discipline: "OT", otpfCategory: "IADLs", clinicalContext: "Single hand pan lift and wrist radial stabilization" },
  { keyword: "saucepan helper handle", discipline: "OT", otpfCategory: "IADLs", clinicalContext: "Bimanual lift of heavy pot to prevent hot spillage" },
  { keyword: "stockpot side loop handle", discipline: "OT", otpfCategory: "IADLs", clinicalContext: "Two-handed symmetrical carrying from stove to sink" },
  { keyword: "pot lid knob", discipline: "OT", otpfCategory: "IADLs", clinicalContext: "Spherical pinch grasp and steam deflection angle" },
  { keyword: "silicone oven mitt", discipline: "OT", otpfCategory: "IADLs", clinicalContext: "Adaptive thermal protection and gross mitten grasp" },
  { keyword: "fabric potholder loop", discipline: "OT", otpfCategory: "IADLs", clinicalContext: "Quick heat shield pick-up and pan placement" },
  { keyword: "baking sheet rim", discipline: "OT", otpfCategory: "IADLs", clinicalContext: "Two-handed oven insertion and level carrying" },
  { keyword: "muffin baking tin", discipline: "OT", otpfCategory: "IADLs", clinicalContext: "Horizontal tray balance and oven rack transfer" },
  { keyword: "casserole dish glass handle", discipline: "OT", otpfCategory: "IADLs", clinicalContext: "Rigid glass handle grip for heavy baked meals" },
  { keyword: "colander drainage hole", discipline: "OT", otpfCategory: "IADLs", clinicalContext: "Sink pasta straining and hot water separation" },
  { keyword: "fine mesh wire strainer", discipline: "OT", otpfCategory: "IADLs", clinicalContext: "Lightweight flour sifting and single hand shaking" },
  { keyword: "stainless steel mixing bowl", discipline: "OT", otpfCategory: "IADLs", clinicalContext: "Non-dominant arm bowl cradling while whisking" },
  { keyword: "glass measuring cup spout", discipline: "OT", otpfCategory: "IADLs", clinicalContext: "Eye-level volume checking and controlled pouring" },
  { keyword: "plastic measuring spoon ring", discipline: "OT", otpfCategory: "IADLs", clinicalContext: "Pinch separation of ring spoons and dry ingredient leveling" },
  { keyword: "digital kitchen food scale", discipline: "OT", otpfCategory: "IADLs", clinicalContext: "Portion control and tare button digital targeting" },
  { keyword: "kitchen timer turn dial", discipline: "OT", otpfCategory: "IADLs", clinicalContext: "Rotary dial countdown setting and cognitive cooking safety" },
  { keyword: "manual can opener turn key", discipline: "OT", otpfCategory: "IADLs", clinicalContext: "Bimanual coordination: clamp handle plus rotate wing key" },
  { keyword: "jar lid gripper pad", discipline: "OT", otpfCategory: "IADLs", clinicalContext: "High-friction rubber circle for arthritic jar opening" },
  { keyword: "bottle twist opener tool", discipline: "OT", otpfCategory: "IADLs", clinicalContext: "Leverage assistance for soda and water bottle caps" },
  { keyword: "corkscrew lever arm", discipline: "OT", otpfCategory: "IADLs", clinicalContext: "Wing corkscrew bilateral downward push" },
  { keyword: "refrigerator door handle", discipline: "PT", otpfCategory: "IADLs", clinicalContext: "Standing balance counter-pull against magnetic gasket" },
  { keyword: "freezer drawer pull", discipline: "PT", otpfCategory: "IADLs", clinicalContext: "Squat or hinge reach to pull heavy bottom freezer" },
  { keyword: "refrigerator crisper drawer", discipline: "OT", otpfCategory: "IADLs", clinicalContext: "Two-handed glide open and vegetable reach" },
  { keyword: "microwave door push button", discipline: "OT", otpfCategory: "IADLs", clinicalContext: "Isolated finger depression to pop open microwave latch" },
  { keyword: "microwave turntable glass plate", discipline: "OT", otpfCategory: "IADLs", clinicalContext: "Centering circular plate on rotating spindle" },
  { keyword: "electric toaster push lever", discipline: "OT", otpfCategory: "IADLs", clinicalContext: "Downward finger or palmar latch press" },
  { keyword: "countertop blender pitcher", discipline: "OT", otpfCategory: "IADLs", clinicalContext: "Heavy pitcher alignment onto motorized blender base" },
  { keyword: "blender lid center cap", discipline: "OT", otpfCategory: "IADLs", clinicalContext: "Press-fit rubber lid seal and safety cover" },
  { keyword: "electric food processor bowl", discipline: "OT", otpfCategory: "IADLs", clinicalContext: "Twist-lock safety interlock alignment" },
  { keyword: "electric kettle switch", discipline: "OT", otpfCategory: "IADLs", clinicalContext: "One-touch boiling activation and auto shut-off safety" },
  { keyword: "coffee drip maker carafe", discipline: "OT", otpfCategory: "IADLs", clinicalContext: "Hot liquid pouring from carafe into breakfast mug" },
  { keyword: "coffee filter basket", discipline: "OT", otpfCategory: "IADLs", clinicalContext: "Fine paper filter insertion and coffee ground measuring" },
  { keyword: "ceramic tea mug handle", discipline: "OT", otpfCategory: "ADLs", clinicalContext: "Four-finger loop grip and hot beverage sip control" },
  { keyword: "tea kettle whistle spout", discipline: "OT", otpfCategory: "IADLs", clinicalContext: "Flip cap spout opening prior to boiling pour" },
  { keyword: "kitchen sink gooseneck faucet", discipline: "OT", otpfCategory: "IADLs", clinicalContext: "High arc clearance for washing large soup pots" },
  { keyword: "sink sprayer hose nozzle", discipline: "OT", otpfCategory: "IADLs", clinicalContext: "Extendable pull-out spray trigger for sink rinsing" },
  { keyword: "sink drain strainer basket", discipline: "OT", otpfCategory: "IADLs", clinicalContext: "Center post pinch retrieval and food debris cleaning" },
  { keyword: "dish soap squeeze bottle", discipline: "OT", otpfCategory: "IADLs", clinicalContext: "Inversion squeeze to apply detergent to sponge" },
  { keyword: "foam dish scrub sponge", discipline: "OT", otpfCategory: "IADLs", clinicalContext: "Rhythmic circular scrubbing and bimanual dish washing" },
  { keyword: "bottle brush bristle head", discipline: "OT", otpfCategory: "IADLs", clinicalContext: "Deep cylinder scrub for tumblers and narrow glassware" },
  { keyword: "countertop dish drying rack", discipline: "OT", otpfCategory: "IADLs", clinicalContext: "Plate slotting and delicate glass inverted balancing" },
  { keyword: "microfiber dish drying towel", discipline: "OT", otpfCategory: "IADLs", clinicalContext: "Two-handed cloth wrapping and dish moisture wipe" },
  { keyword: "paper towel countertop stand", discipline: "OT", otpfCategory: "IADLs", clinicalContext: "One-handed tear stabilization against upright post" },
  { keyword: "paper towel roll sheet", discipline: "OT", otpfCategory: "IADLs", clinicalContext: "Perforated sheet tear for spill cleanup" },
  { keyword: "kitchen trash can foot pedal", discipline: "PT", otpfCategory: "IADLs", clinicalContext: "Single limb stance while holding kitchen debris" },
  { keyword: "under sink cabinet hinge", discipline: "PT", otpfCategory: "IADLs", clinicalContext: "Deep squatting to access cleaning supplies safely" },
  { keyword: "spice jar shaker lid", discipline: "OT", otpfCategory: "IADLs", clinicalContext: "Flip top cap opening and controlled spice dusting" },
  { keyword: "salt shaker perforated top", discipline: "OT", otpfCategory: "IADLs", clinicalContext: "Wrist shaking oscillations for food seasoning" },
  { keyword: "pepper grinder twist mechanism", discipline: "OT", otpfCategory: "IADLs", clinicalContext: "Opposing bimanual torque to mill peppercorns" },
  { keyword: "cooking oil bottle pour spout", discipline: "OT", otpfCategory: "IADLs", clinicalContext: "Controlled tilt and rate of liquid oil flow" },
  { keyword: "glass food container lid", discipline: "OT", otpfCategory: "IADLs", clinicalContext: "Four-sided snap locking tabs for airtight food storage" },
  { keyword: "plastic food storage container tab", discipline: "OT", otpfCategory: "IADLs", clinicalContext: "Corner corner peel off to open leftover container" },
  { keyword: "resealable zipper sandwich bag", discipline: "OT", otpfCategory: "IADLs", clinicalContext: "Pinch track glide to seal zip lock air pocket" },
  { keyword: "aluminum foil tear strip edge", discipline: "OT", otpfCategory: "IADLs", clinicalContext: "Pulling foil sheet and downward tear across blade" },
  { keyword: "plastic cling wrap roll", discipline: "OT", otpfCategory: "IADLs", clinicalContext: "Unrolling transparent wrap without static tangle" },
  { keyword: "parchment paper roll box", discipline: "OT", otpfCategory: "IADLs", clinicalContext: "Baking sheet lining preparation and measure cutting" },
  { keyword: "kitchen apron waist strap", discipline: "OT", otpfCategory: "ADLs", clinicalContext: "Back tie fastening for culinary clothing protection" },
  { keyword: "ceramic dinner plate rim", discipline: "OT", otpfCategory: "ADLs", clinicalContext: "Mealtime stabilization and boundary for utensil scooping" },
  { keyword: "shallow soup bowl rim", discipline: "OT", otpfCategory: "ADLs", clinicalContext: "High curved edge aiding soup collection" },
  { keyword: "salad fork tine", discipline: "OT", otpfCategory: "ADLs", clinicalContext: "Utensil spearing of solid vegetable morsels" },
  { keyword: "dinner table knife blade", discipline: "OT", otpfCategory: "ADLs", clinicalContext: "Two-handed fork and knife cutting coordination" },
  { keyword: "soup spoon bowl", discipline: "OT", otpfCategory: "ADLs", clinicalContext: "Fluid balance during hand-to-mouth trajectory" },
  { keyword: "teaspoon bowl", discipline: "OT", otpfCategory: "ADLs", clinicalContext: "Coffee stirring and controlled sugar measurement" },
  { keyword: "butter knife flat edge", discipline: "OT", otpfCategory: "ADLs", clinicalContext: "Bimanual bread spreading with wrist planar movement" },
  { keyword: "adaptive weighted utensil handle", discipline: "OT", otpfCategory: "ADLs", clinicalContext: "Dampens tremors in Parkinson's or ataxia during dining" },
  { keyword: "silicone scoop dish suction base", discipline: "OT", otpfCategory: "ADLs", clinicalContext: "Prevents bowl slippage for single-handed dining" },
  { keyword: "high rim dining plate guard", discipline: "OT", otpfCategory: "ADLs", clinicalContext: "Prevents food push-off for uncoordinated grasp" },
  { keyword: "clear tumbler drinking glass", discipline: "OT", otpfCategory: "ADLs", clinicalContext: "Cylindrical grasp and visual monitoring of liquid volume" },
  { keyword: "two handled adaptive drinking mug", discipline: "OT", otpfCategory: "ADLs", clinicalContext: "Bilateral hand hold for weak or shaky grip" },
  { keyword: "angled nose cut dysphagia cup", discipline: "SLP", otpfCategory: "ADLs", clinicalContext: "Enables drinking without neck hyperextension aspiration risk" },
  { keyword: "one way straw with valve", discipline: "SLP", otpfCategory: "ADLs", clinicalContext: "Keeps fluid primed in straw for weak suction dysarthria" },
  { keyword: "pureed food plate scoop", discipline: "SLP", otpfCategory: "ADLs", clinicalContext: "IDDSI Level 4 pureed bolus consistency landmark" },
  { keyword: "nectar thick liquid glass", discipline: "SLP", otpfCategory: "ADLs", clinicalContext: "IDDSI Level 2 mildly thick fluid for swallow safety" },
  { keyword: "pureed fruit squeeze pouch", discipline: "SLP", otpfCategory: "ADLs", clinicalContext: "Safe swallow texture with controlled oral intake" },
  { keyword: "kitchen step stool top rung", discipline: "PT", otpfCategory: "Health Management", clinicalContext: "Step up ascent and reach into high upper pantry" },
  { keyword: "anti fatigue kitchen floor mat", discipline: "PT", otpfCategory: "Health Management", clinicalContext: "Prolonged standing cushioning and joint comfort" },
  { keyword: "kitchen barstool padded seat", discipline: "PT", otpfCategory: "Rest and Sleep", clinicalContext: "Energy conservation seated workstation for meal prep" },
  { keyword: "recipe cookbook page", discipline: "OT", otpfCategory: "Education", clinicalContext: "Cognitive step-by-step sequencing and comprehension" },
  { keyword: "restaurant ticket holder strip", discipline: "OT", otpfCategory: "Work", clinicalContext: "Vocational culinary ticket sorting and order prep" },
  { keyword: "cookie cutter shape", discipline: "OT", otpfCategory: "Play", clinicalContext: "Bimanual dough pressing and baking recreation" },
  { keyword: "teapot infuser basket", discipline: "OT", otpfCategory: "Leisure", clinicalContext: "Loose leaf tea steeping and relaxation ritual" },
  { keyword: "family dining lazy susan turntable", discipline: "OT", otpfCategory: "Social Participation", clinicalContext: "Rotary shared dining condiment passing with peers" },
];

export const SAM_KITCHEN_ITEMS_ENGINE: SamEngineMetadata = buildEngine(
  "kitchen_items",
  "Kitchen Items",
  "Adolescent to Geriatric (Culinary Rehab)",
  {
    occupationalTherapy: [
      "Culinary Meal Prep & Cutting Dexterity",
      "Bimanual Cooking & Adaptive Kitchen Tools",
      "Utensil Feeding & Tremor Dampening Solutions",
      "Kitchen Energy Conservation Workstations",
    ],
    physicalTherapy: [
      "Dynamic Standing Balance at Kitchen Counter",
      "Low Pantry Squatting & High Shelf Reaching",
      "Anti-Fatigue Postural Stability During Cooking",
    ],
    speechPathology: [
      "IDDSI Level 4 Pureed Meal Textures & Plate Scooping",
      "IDDSI Level 2 Nectar Thick Fluid Hydration",
      "Nose-Cutout Dysphagia Cup Adaptive Drinking",
      "One-Way Valve Straw Swallow Coordination",
    ],
  },
  KITCHEN_ITEMS_ITEMS,
  "environment"
);

export const SAM_ENGINES: Record<SamEngineCategory, SamEngineMetadata> = {
  pedia: SAM_PEDIA_ENGINE,
  adolescent: SAM_ADOLESCENT_ENGINE,
  adult: SAM_ADULT_ENGINE,
  old_people: SAM_OLD_PEOPLE_ENGINE,
  home_objects: SAM_HOME_OBJECTS_ENGINE,
  school_objects: SAM_SCHOOL_OBJECTS_ENGINE,
  kitchen_items: SAM_KITCHEN_ITEMS_ENGINE,
};

/**
 * Resolves a SAM engine by client category or environment string.
 * Falls back to Adult if unrecognized.
 */
export function getSamEngineByCategory(category?: string | null): SamEngineMetadata {
  if (!category) return SAM_ADULT_ENGINE;
  const normalized = category.toLowerCase().trim();
  if (normalized === "pedia" || normalized === "pediatric") return SAM_PEDIA_ENGINE;
  if (normalized === "adolescent" || normalized === "teen") return SAM_ADOLESCENT_ENGINE;
  if (
    normalized === "old_people" ||
    normalized === "elderly" ||
    normalized === "senior" ||
    normalized === "geriatric"
  ) {
    return SAM_OLD_PEOPLE_ENGINE;
  }
  if (
    normalized === "home_objects" ||
    normalized === "home" ||
    normalized === "everyday_home" ||
    normalized.includes("home")
  ) {
    return SAM_HOME_OBJECTS_ENGINE;
  }
  if (
    normalized === "school_objects" ||
    normalized === "school" ||
    normalized === "everyday_school" ||
    normalized.includes("school")
  ) {
    return SAM_SCHOOL_OBJECTS_ENGINE;
  }
  if (
    normalized === "kitchen_items" ||
    normalized === "kitchen" ||
    normalized === "kitchen_objects" ||
    normalized.includes("kitchen")
  ) {
    return SAM_KITCHEN_ITEMS_ENGINE;
  }
  return SAM_ADULT_ENGINE;
}

/**
 * Returns the 100-keyword comma-separated payload for a demographic category.
 */
export function getSamEnginePayload(category?: string | null): string {
  return getSamEngineByCategory(category).payload;
}

/**
 * Validates an arbitrary array of keywords against Meta SAM 3.1 single-concept rules.
 */
export function validateSamKeywords(keywords: string[]): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];
  const seen = new Set<string>();

  for (let i = 0; i < keywords.length; i++) {
    const raw = keywords[i];
    const trimmed = raw.trim().toLowerCase();
    if (!trimmed) {
      errors.push(`Keyword at index ${i} is empty.`);
      continue;
    }
    if (seen.has(trimmed)) {
      errors.push(`Duplicate keyword "${trimmed}" at index ${i}.`);
    }
    seen.add(trimmed);

    if (/,|;|\band\b|\bplus\b/i.test(trimmed)) {
      errors.push(
        `Keyword "${trimmed}" contains compound separator (comma, semicolon, 'and', 'plus').`
      );
    }
    if (/^(segment|find|show|track|detect|which|what|please)\b/i.test(trimmed)) {
      errors.push(`Keyword "${trimmed}" starts with imperative verb.`);
    }
    if (trimmed.split(/\s+/).length > 8) {
      errors.push(`Keyword "${trimmed}" exceeds maximum of 8 words.`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
