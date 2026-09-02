#!/usr/bin/env python3
"""Resolve nav.css to a per-selector declaration map at a set of viewport widths.

Used to prove the desktop-up refactor is behaviour-neutral: run it on the old
file and the new one and diff. It is a cascade simulator for THIS file only --
it assumes one selector string is never split across differing specificity
tiers, which holds because we only ever move whole declarations between media
blocks, never rewrite a selector.
"""
import json, re, sys

WIDTHS = [375, 480, 600, 767, 768, 900, 991, 992, 1100, 1279,
          1280, 1350, 1439, 1440, 1600, 1920]


def strip_comments(s):
    return re.sub(r'/\*.*?\*/', '', s, flags=re.S)


def split_blocks(s):
    """-> [(prelude, body)] at one nesting level."""
    out, depth, buf, prelude = [], 0, '', ''
    for c in s:
        if c == '{':
            if depth == 0:
                prelude, buf, depth = buf.strip(), '', 1
            else:
                depth += 1
                buf += c
        elif c == '}':
            depth -= 1
            if depth == 0:
                out.append((prelude, buf))
                buf = ''
            else:
                buf += c
        else:
            buf += c
    return out


BOX = {'padding': 'padding-%s', 'margin': 'margin-%s'}
SIDES = ['top', 'right', 'bottom', 'left']
# shorthands that RESET longhands they do not mention. `font: inherit` in the
# component baseline silently wipes font-size / line-height / font-weight, which
# is invisible if the two are compared as unrelated keys.
RESETS = {'font': ['font-style', 'font-variant', 'font-weight', 'font-stretch',
                   'font-size', 'line-height', 'font-family'],
          'list-style': ['list-style-type', 'list-style-position', 'list-style-image']}


def expand(prop, val):
    """Expand the shorthands this file uses, so a shorthand and its longhands
    compare on equal terms rather than as two unrelated keys."""
    if prop in BOX and '(' not in val.replace('var(', '').replace(')', ''):
        parts = re.findall(r'var\([^)]*\)|\S+', val)
        if len(parts) == 1:
            parts *= 4
        elif len(parts) == 2:
            parts = [parts[0], parts[1], parts[0], parts[1]]
        elif len(parts) == 3:
            parts = [parts[0], parts[1], parts[2], parts[1]]
        if len(parts) == 4:
            return [(BOX[prop] % s, p) for s, p in zip(SIDES, parts)]
    if prop in RESETS and val.strip() in ('inherit', 'initial', 'unset', 'revert', '0', 'none'):
        return [(lh, val.strip()) for lh in RESETS[prop]]
    if prop == 'gap':
        parts = re.findall(r'var\([^)]*\)|\S+', val)
        if len(parts) == 1:
            return [('row-gap', val), ('column-gap', val)]
        if len(parts) == 2:
            return [('row-gap', parts[0]), ('column-gap', parts[1])]
    return [(prop, val)]


def decls(body):
    out = []
    for part in re.split(r';(?![^(]*\))', body):
        if ':' not in part:
            continue
        k, _, v = part.partition(':')
        k, v = k.strip(), ' '.join(v.split())
        if k and v:
            out.extend(expand(k, v))
    return out


def parse_text(css):
    """Same as parse(), for a CSS string already in memory."""
    rules = []
    for prelude, body in split_blocks(strip_comments(css)):
        if prelude.startswith('@media'):
            cond = prelude[len('@media'):].strip()
            for sel, inner in split_blocks(body):
                rules.append((cond, sel, decls(inner)))
        elif prelude.startswith('@'):
            rules.append((None, prelude + '#' + str(len(rules)), decls(body)))
        else:
            rules.append((None, prelude, decls(body)))
    return rules


def parse(path):
    """-> [(media_or_None, selector, [(prop, value)])] in source order."""
    rules = []
    for prelude, body in split_blocks(strip_comments(open(path).read())):
        if prelude.startswith('@media'):
            cond = prelude[len('@media'):].strip()
            for sel, inner in split_blocks(body):
                rules.append((cond, sel, decls(inner)))
        elif prelude.startswith('@'):
            rules.append((None, prelude + '#' + str(len(rules)), decls(body)))
        else:
            rules.append((None, prelude, decls(body)))
    return rules


def matches(cond, w):
    if cond is None:
        return True
    if 'prefers-reduced-motion' in cond:
        return False          # orthogonal to width; excluded from the diff
    m = re.search(r'max-width:\s*(\d+)px', cond)
    if m and w > int(m.group(1)):
        return False
    m = re.search(r'min-width:\s*(\d+)px', cond)
    if m and w < int(m.group(1)):
        return False
    return True


COMBINATORS = re.compile(r'\s*([>+~])\s*|\s+')


def compound(tok):
    """A compound selector -> the set of things it requires (classes, attrs, tag)."""
    parts = set(re.findall(r'\.[-\w]+|\[[^\]]*\]|^[a-zA-Z][-\w]*', tok))
    return frozenset(parts)


def split_sel(sel):
    """-> (context, subject). context is [(combinator, compound), ...]."""
    toks, combs, buf = [], [], ''
    i = 0
    while i < len(sel):
        c = sel[i]
        if c in '>+~':
            toks.append(buf.strip()); combs.append(c); buf = ''
        elif c == ' ' and buf.strip() and not sel[i:].lstrip().startswith(('>', '+', '~')):
            toks.append(buf.strip()); combs.append(' '); buf = ''
        else:
            buf += c
        i += 1
    toks.append(buf.strip())
    toks = [t for t in toks if t]
    ctx = list(zip(combs, [compound(t) for t in toks[:-1]]))
    return ctx, compound(toks[-1])


def specificity(sel):
    a = len(re.findall(r'\.[-\w]+', sel)) + len(re.findall(r'\[[^\]]*\]', sel))
    a += len(re.findall(r':(?!:)(?!where)[-\w]+', sel))
    b = len(re.findall(r'(?:^|[\s>+~])([a-zA-Z][-\w]*)', sel))
    return (a, b)


def applies_to(rule_sel, target_sel):
    """Does `rule_sel` also style the element that `target_sel` describes?"""
    if rule_sel.startswith('@') or target_sel.startswith('@'):
        return rule_sel == target_sel
    if any(x in rule_sel for x in (':', '*')):
        return rule_sel == target_sel
    rctx, rsub = split_sel(rule_sel)
    tctx, tsub = split_sel(target_sel)
    if not rsub <= tsub:
        return False
    if len(rctx) > len(tctx):
        return False
    # every context step the rule demands must be satisfied, right-aligned
    for (rc, rcomp), (tc, tcomp) in zip(reversed(rctx), reversed(tctx)):
        if rc != tc or not rcomp <= tcomp:
            return False
    return True


def resolve(rules, w, targets=None):
    """Accumulate declarations per selector, ordered by specificity then source."""
    active = []
    for idx, (cond, sel, ds) in enumerate(rules):
        if not matches(cond, w):
            continue
        for s in (x.strip() for x in sel.split(',')):
            if s:
                active.append((idx, s, ds))

    if targets is None:
        targets = {s for _, s, _ in active}
    out = {}
    for t in targets:
        hits = [(specificity(s), idx, ds) for idx, s, ds in active if applies_to(s, t)]
        hits.sort(key=lambda h: (h[0], h[1]))
        acc = {}
        for _, _, ds in hits:
            acc.update(ds)
        out[t] = acc
    return out


def selectors(path):
    out = set()
    for _, sel, _ in parse(path):
        out.update(s.strip() for s in sel.split(',') if s.strip())
    return out


def snapshot(path, targets=None):
    rules = parse(path)
    return {str(w): resolve(rules, w, targets) for w in WIDTHS}


if __name__ == '__main__':
    json.dump(snapshot(sys.argv[1]), sys.stdout, indent=1, sort_keys=True)
