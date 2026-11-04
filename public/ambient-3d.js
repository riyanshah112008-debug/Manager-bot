(() => {
  "use strict";
  const canvas = document.getElementById("starry-ambient");
  if (!canvas) return;
  const ctx = canvas.getContext("2d", { alpha: true, desynchronized: true });
  if (!ctx) return;
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const mobile = matchMedia("(max-width: 700px)").matches;
  let w=0,h=0,dpr=1,last=0,raf=0,px=0,py=0,tx=0,ty=0;
  const particles=[];
  const rand=(a,b)=>a+Math.random()*(b-a);
  function resize(){
    w=innerWidth;h=innerHeight;dpr=Math.min(devicePixelRatio||1,mobile?1.2:1.6);
    canvas.width=Math.round(w*dpr);canvas.height=Math.round(h*dpr);
    ctx.setTransform(dpr,0,0,dpr,0,0);
    particles.length=0;
    for(let i=0;i<(mobile?42:95);i++)particles.push({x:rand(0,w),y:rand(0,h),z:rand(.2,1),r:rand(.45,1.5),p:rand(0,6.28)});
  }
  function line(x1,y1,x2,y2,color,width=1){ctx.beginPath();ctx.moveTo(x1,y1);ctx.lineTo(x2,y2);ctx.strokeStyle=color;ctx.lineWidth=width;ctx.stroke();}
  function draw(now){
    if(!reduced&&now-last<30){raf=requestAnimationFrame(draw);return;}
    last=now;ctx.clearRect(0,0,w,h);
    const t=reduced?1:now*.00016;
    px+=(tx-px)*.035;py+=(ty-py)*.035;
    const cx=w*(mobile?.77:.79)+px*20,cy=h*(mobile?.24:.29)+py*14;
    const r=Math.min(w,h)*(mobile?.19:.235);
    // Soft cyan reactor glow.
    const glow=ctx.createRadialGradient(cx,cy,r*.08,cx,cy,r*1.7);
    glow.addColorStop(0,"rgba(43,194,231,.16)");glow.addColorStop(.55,"rgba(48,131,211,.055)");glow.addColorStop(1,"rgba(48,131,211,0)");
    ctx.fillStyle=glow;ctx.beginPath();ctx.arc(cx,cy,r*1.7,0,Math.PI*2);ctx.fill();
    // Holographic wireframe sphere.
    const tilt=-.34,rot=t*.62;
    const project=(lat,lon)=>{
      const a=lon+rot,x=Math.cos(lat)*Math.cos(a),y=Math.sin(lat),z=Math.cos(lat)*Math.sin(a);
      const yy=x*Math.sin(tilt)+y*Math.cos(tilt),xx=x*Math.cos(tilt)-y*Math.sin(tilt),p=1/(1.7-z*.38);
      return [cx+xx*r*p,cy+yy*r*p,z];
    };
    for(let i=1;i<15;i++){
      const lat=-Math.PI/2+Math.PI*i/15;ctx.beginPath();
      for(let j=0;j<=64;j++){const q=project(lat,j*Math.PI*2/64);if(!j)ctx.moveTo(q[0],q[1]);else ctx.lineTo(q[0],q[1]);}
      ctx.strokeStyle="rgba(100,220,246,"+(.075+i/15*.065)+")";ctx.lineWidth=.75;ctx.stroke();
    }
    for(let j=0;j<32;j++){
      ctx.beginPath();
      for(let i=0;i<=40;i++){const q=project(-Math.PI/2+Math.PI*i/40,j*Math.PI*2/32);if(!i)ctx.moveTo(q[0],q[1]);else ctx.lineTo(q[0],q[1]);}
      ctx.strokeStyle="rgba(121,179,255,.12)";ctx.lineWidth=.65;ctx.stroke();
    }
    // Concentric scanner rings and rotating orbit.
    ctx.save();ctx.translate(cx,cy);ctx.rotate(-.26);
    [1.18,1.34,1.49].forEach((scale,i)=>{
      ctx.beginPath();ctx.ellipse(0,0,r*scale,r*(.34+i*.025),0,0,Math.PI*2);
      ctx.strokeStyle=i===1?"rgba(72,220,247,.28)":"rgba(113,165,255,.17)";ctx.lineWidth=i===1?1.2:.8;ctx.stroke();
    });
    ctx.rotate(t*1.5);ctx.beginPath();ctx.ellipse(0,0,r*1.53,r*.39,0,.15,Math.PI*.86);
    ctx.strokeStyle="rgba(107,231,249,.5)";ctx.lineWidth=1.3;ctx.stroke();
    ctx.restore();
    // Four technical corner brackets around the hologram.
    const b=r*1.62;
    [[-1,-1],[1,-1],[-1,1],[1,1]].forEach(([sx,sy])=>{
      const x=cx+sx*b*.72,y=cy+sy*b*.48,l=13;
      line(x,y,x-sx*l,y,"rgba(101,222,247,.45)",1.2);line(x,y,x,y-sy*l,"rgba(101,222,247,.45)",1.2);
    });
    // Perspective data grid below the reactor.
    const horizon=h*.55,base=h*1.12;
    ctx.save();ctx.beginPath();ctx.rect(0,horizon,w,h-horizon);ctx.clip();
    for(let i=0;i<17;i++){
      const u=i/16, x=w/2+(u-.5)*w*2.25;
      line(w/2+(u-.5)*w*.16,horizon,x,base,"rgba(70,196,231,"+(.055+(i%4===0?.055:0))+")",.75);
    }
    for(let i=0;i<13;i++){
      const f=i/12,y=horizon+(base-horizon)*f*f;
      line(0,y,w,y,"rgba(70,196,231,"+(.035+f*.045)+")",.7);
    }
    ctx.restore();
    // Floating data particles and subtle connecting traces.
    const visible=[];
    for(const p of particles){
      const drift=reduced?0:t*12*p.z;
      const x=(p.x+drift)%w,y=p.y+Math.sin(t*1.2+p.p)*5*p.z;
      visible.push([x,y,p]);
      const a=.12+(Math.sin(t*2+p.p)+1)*.11;
      ctx.beginPath();ctx.arc(x,y,p.r,0,Math.PI*2);ctx.fillStyle="rgba(160,231,255,"+a+")";ctx.fill();
    }
    for(let i=0;i<visible.length;i+=7){
      const a=visible[i],b=visible[(i+3)%visible.length];
      if(Math.hypot(a[0]-b[0],a[1]-b[1])<150)line(a[0],a[1],b[0],b[1],"rgba(80,198,233,.08)",.6);
    }
    if(!reduced)raf=requestAnimationFrame(draw);
  }
  addEventListener("resize",resize,{passive:true});
  addEventListener("pointermove",e=>{tx=(e.clientX/Math.max(w,1)-.5)*2;ty=(e.clientY/Math.max(h,1)-.5)*2;},{passive:true});
  resize();draw(0);if(reduced)cancelAnimationFrame(raf);
})();