# Builds the stories page for Elad from template.html + week.json.
# Images come from content/posts/<id>/web/ (made by photo-selector).
# Output: index.html (page) + files-map.json (published path -> source path).
import json, os, sys

HERE = os.path.dirname(os.path.abspath(__file__))
POSTS_DIR = os.path.normpath(os.path.join(HERE, "..", "posts"))

week = json.load(open(os.path.join(HERE, "week.json"), encoding="utf-8"))
files = {}
for p in week["posts"]:
    web = os.path.join(POSTS_DIR, p["id"], "web")
    if not os.path.isdir(web):
        sys.exit("missing web folder: " + web)
    names = sorted(os.listdir(web))
    if p.get("kind") == "video":
        p["video"] = {"src": "media/%s/preview.mp4" % p["id"], "poster": "media/%s/cover.jpg" % p["id"]}
        for n in ("preview.mp4", "cover.jpg"):
            if n not in names:
                sys.exit("missing %s in %s" % (n, web))
            files["media/%s/%s" % (p["id"], n)] = os.path.join(web, n)
        p["images"] = []
    else:
        imgs = [n for n in names if n.lower().endswith(".jpg")]
        p["images"] = ["media/%s/%s" % (p["id"], n) for n in imgs]
        for n in imgs:
            files["media/%s/%s" % (p["id"], n)] = os.path.join(web, n)

data = json.dumps(week, ensure_ascii=False).replace("<", "\\u003c")
tpl = open(os.path.join(HERE, "template.html"), encoding="utf-8").read()
open(os.path.join(HERE, "index.html"), "w", encoding="utf-8").write(tpl.replace("__DATA__", data))
json.dump(files, open(os.path.join(HERE, "files-map.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
total = sum(os.path.getsize(v) for v in files.values())
print("posts:", len(week["posts"]), "files:", len(files), "MB: %.1f" % (total / 1e6))
