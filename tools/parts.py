"""Which source meshes make up each part of the atlas model and the exercise skeleton."""

# muscle id -> (source mesh names with "{s}" = left/right, mirror, skin joints).
# mirror=True: build the right side by mirroring the left (source right side is missing or malformed).
# Skin joints are the bones a muscle attaches to; "{S}" becomes L or R. Vertices are weighted
# between these by distance, so the belly stretches between its attachments.
NECK = ["c1", "c2", "c3", "c4", "c5", "c6", "c7"]
MUSCLES = {
    "upper-trapezius": (["descending part of {s} trapezius"], False, ["head"] + NECK + ["clav{S}", "scap{S}"]),
    "middle-trapezius": (["transverse part of {s} trapezius"], False, ["c7", "thorax", "scap{S}"]),
    "lower-trapezius": (["ascending part of {s} trapezius"], False, ["thorax", "scap{S}"]),
    "levator-scapulae": (["{s} levator scapulae"], False, ["c1", "c2", "c3", "c4", "scap{S}"]),
    "rhomboid-minor": (["{s} rhomboid minor"], False, ["c7", "thorax", "scap{S}"]),
    "rhomboid-major": (["{s} rhomboid major"], False, ["thorax", "scap{S}"]),
    "splenius-capitis": (["{s} splenius capitis"], False, ["head"] + NECK[2:] + ["thorax"]),
    "splenius-cervicis": (["{s} splenius cervicis"], False, NECK + ["thorax"]),
    "semispinalis-capitis": (["{s} semispinalis capitis"], False, ["head"] + NECK + ["thorax"]),
    "semispinalis-cervicis": (["{s} semispinalis cervicis"], False, NECK[1:] + ["thorax"]),
    "suboccipitals": (["{s} rectus capitis posterior major", "{s} rectus capitis posterior minor"], False, ["head", "c1", "c2"]),
    "sternocleidomastoid": (["{s} sternocleidomastoid"], True, ["head", "thorax", "clav{S}"]),
    "scalenes": (["{s} scalenus anterior", "{s} scalenus medius", "{s} scalenus posterior"], False, NECK[1:] + ["thorax"]),
    "deep-neck-flexors": ([
        "inferior oblique part of {s} longus colli",
        "superior oblique part of {s} longus colli",
        "vertical intermediate part of {s} longus colli",
        "{s} longus capitis",
    ], True, ["head"] + NECK + ["thorax"]),
    "supraspinatus": (["{s} supraspinatus"], False, ["scap{S}", "hum{S}"]),
    "infraspinatus": (["{s} infraspinatus muscle"], False, ["scap{S}", "hum{S}"]),
    "erector-spinae": ([
        "{s} iliocostalis thoracis", "{s} iliocostalis cervicis",
        "{s} longissimus thoracis", "{s} longissimus cervicis", "{s} longissimus capitis",
        "{s} spinalis thoracis",
    ], False, ["head"] + NECK + ["thorax", "l1"]),
}

ORD = ["first", "second", "third", "fourth", "fifth", "sixth", "seventh", "eighth", "ninth", "tenth", "eleventh", "twelfth"]
CERV = ["atlas", "axis"] + [f"{o} cervical vertebra" for o in ORD[2:7]]
THOR = [f"{o} thoracic vertebra" for o in ORD]
LUMB = [f"{o} lumbar vertebra" for o in ORD[:5]]
SKULL = ["occipital bone", "frontal bone", "sphenoid bone", "mandible", "hyoid bone",
         "left parietal bone", "right parietal bone", "left temporal bone", "right temporal bone",
         "left maxilla", "right maxilla", "left zygomatic bone", "right zygomatic bone",
         "left nasal bone", "right nasal bone"]
RIBS = [f"left {o} rib" for o in ORD] + [f"right {o} rib" for o in ORD]
STERNUM = ["manubrium", "body of sternum", "xiphoid process"]

# Regexes that pick the many small bones of a hand or foot ("{s}" = left/right).
HAND_RE = r"^(?=.*\b{s}\b).*(capitate|hamate|lunate|pisiform|scaphoid|trapezium|trapezoid|triquetr|metacarpal|finger|thumb)"
FOOT_RE = r"^(?=.*\b{s}\b).*(calcaneus|cuboid|cuneiform|talus|metatarsal|toe|navicular|sesamoid)"

MUSCLE_KEEP = 0.72      # fraction of triangles kept per muscle mesh
CUT_Z = 1012.0          # mm: atlas parts are clipped below this height (just under L1)
HUMERUS_CUT_Z = 1150.0  # mm: the atlas shows the humerus above mid-shaft
ORIGIN = (0.0, -45.0, 1330.0)  # source point that becomes the model origin (near T1)

# vertebral levels marked on the stage ruler: (label, source bone)
LEVELS = [("C2", "axis"), ("C7", "seventh cervical vertebra"), ("T1", "first thoracic vertebra"),
          ("T4", "fourth thoracic vertebra"), ("T8", "eighth thoracic vertebra"), ("T12", "twelfth thoracic vertebra")]
