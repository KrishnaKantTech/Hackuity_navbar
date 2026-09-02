#!/usr/bin/env python3
"""Resolve two stylesheets over the REAL element tree in nav.html and diff them.

The earlier per-selector-string check had a blind spot: it scored a rule only
against selectors that named the same classes, so it never noticed that
`.nv-login` and `.nv-btn` land on the SAME element and fight on source order.
This walks actual elements instead, so every rule that touches an element is
in the running.

    python3 tools/verify_flip.py old.css new.css
"""
import os
import re
import sys
from html.parser import HTMLParser

from cascade import WIDTHS, matches, parse

# state classes nav.js adds at runtime, and the attributes it writes
STATES = ['nv-is-active', 'nv-is-open', 'nv-is-scrollable', 'nv-is-enter',
          'nv-is-leave', 'nv-is-out', 'nv-is-drilled']
SWAPS = ['next', 'prev', 'open', 'close']
PSEUDO = re.compile(r':{1,2}(?!where)[-\w]+(?:\([^)]*\))?')


class Tree(HTMLParser):
    def __init__(self):
        super().__init__()
        self.nodes, self.stack = [], []

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        parent = self.stack[-1] if self.stack else None
        sibs = [n for n in self.nodes if n['parent'] is parent]
        node = {'tag': tag, 'cls': set((a.get('class') or '').split()),
                'attrs': a, 'parent': parent,
                'prev': sibs[-1] if sibs else None}
        self.nodes.append(node)
        if tag not in ('img', 'br', 'input', 'path', 'use', 'meta', 'link'):
            self.stack.append(node)

    def handle_endtag(self, tag):
        if self.stack and self.stack[-1]['tag'] == tag:
            self.stack.pop()


def compound_ok(node, comp):
    """Does one compound selector (no combinators) match this node?"""
    for part in re.findall(r'\.[-\w]+|\[[^\]]*\]|^[a-zA-Z][-\w]*', comp):
        if part.startswith('.'):
            if part[1:] not in node['cls']:
                return False
        elif part.startswith('['):
            m = re.match(r'\[([-\w]+)(?:([~|^$*]?=)"?([^"\]]*)"?)?\]', part)
            name, _, val = m.group(1), m.group(2), m.group(3)
            if name not in node['attrs']:
                return False
            if val is not None and node['attrs'][name] != val:
                return False
        else:
            if node['tag'] != part:
                return False
    return True


def split(sel):
    toks, combs, buf, i = [], [], '', 0
    while i < len(sel):
        c = sel[i]
        if c in '>+~':
            toks.append(buf.strip()); combs.append(c); buf = ''
        elif c == ' ' and buf.strip() and not sel[i:].lstrip()[:1] in ('>', '+', '~'):
            toks.append(buf.strip()); combs.append(' '); buf = ''
        else:
            buf += c
        i += 1
    toks.append(buf.strip())
    toks = [t for t in toks if t]
    return list(zip(combs, toks[:-1])), toks[-1]


def sel_matches(node, sel):
    ctx, subject = split(sel)
    if not compound_ok(node, subject):
        return False
    cur = node
    for comb, comp in reversed(ctx):
        if comb == ' ':
            p = cur['parent']
            while p is not None and not compound_ok(p, comp):
                p = p['parent']
            if p is None:
                return False
            cur = p
        elif comb == '>':
            p = cur['parent']
            if p is None or not compound_ok(p, comp):
                return False
            cur = p
        elif comb == '+':
            s = cur['prev']
            if s is None or not compound_ok(s, comp):
                return False
            cur = s
        else:
            return False
    return True


def spec(sel):
    a = len(re.findall(r'\.[-\w]+', sel)) + len(re.findall(r'\[[^\]]*\]', sel))
    a += len(re.findall(r'(?<!:):(?!:)(?!where)[-\w]+', sel))
    b = len(re.findall(r'(?:^|[\s>+~])([a-zA-Z][-\w]*)', sel))
    return (a, b)


def resolve(rules, node, w, with_pseudo):
    hits = []
    for idx, (cond, sel, ds) in enumerate(rules):
        if sel.startswith('@') or not matches(cond, w):
            continue
        for s in (x.strip() for x in sel.split(',')):
            if not s or '*' in s or ':where' in s:
                continue
            has_p = bool(PSEUDO.search(s))
            if has_p and not with_pseudo:
                continue
            bare = PSEUDO.sub('', s).strip()
            if bare and sel_matches(node, bare):
                hits.append(((spec(s), idx), ds))
    hits.sort(key=lambda h: h[0])
    acc = {}
    for _, ds in hits:
        acc.update(ds)
    return acc


def elements(path):
    t = Tree()
    t.feed(open(path).read())
    base = [n for n in t.nodes if n['cls']]
    out = list(base)
    for n in base:                                  # + runtime state variants
        for s in STATES:
            v = dict(n); v['cls'] = n['cls'] | {s}
            out.append(v)
    for n in base:                                  # + swap attrs on ancestors
        if 'nv-panels' in n['cls']:
            for sw in SWAPS:
                v = dict(n); v['attrs'] = dict(n['attrs'], **{'data-nav-swap': sw})
                out.append(v)
                for kid in [k for k in t.nodes if k['parent'] is n]:
                    for s in ('nv-is-enter', 'nv-is-leave', 'nv-is-out'):
                        kv = dict(kid); kv['parent'] = v
                        kv['cls'] = kid['cls'] | {s}
                        out.append(kv)
    return out


INITIAL = {'flex-direction': 'row', 'width': 'auto', 'height': 'auto',
           'justify-content': 'normal', 'align-items': 'normal', 'align-self': 'auto',
           'order': '0', 'overflow': 'visible', 'top': 'auto', 'background': 'none',
           'border-radius': '0', 'box-shadow': 'none', 'transition': 'none',
           'grid-template-columns': 'none', 'min-height': 'auto', 'grid-column': 'auto',
           'grid-row': 'auto', 'max-height': 'none', 'pointer-events': 'auto',
           'position': 'static'}
# element defaults, confirmed against nav.html: div/section -> block, and the
# two that inherit a display from a class they always ship with
DISPLAY = {'nv-body': 'block', 'nv-split': 'block', 'nv-group--empty': 'flex',
           'nv-login': 'inline-flex'}


def is_reset(cls, prop, old, new):
    if old is not None:
        return False
    if INITIAL.get(prop) == new:
        return True
    if prop == 'display':
        for k, v in DISPLAY.items():
            if k in cls and v == new:
                return True
    return False


def main(old, new):
    ro, rn = parse(old), parse(new)
    els = elements(os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'nav.html'))
    total = diffs = resets = 0
    seen = set()
    for w in WIDTHS:
        for n in els:
            for wp in (False, True):
                a = resolve(ro, n, w, wp)
                b = resolve(rn, n, w, wp)
                for p in set(a) | set(b):
                    total += 1
                    if a.get(p) == b.get(p):
                        continue
                    if is_reset(n['cls'], p, a.get(p), b.get(p)):
                        resets += 1
                        continue
                    diffs += 1
                    key = (' '.join(sorted(n['cls'])), p, str(a.get(p)), str(b.get(p)))
                    if key not in seen:
                        seen.add(key)
                        print(f'@{w:<5} .{key[0]:<42} {p:<16} '
                              f'{key[2]:<28} -> {key[3]}')
    print(f'\nelements (incl. state variants): {len(els)}')
    print(f'declaration comparisons        : {total}')
    print(f'identical                      : {total - resets - diffs}')
    print(f'explicit resets to initial     : {resets}')
    print(f'REAL BEHAVIOUR DIFFS           : {diffs}')
    return 1 if diffs else 0


if __name__ == '__main__':
    sys.exit(main(sys.argv[1], sys.argv[2]))
