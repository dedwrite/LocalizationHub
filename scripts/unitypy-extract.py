#!/usr/bin/env python3
"""
UnityPy extraction helper for LocalizationHub.

Read-only: loads a Unity asset, AssetBundle, or serialized file, enumerates its
objects, and writes a machine-readable manifest plus extracted TextAsset /
MonoBehaviour payloads to an output directory. Never writes back to the source.

Usage:
    python unitypy-extract.py <INPUT> <OUTPUT_DIR>

INPUT may be:
    - a single .bundle / .unity3d / .assets / .asset file, or
    - a directory containing Unity data files (resources.assets, level*, etc.)

Output layout:
    <OUTPUT_DIR>/manifest.json                  object enumeration (machine readable)
    <OUTPUT_DIR>/textassets/<n>_<name>.<ext>    raw TextAsset payloads (decoded)
    <OUTPUT_DIR>/monobehaviours/<n>_<name>.json typed MonoBehaviour trees

Exit codes:
    0 success (even if zero objects found)
    1 load / fatal error
"""

import json
import os
import re
import sys


def sanitize(name: str) -> str:
    return re.sub(r"[^A-Za-z0-9._-]+", "_", name or "object")


# Objects that are almost never localization-relevant and are expensive to
# deserialize. They are enumerated (pathId/classId/type/name) in the manifest
# but NOT deeply read — inventory first, avoid heavy serialized payloads.
HEAVY_TYPES = {
    "Texture2D", "Texture3D", "Sprite", "Cubemap", "RenderTexture", "MovieTexture",
    "Mesh", "SkinnedMeshRenderer", "MeshFilter",
    "AudioClip", "VideoClip", "AnimationClip", "AnimatorController",
    "Shader", "Material", "Font", "LightmapSettings", "LightingDataAsset",
    "NavMeshData", "TerrainData", "PhysicMaterial", "PhysicsMaterial2D",
}

# Types we DO read deeply and extract payloads from.
EXTRACT_TYPES = {"TextAsset", "MonoBehaviour", "ScriptableObject", "GameObject", "LocalizationTable"}


def guess_extension(raw: bytes) -> str:
    if raw.startswith(b"{") or raw.startswith(b"["):
        return "json"
    if b"," in raw[:256] or (b"\n" in raw[:256] and b"," in raw[:512]):
        return "csv"
    head = raw[:512].lstrip()
    if head.startswith(b"<?xml") or head.startswith(b"<"):
        return "xml"
    if head.startswith(b"---"):
        return "yaml"
    # Ink source: knots/stitches (=== / =), choices (* / +), diverts (->),
    # VAR/knitted text markers, tags (#).
    if re.search(rb"(?m)^\s*(===|==)\s+", raw[:2048]) or re.search(rb"(?m)^\s*[*+-]\s+", raw[:2048]) or b"-> " in raw[:2048]:
        return "ink"
    # Yarn Spinner: <<command>>, -> jump, --- header, title:.
    if re.search(rb"<<[^>]+>>", raw[:2048]) and (b"->" in raw[:2048] or b"title:" in raw[:2048].lower()):
        return "yarn"
    return "txt"


def decode_text(raw: bytes) -> str:
    # TextAssets are usually UTF-8 or UTF-16. Try the common encodings.
    for enc in ("utf-8-sig", "utf-16", "utf-8"):
        try:
            return raw.decode(enc)
        except (UnicodeDecodeError, ValueError):
            continue
    return raw.decode("utf-8", errors="replace")


def dump_type_tree(obj, name: str):
    """Return a JSON-serializable dict for a MonoBehaviour/ScriptableObject."""
    try:
        tree = obj.read_typetree()
    except Exception:
        return None
    if tree is None:
        return None
    if isinstance(tree, dict):
        tree = dict(tree)
    return {"name": name, "type": getattr(obj.type, "name", None), "tree": tree}


def main() -> int:
    if len(sys.argv) != 3:
        print("usage: python unitypy-extract.py <INPUT> <OUTPUT_DIR>", file=sys.stderr)
        return 1

    input_path = sys.argv[1]
    out_dir = sys.argv[2]

    import UnityPy

    # Some bundles omit the Unity version from their header; UnityPy then
    # needs a fallback to interpret the type tree. Allow an explicit override
    # via env, defaulting to a common LTS.
    fallback = os.environ.get("UNITYPY_FALLBACK_VERSION", "2022.3.22f1")
    try:
        UnityPy.config.FALLBACK_UNITY_VERSION = fallback
    except Exception:  # noqa: BLE001
        pass

    os.makedirs(out_dir, exist_ok=True)
    ta_dir = os.path.join(out_dir, "textassets")
    mb_dir = os.path.join(out_dir, "monobehaviours")
    os.makedirs(ta_dir, exist_ok=True)
    os.makedirs(mb_dir, exist_ok=True)

    try:
        env = UnityPy.load(input_path)
    except Exception as exc:  # noqa: BLE001
        print(f"UnityPy load failed: {exc}", file=sys.stderr)
        return 1

    manifest = {"input": input_path, "objects": []}
    ta_index = 0
    mb_index = 0

    for obj in env.objects:
        try:
            class_name = getattr(obj.type, "name", None) or str(obj.type)
        except Exception:
            class_name = None

        entry = {
            "pathId": getattr(obj, "path_id", None),
            "classId": getattr(obj, "class_id", None),
            "type": class_name,
        }
        try:
            entry["name"] = getattr(obj, "name", None)
        except Exception:
            entry["name"] = None

        # Inventory-first: heavy binary types are enumerated but never read.
        if class_name in HEAVY_TYPES:
            manifest["objects"].append(entry)
            continue

        # Only types that can carry text are deserialized.
        if class_name not in EXTRACT_TYPES:
            manifest["objects"].append(entry)
            continue

        try:
            data = obj.read()
        except Exception as exc:  # noqa: BLE001
            entry["error"] = str(exc)
            manifest["objects"].append(entry)
            continue

        # TextAsset: extract the raw text payload.
        if class_name == "TextAsset":
            try:
                script = data.m_Script if hasattr(data, "m_Script") else data.m_Text
                raw = bytes(script)
                text = decode_text(raw)
                ext = guess_extension(raw)
                file_name = f"{ta_index:05d}_{sanitize(entry.get('name') or 'textasset')}.{ext}"
                with open(os.path.join(ta_dir, file_name), "w", encoding="utf-8") as fh:
                    fh.write(text)
                entry["textAssetFile"] = f"textassets/{file_name}"
                ta_index += 1
            except Exception as exc:  # noqa: BLE001
                entry["error"] = f"textasset: {exc}"

        # MonoBehaviour / ScriptableObject / GameObject: dump typed tree when
        # available.
        elif class_name in ("MonoBehaviour", "ScriptableObject", "GameObject"):
            tree = dump_type_tree(obj, entry.get("name") or "object")
            if tree is not None:
                file_name = f"{mb_index:05d}_{sanitize(entry.get('name') or 'mono')}.json"
                with open(os.path.join(mb_dir, file_name), "w", encoding="utf-8") as fh:
                    json.dump(tree, fh, default=str, ensure_ascii=False)
                entry["monoFile"] = f"monobehaviours/{file_name}"
                mb_index += 1

        manifest["objects"].append(entry)

    manifest_path = os.path.join(out_dir, "manifest.json")
    with open(manifest_path, "w", encoding="utf-8") as fh:
        json.dump(manifest, fh, default=str, ensure_ascii=False, indent=2)

    print(f"UnityPy: {len(manifest['objects'])} objects, {ta_index} TextAssets, {mb_index} MonoBehaviours")
    return 0


if __name__ == "__main__":
    sys.exit(main())
