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

# The wrist and palm move as one piece; each finger bone is its own part so the fingers can curl.
CARPUS = ["capitate", "hamate", "lunate", "pisiform", "scaphoid", "trapezium", "trapezoid"]
METACARPALS = ["first", "second", "third", "fourth", "fifth"]
DIGITS = ["thumb", "index finger", "middle finger", "ring finger", "little finger"]   # digit 1..5
FOOT_RE = r"^(?=.*\b{s}\b).*(calcaneus|cuboid|cuneiform|talus|metatarsal|toe|navicular|sesamoid)"
TOES_RE = r"phalanx of {s} \w+ toe$"   # the part of FOOT_RE that bends at the ball of the foot
TOE_RAYS = ["first", "second", "third", "fourth", "fifth"]   # metatarsals, big toe to little toe

MUSCLE_KEEP = 0.72      # fraction of triangles kept per muscle mesh
CUT_Z = 1012.0          # mm: atlas parts are clipped below this height (just under L1)
HUMERUS_CUT_Z = 1150.0  # mm: the atlas shows the humerus above mid-shaft
ORIGIN = (0.0, -45.0, 1330.0)  # source point that becomes the model origin (near T1)

# vertebral levels marked on the stage ruler: (label, source bone)
LEVELS = [("C2", "axis"), ("C7", "seventh cervical vertebra"), ("T1", "first thoracic vertebra"),
          ("T4", "fourth thoracic vertebra"), ("T8", "eighth thoracic vertebra"), ("T12", "twelfth thoracic vertebra")]

# ---------- the rest of the body ----------
# region -> unit id -> (regex over source names of the LEFT side, skin joints, layer)
# "{S}" in a joint becomes L or R. Units are matched by regex because the source splits many
# muscles into heads; `zmin` guards against same-named muscles elsewhere (hand vs foot).
LUMBAR = ["l1", "l2", "l3", "l4", "l5"]
ARM = ["hum{S}", "ulna{S}", "rad{S}", "hand{S}"]
REGION_UNITS = {
    "core": {
        "latissimus-dorsi": (r"latissimus dorsi", ["thorax"] + LUMBAR + ["pelvis", "scap{S}", "hum{S}"], 1),
        "lumbar-erectors": (r"iliocostalis lumborum", ["thorax"] + LUMBAR + ["pelvis"], 2),
        "multifidus": (r"multifidus lumborum", ["thorax"] + LUMBAR + ["pelvis"], 4),
        "quadratus-lumborum": (r"quadratus lumborum", ["thorax"] + LUMBAR + ["pelvis"], 3),
        "rectus-abdominis": (r"rectus abdominis", ["thorax", "pelvis"], 1),
        "external-oblique": (r"external oblique", ["thorax", "pelvis"], 1),
        "internal-oblique": (r"internal oblique", ["thorax", "pelvis"], 2),
        "transversus-abdominis": (r"transversus abdominis", ["thorax", "pelvis"], 3),
        "iliopsoas": (r"psoas major|iliacus", ["thorax"] + LUMBAR + ["pelvis", "fem{S}"], 4),
    },
    "shoulder": {
        "deltoid-anterior": (r"clavicular part of left deltoid", ["clav{S}", "scap{S}", "hum{S}"], 1),
        "deltoid-middle": (r"acromial part of left deltoid", ["scap{S}", "hum{S}"], 1),
        "deltoid-posterior": (r"spinal part of left deltoid", ["scap{S}", "hum{S}"], 1),
        "pectoralis-major": (r"pectoralis major", ["clav{S}", "thorax", "hum{S}"], 1),
        "pectoralis-minor": (r"pectoralis minor", ["thorax", "scap{S}"], 2),
        "serratus-anterior": (r"serratus anterior", ["thorax", "scap{S}"], 2),
        "teres-major": (r"teres major", ["scap{S}", "hum{S}"], 2),
        "teres-minor": (r"teres minor", ["scap{S}", "hum{S}"], 2),
        "subscapularis": (r"subscapularis", ["scap{S}", "hum{S}"], 3),
        "biceps-brachii": (r"biceps brachii", ["scap{S}", "hum{S}", "rad{S}"], 1),
        "brachialis": (r"left brachialis$", ["hum{S}", "ulna{S}"], 2),
        "coracobrachialis": (r"coracobrachialis", ["scap{S}", "hum{S}"], 2),
        "triceps-brachii": (r"triceps brachii", ["scap{S}", "hum{S}", "ulna{S}"], 1),
        "brachioradialis": (r"brachioradialis", ["hum{S}", "rad{S}"], 1),
        "forearm-flexors": (r"flexor carpi|palmaris longus|pronator teres|flexor digitorum (superficialis|profundus)|flexor pollicis longus", ARM, 2),
        "forearm-extensors": (r"extensor carpi|extensor digitorum$|extensor digiti minimi|extensor indicis|extensor pollicis|abductor pollicis longus|supinator|anconeus", ARM, 2),
    },
    "hip": {
        "gluteus-maximus": (r"gluteus maximus", ["pelvis", "fem{S}"], 1),
        "gluteus-medius": (r"gluteus medius", ["pelvis", "fem{S}"], 2),
        "gluteus-minimus": (r"gluteus minimus", ["pelvis", "fem{S}"], 3),
        "piriformis": (r"piriformis", ["pelvis", "fem{S}"], 3),
        "deep-rotators": (r"obturator|gemellus|quadratus femoris", ["pelvis", "fem{S}"], 4),
        "tensor-fasciae-latae": (r"tensor fasciae latae", ["pelvis", "fem{S}"], 1),
        "adductors": (r"adductor (longus|brevis|magnus)|pectineus|gracilis", ["pelvis", "fem{S}", "tib{S}"], 2),
    },
    "leg": {
        "rectus-femoris": (r"rectus femoris", ["pelvis", "fem{S}", "tib{S}"], 1),
        "vasti": (r"vastus", ["fem{S}", "tib{S}"], 2),
        "sartorius": (r"sartorius", ["pelvis", "fem{S}", "tib{S}"], 1),
        "biceps-femoris": (r"biceps femoris", ["pelvis", "fem{S}", "tib{S}"], 1),
        "medial-hamstrings": (r"semitendinosus|semimembranosus", ["pelvis", "fem{S}", "tib{S}"], 1),
        "gastrocnemius": (r"gastrocnemius", ["fem{S}", "tib{S}", "foot{S}"], 1),
        "soleus": (r"soleus", ["tib{S}", "foot{S}"], 2),
        "tibialis-anterior": (r"tibialis anterior", ["tib{S}", "foot{S}"], 1),
        "tibialis-posterior": (r"tibialis posterior", ["tib{S}", "foot{S}"], 3),
        "fibulares": (r"fibularis (longus|brevis)", ["tib{S}", "foot{S}"], 1),
    },
}
# extra sources that only contribute their part below the neck atlas's cut (the lumbar half of the long back extensors)
BELOW_CUT = {"lumbar-erectors": ["{s} longissimus thoracis", "{s} spinalis thoracis"]}
REGION_KEEP = 0.5
# The scanned flat abdominal muscles carry their aponeuroses, which form the rectus sheath and cover the
# rectus abdominis. Cut each away medial to the rectus's lateral border (the linea semilunaris), measured
# height by height from the same side's rectus mesh; only the front of the trunk (source y below
# SHEATH_FRONT_Y, mm) is cut, so the posterior attachments stay.
SHEATH_UNITS = ("external-oblique", "internal-oblique", "transversus-abdominis")
SHEATH_BORDER = "{s} rectus abdominis"
SHEATH_FRONT_Y = -110.0
