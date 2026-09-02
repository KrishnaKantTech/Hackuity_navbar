#!/usr/bin/env python3
"""Turn nav.css into a Webflow update_style plan.

Emits webflow/import-plan.json: one entry per (style, breakpoint, pseudo) with
the properties to write, `var(--nv-*)` already resolved to Webflow variable ids.
Anything Webflow's Style panel cannot express is listed under `skipped` with a
reason, and stays in nav.css.
"""
import json
import os
import re
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from cascade import parse, parse_text

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
NAVVARS = json.load(open(os.path.join(ROOT, 'webflow/nav-variables.json')))

# --nv-* -> Webflow variable id
VAR = {k: v['id'] for k, v in NAVVARS['variables'].items()}
VAR.update({
    '--nv-accent-9':        'variable-a7054ef3-6528-b5d4-661d-db0a8cc3a1c0',
    '--nv-accent-9-hover':  'variable-3bf39d0f-f014-2068-b66d-7b349bda21e3',
    '--nv-accent-alpha-11': 'variable-4c8c0037-4690-a85c-f65c-0227919c69c0',
    '--nv-violet-alpha-3':  'variable-01164987-b380-abe5-eca7-ef00a0e3e8ad',
    '--nv-gray-4':          'variable-e5d1ebc3-5033-04f7-b97c-acfe18fc2ba5',
    '--nv-gray-alpha-2':    'variable-de2420f8-04cd-fa23-7187-7391af82e8f7',
    '--nv-neutral-alpha-3': 'variable-f72b344d-bf85-ac6d-5051-a3deeb361054',
    '--nv-white-alpha-9':   'variable-5c9af05e-a39c-4822-8593-73070cb1ed65',
    '--nv-text-primary':    'variable-89416626-543b-1133-e9e4-c73e0a5018e4',
    '--nv-text-heading':    'variable-89416626-543b-1133-e9e4-c73e0a5018e4',
    '--nv-text-secondary':  'variable-115345f1-76a3-6880-0a9a-2682d66f0014',
    '--nv-text-disabled':   'variable-37a4eaa2-ee0d-d0ce-47de-e816fb29509e',
    '--nv-text-logo':       'variable-4fa288f6-13b7-62d1-16ac-c1d0a53109b9',
    '--nv-surface':         'variable-473d13b9-3839-2f9f-c072-df36c7ce5a7d',
    '--nv-icon-tile-bg':    'variable-b08ed8ac-523b-f2d1-7a8e-f04731c0dc11',
    '--nv-info-9':          'variable-7e2bafa2-8a6f-6875-7c15-577a62cf254a',
})
LITERAL = {'--nv-accent-contrast': '#ffffff', '--nv-scrim-bg': 'rgba(32, 32, 32, 0.28)'}

# nav.css single class -> Webflow combo chain (from query_styles)
COMBO = {
    'nv-logo--standalone': ['nv-logo'], 'nv-logo--inbar': ['nv-logo'],
    'nv-btn--ghost': ['nv-btn'], 'nv-btn--primary': ['nv-btn'],
    'nv-login': ['nv-btn', 'nv-btn--ghost'],
    'nv-ico--menu': ['nv-ico'], 'nv-ico--close': ['nv-ico'], 'nv-ico--back': ['nv-ico'],
    'nv-cards--loose': ['nv-cards'], 'nv-cards--tight': ['nv-cards'],
    'nv-panel--thirds': ['nv-panel'], 'nv-group--empty': ['nv-group'],
    'nv-card-icon--muted': ['nv-card-icon'], 'nv-tag--plain': ['nv-tag'],
}
BP = {None: 'main', '(min-width:1280px)': 'large', '(min-width:1440px)': 'xl',
      '(max-width:767px)': 'small', '(max-width:479px)': 'tiny'}
PSEUDO_OK = {'hover', 'focus', 'focus-visible', 'active', 'empty',
             'before', 'after', 'visited', 'first-child', 'last-child'}

# properties that stay in nav.css whatever rule they appear in
SKIP_PROP = {
    'transition': 'duration/easing come from --nv-* tokens Webflow cannot type',
    'box-shadow': '--nv-shadow is a composite alias (offset + colour token)',
    'grid-template-areas': 'named areas are not expressible in the Style panel',
    '-webkit-backdrop-filter': 'prefixed property; Webflow writes its own',
    '-webkit-font-smoothing': 'not in the Style panel',
    '-webkit-appearance': 'prefixed property',
    '-webkit-overflow-scrolling': 'prefixed property',
}
# whole rules that stay in nav.css: runtime state combos driven by nav.js
SKIP_RULE = re.compile(r'\.nv-is-(enter|leave|out|open|scrollable|drilled)')
# shorthands in section 2 that reset longhands they never name
RESET_LONGHANDS = {
    'font': ['font-style', 'font-variant', 'font-weight', 'font-stretch',
             'font-size', 'line-height', 'font-family'],
    'border': ['border-width', 'border-style', 'border-color'],
    'list-style': ['list-style-type', 'list-style-position', 'list-style-image'],
    'background': ['background-color', 'background-image', 'background-position',
                   'background-size', 'background-repeat'],
}
BOX = ('padding', 'margin')
SIDES = ('top', 'right', 'bottom', 'left')
CORNERS = ('top-left', 'top-right', 'bottom-right', 'bottom-left')


def split_val(v):
    return re.findall(r'var\([^)]*\)|\S+', v)


def expand(prop, val):
    # `background` with a colour is `background-color` to Webflow — the
    # shorthand hard-errors when a colour variable is bound to it.
    if prop == 'background':
        return [('background-color', 'transparent' if val.strip() == 'none' else val)]
    # Webflow's model spells gap the legacy way. `gap`, `row-gap` and
    # `column-gap` all hard-error when a size variable is bound to them.
    # cascade.parse() has already split the shorthand, so catch the longhands.
    if prop in ('gap', 'row-gap', 'column-gap'):
        p = split_val(val)
        if prop == 'row-gap':
            return [('grid-row-gap', p[0])]
        if prop == 'column-gap':
            return [('grid-column-gap', p[0])]
        return [('grid-row-gap', p[0]), ('grid-column-gap', p[-1])]
    if prop == 'border-radius':
        p = split_val(val)
        if len(p) == 1: p *= 4
        elif len(p) == 2: p = [p[0], p[1], p[0], p[1]]
        elif len(p) == 3: p = [p[0], p[1], p[2], p[1]]
        if len(p) == 4:
            return [(f'border-{c}-radius', x) for c, x in zip(CORNERS, p)]
    if prop in BOX:
        p = split_val(val)
        if len(p) == 1: p *= 4
        elif len(p) == 2: p = [p[0], p[1], p[0], p[1]]
        elif len(p) == 3: p = [p[0], p[1], p[2], p[1]]
        if len(p) == 4:
            return [(f'{prop}-{s}', x) for s, x in zip(SIDES, p)]
    return [(prop, val)]


def as_prop(name, value):
    m = re.fullmatch(r'var\((--nv-[\w-]+)(?:,.*)?\)', value.strip())
    if m:
        tok = m.group(1)
        if tok in VAR:
            return {'property_name': name, 'variable_as_value': VAR[tok]}
        if tok in LITERAL:
            return {'property_name': name, 'property_value': LITERAL[tok]}
        return None
    if 'var(--nv-' in value:
        return None                      # composite token value: leave in CSS
    return {'property_name': name, 'property_value': value}


def classify(sel):
    """-> (style_name, parents, pseudo) or None if Webflow cannot express it."""
    if re.search(r'[ >+~]|\[|:where|\*', sel) or re.match(r'^[a-zA-Z]', sel):
        return None
    m = re.match(r'^((?:\.[-\w]+)+)(?::([-\w]+))?$', sel)
    if not m:
        return None
    classes = m.group(1)[1:].split('.')
    pseudo = m.group(2)
    if pseudo and pseudo not in PSEUDO_OK:
        return None
    if len(classes) == 1:
        name = classes[0]
        return name, COMBO.get(name, []), pseudo
    return classes[-1], classes[:-1], pseudo      # written as a combo already


def source_without_baseline():
    """nav.css with section 2 cut out.

    Section 2 is the component baseline — `color:inherit`, `font:inherit`,
    `appearance:none` and friends, scoped to nv- classes purely to undo
    Webflow's own normalize on <a> and <button>. It has to keep loading AFTER
    Webflow's stylesheet to do its job, so it stays in nav.css. Writing it into
    the Style panel would also mean writing shorthands (`font`, `border`) the
    panel has no field for.
    """
    css = open(os.path.join(ROOT, 'nav.css')).read()
    a = css.index('2. COMPONENT BASELINE')
    b = css.index('3. LOGO')
    return css[:css.rindex('/*', 0, a)] + css[css.rindex('/*', 0, b):]


def baseline_block():
    """{class: {property}} that section 2 re-declares and would now win.

    nav.css loads AFTER Webflow's stylesheet. Anything section 2 still sets —
    `padding:0` on .nv-link/.nv-menu-btn, `padding:0` on the .nv-menu <ul> — now
    lands later in the cascade than the Style panel's value and clobbers it. At
    equal specificity nav.css wins, so those properties cannot be imported.
    A combo (.nv-btn.nv-btn--ghost, 0-2-0) outranks section 2's .nv-btn (0-1-0)
    and is left alone.
    """
    css = open(os.path.join(ROOT, 'nav.css')).read()
    a, b = css.index('2. COMPONENT BASELINE'), css.index('3. LOGO')
    section = css[css.rindex('/*', 0, a):css.rindex('/*', 0, b)]
    block = {}
    for cond, sel, ds in parse_text(section):
        if sel.startswith('@'):
            continue
        for one in (x.strip() for x in sel.split(',')):
            if not re.fullmatch(r'\.[-\w]+', one or ''):
                continue                      # `*`, descendants: cannot collide
            for prop, val in ds:
                names = [p for p, _ in expand(prop, val)]
                names += RESET_LONGHANDS.get(prop, [])
                for p in names:
                    block.setdefault(one[1:], set()).add(p)
    return block


def main():
    plan, skipped = {}, []
    BASELINE = baseline_block()
    import tempfile
    tmp = tempfile.NamedTemporaryFile('w', suffix='.css', delete=False)
    tmp.write(source_without_baseline()); tmp.close()
    for cond, sel, ds in parse(tmp.name):
        if sel.startswith('@') or cond not in BP:
            if not sel.startswith('@'):
                skipped.append({'sel': sel, 'media': cond, 'why': 'media query Webflow has no tier for'})
            continue
        bp = BP[cond]
        for one in (x.strip() for x in sel.split(',')):
            if not one:
                continue
            if one == ':root' or SKIP_RULE.search(one):
                skipped.append({'sel': one, 'bp': bp,
                                'why': 'tokens live in the Nav collection' if one == ':root'
                                       else 'runtime state combo driven by nav.js'})
                continue
            c = classify(one)
            if not c:
                skipped.append({'sel': one, 'bp': bp, 'why': 'selector Webflow cannot express'})
                continue
            name, parents, pseudo = c
            # Equal-specificity collision with the section-2 baseline. A combo
            # (.nv-btn.nv-btn--ghost) or a pseudo (.nv-link:hover) is 0-2-0 and
            # outranks section 2's bare 0-1-0 class, so only the plain case loses.
            blocked = (BASELINE.get(name, set())
                       if not parents and not pseudo else set())
            props, left = [], []
            for prop, val in ds:
                if prop.startswith('--'):
                    continue
                if prop in SKIP_PROP:
                    left.append((prop, SKIP_PROP[prop]))
                    continue
                for p, v in expand(prop, val):
                    if p in blocked:
                        left.append((p, 'section 2 re-declares it after Webflow loads'))
                        continue
                    got = as_prop(p, v)
                    (props.append(got) if got else left.append((p, 'composite token value')))
            if props:
                key = f'{name}|{",".join(parents)}|{bp}|{pseudo or ""}'
                plan.setdefault(key, {'style_name': name, 'parent_style_names': parents,
                                      'breakpoint': bp, 'pseudo': pseudo,
                                      'selector': one, 'properties': []})
                plan[key]['properties'].extend(props)
            for p, why in left:
                skipped.append({'sel': one, 'bp': bp, 'prop': p, 'why': why})

    # A property whose base value had to stay in nav.css cannot have its
    # breakpoint override imported either: the override would sit in an EARLIER
    # stylesheet than the base, and a media query adds no specificity, so the
    # base would win at every width. All tiers of a property travel together.
    partial = {}
    for s_ in skipped:
        if 'prop' in s_ and not s_['sel'].startswith(':'):
            c = classify(s_['sel'])
            if c:
                partial.setdefault(c[0], set()).add(s_['prop'])
    moved = True
    while moved:
        moved = False
        for e in plan.values():
            bad = partial.get(e['style_name'], set())
            keep = [p for p in e['properties'] if p['property_name'] not in bad]
            if len(keep) != len(e['properties']):
                for p in e['properties']:
                    if p['property_name'] in bad:
                        skipped.append({'sel': e['selector'], 'bp': e['breakpoint'],
                                        'prop': p['property_name'],
                                        'why': 'another tier of this property stays in nav.css'})
                e['properties'] = keep
    plan = {k: v for k, v in plan.items() if v['properties']}

    for e in plan.values():                 # last write wins, same as CSS order
        seen = {}
        for pr in e['properties']:
            seen[pr['property_name']] = pr
        e['properties'] = list(seen.values())

    out = {'entries': list(plan.values()), 'skipped': skipped}
    with open(os.path.join(ROOT, 'webflow/import-plan.json'), 'w') as f:
        json.dump(out, f, indent=1)

    n = sum(len(e['properties']) for e in out['entries'])
    print(f'style writes : {len(out["entries"])}   properties: {n}')
    from collections import Counter
    print(f'by breakpoint: {dict(Counter(e["breakpoint"] for e in out["entries"]))}')
    print(f'\nstays in nav.css ({len(skipped)}):')
    for why, c in Counter(s["why"] for s in skipped).most_common():
        print(f'  {c:>3}  {why}')


if __name__ == '__main__':
    main()
