#!/usr/bin/env python3
"""Emit the CSS Webflow will now serve for the navbar, from the pre-strip nav.css.

It is the exact complement of tools/strip_imported.py: whatever the stripper
deleted, this keeps — with the original value text, and with each single class
rewritten to the combo selector Webflow actually generates
(`.nv-btn--ghost` -> `.nv-btn.nv-btn--ghost`), which is a specificity change
the verification has to see.

Used only to prove `webflow.css + stripped nav.css == pre-strip nav.css`.

    python3 tools/emit_webflow_css.py <pre-strip nav.css> > webflow.css
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from build_import import COMBO, classify
from strip_imported import ABSENT, SECTION2, imported_props, props_for, split_body


def wf_selector(sel):
    c = classify(sel)
    if not c:
        return sel
    name, parents, pseudo = c
    return '.' + '.'.join(parents + [name]) + (f':{pseudo}' if pseudo else '')


def keep_body(body, sels, media):
    out = []
    for kind, text, prop in split_body(body):
        if kind != 'decl':
            continue
        val = text.split(':', 1)[1].rstrip(';').strip() if ':' in text else ''
        if prop and all(props_for(prop, val, s, media) for s in sels):
            out.append(f'  {prop}: {val};')
    return out


def walk(css, media=None, in_section2=False, sink=None):
    i, n = 0, len(css)
    while i < n:
        if css.startswith('/*', i):
            i = css.index('*/', i) + 2
            continue
        if css[i] in ' \t\r\n':
            i += 1
            continue
        j = i
        while j < n and css[j] != '{':
            if css.startswith('/*', j):
                j = css.index('*/', j) + 2
                continue
            j += 1
        prelude = css[i:j].strip()
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
        if prelude.startswith('@media'):
            walk(body, prelude[len('@media'):].strip(), in_section2, sink)
        elif not prelude.startswith('@') and not in_section2:
            if imported_props(prelude, media):
                sels_raw = [x.strip() for x in prelude.split(',') if x.strip()]
                lines = keep_body(body, sels_raw, media)
                if lines:
                    sels = [wf_selector(s.strip()) for s in prelude.split(',') if s.strip()]
                    if all(classify(s.strip()) and classify(s.strip())[0] not in ABSENT
                           for s in prelude.split(',') if s.strip()):
                        sink.setdefault(media, []).append(
                            ',\n'.join(sels) + ' {\n' + '\n'.join(lines) + '\n}')
        i = k


def main(path):
    css = open(path).read()
    a, b = css.index(SECTION2[0]), css.index(SECTION2[1])
    head = css[:css.rindex('/*', 0, a)]
    tail = css[css.rindex('/*', 0, b):]
    sink = {}
    walk(head, sink=sink)
    walk(tail, sink=sink)
    order = [None, '(min-width:1280px)', '(min-width:1440px)',
             '(max-width:767px)', '(max-width:479px)']
    out = ["""/* ============================================================================
   HACKUITY NAVBAR  ·  nav-panel.css  ·  GENERATED — DO NOT EDIT BY HAND
   ----------------------------------------------------------------------------
   A local mirror of the rules that now live in the Webflow Style panel.

   Webflow serves these on the real site; this file exists so embed.html and
   preview.html still render the component standing on its own. Load it BEFORE
   nav.css, in the same order Webflow does:

     <link rel="stylesheet" href="nav-panel.css">   <- Webflow's job on the site
     <link rel="stylesheet" href="nav.css">         <- the CDN layer

   It is a SNAPSHOT. Webflow is the source of truth — edit there, then
   regenerate:  python3 tools/emit_webflow_css.py <nav.css@the-import> > nav-panel.css
   Single classes are written as the combo selectors Webflow generates
   (.nv-btn.nv-btn--ghost), so the specificity matches the real site.
   ========================================================================= */"""]
    for m in order:
        if m not in sink:
            continue
        if m is None:
            out.extend(sink[m])
        else:
            out.append(f'@media {m} {{')
            out.extend(sink[m])
            out.append('}')
    print('\n\n'.join(out))


if __name__ == '__main__':
    main(sys.argv[1])
