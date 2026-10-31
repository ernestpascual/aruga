# SAM 3.1 Clinical Lifespan Keyword Engines Guide

## 1. Executive Summary & Purpose

Aruga leverages **Meta SAM 3.1** (`sam-3.1`) to execute automated video segmentation and kinematic tracking across clinician-assigned tabletop home exercises. Rather than asking patients or caregivers to manually annotate objects, Aruga provides **domain-optimized clinical engines** that bundle pre-validated noun phrases into structured detection payloads.

This guide documents the **lifespan keyword engines** tailored for the four distinct clinical populations:
1. **Pediatric (`pedia`)**: Ages 1–11
2. **Adolescent (`adolescent`)**: Ages 12–17
3. **Adult (`adult`)**: Ages 18–54
4. **Geriatrics (`geriatric` / `old_people`)**: Ages 55 and Above

Each engine provides **exactly 100 physical noun-phrase keywords** (totaling 400 unique validated targets) engineered to capture visual artifacts, assistive devices, anatomical landmarks, and therapy tools during rehabilitation routines.

---

## 2. Demographic Brackets & Clinical Focus

Aruga segments clinical caseloads across the entire human developmental continuum:

| Demographic | Age Bracket | Primary Clinical Focus | Caregiver Involvement |
| :--- | :--- | :--- | :--- |
| **Pediatric** | **1 – 11 years** | Play-based milestones, fine-motor grasp progression, sensory modulation, oral motor desensitization, and bilateral coordination. | High (Caregiver co-runner assisting exercises and video capture). |
| **Adolescent** | **12 – 17 years** | School workstation ergonomics, handwriting endurance, sports injury reconditioning, executive dysfunction pacing, and fluency. | Moderate (Parent notification with independent routine execution). |
| **Adult** | **18 – 54 years** | Post-stroke hemiparesis recovery, traumatic brain injury (TBI), carpal tunnel syndrome, joint preservation, workplace RSI, and aphasia. | Independent / Peer support. |
| **Geriatrics** | **55+ years** | Fall prevention, joint mobility with osteoarthritis, total joint arthroplasty precautions, Parkinsonian tremor damping, presbyphagia, and ADL independence. | Independent or Family / Home-health caregiver support. |

---

## 3. Clinical Disciplines & Foundational Conditions

Every payload encompasses visual indicators for the core conditions treated across the three allied rehabilitation professions:

### A. Occupational Therapy (OT)
- **Pediatric**: Sensory Processing Disorder (SPD), Autism Spectrum Disorder (ASD), Cerebral Palsy (CP), Developmental Coordination Disorder (Dyspraxia), Down Syndrome, and bilateral coordination delays.
- **Adolescent**: Dysgraphia, executive dysfunction (ADHD), Hypermobility Spectrum Disorder (EDS), post-concussion visual fatigue, and thumb/wrist repetitive strain.
- **Adult**: Cerebrovascular accident (CVA hemiparesis), Traumatic Brain Injury (TBI), carpal tunnel syndrome, rotator cuff tendinopathy, and spinal cord injuries.
- **Geriatrics (55+)**: Basal thumb CMC osteoarthritis, rheumatoid joint deformities, post-stroke spasticity/neglect, Parkinson's disease, and mild cognitive decline.

### B. Physical Therapy (PT)
- **Pediatric**: Congenital muscular torticollis, idiopathic toe walking, clubfoot, spina bifida, muscular dystrophy, and hypotonia.
- **Adolescent**: Adolescent idiopathic scoliosis, ACL reconstruction rehab, Osgood-Schlatter disease, inversion ankle sprains, and patellofemoral tracking syndrome.
- **Adult**: Lumbar radiculopathy/sciatica, rotator cuff repairs, plantar fasciitis, cervical disc herniation, and athletic knee reconditioning.
- **Geriatrics (55+)**: High fall risk, Parkinsonian freezing of gait, total hip arthroplasty (posterior precautions), total knee replacement (TKA), and spinal stenosis.

### C. Speech-Language Pathology (SLP / Speech Therapy)
- **Pediatric**: Pediatric feeding disorder / dysphagia, Childhood Apraxia of Speech (CAS), phonological articulation disorders, and non-verbal AAC communication.
- **Adolescent**: Stuttering / fluency pacing, vocal cord nodules / voice projection strain (sports/choir), cognitive-communication post-concussion, and advanced AAC.
- **Adult**: Post-stroke aphasia (Broca's / Wernicke's), motor speech dysarthria, adult neurogenic dysphagia, and vocal hyperfunction.
- **Geriatrics (55+)**: Presbyphagia (age-related swallowing changes), thickened liquid consistency monitoring, Parkinsonian hypophonia (LSVT Loud voice elevation), and denture-related speech articulation changes.

---

## 4. OTPF-4 Framework Coverage

The **Occupational Therapy Practice Framework: Domain and Process (4th Edition, OTPF-4)** classifies human engagement into 9 broad occupations. All four engines systematically represent every domain with tangible physical artifacts visible on video:

1. **Activities of Daily Living (ADLs)**: Bathing, dressing, feeding, swallowing, grooming, toileting, functional transfers, and personal device care.
2. **Instrumental Activities of Daily Living (IADLs)**: Meal preparation, medication management, home cleaning, shopping, communication devices, and community mobility.
3. **Health Management**: Physical activity, symptom/condition self-management, medication routines, vitals monitoring, and orthotic wear.
4. **Rest and Sleep**: Sleep preparation, positioning pillows, sensory regulation, and nocturnal fall prevention.
5. **Education**: Formal educational tools, classroom fine motor tasks, desk ergonomics, literacy materials, and handwriting guides.
6. **Work**: Vocational tasks, job ergonomics, tools, register scanning, clerical paperwork, and retirement adjustment.
7. **Play**: Sensorimotor play, exploratory toys, constructive blocks, games with rules, and pretend play.
8. **Leisure**: Hobbies, crafts, knitting, musical instruments, reading, gardening, and creative arts.
9. **Social Participation**: Community engagement, peer interaction cards, communication devices, and family mealtimes.

---

## 5. Technical Constraints & SAM 3.1 Prompt Protocol

Meta SAM 3.1 video segmentation accepts short noun phrases to identify and track masks across keyframes:

```
[Video Stream] + [100-Keyword Engine Payload]
        │
        ▼
[assertSamTextConcept Validation] (Single noun phrase, max 8 words, no compound words)
        │
        ▼
[Sam3Engine.segmentConcepts] (Bounded concurrency = 2-4, TTL Cache = 5 min)
        │
        ▼
[Cross-Concept IoU Overlap Suppression (IoU >= 0.90)]
        │
        ▼
[Interactive Labeled SVG Masks & Normalized Bounding Boxes (0-1 Coordinates)]
```

### Strict Validation Rules
1. **Single Noun Phrase**: Each keyword must represent a single physical object or anatomical landmark (e.g. `"peg board"`, `"adaptive spoon"`, `"quad cane"`).
2. **Compound Word Ban**: Prompts containing commas (`,`), semicolons (`;`), or the words `"and"` or `"plus"` are strictly rejected.
3. **Imperative Verb Prohibition**: Prompts must not begin with action verbs such as `segment`, `track`, `find`, `detect`, `show`, `what`, or `please`.
4. **Length Ceiling**: Maximum 8 words per target (average across Aruga engines is 1.8 words).

---

## 6. Itemized Engine Keyword Payloads (100 Keywords Each)

### 6.1 Pediatric Engine (`pedia`) — Ages 1 to 11 (100 Targets)

```
therapy putty, wooden peg, peg board, sippy cup, cheerio, spoon, toddler fork, suction bowl, sensory brush, bubble wand, play dough, foam block, wooden block, stacking ring, shape sorter, jumbo crayon, child scissors, pincer grip, hand, finger, thumb, tongue, lip, chin, mouth, balance stone, therapy ball, peanut ball, sensory tunnel, weighted vest, chew necklace, oral motor chew tube, tongue depressor, finger puppet, flashcard, picture board, aac tablet, zipper, large button, velcro strap, sock, shoe, toddler shirt, toothbrush, washcloth, bath toy, straw cup, food puree, spill mat, high chair tray, stepping bucket, balance beam, foam roller, slant board, pencil grip, lined paper, sticker sheet, puzzle piece, bead, stringing lace, tweezer, squeeze ball, bean bag, target bucket, scooter board, prone wedge, foam wedge, crawling mat, orthotic boot, afo brace, gait belt, posterior walker, tricycle pedal, jump rope, hopscotch mat, musical shaker, tambourine, xylophone mallet, plush animal, pretend kitchen pot, toy food, doll, crayon box, glue stick, water bottle, snack pouch, nap mat, weighted lap pad, sensory bottle, mirror, blowing whistle, straw, pinwheel, feeding spoon, finger toothbrush, backpack, lunchbox, turn taking token, caregiver hand, foot
```

| # | Keyword | Discipline | OTPF-4 Category | Clinical & Kinematic Tracking Rationale |
| :--- | :--- | :--- | :--- | :--- |
| 1 | `therapy putty` | OT | Play | Sensory regulation and intrinsic hand strengthening resistance |
| 2 | `wooden peg` | OT | Play | Pincer grasp and radial digital manipulation |
| 3 | `peg board` | OT | Play | Bilateral integration and visual-motor coordination |
| 4 | `sippy cup` | OT | ADLs | Pediatric feeding and self-drinking transition |
| 5 | `cheerio` | OT | ADLs | Pincer grasp finger feeding milestone |
| 6 | `spoon` | OT | ADLs | Utensil feeding milestone and self-nourishment |
| 7 | `toddler fork` | OT | ADLs | Adaptive feeding and self-care |
| 8 | `suction bowl` | OT | ADLs | Mealtime bowl stabilization for uncoordinated reach |
| 9 | `sensory brush` | OT | Health Management | Wilbarger brushing protocol for sensory defensiveness |
| 10 | `bubble wand` | SLP | Play | Oral motor breath control and lip rounding |
| 11 | `play dough` | OT | Play | Sensorimotor hand strength and tactile modulation |
| 12 | `foam block` | PT | Play | Gross motor stacking and dynamic trunk stability |
| 13 | `wooden block` | OT | Play | Constructive tabletop play and block stacking |
| 14 | `stacking ring` | OT | Play | Eye-hand coordination and size grading |
| 15 | `shape sorter` | OT | Play | Spatial orientation and cognitive grasp rotation |
| 16 | `jumbo crayon` | OT | Education | Palmar supinate grasp to digital pronate transition |
| 17 | `child scissors` | OT | Education | Scissor skills and bimanual paper cutting |
| 18 | `pincer grip` | OT | Play | Index-thumb opposition kinematic landmark |
| 19 | `hand` | Interdisciplinary | ADLs | Anatomical tracking landmark |
| 20 | `finger` | Interdisciplinary | ADLs | Digital isolation and point landmark |
| 21 | `thumb` | Interdisciplinary | ADLs | Thumb opposition and radial stability landmark |
| 22 | `tongue` | SLP | ADLs | Lingual elevation and articulation placement |
| 23 | `lip` | SLP | ADLs | Bilabial seal and straw suction landmark |
| 24 | `chin` | SLP | ADLs | Jaw grading and chin stability landmark |
| 25 | `mouth` | SLP | ADLs | Oral cavity feeding and articulation aperture |
| 26 | `balance stone` | PT | Play | Dynamic balance and motor planning stepping |
| 27 | `therapy ball` | PT | Health Management | Core tone facilitation and vestibular righting |
| 28 | `peanut ball` | PT | Health Management | Bilateral stability and transitional kneeling |
| 29 | `sensory tunnel` | PT | Play | Four-point quadruped crawling and sensory navigation |
| 30 | `weighted vest` | OT | Health Management | Proprioceptive calming and postural grounding |
| 31 | `chew necklace` | OT | Health Management | Oral sensory seeking regulation |
| 32 | `oral motor chew tube` | SLP | Health Management | Jaw rehabilitation and lateral tongue movement |
| 33 | `tongue depressor` | SLP | Health Management | Oral-motor examination and tactile guidance |
| 34 | `finger puppet` | SLP | Social Participation | Joint attention and social imitation |
| 35 | `flashcard` | SLP | Education | Expressive vocabulary and articulation drills |
| 36 | `picture board` | SLP | Social Participation | Low-tech picture exchange communication |
| 37 | `aac tablet` | SLP | Social Participation | High-tech speech-generating augmentative device |
| 38 | `zipper` | OT | ADLs | Jacket dressing and bilateral pull integration |
| 39 | `large button` | OT | ADLs | Fastener manipulation and finger buttoning |
| 40 | `velcro strap` | OT | ADLs | Adaptive footwear fastening independence |
| 41 | `sock` | OT | ADLs | Lower extremity dressing and ankle dorsiflexion |
| 42 | `shoe` | OT | ADLs | Footwear don/doff milestone |
| 43 | `toddler shirt` | OT | ADLs | Overhead upper body dressing |
| 44 | `toothbrush` | OT | ADLs | Oral hygiene and sensory tolerance |
| 45 | `washcloth` | OT | ADLs | Face and body washing ADL |
| 46 | `bath toy` | OT | Play | Bathing engagement and water play grasp |
| 47 | `straw cup` | SLP | ADLs | Oral suction feeding and liquid intake |
| 48 | `food puree` | SLP | ADLs | Dysphagia texture management and spoon swallow |
| 49 | `spill mat` | OT | IADLs | Meal cleanup routines and environmental containment |
| 50 | `high chair tray` | OT | ADLs | Tabletop feeding surface and postural boundary |
| 51 | `stepping bucket` | PT | Play | Single leg stance balance and step coordination |
| 52 | `balance beam` | PT | Play | Tandem heel-to-toe gait progression |
| 53 | `foam roller` | PT | Health Management | Vestibular equilibrium and trunk stability |
| 54 | `slant board` | OT | Education | Wrist extension facilitation during drawing |
| 55 | `pencil grip` | OT | Education | Adaptive ergonomics for tripod finger posture |
| 56 | `lined paper` | OT | Education | Pre-writing strokes and visual-spatial boundaries |
| 57 | `sticker sheet` | OT | Play | Pincer grasp peeling and bilateral paper hold |
| 58 | `puzzle piece` | OT | Play | Form constancy and cognitive shape fitting |
| 59 | `bead` | OT | Play | In-hand manipulation and fingertip translation |
| 60 | `stringing lace` | OT | Play | Bilateral eye-hand stringing task |
| 61 | `tweezer` | OT | Play | Thenar webspace opening and finger strengthening |
| 62 | `squeeze ball` | OT | Health Management | Gross grasp and isometric hand squeeze |
| 63 | `bean bag` | PT | Play | Proprioceptive toss and bilateral catching |
| 64 | `target bucket` | OT | Work | Classroom chore duties and clean-up task participation |
| 65 | `scooter board` | PT | Play | Prone extension and bilateral upper extremity propulsion |
| 66 | `prone wedge` | PT | Health Management | Tummy time elevation and cervical extensor strength |
| 67 | `foam wedge` | PT | Health Management | Therapeutic positioning for hypotonia |
| 68 | `crawling mat` | PT | Play | Floor gross motor mobility surface |
| 69 | `orthotic boot` | PT | Health Management | Talipes equinovarus corrective support |
| 70 | `afo brace` | PT | Health Management | Ankle-foot orthosis for foot drop / toe walking |
| 71 | `gait belt` | PT | Health Management | Pediatric clinician transfer and walking guard |
| 72 | `posterior walker` | PT | Health Management | Reverse posture walker for independent ambulation |
| 73 | `tricycle pedal` | PT | Play | Reciprocal lower extremity motor planning |
| 74 | `jump rope` | PT | Play | Rhythmic motor jumping and coordination |
| 75 | `hopscotch mat` | PT | Play | Single leg hopping balance and dynamic agility |
| 76 | `musical shaker` | OT | Leisure | Rhythmic grasping and auditory feedback |
| 77 | `tambourine` | OT | Leisure | Bilateral arm clapping and musical play |
| 78 | `xylophone mallet` | OT | Leisure | Radial-palmar mallet strike and targeted reach |
| 79 | `plush animal` | OT | Play | Pretend feeding play and comfort regulation |
| 80 | `pretend kitchen pot` | OT | Play | Symbolic pretend cooking and bilateral stirring |
| 81 | `toy food` | SLP | Play | Receptive vocabulary naming and pretend feeding |
| 82 | `doll` | OT | Play | Body part identification and doll dressing |
| 83 | `crayon box` | OT | Education | Bilateral lid opening and color selection |
| 84 | `glue stick` | OT | Education | Twist mechanism and paper crafting |
| 85 | `water bottle` | OT | Health Management | School hydration container opening |
| 86 | `snack pouch` | OT | ADLs | Squeeze feeding and oral motor compression |
| 87 | `nap mat` | OT | Rest and Sleep | Preschool rest time transition |
| 88 | `weighted lap pad` | OT | Rest and Sleep | Deep pressure input during circle time rest |
| 89 | `sensory bottle` | OT | Rest and Sleep | Visual calming and self-regulation |
| 90 | `mirror` | SLP | Health Management | Visual speech biofeedback for phonemic imitation |
| 91 | `blowing whistle` | SLP | Play | Respiratory breath force and oral constriction |
| 92 | `straw` | SLP | ADLs | Oral motor suction straw drinking |
| 93 | `pinwheel` | SLP | Play | Visual feedback for sustained expiration |
| 94 | `feeding spoon` | SLP | ADLs | Oral bolus delivery and lip strip |
| 95 | `finger toothbrush` | OT | ADLs | Oral sensory desensitization |
| 96 | `backpack` | OT | IADLs | School bag carrying and zipper retrieval |
| 97 | `lunchbox` | OT | IADLs | School meal independence and latch opening |
| 98 | `turn taking token` | SLP | Social Participation | Peer conversation and game turn taking |
| 99 | `caregiver hand` | Interdisciplinary | Social Participation | Hand-over-hand co-activity and parental support |
| 100 | `foot` | PT | ADLs | Weight bearing and arch position landmark |

---

### 6.2 Adolescent Engine (`adolescent`) — Ages 12 to 17 (100 Targets)

```
slant board, ergonomic pen, mechanical pencil, writing grip, college ruled notebook, graph paper, binder ring, highlighter, metal ruler, student desk, ergonomic chair, laptop keyboard, computer mouse, mouse wrist rest, tablet stylus, heavy backpack, backpack strap, locker combination lock, water tumbler, sports hydration bottle, elastic resistance band, loop exercise band, foam roller, lacrosse massage ball, tennis ball, hand dynamometer, grip strengthener, finger extensor band, therapy putty, wrist brace, thumb spica splint, kinesiology tape, ice pack, gel heat pack, knee brace, patellar strap, ankle stabilizing brace, balance wobble board, bosu ball, agility ladder, jump rope, dumbbell, kettlebell, yoga mat, posture corrector harness, speech biofeedback mirror, voice pitch tuner, digital metronome, respiratory flow meter, fluency pacing board, acoustic straw, water resistance tube, reading textbook, flashcard deck, desk organizer, planner notebook, stopwatch, digital timer, smartphone screen, noise cancelling headphone, hand, wrist, forearm, elbow, shoulder, cervical spine, thoracic spine, knee joint, patella, ankle joint, achilles tendon, foot, lip, jaw, throat, athletic sneaker, shoelace, hoodie zipper, jacket button, belt buckle, hairbrush, toothbrush, face wash dispenser, reusable food container, kitchen knife, cutting board, eating fork, drinking glass, microwave door handle, video game controller, musical instrument neck, guitar pick, sketchbook, drawing pencil, cervical support pillow, weighted compression blanket, retail barcode scanner, card swipe terminal, board game card, fidget roller
```

| # | Keyword | Discipline | OTPF-4 Category | Clinical & Kinematic Tracking Rationale |
| :--- | :--- | :--- | :--- | :--- |
| 1 | `slant board` | OT | Education | Postural writing ergonomics and cervical spine relief |
| 2 | `ergonomic pen` | OT | Education | Writing fatigue reduction and hypermobility joint support |
| 3 | `mechanical pencil` | OT | Education | Grasp pressure modulation preventing lead snapping |
| 4 | `writing grip` | OT | Education | Dynamic tripod finger posture stabilization |
| 5 | `college ruled notebook` | OT | Education | Handwriting line adherence and letter sizing |
| 6 | `graph paper` | OT | Education | Spatial organization and column math layout |
| 7 | `binder ring` | OT | Education | Bilateral pinch strength for opening 3-ring binders |
| 8 | `highlighter` | OT | Education | Visual tracking and key concept extraction |
| 9 | `metal ruler` | OT | Education | Bilateral hold and straight edge drafting |
| 10 | `student desk` | OT | Education | Classroom workstation 90-90-90 seating ergonomics |
| 11 | `ergonomic chair` | OT | Education | Pelvic alignment and core postural stabilization |
| 12 | `laptop keyboard` | OT | Work | Typing velocity and wrist neutrality |
| 13 | `computer mouse` | OT | Work | Forearm pronation and index finger clicking |
| 14 | `mouse wrist rest` | OT | Work | Median nerve compression prevention |
| 15 | `tablet stylus` | OT | Education | Precision stylus pressure and digital note taking |
| 16 | `heavy backpack` | PT | IADLs | Spinal loading and scoliosis compensation tracking |
| 17 | `backpack strap` | PT | IADLs | Symmetrical bilateral shoulder strap adjustment |
| 18 | `locker combination lock` | OT | Education | In-hand rotary finger manipulation |
| 19 | `water tumbler` | Health Management | Health Management | School hydration and rotary lid opening |
| 20 | `sports hydration bottle` | Health Management | Health Management | Athletic hydration squeeze valve operation |
| 21 | `elastic resistance band` | PT | Health Management | Scapular retractor and rotator cuff strengthening |
| 22 | `loop exercise band` | PT | Health Management | Gluteus medius activation and knee valgus prevention |
| 23 | `foam roller` | PT | Health Management | Thoracic extension and IT-band soft tissue release |
| 24 | `lacrosse massage ball` | PT | Health Management | Trigger point release for rhomboids and suboccipitals |
| 25 | `tennis ball` | PT | Health Management | Plantar fascia mobilization and grip release drills |
| 26 | `hand dynamometer` | OT | Health Management | Objective isometric grip force measurement |
| 27 | `grip strengthener` | OT | Health Management | Forearm flexor conditioning for athletics |
| 28 | `finger extensor band` | OT | Health Management | Antagonist extensor digitorum training for esports |
| 29 | `therapy putty` | OT | Health Management | Intrinsic hand conditioning post-fracture |
| 30 | `wrist brace` | OT | Health Management | Tendonitis stabilization and sports protection |
| 31 | `thumb spica splint` | OT | Health Management | De Quervain's tenosynovitis immobilization |
| 32 | `kinesiology tape` | PT | Health Management | Proprioceptive joint alignment and lymphatic drainage |
| 33 | `ice pack` | PT | Health Management | Post-exercise cryotherapy for acute sports swelling |
| 34 | `gel heat pack` | PT | Health Management | Cervical and trapezius spasm relaxation |
| 35 | `knee brace` | PT | Health Management | ACL graft protection and patellofemoral tracking |
| 36 | `patellar strap` | PT | Health Management | Osgood-Schlatter tendon pressure dissipation |
| 37 | `ankle stabilizing brace` | PT | Health Management | Inversion sprain prevention during court sports |
| 38 | `balance wobble board` | PT | Health Management | Ankle mechanoreceptor proprioception training |
| 39 | `bosu ball` | PT | Health Management | Single-leg dynamic balance and knee stability |
| 40 | `agility ladder` | PT | Play | Rapid footwork and sports agility reconditioning |
| 41 | `jump rope` | PT | Play | Plyometric ankle stiffness and aerobic conditioning |
| 42 | `dumbbell` | PT | Health Management | Progressive upper body kinetic resistance |
| 43 | `kettlebell` | PT | Health Management | Posterior chain hinge and deadlift form tracking |
| 44 | `yoga mat` | PT | Health Management | Floor base for hamstring and core flexibility |
| 45 | `posture corrector harness` | PT | Health Management | Proprioceptive tactile cue against slouching |
| 46 | `speech biofeedback mirror` | SLP | Health Management | Visual speech mirror for articulation and fluency |
| 47 | `voice pitch tuner` | SLP | Health Management | Voice fundamental frequency modulation for vocal cord nodules |
| 48 | `digital metronome` | SLP | Health Management | Rhythmic syllable pacing for stuttering management |
| 49 | `respiratory flow meter` | SLP | Health Management | Breath support capacity for vocal projection |
| 50 | `fluency pacing board` | SLP | Health Management | Multi-finger tapping pacing for speech rate reduction |
| 51 | `acoustic straw` | SLP | Health Management | Semi-occluded vocal tract phonation (SOVTE) |
| 52 | `water resistance tube` | SLP | Health Management | Submerged bubbling tube voice therapy (Lax Vox) |
| 53 | `reading textbook` | SLP | Education | Post-concussion cognitive reading tolerance |
| 54 | `flashcard deck` | SLP | Education | Executive function retrieval and memory drills |
| 55 | `desk organizer` | OT | Education | Visual task compartmentalization for ADHD |
| 56 | `planner notebook` | OT | Education | Executive time management and daily assignment tracking |
| 57 | `stopwatch` | OT | Education | Timed handwriting stamina and motor processing speed |
| 58 | `digital timer` | OT | Education | Interval pacing and study transition cues |
| 59 | `smartphone screen` | OT | IADLs | Digital communication and schedule reminders |
| 60 | `noise cancelling headphone` | OT | Education | Auditory sensory gating during classroom focus |
| 61 | `hand` | Interdisciplinary | ADLs | Anatomical landmark tracking |
| 62 | `wrist` | Interdisciplinary | ADLs | Wrist extension angle tracking |
| 63 | `forearm` | Interdisciplinary | ADLs | Pronation/supination tracking |
| 64 | `elbow` | Interdisciplinary | ADLs | Elbow flexion tracking |
| 65 | `shoulder` | Interdisciplinary | ADLs | Compensatory shoulder hiking detection |
| 66 | `cervical spine` | PT | Health Management | Forward head angle (tech neck) measurement |
| 67 | `thoracic spine` | PT | Health Management | Kyphotic curvature and scoliosis landmark |
| 68 | `knee joint` | PT | Health Management | Tibiofemoral angle and valgus detection |
| 69 | `patella` | PT | Health Management | Patellofemoral tracking during squats |
| 70 | `ankle joint` | PT | Health Management | Dorsiflexion mobility tracking |
| 71 | `achilles tendon` | PT | Health Management | Heel cord tightness evaluation |
| 72 | `foot` | PT | Health Management | Foot strike and arch collapse tracking |
| 73 | `lip` | SLP | Health Management | Speech articulation labial positioning |
| 74 | `jaw` | SLP | Health Management | Temporomandibular motion and jaw excursion |
| 75 | `throat` | SLP | Health Management | Laryngeal elevation during phonation |
| 76 | `athletic sneaker` | OT | ADLs | Shoe don/doff and footwear readiness |
| 77 | `shoelace` | OT | ADLs | Bimanual knot tying and bow manipulation |
| 78 | `hoodie zipper` | OT | ADLs | School sweatshirt zipping and bilateral pull |
| 79 | `jacket button` | OT | ADLs | Fine motor finger buttoning |
| 80 | `belt buckle` | OT | ADLs | Midline waistband fastener coordination |
| 81 | `hairbrush` | OT | ADLs | Grooming hygiene and upper limb reach |
| 82 | `toothbrush` | OT | ADLs | Oral hygiene and rotary wrist motion |
| 83 | `face wash dispenser` | OT | ADLs | Pump depression hygiene routine |
| 84 | `reusable food container` | OT | IADLs | School meal preparation and lid snapping |
| 85 | `kitchen knife` | OT | IADLs | Safe snack slicing and chopping |
| 86 | `cutting board` | OT | IADLs | Food preparation cutting stability base |
| 87 | `eating fork` | OT | ADLs | Independent meal dining utensil use |
| 88 | `drinking glass` | OT | ADLs | Controlled open-cup liquid drinking |
| 89 | `microwave door handle` | OT | IADLs | After-school snack reheating independence |
| 90 | `video game controller` | OT | Play | Recreational thumb-stick bilateral grip |
| 91 | `musical instrument neck` | OT | Leisure | Guitar/violin fretting hand dexterity |
| 92 | `guitar pick` | OT | Leisure | Precision lateral pincer strumming |
| 93 | `sketchbook` | OT | Leisure | Creative drawing and wrist stabilization |
| 94 | `drawing pencil` | OT | Leisure | Graded shading and fine line pressure |
| 95 | `cervical support pillow` | OT | Rest and Sleep | Cervical spine neutrality during sleep |
| 96 | `weighted compression blanket` | OT | Rest and Sleep | Deep proprioceptive touch for sleep onset |
| 97 | `retail barcode scanner` | OT | Work | Part-time job cashiering grip and reach |
| 98 | `card swipe terminal` | OT | Work | Vocational register operation |
| 99 | `board game card` | SLP | Social Participation | Peer game socialization and card holding |
| 100 | `fidget roller` | OT | Health Management | Tactile focus modulation during homework |

---

### 6.3 Adult Engine (`adult`) — Ages 18 to 54 (100 Targets)

```
universal cuff, adaptive spoon, rocker knife, scooped plate, plate guard, two handled mug, nose cutout cup, straw, thickened beverage cup, food bolus, puree bowl, pill organizer, blister pack, pill splitter, blood pressure cuff, pulse oximeter, button hook, zipper puller, sock aid, shoe horn, elastic shoelace, reacher grabber, long handled sponge, faucet turn extender, jar opener, dycem non slip mat, cutting board with spikes, ergonomic chef knife, cooking spatula, pan handle, kettle handle, spray bottle, dustpan handle, key turner, doorknob lever adapter, wallet, bank card, pen, signature guide card, car steering wheel cover, car transfer handle, ergonomic keyboard, vertical mouse, trackball mouse, wrist rest pad, document slant board, task chair lumbar roll, monitor riser, therapist peg board, pinch clothespin, therapy putty, hand exerciser web, grip dynamometer, finger ladder, shoulder pulley, resistance theraband, latex exercise tubing, foam roller, slant board for calf, wobble balance board, gait belt, single point cane, forearm crutch, standard walker, wheelchair hand rim, transfer board, bed rail, wrist cock up splint, resting hand splint, carpal tunnel wrist brace, elbow strap, shoulder immobilizer sling, lumbar support belt, gel ice pack, moist heating pad, aphasia communication board, picture exchange booklet, speech therapy mirror, oral motor tongue blade, emst respiratory trainer, voice amplifier microphone, drinking straw cup, swallowing posture wedge, cervical contour pillow, wedge elevation pillow, gardening trowel with grip, hand pruner, paint brush, woodworking sandpaper block, chess piece, playing card holder, hand, wrist, forearm, shoulder, lip, tongue, neck, knee, foot
```

| # | Keyword | Discipline | OTPF-4 Category | Clinical & Kinematic Tracking Rationale |
| :--- | :--- | :--- | :--- | :--- |
| 1 | `universal cuff` | OT | ADLs | Adaptive utensil holder for stroke hemiparesis and SCI |
| 2 | `adaptive spoon` | OT | ADLs | Swivel/weighted spoon for neurological feeding independence |
| 3 | `rocker knife` | OT | ADLs | One-handed downward rocking mealtime cutting |
| 4 | `scooped plate` | OT | ADLs | High-walled plate for independent food gathering |
| 5 | `plate guard` | OT | ADLs | Clip-on plate barrier preventing food spillage |
| 6 | `two handled mug` | OT | ADLs | Bimanual cup grasp stabilizing tremor or weakness |
| 7 | `nose cutout cup` | SLP | ADLs | Drinking without cervical hyperextension for dysphagia |
| 8 | `straw` | SLP | ADLs | Controlled liquid bolus volume delivery |
| 9 | `thickened beverage cup` | SLP | ADLs | Modified nectar/honey consistency liquid hydration |
| 10 | `food bolus` | SLP | ADLs | Visual tracking of oral bolus containment and swallow |
| 11 | `puree bowl` | SLP | ADLs | Texture-modified dysphagia nutrition |
| 12 | `pill organizer` | OT | Health Management | Weekly medication sorting and cognitive compliance |
| 13 | `blister pack` | OT | Health Management | In-hand thumb push pill extraction |
| 14 | `pill splitter` | OT | Health Management | Tablet cutting leverage assist |
| 15 | `blood pressure cuff` | Health Management | Health Management | Post-stroke autonomic vitals monitoring |
| 16 | `pulse oximeter` | Health Management | Health Management | Oxygen saturation tracking during activity |
| 17 | `button hook` | OT | ADLs | One-handed wire loop buttoning post-stroke |
| 18 | `zipper puller` | OT | ADLs | Extended ring tool for jacket zipping |
| 19 | `sock aid` | OT | ADLs | Donning socks without breaking hip precautions |
| 20 | `shoe horn` | OT | ADLs | Extended shoe insertion tool |
| 21 | `elastic shoelace` | OT | ADLs | Slip-on shoe conversion avoiding bimanual tying |
| 22 | `reacher grabber` | OT | IADLs | Floor object retrieval and energy conservation |
| 23 | `long handled sponge` | OT | ADLs | Bathing lower extremities and back independently |
| 24 | `faucet turn extender` | OT | ADLs | Lever extension for rotary bathroom fixtures |
| 25 | `jar opener` | OT | IADLs | Mechanical grip assist for kitchen jars |
| 26 | `dycem non slip mat` | OT | IADLs | High-friction silicone mat stabilizing mealtime bowls |
| 27 | `cutting board with spikes` | OT | IADLs | One-handed food anchoring for vegetable prep |
| 28 | `ergonomic chef knife` | OT | IADLs | Neutral wrist downward knife handle |
| 29 | `cooking spatula` | OT | IADLs | Tabletop meal prep pan turning |
| 30 | `pan handle` | OT | IADLs | Two-handed cooking vessel transfer |
| 31 | `kettle handle` | OT | IADLs | Controlled boiling water pouring |
| 32 | `spray bottle` | OT | IADLs | Multi-finger trigger squeeze during housekeeping |
| 33 | `dustpan handle` | OT | IADLs | Standing sweeping and home establishment |
| 34 | `key turner` | OT | IADLs | Enlarged lever handle turning house keys |
| 35 | `doorknob lever adapter` | OT | IADLs | Slip-on lever converting round doorknobs |
| 36 | `wallet` | OT | IADLs | Financial cash and credit card retrieval |
| 37 | `bank card` | OT | IADLs | Pinch precision card insertion into payment chip reader |
| 38 | `pen` | OT | Work | Formal signature writing and workplace documentation |
| 39 | `signature guide card` | OT | Work | Cutout template for legal signature alignment |
| 40 | `car steering wheel cover` | OT | IADLs | High-friction grip for driving community mobility |
| 41 | `car transfer handle` | PT | IADLs | Door latch insertion handle assisting car entry |
| 42 | `ergonomic keyboard` | OT | Work | Split keyboard minimizing ulnar deviation |
| 43 | `vertical mouse` | OT | Work | Handshake position preventing pronator fatigue |
| 44 | `trackball mouse` | OT | Work | Stationary mouse eliminating wrist movement |
| 45 | `wrist rest pad` | OT | Work | Keyboard edge padding preventing contact pressure |
| 46 | `document slant board` | OT | Education | Vocational study and in-line reading posture |
| 47 | `task chair lumbar roll` | PT | Work | Desk chair lordosis support preventing low back strain |
| 48 | `monitor riser` | OT | Work | Desktop screen elevation preventing neck strain |
| 49 | `therapist peg board` | OT | Health Management | 9-hole peg test grasp, transport, and release |
| 50 | `pinch clothespin` | OT | Health Management | Graded spring clothespin pinch training |
| 51 | `therapy putty` | OT | Health Management | Finger flexion, webspace spread, and pinch putty |
| 52 | `hand exerciser web` | OT | Health Management | Circular elastic web for hand extensor training |
| 53 | `grip dynamometer` | OT | Health Management | Hydraulic grip force quantification |
| 54 | `finger ladder` | PT | Health Management | Active shoulder flexion climbing exercise |
| 55 | `shoulder pulley` | PT | Health Management | Overhead reciprocal shoulder range of motion |
| 56 | `resistance theraband` | PT | Health Management | Progressive elastic resistance band exercises |
| 57 | `latex exercise tubing` | PT | Health Management | External rotator strengthening for shoulder impingement |
| 58 | `foam roller` | PT | Health Management | Thoracic extension and spinal mobilization |
| 59 | `slant board for calf` | PT | Health Management | Gastrocnemius and Achilles tendon stretch |
| 60 | `wobble balance board` | PT | Health Management | Multi-planar ankle stability training |
| 61 | `gait belt` | PT | Health Management | Caregiver transfer safety belt |
| 62 | `single point cane` | PT | Health Management | Contralateral gait offloading for lower limb rehab |
| 63 | `forearm crutch` | PT | Health Management | Lofstrand crutch for neurological ambulation |
| 64 | `standard walker` | PT | Health Management | Non-weight bearing post-surgical gait frame |
| 65 | `wheelchair hand rim` | PT | Health Management | Manual wheelchair propulsion stroke |
| 66 | `transfer board` | PT | Health Management | Lateral slide board between wheelchair and bed |
| 67 | `bed rail` | PT | Health Management | Pull handle assisting supine-to-sit transitions |
| 68 | `wrist cock up splint` | OT | Health Management | Radial nerve palsy support keeping wrist in extension |
| 69 | `resting hand splint` | OT | Health Management | Anti-spasticity nocturnal hand positioner |
| 70 | `carpal tunnel wrist brace` | OT | Health Management | Neutral wrist brace for carpal tunnel relief |
| 71 | `elbow strap` | PT | Health Management | Lateral epicondylitis counterforce band |
| 72 | `shoulder immobilizer sling` | PT | Health Management | Post-op rotator cuff surgical protection |
| 73 | `lumbar support belt` | PT | Health Management | Abdominal corset providing lifting support |
| 74 | `gel ice pack` | PT | Health Management | Cryotherapy for acute tendon inflammation |
| 75 | `moist heating pad` | PT | Health Management | Deep thermal heating for chronic muscle spasm |
| 76 | `aphasia communication board` | SLP | Social Participation | Picture communication grid for expressive aphasia |
| 77 | `picture exchange booklet` | SLP | Social Participation | Tabbed communication binder for social needs |
| 78 | `speech therapy mirror` | SLP | Health Management | Oral facial visual biofeedback for dysarthria |
| 79 | `oral motor tongue blade` | SLP | Health Management | Lingual resistance and lateralization exercise |
| 80 | `emst respiratory trainer` | SLP | Health Management | Expiratory muscle strength trainer for airway clearance |
| 81 | `voice amplifier microphone` | SLP | Social Participation | Portable mic for Parkinsonian/hypophonic voice |
| 82 | `drinking straw cup` | SLP | ADLs | Fluid intake cup with calibrated sip volume |
| 83 | `swallowing posture wedge` | SLP | ADLs | Ergonomic cushion facilitating chin tuck position |
| 84 | `cervical contour pillow` | PT | Rest and Sleep | Orthopedic neck pillow preserving spinal alignment |
| 85 | `wedge elevation pillow` | PT | Rest and Sleep | Incline leg wedge reducing peripheral edema |
| 86 | `gardening trowel with grip` | OT | Leisure | Ergonomic soft-grip garden shovel |
| 87 | `hand pruner` | OT | Leisure | Spring-loaded clipper reducing hand squeeze force |
| 88 | `paint brush` | OT | Leisure | Wide-handle brush for fine motor stroke control |
| 89 | `woodworking sandpaper block` | OT | Leisure | Bilateral sanding block for upper limb endurance |
| 90 | `chess piece` | OT | Play | Tabletop strategic chess play and three-jaw chuck pinch |
| 91 | `playing card holder` | OT | Leisure | Slotted tabletop rack holding playing cards |
| 92 | `hand` | Interdisciplinary | ADLs | Anatomical tracking landmark |
| 93 | `wrist` | Interdisciplinary | ADLs | Wrist extension-flexion tracking |
| 94 | `forearm` | Interdisciplinary | ADLs | Pronation/supination tracking |
| 95 | `shoulder` | Interdisciplinary | ADLs | Shoulder elevation and reach tracking |
| 96 | `lip` | SLP | ADLs | Oral competence and labial seal tracking |
| 97 | `tongue` | SLP | ADLs | Lingual coordination and bolus control |
| 98 | `neck` | Interdisciplinary | ADLs | Cervical position and swallow posture tracking |
| 99 | `knee` | PT | ADLs | Knee flexion/extension gait angle |
| 100 | `foot` | PT | ADLs | Plantar weight bearing and heel strike tracking |

---

### 6.4 Geriatrics Engine (`geriatric` / `old_people`) — Ages 55 and Above (100 Targets)

```
four wheeled rollator, wheeled walker, walker tennis ball, quad cane, single point cane, gait belt, transfer bench, shower chair, bathroom grab bar, raised toilet seat, toilet safety frame, bed assist rail, transfer slide board, reacher grabber tool, sock aid device, long handled shoehorn, dressing stick, button hook tool, zipper loop, elastic shoelace, velcro strap shoe, non skid slipper, built up handle spoon, weighted fork, scoop dish, plate guard ring, two handled cup with lid, weighted mug, straw with valve, nectar thick liquid cup, thickened water glass, dysphagia cup, pureed meal plate, oral swab, denture cleaning cup, denture brush, long handled bath sponge, long handled hairbrush, faucet knob turner, weekly pill organizer, automated pill dispenser, pill blister pack, magnifying glass with light, large print book, reading spectacles, eyeglass cord, hearing aid case, hearing aid battery, medical alert pendant, emergency call button, telephone with large buttons, jar opener gripper, bottle twist opener, can opener with knob, dycem non slip coaster, non slip kitchen mat, lightweight plastic kettle, reach extender pole, shopping cart with wheels, grocery tote bag, key turner aid, door handle lever, theraband exercise loop, light ankle weight, seated pedal exerciser, soft squeeze ball, hand therapy putty, cmc thumb arthritis brace, resting hand orthosis, neoprene knee support, hip abduction pillow, lumbar roll cushion, orthopedic knee spacer pillow, wedge positioning pillow, bedside commode bucket, voice decibel sound meter, speech biofeedback mirror, respiratory incentive spirometer, lsvt voice prompt card, large print playing card, playing card holder stand, jigsaw puzzle with large pieces, bingo dauber marker, domino tile, crochet hook with ergonomic grip, thick knitting needle, yarn ball, watering can with double handle, gardening kneeling pad, prayer bead strand, photo album, hand, tremor hand, finger, wrist, shoulder, knee, foot, lip, throat
```

| # | Keyword | Discipline | OTPF-4 Category | Clinical & Kinematic Tracking Rationale |
| :--- | :--- | :--- | :--- | :--- |
| 1 | `four wheeled rollator` | PT | Health Management | Community ambulation with fold-down seat and loop brakes |
| 2 | `wheeled walker` | PT | Health Management | Front-wheeled walker for steady indoor ambulation |
| 3 | `walker tennis ball` | PT | Health Management | Gliding feet for smooth walker movement on carpet |
| 4 | `quad cane` | PT | Health Management | Wide-base cane for stroke hemiparesis and ataxia |
| 5 | `single point cane` | PT | Health Management | Unilateral offloading for knee/hip osteoarthritis |
| 6 | `gait belt` | PT | Health Management | Caregiver transfer safety belt preventing fall injury |
| 7 | `transfer bench` | OT | ADLs | Sliding tub bench protecting hip replacement precautions |
| 8 | `shower chair` | OT | ADLs | Seated showering for fatigue and vestibular balance |
| 9 | `bathroom grab bar` | OT | ADLs | Wall-anchored bar preventing wet surface falls |
| 10 | `raised toilet seat` | OT | ADLs | Elevated toilet seat avoiding hip flexion past 90 degrees |
| 11 | `toilet safety frame` | OT | ADLs | Dual armrests for bilateral sit-to-stand push |
| 12 | `bed assist rail` | PT | Health Management | Bedside safety handle preventing nocturnal roll-out |
| 13 | `transfer slide board` | PT | Health Management | Smooth wooden board for bed-to-wheelchair transfers |
| 14 | `reacher grabber tool` | OT | IADLs | Floor object pickup avoiding spinal bending and dizziness |
| 15 | `sock aid device` | OT | ADLs | Curved plastic chute donning socks without bending |
| 16 | `long handled shoehorn` | OT | ADLs | Extended shoehorn for slipping on shoes while seated |
| 17 | `dressing stick` | OT | ADLs | Hooked rod pulling pants, socks, and jackets |
| 18 | `button hook tool` | OT | ADLs | Wire loop pulling buttons through small holes |
| 19 | `zipper loop` | OT | ADLs | Large keyring ring on zipper pullers for arthritic hands |
| 20 | `elastic shoelace` | OT | ADLs | Stretch laces turning standard shoes into slip-ons |
| 21 | `velcro strap shoe` | OT | ADLs | Orthopedic wide shoe with easy hook-and-loop closure |
| 22 | `non skid slipper` | PT | ADLs | Rubber-soled slipper reducing indoor slip and fall risk |
| 23 | `built up handle spoon` | OT | ADLs | Thick cylindrical foam handle for contracted fingers |
| 24 | `weighted fork` | OT | ADLs | Heavy utensil damping Parkinsonian resting tremor |
| 25 | `scoop dish` | OT | ADLs | Curved high-wall dish assisting one-handed eating |
| 26 | `plate guard ring` | OT | ADLs | Removable barrier preventing meal spillover |
| 27 | `two handled cup with lid` | OT | ADLs | Bilateral drinking cup with splash-proof lid |
| 28 | `weighted mug` | OT | ADLs | Calibrated weight mug stabilizing drinking tremor |
| 29 | `straw with valve` | SLP | ADLs | One-way valve keeping fluid loaded at top of straw |
| 30 | `nectar thick liquid cup` | SLP | ADLs | Drinking cup for nectar-thick fluid dysphagia safety |
| 31 | `thickened water glass` | SLP | ADLs | Thickened water intake preventing airway aspiration |
| 32 | `dysphagia cup` | SLP | ADLs | Measured-flow cup dispensing 5ml bolus at a time |
| 33 | `pureed meal plate` | SLP | ADLs | Modified smooth meal for impaired mastication |
| 34 | `oral swab` | SLP | ADLs | Foam sponge swab for xerostomia and oral hygiene |
| 35 | `denture cleaning cup` | OT | ADLs | Soaking bath for dental prosthetics |
| 36 | `denture brush` | OT | ADLs | Dual-bristle brush for denture cleaning |
| 37 | `long handled bath sponge` | OT | ADLs | Curved sponge reaching back, calves, and feet |
| 38 | `long handled hairbrush` | OT | ADLs | Extended brush for restricted shoulder abduction |
| 39 | `faucet knob turner` | OT | ADLs | Leverage tool turning rotary sink knobs smoothly |
| 40 | `weekly pill organizer` | OT | Health Management | 7-day compartment box for polypharmacy adherence |
| 41 | `automated pill dispenser` | OT | Health Management | Motorized rotating carousel with audible medication alarm |
| 42 | `pill blister pack` | OT | Health Management | Foil blister dosage pack for daily medication tracking |
| 43 | `magnifying glass with light` | OT | Education | Optical lighted magnifier for macular degeneration |
| 44 | `large print book` | SLP | Education | High-contrast enlarged font book for cognitive stimulation |
| 45 | `reading spectacles` | OT | Work | Presbyopia corrective eyeglasses for volunteer clerical duties |
| 46 | `eyeglass cord` | OT | ADLs | Neck retainer cord keeping glasses accessible |
| 47 | `hearing aid case` | SLP | Health Management | Protective case with desiccant drying hearing aids |
| 48 | `hearing aid battery` | SLP | Health Management | Miniature zinc-air battery replacement |
| 49 | `medical alert pendant` | Health Management | Health Management | Emergency SOS pendant worn around the neck |
| 50 | `emergency call button` | Health Management | Health Management | Wall-mounted switch in bathroom/bedroom for fall alert |
| 51 | `telephone with large buttons` | SLP | IADLs | Big-button high-contrast telephone with photo speed-dial |
| 52 | `jar opener gripper` | OT | IADLs | Textured rubber cone assisting jar torque |
| 53 | `bottle twist opener` | OT | IADLs | Lever grip removing plastic soda and water bottle caps |
| 54 | `can opener with knob` | OT | IADLs | Extra-large turn-knob manual can opener |
| 55 | `dycem non slip coaster` | OT | IADLs | Non-skid coaster preventing mug tipping |
| 56 | `non slip kitchen mat` | PT | IADLs | Beveled rubber mat reducing standing fatigue and slips |
| 57 | `lightweight plastic kettle` | OT | IADLs | Lightweight kettle preventing scalds during hot tea prep |
| 58 | `reach extender pole` | OT | IADLs | Long hook pole reaching high curtain rods and shelves |
| 59 | `shopping cart with wheels` | PT | IADLs | Rolling market cart offloading heavy grocery carrying |
| 60 | `grocery tote bag` | OT | IADLs | Padded handle tote for light errand carrying |
| 61 | `key turner aid` | OT | IADLs | Plastic handle lever turning deadbolt locks smoothly |
| 62 | `door handle lever` | OT | IADLs | Downward push lever replacing rotary doorknobs |
| 63 | `theraband exercise loop` | PT | Health Management | Seated resistance loop for sarcopenia prevention |
| 64 | `light ankle weight` | PT | Health Management | 1-2 lb cuff weight for seated knee extension exercises |
| 65 | `seated pedal exerciser` | PT | Health Management | Floor cycle for gentle leg reconditioning and circulation |
| 66 | `soft squeeze ball` | OT | Health Management | Low-resistance ball preserving arthritic finger mobility |
| 67 | `hand therapy putty` | OT | Health Management | Extra-soft therapeutic putty for finger flexion/extension |
| 68 | `cmc thumb arthritis brace` | OT | Health Management | Rigid support stabilizing the thumb basal joint |
| 69 | `resting hand orthosis` | OT | Health Management | Padded resting splint preventing nocturnal contractures |
| 70 | `neoprene knee support` | PT | Health Management | Compressive knee sleeve providing joint warmth and stability |
| 71 | `hip abduction pillow` | PT | Health Management | Foam wedge preventing hip dislocation post-arthroplasty |
| 72 | `lumbar roll cushion` | PT | Health Management | Firm cylindrical cushion supporting spinal stenosis posture |
| 73 | `orthopedic knee spacer pillow` | PT | Rest and Sleep | Hourglass foam cushion between knees during side sleep |
| 74 | `wedge positioning pillow` | PT | Rest and Sleep | Incline foam wedge for acid reflux and respiratory comfort |
| 75 | `bedside commode bucket` | OT | Rest and Sleep | Nighttime portable toilet preventing dark bathroom falls |
| 76 | `voice decibel sound meter` | SLP | Health Management | Visual sound pressure meter for Parkinson's voice training |
| 77 | `speech biofeedback mirror` | SLP | Health Management | Mirror for practicing labial closure and facial symmetry |
| 78 | `respiratory incentive spirometer` | PT | Health Management | Inhalation coach preventing post-op atelectasis |
| 79 | `lsvt voice prompt card` | SLP | Social Participation | "Think Loud!" clinical visual prompt card |
| 80 | `large print playing card` | OT | Social Participation | Enlarged font playing cards for bridge/poker with peers |
| 81 | `playing card holder stand` | OT | Leisure | Curved wooden stand holding cards hands-free |
| 82 | `jigsaw puzzle with large pieces` | OT | Leisure | 50-100 piece puzzle with extra-large tactile pieces |
| 83 | `bingo dauber marker` | OT | Play | Recreational bingo play and palmar grip stamping |
| 84 | `domino tile` | OT | Leisure | Large dot dominoes for tabletop fine motor matching |
| 85 | `crochet hook with ergonomic grip` | OT | Leisure | Soft silicone ergonomic handle crochet hook |
| 86 | `thick knitting needle` | OT | Leisure | Large-gauge wooden knitting needles for low vision |
| 87 | `yarn ball` | OT | Leisure | Bimanual yarn winding and craft manipulation |
| 88 | `watering can with double handle` | OT | IADLs | Dual-handle balanced watering can for houseplants |
| 89 | `gardening kneeling pad` | PT | Leisure | Thick foam knee cushion protecting arthritic knees |
| 90 | `prayer bead strand` | OT | Social Participation | Rosary or meditation beads for spiritual engagement |
| 91 | `photo album` | SLP | Social Participation | Grandchildren family photographs for reminiscence therapy |
| 92 | `hand` | Interdisciplinary | ADLs | Anatomical tracking landmark |
| 93 | `tremor hand` | Interdisciplinary | ADLs | Parkinsonian resting/action tremor tracking |
| 94 | `finger` | Interdisciplinary | ADLs | Digital extension and contracture landmark |
| 95 | `wrist` | Interdisciplinary | ADLs | Ulnar/radial deviation tracking |
| 96 | `shoulder` | Interdisciplinary | ADLs | Shoulder elevation and reach limits |
| 97 | `knee` | PT | ADLs | Knee replacement alignment and gait tracking |
| 98 | `foot` | PT | ADLs | Shuffle gait, foot clearance, and balance tracking |
| 99 | `lip` | SLP | ADLs | Labial seal and swallow competence tracking |
| 100 | `throat` | SLP | ADLs | Laryngeal elevation during swallowing |

---

## 7. Programmatic Usage in Aruga

### A. Importing from the Core Library
Therapists and developer modules can access engines directly:

```typescript
import {
  getSamEngineByCategory,
  getSamEnginePayload,
  SAM_ENGINES,
  validateSamKeywords,
} from "@/lib/meta/sam-engines";

// 1. Retrieve the entire metadata object for Geriatrics (55+)
const geriatricEngine = getSamEngineByCategory("geriatric");
console.log(`Loaded ${geriatricEngine.targetCount} keywords for ${geriatricEngine.name}`);

// 2. Obtain the comma-separated payload ready for SAM inference
const pediaPayload = getSamEnginePayload("pedia");

// 3. Validate arbitrary keywords
const result = validateSamKeywords(["weighted fork", "quad cane"]);
console.log("Valid:", result.valid);
```

### B. Calling SAM Multi-Concept Video Segmentation
```typescript
import { sam3Engine } from "@/lib/meta/sam-engine";
import { getSamEngineByCategory } from "@/lib/meta/sam-engines";

async function analyzePatientVideo(videoUrl: string, clientCategory: string) {
  const engine = getSamEngineByCategory(clientCategory);

  const trackingResult = await sam3Engine.segmentConcepts({
    videoUrl,
    concepts: [...engine.keywords], // 100 validated concepts
    durationSeconds: 30,
    fps: 5, // Temporal subsampling: 5 keyframes/sec
    overlapIouThreshold: 0.90, // Suppress cross-concept overlaps
  });

  return {
    tracks: trackingResult.tracks,
    boxes: trackingResult.boxes,
    svgPaths: trackingResult.svgPaths,
    billedRequests: trackingResult.billedRequests,
  };
}
```

### C. 1-Click Interactive Test Bench (`/sam-test`)
The test bench at `/sam-test` provides 1-click loading buttons for all 7 engines:
- **Demographic Engines**:
  - **👶 Pediatric (1–11)**: Loads 100 pediatric keywords (Milestones, Sensory & Play).
  - **🎒 Adolescent (12–17)**: Loads 100 adolescent keywords (School & Sports Agility).
  - **💼 Adult (18–54)**: Loads 100 adult keywords (Vocational & Stroke Rehab).
  - **🧓 Geriatrics (55+)**: Loads 100 geriatric independence keywords (Geriatrics & Fall Prevention).
- **Environmental & Contextual Engines**:
  - **🏠 Everyday Objects at Home**: Loads 100 domestic ADL, IADL, and safety targets.
  - **🏫 Everyday Objects at School**: Loads 100 classroom, playground, and academic targets.
  - **🍳 Kitchen Items**: Loads 100 culinary prep, adaptive eating, and dysphagia hydration targets.
- **Processing Time & Session Reloading**:
  - Automatically measures and records processing latency (`latency_ms` and `processingTimeMs`).
  - Stores all test runs in database `sam_test_results` and in an in-memory session ring buffer.
  - Displays a **Previous Processed Sessions** panel with a **Reload Sessions** button to restore past tracking data, video bounding boxes, and SVG masks.

---

## 7. Environmental & Contextual Testing Engines

### Engine 5: Everyday Objects at Home (100 Targets)
Targets domestic rehabilitation, ADL independence, fall prevention, and home environmental safety across the lifespan:
`front door knob`, `door handle lever`, `light switch plate`, `wall outlet cover`, `window latch`, `window blind cord`, `curtain rod`, `sofa cushion`, `living room armchair`, `coffee table`, `television remote control`, `table lamp switch`, `floor rug edge`, `doormat`, `stair handrail`, `stair step edge`, `hallway nightlight`, `ceiling fan pull chain`, `bookshelf ledge`, `throw pillow`, `fleece blanket`, `bed mattress edge`, `bed sheet corner`, `bed pillow`, `nightstand drawer knob`, `alarm clock button`, `closet hanger`, `closet sliding door track`, `clothing drawer handle`, `bedroom slipper`, `laundry hamper basket`, `ironing board lever`, `clothes iron handle`, `spray bottle trigger`, `vacuum cleaner handle`, `broom handle`, `dustpan rim`, `trash can foot pedal`, `bathroom sink faucet`, `faucet knob`, `soap dispenser pump`, `bar soap dish`, `manual toothbrush`, `electric toothbrush base`, `toothpaste tube cap`, `dental floss container`, `bathroom mirror surface`, `hair comb`, `hairbrush bristle pad`, `hair dryer handle`, `bathroom towel rack`, `bath towel loop`, `washcloth`, `toilet flush lever`, `toilet seat lid`, `toilet paper roll holder`, `shower curtain ring`, `shower head wand`, `shower mixing valve`, `non slip bathtub mat`, `bathroom scale platform`, `medicine cabinet latch`, `first aid kit box`, `thermometer digital screen`, `band aid wrapper`, `house key ring`, `deadbolt latch knob`, `front porch step`, `handrail bracket`, `mailbox door latch`, `envelope flap`, `landline telephone handset`, `smartphone touchscreen`, `tablet computer stand`, `charging cable plug`, `wall clock face`, `thermostat dial`, `air conditioner remote`, `umbrella handle`, `coat rack hook`, `shoe rack shelf`, `shoehorn blade`, `wallet zipper`, `coin purse clasp`, `reading glasses frame`, `eyeglass cleaning cloth`, `magnifying glass lens`, `paper notebook spine`, `ballpoint pen clicker`, `desk study lamp`, `home office desk chair`, `board game token`, `jigsaw puzzle box`, `knitting basket`, `stereo volume knob`, `wastebasket rim`, `pet food bowl`, `hand`, `finger`, `foot`.

### Engine 6: Everyday Objects at School (100 Targets)
Targets school-based therapy, fine motor tool handling, classroom posture, recess agility, and AAC participation:
`student backpack strap`, `backpack zipper pull`, `lunchbox zipper`, `thermos flask lid`, `pencil case zipper`, `wooden number two pencil`, `pencil grip sleeve`, `pencil eraser tip`, `manual pencil sharpener receptacle`, `electric pencil sharpener slot`, `student safety scissors`, `glue stick twist base`, `liquid glue squeeze bottle`, `wax crayon`, `crayon box flap`, `felt tip marker cap`, `dry erase marker barrel`, `whiteboard eraser felt`, `classroom whiteboard tray`, `chalkboard eraser`, `dustless chalk stick`, `classroom desk chair`, `student desk surface`, `desk book compartment`, `loose leaf lined paper`, `construction paper sheet`, `spiral notebook wire`, `composition notebook cover`, `three ring binder ring`, `two pocket folder`, `plastic ruler edge`, `wooden yardstick`, `desktop stapler lever`, `staple remover jaw`, `paper clip bend`, `binder clip lever`, `two hole paper punch`, `clear tape dispenser wheel`, `masking tape roll`, `highlighter felt chisel`, `math counting block`, `base ten plastic rod`, `plastic pattern block`, `abacus sliding bead`, `flashcard deck`, `aac communication tablet`, `communication board binder`, `core vocabulary word chart`, `visual picture schedule strip`, `laminated token board`, `reward star sticker sheet`, `student locker latch`, `combination padlock dial`, `hall pass lanyard`, `student id card badge`, `water fountain push bar`, `classroom door push bar`, `auditorium seat folding hinge`, `school bus handrail`, `school bus step tread`, `cafeteria tray divider`, `disposable cafeteria spork`, `milk carton spout flap`, `juice box straw wrapper`, `applesauce squeeze pouch cap`, `granola bar tear wrapper`, `reusable sandwich container latch`, `cafeteria bench seat`, `library book spine label`, `book bookmark ribbon`, `computer keyboard spacebar`, `computer mouse scroll wheel`, `student headphones headband`, `speech microphone boom`, `sensory wobble stool`, `inflatable balance disc cushion`, `weighted lap pad seam`, `fidget spinner bearing`, `sensory squeeze stress ball`, `chewable necklace pendant`, `noise cancelling ear muff`, `gymnasium basketball rim`, `gym floor line stripe`, `rubber dodgeball`, `plastic jump rope handle`, `sports agility cone`, `balance beam edge`, `tumbling floor mat seam`, `playground swing chain`, `playground slide handrail`, `monkey bar rung`, `playground merry go round handle`, `recess kickball`, `recess sidewalk chalk`, `instrument music stand desk`, `orchestra violin bow`, `art easel frame`, `classroom chore clipboard`, `recycling bin rim`, `quiet corner beanbag chair`.

### Engine 7: Kitchen Items (100 Targets)
Targets culinary meal preparation, adaptive feeding utensils, bimanual coordination, and dysphagia hydration:
`chef knife handle`, `serrated bread knife`, `paring knife grip`, `wooden cutting board`, `flexible cutting mat`, `kitchen shears handle`, `vegetable peeler swivel blade`, `box grater handle`, `garlic press lever`, `rolling pin handle`, `silicone spatula blade`, `slotted cooking spoon`, `wooden stirring spoon`, `soup ladle bowl`, `stainless steel tongs handle`, `balloon wire whisk`, `potato masher grid`, `meat tenderizer mallet face`, `frying pan handle`, `saucepan helper handle`, `stockpot side loop handle`, `pot lid knob`, `silicone oven mitt`, `fabric potholder loop`, `baking sheet rim`, `muffin baking tin`, `casserole dish glass handle`, `colander drainage hole`, `fine mesh wire strainer`, `stainless steel mixing bowl`, `glass measuring cup spout`, `plastic measuring spoon ring`, `digital kitchen food scale`, `kitchen timer turn dial`, `manual can opener turn key`, `jar lid gripper pad`, `bottle twist opener tool`, `corkscrew lever arm`, `refrigerator door handle`, `freezer drawer pull`, `refrigerator crisper drawer`, `microwave door push button`, `microwave turntable glass plate`, `electric toaster push lever`, `countertop blender pitcher`, `blender lid center cap`, `electric food processor bowl`, `electric kettle switch`, `coffee drip maker carafe`, `coffee filter basket`, `ceramic tea mug handle`, `tea kettle whistle spout`, `kitchen sink gooseneck faucet`, `sink sprayer hose nozzle`, `sink drain strainer basket`, `dish soap squeeze bottle`, `foam dish scrub sponge`, `bottle brush bristle head`, `countertop dish drying rack`, `microfiber dish drying towel`, `paper towel countertop stand`, `paper towel roll sheet`, `kitchen trash can foot pedal`, `under sink cabinet hinge`, `spice jar shaker lid`, `salt shaker perforated top`, `pepper grinder twist mechanism`, `cooking oil bottle pour spout`, `glass food container lid`, `plastic food storage container tab`, `resealable zipper sandwich bag`, `aluminum foil tear strip edge`, `plastic cling wrap roll`, `parchment paper roll box`, `kitchen apron waist strap`, `ceramic dinner plate rim`, `shallow soup bowl rim`, `salad fork tine`, `dinner table knife blade`, `soup spoon bowl`, `teaspoon bowl`, `butter knife flat edge`, `adaptive weighted utensil handle`, `silicone scoop dish suction base`, `high rim dining plate guard`, `clear tumbler drinking glass`, `two handled adaptive drinking mug`, `angled nose cut dysphagia cup`, `one way straw with valve`, `pureed food plate scoop`, `nectar thick liquid glass`, `pureed fruit squeeze pouch`, `kitchen step stool top rung`, `anti fatigue kitchen floor mat`, `kitchen barstool padded seat`, `recipe cookbook page`, `restaurant ticket holder strip`, `cookie cutter shape`, `teapot infuser basket`, `family dining lazy susan turntable`.

