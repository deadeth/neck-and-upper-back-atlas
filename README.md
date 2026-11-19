# Neck and Upper Back Atlas

An interactive 3D atlas of the neck and upper back. Click a muscle to see how it tends to hurt, a quick self-check, and two or three exercises. Each exercise plays on a full skeleton, with the worked muscle highlighted and stretching as the bones move.

**Live site:** https://deadeth.github.io/neck-and-upper-back-atlas/

## What's in it

- A real-anatomy model of the skull, spine, ribs and shoulder girdle with 17 muscles in six groups, left and right.
- A pain finder: pick where it hurts or which movement sets it off, and the likely muscles light up in ranked order.
- Notes per muscle: what it does, where it refers pain, common triggers, attachments and nerve supply.
- Twenty exercises animated on a skeleton, with step-by-step captions that follow the motion.

This is a guide to muscular sources of neck pain. It isn't medical advice and it can't examine you. Joints, discs and nerves cause neck pain too, and the site lists the symptoms that mean seeing a GP or physio first.

## How it's built

The site is static and lives in `docs/`. There's no build step for the page.

| File | Job |
|---|---|
| `docs/index.html` | Markup and styles |
| `docs/app.js` | Panel views, navigation, wiring |
| `docs/anatomy.js` | The clickable atlas scene |
| `docs/figure.js` | The exercise skeleton: joints, arm IK, skinned muscles, props |
| `docs/moves.js` | Keyframes for each exercise |
| `docs/content.js` | Muscle notes, pain patterns, exercise instructions |
| `docs/model.js` | Unpacks `model.json` into geometry |
| `docs/model.json` | Bones, muscles, joint centres and skin weights |

three.js 0.170.0 loads from jsDelivr through an import map.

To run it locally, serve `docs/` with any static server:

```sh
python3 -m http.server --directory docs 8000
```

`npm run check` verifies that every muscle, pain pattern, exercise note and animation resolves.

### Rebuilding the model

`tools/build_model.py` cuts the needed bones and muscles out of the source meshes, simplifies them, works out joint centres, computes skin weights for each muscle from the bones it attaches to, and writes `docs/model.json`.

It needs `anatomy.glb` and `skeleton.glb` from [BodyExplorer](https://github.com/JohanBellander/BodyExplorer) (a GLB conversion of BodyParts3D) and the sacrum (`FMA16202.stl`) from a [BodyParts3D mirror](https://github.com/Kevin-Mattheus-Moerman/BodyParts3D).

```sh
pip install numpy scipy trimesh fast-simplification shapely
python3 tools/build_model.py anatomy.glb skeleton.glb FMA16202.stl docs
```

## Credits and licence

Anatomy meshes come from **BodyParts3D**, © The Database Center for Life Science, licensed under [CC BY-SA 2.1 Japan](https://creativecommons.org/licenses/by-sa/2.1/jp/deed.en). The meshes were cropped, simplified, merged and rigged for this project. The adapted model in `docs/model.json` is shared under the same licence.

Muscle notes follow standard anatomy and physiotherapy references. They haven't been reviewed by a clinician.
