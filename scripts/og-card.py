# The shared link-preview card (public/og/fallback.png, 1200x630): used for the
# home page and for any place without its own illustration card. Drawn with
# Pillow in Pretendard GOV (from the pretendard-gov npm package) so it
# matches the app and shows the claim mark (docs/UI-DIRECTION.md).
# Run from the project root:  python scripts/og-card.py public/og/fallback.png

import sys
from PIL import Image, ImageDraw, ImageFont
F='node_modules/pretendard-gov/dist/public/static/alternative/PretendardGOV-'
def font(w,s): return ImageFont.truetype(F+w+'.ttf', s)
W,H=1200,630
S=2  # supersample
img=Image.new('RGB',(W*S,H*S),'#F7F7F8'); d=ImageDraw.Draw(img)
INK='#1F2328'; BODY='#3F444A'; MUTED='#6B7280'; MS='#616875'; GREEN='#087F5B'
x=80*S
# eyebrow with tracking
ey=font('Bold',22*S); cx=x
for ch in 'K-FOOD MAP':
    d.text((cx,86*S),ch,font=ey,fill=GREEN); cx+=d.textlength(ch,font=ey)+3.2*S
t=font('ExtraBold',70*S)
d.text((x,130*S),'Vegan and halal food',font=t,fill=INK)
d.text((x,214*S),'across Korea.',font=t,fill=INK)
d.text((x,318*S),'Every dietary claim says how sure we are.',font=font('Regular',32*S),fill=BODY)
# claim chips
lab=font('SemiBold',25*S); lvl=font('Medium',21*S)
chips=[('Fully vegan','Confirmed','solid'),('Halal-friendly','Reported','outline'),('Vegan options','Our reading','dashed')]
cy=412*S; h=58*S; pad=20*S; gap=14*S
def dashed_rrect(box,r,col,w,dash=10*S,space=7*S):
    x0,y0,x1,y1=box
    # straight edges
    def seg(a,b,horiz,fixed):
        p=a
        while p<b:
            q=min(p+dash,b)
            if horiz: d.line([(p,fixed),(q,fixed)],fill=col,width=w)
            else: d.line([(fixed,p),(fixed,q)],fill=col,width=w)
            p=q+space
    seg(x0+r,x1-r,True,y0); seg(x0+r,x1-r,True,y1); seg(y0+r,y1-r,False,x0); seg(y0+r,y1-r,False,x1)
    for (cx0,cy0,a0) in [(x0,y0,180),(x1-2*r,y0,270),(x1-2*r,y1-2*r,0),(x0,y1-2*r,90)]:
        d.arc([cx0,cy0,cx0+2*r,cy0+2*r],a0,a0+90,fill=col,width=w)
xx=x
for name,level,kind in chips:
    wn=d.textlength(name,font=lab); wd=d.textlength('·',font=lvl); wl=d.textlength(level,font=lvl)
    wtot=pad+wn+10*S+wd+10*S+wl+pad
    box=[xx,cy,xx+wtot,cy+h]
    if kind=='solid':
        d.rounded_rectangle(box,radius=12*S,fill=INK)
        c1,c2='#FFFFFF','#D5D9DF'
    elif kind=='outline':
        d.rounded_rectangle(box,radius=12*S,fill='#FFFFFF',outline=MUTED,width=2*S)
        c1,c2=INK,MS
    else:
        d.rounded_rectangle(box,radius=12*S,fill='#FFFFFF')
        dashed_rrect(box,12*S,MS,3*S)
        c1,c2=INK,MS
    ty=cy+h/2
    d.text((xx+pad,ty),name,font=lab,fill=c1,anchor='lm')
    d.text((xx+pad+wn+10*S,ty),'·',font=lvl,fill=c2,anchor='lm')
    d.text((xx+pad+wn+10*S+wd+10*S,ty+1*S),level,font=lvl,fill=c2,anchor='lm')
    xx+=wtot+gap
print('chips end x', xx/S)
d.text((x,540*S),'kfoodmap.vercel.app',font=font('Medium',24*S),fill=MUTED)
# thin top rule in brand green
d.rectangle([0,0,W*S,8*S],fill=GREEN)
img=img.resize((W,H),Image.LANCZOS)
img.save(sys.argv[1],optimize=True)
