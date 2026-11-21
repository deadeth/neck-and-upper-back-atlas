# Muscle Atlas

An interactive 3D atlas of the body's muscles, with two ways in.

**Pain and stretch** works region by region. Click a muscle to see how it tends to hurt, a quick self-check, and two or three exercises. Or start from the pain: pick where it hurts or what sets it off, and the likely muscles light up in ranked order.

**Strength** splits training into Pull, Push and Legs days. Each day shows the muscles it trains and its lifts.

Every exercise and lift plays on a full skeleton, with the worked muscles highlighted and moving with the bones.

**Live site:** https://deadeth.github.io/neck-and-upper-back-atlas/

## What's in it

- A real-anatomy skeleton with 65 muscles in six regions, left and right, from the jaw to the feet. The face's expression muscles are drawn in over the skull.
- A pain finder for every region: pick where it hurts or what sets it off (69 patterns in all), and the likely muscles light up in ranked order. Every muscle has notes on how it tends to hurt, what sets it off and a quick check, and every region lists its warning signs.
- Head, face and jaw, neck and upper back, and lower back and core also have 36 animated stretches and control exercises, including jaw exercises on a jaw that opens and slides as a real one does. Stretches for shoulders, hips and legs are still to come; until then those muscles list the lifts that train them.
- Three strength days with 16 lifts, 13 of them new animations.
- Search across muscles, exercises, lifts, pain patterns, regions and days, with everyday names and gym slang ("traps", "six pack", "rdl", "sciatica").
- A Real time switch on the exercise player turns it into a guided session: it waits for Start, holds last as long as the instruction says, reps and sets are counted from the written dose, and rests are timed between sets, sides and long holds.
- Hovering a "Where it hurts" button (or holding a finger on it) makes that area of the body glow on the model.

This is a guide to muscular sources of pain. It isn't medical advice and it can't examine you. Joints, discs and nerves cause pain too, and each finished region lists the symptoms that mean seeing a GP or physio first, or calling 999.

## How it's built

The site is static and lives in `docs/`. There's no build step for the page.

| File | Job |
|---|---|
| `docs/index.html` | Markup and styles |
| `docs/app.js` | Modes, regions, panel views, navigation, lazy loading |
| `docs/anatomy.js` | The clickable atlas scene |
| `docs/figure.js` | The exercise skeleton: joints, arm and leg IK, skinned muscles, props |
| `docs/moves.js`, `moves-head.js`, `moves-core.js`, `moves-strength.js` | Keyframes for each exercise and lift |
| `docs/content.js`, `content-body.js` | Regions, muscle notes, pain patterns, exercise instructions, strength days |
| `docs/areas.js` | Turns a pain pattern's body area into glow spots |
| `docs/search.js` | Search matching and ranking (pure functions) |
| `docs/timing.js` | Real-time hold and tempo for each animation |
| `docs/model.js` | Unpacks the model files into geometry |
| `docs/model.json` | Bones, joint centres and the rig |
| `docs/muscles-<region>.json` | One region's muscles and skin weights, loaded when first needed |

three.js 0.170.0 loads from jsDelivr through an import map.

To run it locally, serve `docs/` with any static server:

```sh
python3 -m http.server --directory docs 8000
```

`npm run check` verifies that every region, muscle, pain pattern, exercise note, strength day, alias, timing entry and animation resolves, then runs the search tests.

### Rebuilding the model

`tools/build_model.py` cuts the needed bones and muscles out of the source meshes, simplifies them, works out joint centres, computes skin weights for each muscle from the bones it attaches to, and writes `docs/model.json` plus one `docs/muscles-<region>.json` per region. The muscle list lives in `tools/parts.py`.

It needs `anatomy.glb` and `skeleton.glb` from [BodyExplorer](https://github.com/JohanBellander/BodyExplorer) (a GLB conversion of BodyParts3D) and the sacrum (`FMA16202.stl`) from a [BodyParts3D mirror](https://github.com/Kevin-Mattheus-Moerman/BodyParts3D).

```sh
pip install numpy scipy trimesh fast-simplification shapely
python3 tools/build_model.py anatomy.glb skeleton.glb FMA16202.stl docs
```

## Credits and licence

Anatomy meshes come from **BodyParts3D**, © The Database Center for Life Science, licensed under [CC BY-SA 2.1 Japan](https://creativecommons.org/licenses/by-sa/2.1/jp/deed.en). The meshes were cropped, simplified, merged and rigged for this project. The adapted model in `docs/model.json` and `docs/muscles-*.json` is shared under the same licence.

Muscle notes follow standard anatomy and physiotherapy references. They haven't been reviewed by a clinician.
