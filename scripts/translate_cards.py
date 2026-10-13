#!/usr/bin/env python3
"""
Traduce automáticamente (inglés → español) los apodos y descripciones de las cartas
y genera public/data/cards.es.json. Corre 100 % local: no usa APIs ni servicios externos.

Modelo: Helsinki-NLP/opus-mt-tc-big-en-es (CC BY 4.0) convertido a CTranslate2 int8.

Preparación (una sola vez):
    python -m venv .venv-mt
    .venv-mt/Scripts/pip install ctranslate2 sentencepiece transformers torch --extra-index-url https://download.pytorch.org/whl/cpu
    .venv-mt/Scripts/ct2-transformers-converter --model Helsinki-NLP/opus-mt-tc-big-en-es \
        --output_dir .cache/ct2-en-es --quantization int8 --copy_files source.spm target.spm

Uso:
    .venv-mt/Scripts/python scripts/translate_cards.py --model .cache/ct2-en-es [--limit 50] [--ids scp-173,scp-682]
"""
from __future__ import annotations

import argparse
import json
import os
import re
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

import ctranslate2
import sentencepiece as spm

ROOT = Path(__file__).resolve().parent.parent
CARDS = ROOT / "public" / "data" / "cards.json"
OUT = ROOT / "public" / "data" / "cards.es.json"

# ───────────────────────────── protección de tokens ─────────────────────────────
# El modelo no conoce "█" ni ciertas convenciones de la wiki; se reemplazan por
# marcadores que el traductor copia tal cual y luego se restauran.

PROTECT = [
    re.compile(r"█+"),
    re.compile(r"[@#™®©~^<>{}|\\_]+"),
    re.compile(r"\[(?:DATA EXPUNGED|REDACTED|EXPUNGED|DATA REDACTED)\]", re.I),
]
FIXED = {
    "[DATA EXPUNGED]": "[DATOS ELIMINADOS]",
    "[EXPUNGED]": "[ELIMINADO]",
    "[REDACTED]": "[CENSURADO]",
    "[DATA REDACTED]": "[DATOS CENSURADOS]",
}

ABBREV = re.compile(r"(?:\b(?:Dr|Mr|Mrs|Ms|Mx|St|Mt|Jr|Sr|Lt|Col|Gen|Sgt|Capt|Prof|Rev|No|vs|etc|approx|ca|Inc|Ltd|Co|Fig|Vol)|\b[A-Z])\.$")


UNKNOWN_CHARS: set[str] = set()  # se completa con los caracteres que el vocabulario del modelo no cubre


def protect(text: str):
    found: list[str] = []

    def sub(m: re.Match) -> str:
        found.append(m.group(0))
        return f"X{len(found) - 1}X"

    for rx in PROTECT:
        text = rx.sub(sub, text)
    unknown = sorted({ch for ch in text if ch in UNKNOWN_CHARS})
    if unknown:
        text = re.sub("[" + re.escape("".join(unknown)) + "]+", sub, text)
    return text, found


# "USA" en mitad de la oración hace que el modelo corte tras "EE.": se expande antes de traducir.
PRE = [
    (re.compile(r"\bU\.S\.A\.?(?=[\s,;)]|$)"), "United States"),
    (re.compile(r"\bUSA\b"), "United States"),
]


def pre_edit(text: str) -> str:
    for rx, rep in PRE:
        text = rx.sub(rep, text)
    return text


def restore(text: str, found: list[str]) -> str:
    for i, original in enumerate(found):
        replacement = FIXED.get(original.upper(), original)
        text = re.sub(rf"X\s*{i}\s*X", lambda _m, r=replacement: r, text)
    return text


def split_sentences(text: str) -> list[str]:
    parts, start = [], 0
    for m in re.finditer(r"[.!?…](?=\s+[A-Z\"“(\[])", text):
        chunk = text[start : m.end()]
        if ABBREV.search(chunk):
            continue
        parts.append(chunk.strip())
        start = m.end()
    tail = text[start:].strip()
    if tail:
        parts.append(tail)
    return parts or [text]


# ───────────────────────────── post-edición ─────────────────────────────
# Convenciones de la comunidad hispana de la Fundación (SCP-ES).

POST = [
    (re.compile(r"\bSite-(\d+)"), r"Sitio-\1"),
    (re.compile(r"\bSitio (\d+)"), r"Sitio-\1"),
    (re.compile(r"\bArea-(\d+)"), r"Área-\1"),
    (re.compile(r"\bÁrea (\d+)"), r"Área-\1"),
    (re.compile(r"\bclase D\b", re.I), "Clase-D"),
    (re.compile(r"\bD-[Cc]lass\b"), "Clase-D"),
    (re.compile(r"\bthe Foundation\b"), "la Fundación"),
    (re.compile(r"\bFundación SCP\b"), "Fundación SCP"),
    (re.compile(r"\b(keter|euclid|thaumiel|apollyon|archon|ticonderoga|cernunnos)\b"), lambda m: m.group(1).capitalize()),
    (re.compile(r"\bo5\b"), "O5"),
    (re.compile(r"\bEE\.(?!\s*UU)"), "EE. UU."),
    # el vocabulario de salida no tiene "ü": antig⁇edad → antigüedad, ling⁇ística → lingüística
    (re.compile(r"g\s?⁇\s?(?=[eéiíEI])"), "gü"),
    (re.compile(r"\s+([,.;:!?])"), r"\1"),
    (re.compile(r"\s{2,}"), " "),
]

US_TAIL = re.compile(r"(?:USA|U\.S\.A?\.?|United States)[.)]?$")


def post_edit(text: str) -> str:
    for rx, rep in POST:
        text = rx.sub(rep, text)
    return text.strip()


def fix_codes(text: str, codes: set[str]) -> str:
    """El modelo a veces parte los códigos ("SCP-12 39-2"): se reúnen los que figuran en el original."""
    for code in codes:
        rx = re.compile(r"SCP-" + r"\s?".join(code[4:]) + r"(?!\d)")
        text = rx.sub(code, text)
    return text


def looks_broken(src: str, out: str) -> bool:
    """Descarta salidas degeneradas: vacías, demasiado largas/cortas o con repeticiones."""
    if not out:
        return True
    ratio = len(out) / max(1, len(src))
    if ratio > 2.2 or ratio < 0.35:
        return True
    words = out.split()
    if len(words) > 6 and len(set(words)) / len(words) < 0.35:
        return True
    return bool(re.search(r"[Ͱ-ϿЀ-ӿ؀-ۿ一-鿿]", out))


# ───────────────────────────── traductor ─────────────────────────────


class Translator:
    def __init__(self, model_dir: Path, threads: int):
        self.tr = ctranslate2.Translator(str(model_dir), device="cpu", compute_type="int8", inter_threads=max(1, threads // 4), intra_threads=4)
        self.sp_src = spm.SentencePieceProcessor(model_file=str(model_dir / "source.spm"))
        self.sp_tgt = spm.SentencePieceProcessor(model_file=str(model_dir / "target.spm"))

    def learn_unknown(self, texts: list[str]) -> None:
        """Registra los caracteres que el tokenizador de origen no conoce (salen como ⁇)."""
        # Se protege lo que falte en cualquiera de los dos vocabularios: si sólo falta en el de
        # salida, el modelo intenta copiarlo y genera un token desconocido.
        for ch in {c for t in texts for c in t if not c.isspace()} - UNKNOWN_CHARS:
            if self.sp_src.unk_id() in self.sp_src.encode(ch, out_type=int) or self.sp_tgt.unk_id() in self.sp_tgt.encode(ch, out_type=int):
                UNKNOWN_CHARS.add(ch)

    def _run(self, texts: list[str], **kw) -> list[str]:
        tokens = [self.sp_src.encode(t, out_type=str) + ["</s>"] for t in texts]
        results = self.tr.translate_batch(tokens, max_batch_size=32, batch_type="examples", max_decoding_length=256, **kw)
        return [self.sp_tgt.decode(r.hypotheses[0]) for r in results]

    def translate(self, texts: list[str], beam: int = 4) -> list[str]:
        out = self._run(texts, beam_size=beam, no_repeat_ngram_size=4)
        # Reintento para salidas truncadas (el modelo a veces corta tras "EE." o abreviaturas).
        short = [i for i, (s, o) in enumerate(zip(texts, out)) if len(s) > 40 and len(o) < len(s) * 0.7]
        if short:
            retry = self._run([texts[i] for i in short], beam_size=beam + 2, length_penalty=1.3)
            for i, r in zip(short, retry):
                if len(r) > len(out[i]):
                    out[i] = r
        for i, (s, o) in enumerate(zip(texts, out)):
            if US_TAIL.search(s.strip()) and o.rstrip().endswith("EE."):
                out[i] = o.rstrip() + " UU."
        return out


def translate_descs(tr: Translator, items: list[tuple[str, str]]) -> dict[str, str]:
    """Traduce oración por oración (más fiel que el párrafo completo).

    Conserva la estructura de la descripción: párrafos ("\\n\\n"), líneas ("\\n") y viñetas ("• ").
    """
    segments: list[str] = []
    # por carta: [párrafo → [(viñeta, n.º de oraciones, mayúsculas por oración)]]
    index: list[tuple[str, list[list[tuple[bool, int, list[bool]]]], list[str], bool]] = []
    for card_id, desc in items:
        if not desc:
            continue
        ellipsis = desc.endswith("…")
        body = desc[:-1].rstrip() if ellipsis else desc
        # las viñetas se apartan antes de proteger caracteres ("•" no está en el vocabulario del modelo)
        bullets = [[line.startswith("• ") for line in para.split("\n")] for para in body.split("\n\n")]
        body = "\n\n".join("\n".join(line[2:] if line.startswith("• ") else line for line in para.split("\n")) for para in body.split("\n\n"))
        protected, found = protect(pre_edit(body))
        layout = []
        for p_i, para in enumerate(protected.split("\n\n")):
            lines = []
            for l_i, line in enumerate(para.split("\n")):
                bullet = bullets[p_i][l_i]
                sents = split_sentences(line)
                # Oraciones en MAYÚSCULAS: se traducen en minúsculas (el vocabulario de salida no tiene
                # Ó, Í, Ú, Ñ) y luego se vuelven a pasar a mayúsculas.
                upper = [is_shouting(s) for s in sents]
                segments.extend(s.lower() if u else s for s, u in zip(sents, upper))
                lines.append((bullet, len(sents), upper))
            layout.append(lines)
        index.append((card_id, layout, found, ellipsis, set(re.findall(r"SCP-\d+", desc))))
    out = tr.translate(segments)
    result, pos = {}, 0
    for card_id, layout, found, ellipsis, codes in index:
        src_all, raw_all, paras = [], [], []
        for lines in layout:
            rendered = []
            for bullet, n, upper in lines:
                src_all.extend(segments[pos : pos + n])
                line = " ".join(o.upper() if u else o for o, u in zip(out[pos : pos + n], upper))
                raw_all.append(line)
                pos += n
                # la post-edición normaliza espacios: se aplica por línea para no perder los saltos
                rendered.append(("• " if bullet else "") + fix_codes(post_edit(restore(line, found)), codes))
            paras.append("\n".join(rendered))
        text = "\n\n".join(paras)
        # la salida del modelo se evalúa antes de restaurar lo protegido (el original puede traer otros alfabetos)
        if looks_broken(" ".join(src_all), " ".join(raw_all)) or "⁇" in text:  # mejor el original en inglés que un texto roto
            continue
        if ellipsis and not text.endswith("…"):
            text = text.rstrip(".") + "…"
        result[card_id] = text
    return result


def is_shouting(s: str) -> bool:
    letters = [c for c in re.sub(r"X\d+X|SCP-\S+", "", s) if c.isalpha()]
    return len(letters) >= 6 and sum(c.isupper() for c in letters) / len(letters) > 0.8


def translate_names(tr: Translator, items: list[tuple[str, str]]) -> dict[str, str]:
    prepared, keep = [], []
    for card_id, name in items:
        if not name:
            continue
        letters = re.sub(r"[^A-Za-z]", "", name)
        # Títulos estilizados (siglas, nombres propios de una palabra, juegos tipográficos) no se tocan.
        if len(letters) <= 2 or (name.isupper() and " " not in name.strip()) or re.search(r"[#@_/\\{}<>]|\s[A-Z]\s[A-Z]\s", name):
            continue
        upper = name.isupper()
        src, found = protect(pre_edit(sentence_case(name.lower() if upper else name)))
        prepared.append((card_id, name, src, upper, found))
    out = tr.translate([p[2] for p in prepared], beam=5)
    result = {}
    for (card_id, name, src, upper, found), text in zip(prepared, out):
        text = post_edit(restore(text, found)).strip()
        # los títulos cortos ("Why?" → "¿Por qué?") crecen mucho en proporción: sólo se mira el largo absoluto
        broken = looks_broken(src, text) if len(src) >= 15 else not text
        if broken or len(text) > max(40, len(name) * 2.2) or "⁇" in text:
            continue
        text = text[:1].upper() + text[1:]
        result[card_id] = text.upper() if upper else text
    return result


def sentence_case(name: str) -> str:
    """'Plague Doctor' → 'Plague doctor': evita la traducción palabra por palabra de los títulos."""
    words = name.split(" ")
    out = []
    for i, w in enumerate(words):
        if i > 0 and w == "A":  # artículo, no sigla
            out.append("a")
            continue
        keep = i == 0 or w.isupper() or not w[:1].isupper() or any(c.isupper() for c in w[1:])
        out.append(w if keep else w[:1].lower() + w[1:])
    return " ".join(out)


def main() -> None:
    for stream in (sys.stdout, sys.stderr):
        stream.reconfigure(encoding="utf-8")  # consolas de Windows en cp1252
    ap = argparse.ArgumentParser()
    ap.add_argument("--model", required=True, type=Path)
    ap.add_argument("--limit", type=int, default=0)
    ap.add_argument("--ids", default="")
    ap.add_argument("--chunk", type=int, default=400)
    ap.add_argument("--print", action="store_true", help="muestra las traducciones en lugar de escribir el archivo")
    ap.add_argument("--fix", action="store_true", help="retraduce sólo las cartas con problemas detectados y las fusiona con el archivo existente")
    args = ap.parse_args()

    payload = json.loads(CARDS.read_text(encoding="utf-8"))
    cols = payload["columns"]
    cards = [dict(zip(cols, row)) for row in payload["rows"]]
    previous = json.loads(OUT.read_text(encoding="utf-8")) if args.fix and OUT.exists() else None
    if previous:
        def needs_fix(c: dict) -> bool:
            d, n = previous["descs"].get(c["id"], ""), previous["names"].get(c["id"], "")
            return (
                "⁇" in d
                or "⁇" in n
                or bool(re.search(r"\bUSA\b|\bU\.S\.A?\b", c["desc"]))
                or " A " in c["name"]
                or bool(re.search(r"\bEE\.(?!\s*UU)", d))
                or (bool(c["name"]) and c["id"] not in previous["names"])
                or (bool(c["desc"]) and c["id"] not in previous["descs"])
            )
        cards = [c for c in cards if needs_fix(c)]
        print(f"  --fix: {len(cards)} cartas a retraducir", file=sys.stderr)
    if args.ids:
        wanted = set(args.ids.split(","))
        cards = [c for c in cards if c["id"] in wanted]
    if args.limit:
        cards = cards[: args.limit]

    tr = Translator(args.model, os.cpu_count() or 4)
    tr.learn_unknown([c["desc"] for c in cards] + [c["name"] for c in cards])
    print(f"  caracteres fuera del vocabulario: {''.join(sorted(UNKNOWN_CHARS))}", file=sys.stderr)
    names: dict[str, str] = dict(previous["names"]) if previous else {}
    descs: dict[str, str] = dict(previous["descs"]) if previous else {}
    if previous:
        for c in cards:  # lo que no se pueda retraducir bien vuelve al original en inglés
            names.pop(c["id"], None)
            descs.pop(c["id"], None)
    t0 = time.time()
    for i in range(0, len(cards), args.chunk):
        chunk = cards[i : i + args.chunk]
        names.update(translate_names(tr, [(c["id"], c["name"]) for c in chunk]))
        descs.update(translate_descs(tr, [(c["id"], c["desc"]) for c in chunk]))
        done = min(len(cards), i + args.chunk)
        rate = done / max(1e-6, time.time() - t0)
        print(f"  {done}/{len(cards)} cartas · {rate:.1f}/s · ETA {(len(cards) - done) / max(rate, 1e-6):.0f}s", file=sys.stderr, flush=True)

    if args.print:
        for c in cards:
            print(f"\n# {c['code']} {c['name']} → {names.get(c['id'], '(sin traducir)')}\nEN: {c['desc']}\nES: {descs.get(c['id'], '(sin traducir)')}")
        return

    out = {
        "lang": "es",
        "method": "machine",
        "model": "Helsinki-NLP/opus-mt-tc-big-en-es (CTranslate2 int8)",
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "source": payload.get("generatedAt"),
        "names": names,
        "descs": descs,
    }
    OUT.write_text(json.dumps(out, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(f"✔ {len(descs)} descripciones y {len(names)} apodos → {OUT.relative_to(ROOT)} ({OUT.stat().st_size / 1e6:.2f} MB) en {time.time() - t0:.0f}s")


if __name__ == "__main__":
    main()
