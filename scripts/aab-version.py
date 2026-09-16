#!/usr/bin/env python3
"""Print `versionName versionCode` read out of a built .aab.

    ./scripts/aab-version.py build/wordburn-1.0.0-1.aab
    1.0.0 1

This exists because `aapt2 dump badging` refuses an .aab — it only knows the
APK container — and bundletool is not installed anywhere in this project. So
the two numbers are read straight out of the bundle's own manifest.

That manifest is protobuf, not the binary XML an APK carries, which is the
whole reason aapt2 cannot open it. Nothing here needs the aapt.pb schema
though: a protobuf message can be walked by its wire format alone, and the
three field numbers used below are fixed by aapt's own .proto and have been
since bundles existed.

    XmlNode.element        = 1
    XmlElement.name        = 3
    XmlElement.attribute   = 4
    XmlAttribute.name      = 2
    XmlAttribute.value     = 3   the source string, "1.0.0"
    XmlAttribute.compiled  = 6   Item -> Primitive, where an int lives

versionName is a string and comes back on field 3. versionCode is an integer,
so AGP may leave field 3 empty and put it in the compiled item instead; both
are read and the string wins when it is there.

Verifying the *artifact* rather than app.json is the point. A stale android/
directory will happily build a bundle carrying a version nobody asked for,
which is exactly what happened here — app.json said 1.0.0 while the bundle on
disk said 0.0.1 — and reading the input back to yourself proves nothing.
"""

import sys
import zipfile

MANIFEST = "base/manifest/AndroidManifest.xml"


def read_varint(buf, i):
    result = shift = 0
    while True:
        byte = buf[i]
        i += 1
        result |= (byte & 0x7F) << shift
        if not byte & 0x80:
            return result, i
        shift += 7


def read_fields(buf):
    """Wire-format walk. Returns {field number: [value, ...]}."""
    out = {}
    i = 0
    while i < len(buf):
        key, i = read_varint(buf, i)
        number, wire = key >> 3, key & 7
        if wire == 0:
            value, i = read_varint(buf, i)
        elif wire == 2:
            length, i = read_varint(buf, i)
            value, i = buf[i : i + length], i + length
        elif wire == 5:
            value, i = buf[i : i + 4], i + 4
        elif wire == 1:
            value, i = buf[i : i + 8], i + 8
        else:
            raise ValueError(f"unsupported wire type {wire} at byte {i}")
        out.setdefault(number, []).append(value)
    return out


def manifest_attributes(blob):
    node = read_fields(blob)
    if 1 not in node:
        raise ValueError("no root element in the manifest")
    element = read_fields(node[1][0])
    name = element.get(3, [b""])[0].decode("utf-8")
    if name != "manifest":
        raise ValueError(f"root element is <{name}>, expected <manifest>")

    found = {}
    for raw in element.get(4, []):
        attribute = read_fields(raw)
        key = attribute.get(2, [b""])[0].decode("utf-8")
        if key not in ("versionCode", "versionName"):
            continue
        value = attribute.get(3, [b""])[0].decode("utf-8")
        if not value and 6 in attribute:
            item = read_fields(attribute[6][0])
            if 7 in item:  # Item.prim
                primitive = read_fields(item[7][0])
                numbers = [v for v in primitive.values() if isinstance(v[0], int)]
                if numbers:
                    value = str(numbers[0][0])
        found[key] = value
    return found


def main():
    if len(sys.argv) != 2:
        sys.exit("usage: aab-version.py <bundle.aab>")

    path = sys.argv[1]
    try:
        with zipfile.ZipFile(path) as bundle:
            blob = bundle.read(MANIFEST)
    except FileNotFoundError:
        sys.exit(f"no such file: {path}")
    except KeyError:
        sys.exit(f"{path} has no {MANIFEST}. Is it really an app bundle?")
    except zipfile.BadZipFile:
        sys.exit(f"{path} is not a zip, so it is not a bundle either.")

    attributes = manifest_attributes(blob)
    name = attributes.get("versionName")
    code = attributes.get("versionCode")
    if not name or not code:
        sys.exit(f"{path} declares no versionName/versionCode at all.")

    print(f"{name} {code}")


if __name__ == "__main__":
    main()
