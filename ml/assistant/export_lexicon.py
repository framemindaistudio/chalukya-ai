"""Exports the lexicon and place aliases so the browser uses exactly the same rules as the server."""
import json
from pathlib import Path
from intents_data import ALIASES
from lexicon import LEX
out = Path(__file__).parent / "out" / "lexicon.json"
out.write_text(json.dumps({"lex": LEX, "aliases": ALIASES}, ensure_ascii=False, separators=(",", ":")), encoding="utf8")
print(out, out.stat().st_size // 1024, "KB")
