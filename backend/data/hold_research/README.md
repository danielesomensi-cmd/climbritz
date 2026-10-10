# Hold research (HC-REVIEW)

`placement_to_hold_number_12x12.csv`: maps every 12x12 Original hand placement
(306 bolt-ons, rows y=16…152) to the **physical Kilter hold number** moulded on
the hold, its pack SKU (`KB0nn` = 10 consecutive numbers) and its mounting
rotation. Parsed from Kilter's official "Handhold Guide" install PDF
(Drive folder linked from settercloset.com/pages/kilter-board-installation-handbooks).
Rule: guide row r ↔ y = 8 + 8r, column index i (A=0) ↔ x = 8·(i+1).
Validated: centre SKUs land in columns D–N, wing SKUs elsewhere, all numbers unique.

There is no trustworthy public per-hold grip-type dataset (the one community CSV
found, Rundstedtzz/climbology, contradicts Kilter's own setting notes).

`app/data/hold_suggestions.json` is the AI **draft** built from the hold drawings
(`/holds/{placement_id}.png`), hold size, and Kilter DB usage stats (hand vs foot
share, difficulty of the climbs using the hold). It is only shown in `/classify`
review mode; nothing is stored until the user confirms or corrects a hold.
