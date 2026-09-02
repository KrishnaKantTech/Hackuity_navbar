#!/usr/bin/env python3
"""Remove from nav.css every declaration that now lives in the Webflow Style panel.

The mapping is recomputed with build_import's own expand()/as_prop()/classify(),
so the strip and the import cannot drift: a property is removed only if THAT
rule, at THAT breakpoint, actually got it written to Webflow.

Conservative by design:
  · a comma-selector rule is only stripped where EVERY selector in it was imported
  · the two styles Webflow rejected (.nv-panel-wrap, .nv-scrim) are never stripped
  · a comment sitting directly under a removed declaration goes with it
  · a rule left with nothing is dropped, and so is its leading comment
"""
import os
import re
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import json

from build_import import BP, SKIP_PROP, SKIP_RULE, classify, expand

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
# styles that do not exist in Webflow, so their rules stay put
ABSENT = {'nv-panel-wrap', 'nv-scrim'}
SECTION2 = ('2. COMPONENT BASELINE', '3. LOGO')


def imported_props(selector_list, media):
    """Original nav.css property names safe to delete from this rule."""
    if media not in BP:
        return None
    sels = [s.strip() for s in selector_list.split(',') if s.strip()]
    if not sels:
        return None
    per_sel = []
    for s in sels:
        if s == ':root' or SKIP_RULE.search(s):
            return None
        c = classify(s)
        if not c or c[0] in ABSENT:
            return None
        per_sel.append(True)
    return True


def _load_plan():
    """{(style, parents, breakpoint, pseudo): {property}} — what actually shipped.

    Read from the plan rather than recomputed. build_import drops properties for
    reasons this module cannot see (the section-2 collision, and properties whose
    other tier stayed behind), so recomputing here would strip more than was
    imported — which is exactly how the first pass broke .nv-menu and .nv-body.
    """
    plan = json.load(open(os.path.join(ROOT, 'webflow/import-plan.json')))
    out = {}
    for e in plan['entries']:
        key = (e['style_name'], tuple(e['parent_style_names']),
               e['breakpoint'], e['pseudo'])
        out[key] = {p['property_name'] for p in e['properties']}
    return out


PLAN = _load_plan()


def props_for(prop, val, selector=None, media=None):
    """Was this whole declaration carried into Webflow for THIS rule?"""
    if prop.startswith('--') or prop in SKIP_PROP:
        return False
    if selector is None:
        return False
    c = classify(selector)
    if not c:
        return False
    key = (c[0], tuple(c[1]), BP.get(media), c[2])
    got = PLAN.get(key, set())
    return all(p in got for p, _ in expand(prop, val))


def split_body(body):
    """-> [('comment'|'decl'|'ws', text, prop_or_None)] preserving every byte."""
    items, i, n = [], 0, len(body)
    while i < n:
        if body.startswith('/*', i):
            j = body.index('*/', i) + 2
            items.append(('comment', body[i:j], None))
            i = j
        elif body[i] in ' \t\r\n':
            j = i
            while j < n and body[j] in ' \t\r\n':
                j += 1
            items.append(('ws', body[i:j], None))
            i = j
        else:
            depth, j = 0, i
            while j < n:
                if body[j] == '(':
                    depth += 1
                elif body[j] == ')':
                    depth -= 1
                elif body[j] == ';' and depth == 0:
                    j += 1
                    break
                elif body.startswith('/*', j) and depth == 0:
                    break
                j += 1
            text = body[i:j]
            prop = text.split(':', 1)[0].strip() if ':' in text else None
            items.append(('decl', text, prop))
            i = j
    return items


def strip_body(body, keep_all, sels=(), media=None):
    out, drop_next_comment = [], False
    for kind, text, prop in split_body(body):
        if kind == 'decl':
            val = text.split(':', 1)[1].rstrip(';').strip() if ':' in text else ''
            if (not keep_all and prop
                    and all(props_for(prop, val, s, media) for s in sels)):
                drop_next_comment = True
                if out and out[-1][0] == 'ws':
                    out.pop()
                continue
            drop_next_comment = False
        elif kind == 'comment' and drop_next_comment:
            if out and out[-1][0] == 'ws':
                out.pop()
            drop_next_comment = False
            continue
        elif kind == 'ws':
            pass
        out.append((kind, text))
    if not any(k == 'decl' for k, _ in out):
        return None
    return ''.join(t for _, t in out)


def walk(css, media=None, in_section2=False):
    """Rewrite one nesting level, returning the new text."""
    out, i, n = [], 0, len(css)
    while i < n:
        if css.startswith('/*', i):
            j = css.index('*/', i) + 2
            out.append(('comment', css[i:j]))
            i = j
            continue
        if css[i] in ' \t\r\n':
            j = i
            while j < n and css[j] in ' \t\r\n':
                j += 1
            out.append(('ws', css[i:j]))
            i = j
            continue
        # a rule or at-block: read the prelude then the braced body
        j = i
        while j < n and css[j] != '{':
            if css.startswith('/*', j):
                j = css.index('*/', j) + 2
                continue
            j += 1
        prelude = css[i:j]
        depth, k = 0, j
        while k < n:
            if css[k] == '{':
                depth += 1
            elif css[k] == '}':
                depth -= 1
                if depth == 0:
                    k += 1
                    break
            k += 1
        body = css[j + 1:k - 1]
        sel = prelude.strip()
        if sel.startswith('@media'):
            cond = sel[len('@media'):].strip()
            inner = walk(body, cond, in_section2)
            out.append(('rule', prelude + '{' + inner + '}'))
        elif sel.startswith('@'):
            out.append(('rule', prelude + '{' + body + '}'))
        else:
            keep_all = in_section2 or not imported_props(sel, media)
            sels = [x.strip() for x in sel.split(',') if x.strip()]
            new = strip_body(body, keep_all, sels, media)
            if new is None:
                if out and out[-1][0] == 'ws':
                    out.pop()
                if out and out[-1][0] == 'comment' and not out[-1][1].startswith('/* ==='):
                    out.pop()
                    if out and out[-1][0] == 'ws':
                        out.pop()
                i = k
                continue
            out.append(('rule', prelude + '{' + new + '}'))
        i = k
    return ''.join(t for _, t in out)


def main():
    path = os.path.join(ROOT, 'nav.css')
    css = open(path).read()
    a = css.index(SECTION2[0])
    b = css.index(SECTION2[1])
    head = css[:css.rindex('/*', 0, a)]
    baseline = css[css.rindex('/*', 0, a):css.rindex('/*', 0, b)]
    tail = css[css.rindex('/*', 0, b):]
    out = walk(head) + baseline + walk(tail)

    # .nv-panel-wrap never appears in nav.html — dead since the native port.
    out = out.replace("""
.nv-panel-wrap {
  display: flex;
  align-items: flex-start;
  gap: var(--nv-space-6)
}

/* 32 */
""", "\n")

    # section 3 has no rules left; every logo declaration went to the panel
    out = out.replace("""   3. LOGO — box 175.535 x 34 (Figma I153:845;5531:23300). Children are % of the
   box, so the mobile 222 x 43 lockup is the same asset at a bigger font-size.""",
"""   3. LOGO — now entirely in the Webflow Style panel.
   The box is 175.535 x 34 (Figma I153:845;5531:23300) and the children are
   percentages of it, so the mobile 222 x 43 lockup is the same asset at a
   bigger font-size. Edit .nv-logo / .nv-logo-mark / .nv-logo-word in Webflow.""")

    out = re.sub(r'\n{4,}', '\n\n\n', out)
    open(path, 'w').write(out)
    print(f'{len(css.splitlines())} -> {len(out.splitlines())} lines')


if __name__ == '__main__':
    main()
