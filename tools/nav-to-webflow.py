"""nav.html -> Webflow @webflow/XscpData clipboard JSON."""
import re, json, uuid, html as ht, sys
from html.parser import HTMLParser

SRC = 'nav.html'
CREATED_BY = "624c733654cc483428fdcb25"

raw = open(SRC).read()
raw = re.sub(r'<!--.*?-->', '', raw, flags=re.S)

# 1. lift every <svg> out, leave a placeholder
SVGS = []
def _lift(m):
    SVGS.append(m.group(0))
    return '<wfembed data-svgidx="%d"></wfembed>' % (len(SVGS)-1)
raw = re.sub(r'<svg\b.*?</svg>', _lift, raw, flags=re.S)

# 2. parse into a tree
class Node:
    __slots__=('tag','attrs','kids','text')
    def __init__(self,tag,attrs): self.tag=tag; self.attrs=dict(attrs); self.kids=[]; self.text=None
VOID={'br','img','input','meta','link','hr','source','wbr'}
class P(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True); self.root=Node('#root',{}); self.stack=[self.root]
    def handle_starttag(self,t,a):
        n=Node(t,a); self.stack[-1].kids.append(n)
        if t not in VOID: self.stack.append(n)
    def handle_startendtag(self,t,a): self.stack[-1].kids.append(Node(t,a))
    def handle_endtag(self,t):
        if t in VOID: return
        for i in range(len(self.stack)-1,0,-1):
            if self.stack[i].tag==t: del self.stack[i:]; return
    def handle_data(self,d):
        if d.strip(): self.stack[-1].kids.append(('#text', d.strip()))
p=P(); p.feed(raw)

# 3. styles: base + combo chain
styles={}   # name -> {_id, children:set}
order=[]
def style_id(name):
    if name not in styles:
        styles[name]={'_id':str(uuid.uuid4()),'children':[],'comb':''}
        order.append(name)
    return styles[name]['_id']
def register(classes):
    ids=[]
    for i,c in enumerate(classes):
        style_id(c)
        if i>0:
            styles[c]['comb']='&'
            par=classes[i-1]
            if styles[c]['_id'] not in styles[par]['children']:
                styles[par]['children'].append(styles[c]['_id'])
        ids.append(styles[c]['_id'])
    return ids

# 4. emit nodes
nodes=[]
SKIP_ATTR={'class','href','type','xmlns','focusable'}
def xattrs(a):
    out=[]
    for k,v in a.items():
        if k in SKIP_ATTR or k=='id': continue
        if k=='hidden': out.append({'name':'hidden','value':'hidden'}); continue
        if k.startswith('data-') or k.startswith('aria-') or k in ('role',):
            out.append({'name':k,'value':v})
    return out
def base(nid,a):
    return {'devlink':{'runtimeProps':{},'slot':''},'displayName':'',
            'attr':{'id':a.get('id','')},'xattr':xattrs(a),
            'search':{'exclude':False},
            'visibility':{'conditions':[],'keepInHtml':{'tag':'False','val':{}}}}

def build(n):
    """returns node _id"""
    if isinstance(n,tuple):
        i=str(uuid.uuid4()); nodes.append({'_id':i,'text':True,'v':ht.unescape(n[1])}); return i
    a=n.attrs; tag=n.tag
    nid=str(uuid.uuid4())
    cls=register(a.get('class','').split()) if a.get('class') else []
    kids=[build(k) for k in n.kids]
    only_text = len(n.kids)==1 and isinstance(n.kids[0],tuple)

    if tag=='wfembed':
        svg=SVGS[int(a['data-svgidx'])]
        d=base(nid,{}); d.update({'search':{'exclude':True},
            'embed':{'type':'html','meta':{'html':'','div':False,'script':False,'compilable':False,'iframe':False}},
            'insideRTE':False,'content':svg})
        nodes.append({'_id':nid,'type':'HtmlEmbed','tag':'div','classes':cls,'children':[],'v':'','data':d}); return nid
    if tag in ('a','button'):
        url = a.get('href','#')
        d=base(nid,a); d.update({'button':False,'block':'inline','eventIds':[],
                                 'link':{'mode':'external','url':url},'text':only_text})
        nodes.append({'_id':nid,'type':'Link','tag':'a','classes':cls,'children':kids,'data':d}); return nid
    if tag=='ul':
        d=base(nid,a); d.update({'tag':'ul','list':{'type':'list','unstyled':False}})
        nodes.append({'_id':nid,'type':'List','tag':'ul','classes':cls,'children':kids,'data':d}); return nid
    if tag=='li':
        d=base(nid,a); d.update({'list':{'type':'item'},'text':only_text})
        nodes.append({'_id':nid,'type':'ListItem','tag':'li','classes':cls,'children':kids,'data':d}); return nid
    if tag in ('h1','h2','h3','h4','h5','h6'):
        d=base(nid,a); d.update({'tag':tag})
        nodes.append({'_id':nid,'type':'Heading','tag':tag,'classes':cls,'children':kids,'data':d}); return nid
    if tag=='p':
        nodes.append({'_id':nid,'type':'Paragraph','tag':'p','classes':cls,'children':kids,'data':base(nid,a)}); return nid
    # div / span / section / header  -> Block
    wtag = tag if tag in ('header','footer','section','article','aside','nav','main','figure') else 'div'
    d=base(nid,a); d.update({'tag':wtag,'text':only_text})
    nodes.append({'_id':nid,'type':'Block','tag':wtag,'classes':cls,'children':kids,'data':d}); return nid

roots=[build(k) for k in p.root.kids if not isinstance(k,tuple)]

style_list=[{'_id':styles[n]['_id'],'fake':False,'type':'class','name':n,'namespace':'',
             'comb':styles[n]['comb'],'styleLess':'','variants':{},'children':styles[n]['children'],
             'createdBy':CREATED_BY,'origin':None,'selector':None} for n in order]

payload={'type':'@webflow/XscpData','payload':{'nodes':nodes,'styles':style_list,'assets':[],
         'ix1':[],'ix2':{'interactions':[],'events':[],'actionLists':[]}},
         'meta':{'droppedLinks':0,'dynBindRemovedCount':0,'dynListBindRemovedCount':0,
                 'paginationRemovedCount':0,'universalBindingsRemovedCount':0,
                 'unlinkedSymbolCount':0,'codeComponentsRemovedCount':0,'richTextComponentsStripped':False}}

out=json.dumps(payload,separators=(',',':'),ensure_ascii=False)
open(sys.argv[1],'w').write(out)
print("roots           :",len(roots))
print("nodes           :",len(nodes))
print("styles          :",len(style_list))
print("  base          :",sum(1 for s in style_list if s['comb']==''))
print("  combo         :",sum(1 for s in style_list if s['comb']=='&'))
print("svg embeds      :",len(SVGS))
print("xattr total     :",sum(len(n['data'].get('xattr',[])) for n in nodes if 'data' in n))
print("ids             :",sum(1 for n in nodes if 'data' in n and n['data'].get('attr',{}).get('id')))
print("json chars      :",len(out))
