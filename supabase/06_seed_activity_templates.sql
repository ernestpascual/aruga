-- ============================================================================
-- ARUGA SUPABASE SCRIPT 06: SEED 20 ACTIVITY TEMPLATES (5 per age band)
-- Run AFTER 05_activity_worksheets.sql
-- Safe for repeated runs via ON CONFLICT + unique index on (owner_scope,title)
-- ============================================================================

CREATE UNIQUE INDEX IF NOT EXISTS uq_activity_template_system_title
  ON public.activity_templates(owner_scope, title) WHERE owner_scope = 'system';

-- Helper: delete then reinsert to keep seeds idempotent without ON CONFLICT gymnastics
DELETE FROM public.activity_templates WHERE owner_scope = 'system';

-- ----------------------------------------------------------------------------
-- PEDIA (2-12) — bold outlines, large zones, playful
-- ----------------------------------------------------------------------------
INSERT INTO public.activity_templates (owner_scope, title, description, age_band, category, spark_prompt, image_prompt, default_params, is_featured) VALUES
('system','Farm Friends Coloring','6 large farm animals with thick outlines to color — develops grasp + visual discrimination','pedia','coloring',
 'Generate a coloring worksheet for pedia (2-6 years): 6 large farm animals (cow, pig, chicken, horse, sheep, tractor) arranged in a 2x3 grid. Each animal should be simple, bold outline, large open areas perfect for crayon coloring. Include the animal name in large friendly lowercase letters beneath each image. Keep total visual clutter minimal, high contrast.',
 'Black and white line art coloring page, 6 farm animals (cow, pig, chicken, horse, sheep, tractor) in thick 4pt bold outlines, large open interiors for coloring, A4 portrait, no shading, no background clutter, simple child-friendly farm animal designs, each animal centered in its own cell, clean white background, vector-style line art',
 '{"difficulty":"easy","theme":"farm","orientation":"portrait","estimatedMinutes":15}'::jsonb, true),

('system','HWT Capitals A–H — Double Lines','Uppercase A–H on Handwriting Without Tears double-lines for pre-writing practice','pedia','handwriting',
 'Generate a handwriting worksheet for pedia ages 4-7: Uppercase letters A through H. Use Handwriting Without Tears style double-line paper (two solid horizontal lines with wide space between — top and baseline, no middle dashed line). Each letter shown leftmost as a perfect model, followed by 4 faded trace guides and 3 blank double-line slots to write independently. Wide letter spacing. Include a small icon hint for letter sound (A=Apple, B=Ball). Pedia-friendly warm encouragement: "Great job, keep those letters big and tall!"',
 'Handwriting worksheet template, uppercase letters A-H, double-line ruled paper with two solid horizontal lines per row, wide letter spacing, left side perfect model letter, middle faded trace letters, right side blank lines, A4 portrait, clean educational worksheet style, minimal decoration, apple and ball small icons for A and B',
 '{"difficulty":"guided","theme":"alphabet","lineStyle":"double-line","orientation":"portrait","estimatedMinutes":20}'::jsonb, true),

('system','Under the Sea Dot-to-Dot','Numbered 1-20 sea scene to connect, reveal and color — number sequencing + fine motor','pedia','tracing',
 'Generate a dot-to-dot worksheet for pedia ages 5-10: Underwater scene with numbers 1-20 that when connected reveals a friendly sea creature (turtle with fish and starfish). Dots should be large (8pt), numbers in 14pt bold to the side. After completion, the outline becomes a coloring page. Include "Connect the dots from 1 to 20, then color your sea friends!" instruction at top in child-friendly font.',
 'Dot-to-dot line art worksheet, numbers 1-20 connected forming sea turtle with fish and starfish, large dots and numbers, simple underwater theme, black line art on white, thick outlines, child-friendly sea creature, A4 portrait, clean educational design',
 '{"difficulty":"independent","theme":"ocean","orientation":"portrait","estimatedMinutes":15}'::jsonb, true),

('system','Shape Sort & Trace','Match and trace shapes to real-world objects — shape recognition + pincer grasp','pedia','visual_motor',
 'Generate a shape worksheet for pedia ages 3-6: Four shapes (circle, square, triangle, star) in two columns. Left column: each shape as bold dashed trace lines (large, for pencil control). Right column: real-world objects to circle-match — apple→circle, window→square, pizza slice→triangle, starfish→star. Include matching lines (dotted) to draw between column items. Large touch targets, high contrast.',
 'Educational shape worksheet, four shapes circle square triangle star as dashed trace lines left column, real-world objects apple window pizza starfish right column, thick dashed outlines, matching line connectors, preschool worksheet style, A4 portrait, clean white background, bold black lines',
 '{"difficulty":"guided","theme":"shapes","orientation":"portrait","estimatedMinutes":12}'::jsonb, false),

('system','My Family Portrait Frame','Decorative border to draw family inside — creativity + pencil control','pedia','coloring',
 'Generate a family portrait drawing worksheet for pedia ages 3-8: Large ornate but simple frame border (like a picture frame with small heart and star decorations) with empty interior space. Inside: 3-4 lightly printed oval face guides (2 large adults + 1-2 small children ovals) with gentle prompts: "Draw your family here!" At bottom: space to write names with dotted line guides. Encourage creativity and emotional expression.',
 'Drawing frame worksheet border, ornate picture frame border with hearts and stars decoration, three empty face ovals inside for family portrait, name writing lines at bottom with dotted guides, A4 portrait, line art, clean child-friendly design, simple line art',
 '{"difficulty":"independent","theme":"family","orientation":"portrait","estimatedMinutes":20}'::jsonb, false);

-- ADOLESCENT (13-17)
INSERT INTO public.activity_templates (owner_scope, title, description, age_band, category, spark_prompt, image_prompt, default_params, is_featured) VALUES
('system','Graffiti Alphabet — Bubble Letters','Hollow bubble letters A–Z to color and style — identity + letter formation','adolescent','handwriting',
 'Generate a graffiti handwriting worksheet for adolescents 13-17: Bubble-letter alphabet A-Z in 2 rows per page, each letter hollow with thick outlines ready to be colored or filled with patterns. Modern street-art influenced but school-appropriate. Include tips: "Add your own highlights, shadows and patterns!" Encourage personalization and creative letter construction.',
 'Graffiti bubble letter alphabet A-Z, hollow thick outline bubble letters, street-art style alphabet worksheet, 2 rows per page, bold outline letters, urban art inspired, black and white line art, A4 portrait, modern teen design',
 '{"difficulty":"independent","theme":"graffiti","lineStyle":"none","orientation":"portrait","estimatedMinutes":25}'::jsonb, true),

('system','Study Planner — Weekly Grid','Fillable weekly timetable for executive function and time management','adolescent','cognitive',
 'Generate a study planner worksheet for adolescents 13-17: Weekly timetable grid (Monday-Sunday columns × Hourly time blocks 7am-9pm rows). Clean modern grid with header row shaded, icons for School/Homework/Free Time/Sleep categories. Includes instruction: "Fill in your real week. Color-code: school=blue, homework=orange, free time=green." Supports executive function and time management.',
 'Weekly planner timetable grid worksheet, Monday to Sunday columns, hourly rows 7am-9pm, clean modern grid design, header row shaded, school schedule icons, A4 portrait, minimal clean design, teen-friendly layout',
 '{"difficulty":"guided","theme":"planning","orientation":"portrait","estimatedMinutes":15}'::jsonb, true),

('system','Anatomy Color-by-Number: Hand','Numbered hand/bones diagram with legend — fine motor + anatomy learning','adolescent','visual_motor',
 'Generate a color-by-number anatomy worksheet for adolescents: Anatomically simplified hand and wrist bones outline divided into numbered sections (1-6) with a color legend. Educational but not gory — shows bones within hand shape. Instruction: "Color by number to reveal the 27 bones in your hand!" Supports learning and precise coloring control.',
 'Anatomy color-by-number worksheet, simplified hand and wrist bones outline divided into numbered sections, educational hand diagram, numbered zones, color legend box, teen-appropriate line art, A4 portrait, clean educational style',
 '{"difficulty":"guided","theme":"anatomy","orientation":"portrait","estimatedMinutes":20}'::jsonb, false),

('system','Maze Quest: Campus Map','School campus maze from Home to Classroom — visual scanning + problem solving','adolescent','visual_motor',
 'Generate a maze worksheet for adolescents 13-17: School/campus themed maze — start at "Home" icon, end at "Classroom" icon, with multiple dead ends and winding paths. Medium complexity (not too easy). Walls as 3pt bold lines, start/end clearly labeled with small icons. Includes "Find your way to class!" title. A4 portrait, single maze per page.',
 'Maze puzzle worksheet, school campus maze from Home to Classroom, medium complexity maze with 3pt walls, start and end icons, A4 portrait, black lines on white, clean puzzle design, teen-friendly',
 '{"difficulty":"independent","theme":"school","orientation":"portrait","estimatedMinutes":10}'::jsonb, false),

('system','Emotion Faces — Draw & Label','Draw expressions and coping actions for 6 emotions — socioemotional + fine motor','adolescent','cognitive',
 'Generate an emotions worksheet for adolescents 13-17: 6 blank face ovals (2 rows of 3) each labeled with an emotion (Frustrated, Calm, Anxious, Confident, Bored, Excited) and a word bank. Under each face: "Draw the expression" + "My coping action: ___" dotted line. Encourages emotional awareness. Teen-appropriate, not childish.',
 'Emotion faces worksheet, 6 blank face ovals in 2 rows of 3, emotion labels Frustrated Calm Anxious Confident Bored Excited, word bank box, coping action writing lines, teen-appropriate design, A4 portrait, clean line art',
 '{"difficulty":"guided","theme":"emotions","orientation":"portrait","estimatedMinutes":15}'::jsonb, false);

-- ADULT (18-64)
INSERT INTO public.activity_templates (owner_scope, title, description, age_band, category, spark_prompt, image_prompt, default_params, is_featured) VALUES
('system','Cursive Connect — Signature Practice','Signature line practice on ruled guides for return-to-work writing','adult','handwriting',
 'Generate a cursive handwriting worksheet for adults: Full name/signature practice on triple-line (Seyes-style) ruled guides. 6 numbered rows each with a faded cursive exemplar "Signature" at left, middle dotted trace, right blank practice area. Extra wide spacing, adult-professional tone. Instruction: "Practice your signature — steady pace, light grip." Supports fine motor and RTW goals.',
 'Cursive signature practice worksheet, triple-line ruled paper with three horizontal lines per row, cursive exemplar signature, faded trace letters, blank practice lines, 6 rows, adult professional handwriting worksheet, A4 portrait, clean formal design',
 '{"difficulty":"guided","theme":"signature","lineStyle":"triple-line","orientation":"portrait","estimatedMinutes":15}'::jsonb, true),

('system','Kitchen Measures — Matching','Measurement conversions and recipe tracing — ADL + cognitive','adult','adl_sim',
 'Generate an ADL worksheet for adults: Kitchen measurement conversions — match columns: cups↔mL, tablespoons, teaspoons with utensil icons (measuring cup, spoon, etc). Two columns with dotted matching lines to draw. Bottom: simple 3-step recipe to trace (e.g. "Add 250mL water"). Real-world kitchen context for OT intervention.',
 'Kitchen measurement worksheet, matching columns cups to mL tablespoons teaspoons, measuring cup and spoon icons, dotted matching lines, 3-step recipe tracing section at bottom, adult kitchen ADL theme, A4 portrait, clean practical design',
 '{"difficulty":"independent","theme":"kitchen","orientation":"portrait","estimatedMinutes":12}'::jsonb, true),

('system','Keyboard Finger Map — Trace','QWERTY finger paths for common words — fine motor + work readiness','adult','fine_motor',
 'Generate a keyboard finger map worksheet for adults: QWERTY keyboard outline with highlighted finger paths for common words (hello, work, email, please). Shows finger trail arrows across keys. Task: trace the word paths with highlighter, then type them. Supports keyboard dexterity and ergonomic awareness. A4 landscape orientation for keyboard width.',
 'Keyboard finger map worksheet, QWERTY keyboard diagram with highlighted key trails and arrows for words hello work email please, typing finger path visualization, A4 landscape, clean tech diagram style',
 '{"difficulty":"guided","theme":"keyboard","orientation":"landscape","estimatedMinutes":10}'::jsonb, false),

('system','Geometric Patterns — Precision Tracing','Intricate tiling to trace for precision grip and control','adult','visual_motor',
 'Generate a precision tracing worksheet for adults: Intricate but regular geometric tiling pattern (hexagonal/isometric grid) with medium density — trace inner lines for pinch/precision practice. Pattern fills A4 page. Instruction: "Trace the inner lines slowly. Focus on smooth, continuous strokes." Develops precision grip and sustained attention.',
 'Geometric precision tracing pattern, hexagonal isometric tiling pattern, intricate but regular geometric lines, medium density line art, precision tracing worksheet, A4 portrait, thin precise lines, adult pattern design',
 '{"difficulty":"independent","theme":"geometry","orientation":"portrait","estimatedMinutes":20}'::jsonb, false),

('system','Paycheck Budget Grid','Monthly income-expense table to fill — cognitive + ADL budgeting','adult','cognitive',
 'Generate a budgeting worksheet for adults: Monthly income-expense grid with categories (Rent, Groceries, Transport, Utilities, Savings, Fun) and IN/OUT columns + Total rows. Large cells, clear header icons (house, cart, bus). Instruction: "Fill with your estimated monthly amounts. Does it balance?" Supports financial ADL and cognitive organization.',
 'Budget worksheet table, monthly income-expense grid with Rent Groceries Transport Utilities Savings Fun rows, IN OUT columns, large cells, header icons house cart bus, financial table, A4 portrait, clean adult finance design',
 '{"difficulty":"guided","theme":"budget","orientation":"portrait","estimatedMinutes":15}'::jsonb, false);

-- GERIATRIC (65+)
INSERT INTO public.activity_templates (owner_scope, title, description, age_band, category, spark_prompt, image_prompt, default_params, is_featured) VALUES
('system','Large-Print Greetings — Trace & Write','Seasonal greetings in large trace + write — high contrast, low fatigue','geriatric','handwriting',
 'Generate a large-print handwriting worksheet for geriatrics 65+: Seasonal greetings ("Happy Birthday", "Thank You", "Thinking of You") in extra-large 36pt faded trace letters, each on generously spaced triple-line guides with wide interline space. 3 repetitions per greeting: trace (faded), trace (dotted), write independently. Instructions in 14pt bold. High contrast Black on warm off-white background note, generous whitespace, low visual clutter.',
 'Large-print greeting handwriting worksheet, Happy Birthday Thank You Thinking of You in 36pt large faded trace letters, generously spaced triple-line guides, wide line spacing, 3 repetitions per greeting, high contrast black text, A4 portrait, senior-friendly large print, warm off-white, ample whitespace',
 '{"difficulty":"guided","theme":"greetings","lineStyle":"triple-line","orientation":"portrait","estimatedMinutes":15}'::jsonb, true),

('system','Garden Flowers Coloring — Low Detail','Simple large flowers with wide gaps — calming, low visual demand','geriatric','coloring',
 'Generate a flower coloring page for geriatrics 65+: 3 large flowers (rose, sunflower, daisy) with very simple outlines, low detail, very low clutter, wide gaps between petal elements (at least 15mm open spaces). 2pt bold outlines, no intricate fill patterns, high contrast. Calming, nostalgic garden theme. Instruction in 14pt: "Color your garden at your own pace." A4 portrait.',
 'Garden flowers coloring page, 3 large simple flowers rose sunflower daisy, very low detail, wide open spaces between petals, 2pt bold outlines, low clutter, calming garden theme, high contrast, A4 portrait, senior-friendly simple coloring',
 '{"difficulty":"independent","theme":"garden","orientation":"portrait","estimatedMinutes":20}'::jsonb, true),

('system','Number Connect 1–40 — Cognitive','Large-number dot-to-dot revealing familiar object — number sequencing','geriatric','cognitive',
 'Generate a dot-to-dot worksheet for geriatrics 65+: Large-number dot-to-dot (1-40) revealing a familiar everyday object (teapot, house with garden, friendly cat). Numbers in extra-large 18pt bold with strong contrast, dots large (10pt). Simple reveal object, low cognitive load but meaningful. Instruction in 14pt: "Connect the numbers from 1 to 40 to reveal the picture."',
 'Dot-to-dot worksheet numbers 1-40 revealing teapot house cat, extra-large 18pt bold numbers, large dots, familiar everyday object reveal, simple low clutter, high contrast senior-friendly, A4 portrait, clean large print',
 '{"difficulty":"guided","theme":"numbers","orientation":"portrait","estimatedMinutes":15}'::jsonb, false),

('system','Medication Schedule — Fill & Check','7-day pill tracker with large checkboxes — medication ADL','geriatric','adl_sim',
 'Generate a medication tracker worksheet for geriatrics 65+: 7-day pill tracker grid (columns: Morning/Noon/Evening/Bedtime) × 7 days (Mon-Sun). Each cell large with big checkbox (8mm). Pill icons header. Include "My Medicines:" name entry lines at top. High contrast black on white, A4 landscape for grid width. Critical ADL tool. Instructions in 14pt: "Fill in your medicines and check each box after taking."',
 'Medication schedule tracker worksheet, 7-day pill tracker grid Morning Noon Evening Bedtime columns, Monday to Sunday rows, large checkboxes 8mm, pill icons header, medicine name entry lines, high contrast, A4 landscape, senior-friendly ADL chart',
 '{"difficulty":"guided","theme":"medication","orientation":"landscape","estimatedMinutes":10}'::jsonb, true),

('system','Reminisce Frame — Draw Your Home','Memory drawing prompt with cue icons — reminiscence + creativity','geriatric','cognitive',
 'Generate a reminiscence drawing worksheet for geriatrics 65+: Prompted memory drawing "Draw your childhood kitchen" with a decorative but simple frame border. Inside: large empty drawing space with small faint cue thumbnails around edges (stove, table, window, kettle). Below: gentle writing prompt lines: "My kitchen had ___" "The smell I remember ___". Supports cognitive engagement and life story work. High contrast, warm tone.',
 'Reminiscence drawing worksheet, decorative simple frame border, empty interior for drawing childhood kitchen, small cue thumbnails stove table window kettle around edges, writing prompt lines My kitchen had, senior nostalgia theme, A4 portrait, warm inviting design',
 '{"difficulty":"independent","theme":"memory","orientation":"portrait","estimatedMinutes":25}'::jsonb, false);
