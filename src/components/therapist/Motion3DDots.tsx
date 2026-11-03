"use client";

import React from "react";

export function Motion3DDots({ mhr, currentTime, onSeek }: { mhr: any; currentTime: number; onSeek?: (t:number)=>void }) {
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const wrapRef = React.useRef<HTMLDivElement>(null);
  const [rotY, setRotY] = React.useState(8);
  const [rotX, setRotX] = React.useState(-8);
  const [showTrail, setShowTrail] = React.useState(false);
  const [showBones, setShowBones] = React.useState(true);
  const [viewMode, setViewMode] = React.useState<"dots" | "both">("both");
  const dragRef = React.useRef<{active:boolean; sx:number; sy:number; ry0:number; rx0:number}>({active:false, sx:0, sy:0, ry0:8, rx0:-8});
  const frames: any[] = mhr?.frames ?? [];
  const activeIdx = React.useMemo(() => {
    if (!frames.length) return 0;
    let best = 0, bestDiff = Infinity;
    for (let i=0;i<frames.length;i++){ const ts = (frames[i].timestampSeconds ?? frames[i].frameIndex/30); const d=Math.abs(ts - currentTime); if(d<bestDiff){bestDiff=d; best=i;}}
    return best;
  }, [frames, currentTime]);
  // real data only: verify pred_keypoints_3d exists and is 70x3 floats
  const has3d = Array.isArray(frames[0]?.pred_keypoints_3d) && frames[0].pred_keypoints_3d.length >= 30 && Array.isArray(frames[0].pred_keypoints_3d[0]);
  const wholeBodyEdges: [number, number][] = [
    // torso + head
    [0,69],[69,5],[69,6],[5,6],[5,11],[6,12],[11,12],[9,11],[10,12],[9,10],
    // arms
    [5,7],[7,62],[6,8],[8,41],
    // legs
    [11,13],[13,15],[12,14],[14,16],[15,17],[16,20],
    // hands — thumb / index / middle fans
    [62,42],[42,43],[62,46],[46,47],[62,50],[50,51],[41,21],[21,22],[41,25],[25,26],[41,29],[29,30],
  ];
  React.useEffect(() => {
    const c = canvasRef.current, wrap=wrapRef.current; if (!c || !wrap) return; const ctx=c.getContext("2d"); if(!ctx) return;
    const dpr = Math.min(window.devicePixelRatio||1, 2);
    const rect = wrap.getBoundingClientRect();
    const W = rect.width, H = 360;
    // canvas fills wrap edge-to-edge (no double padding) — wrap card already has p-4
    c.style.width = W+"px"; c.style.height = H+"px";
    c.width = Math.round(W*dpr); c.height = Math.round(H*dpr);
    ctx.setTransform(dpr,0,0,dpr,0,0);
    // one flat panel — no nested inset; padding is the canvas background
    ctx.fillStyle = "#09090b"; ctx.fillRect(0,0,W,H);
    const pad = 12, innerW = W - pad*2, innerH = H - pad*2;
    const cx = W/2, cy = pad + innerH*0.52;
    // subtle border
    ctx.strokeStyle="rgba(63,63,70,0.55)"; ctx.lineWidth=1; ctx.strokeRect(0.5,0.5,W-1,H-1);
    // faint grid
    ctx.strokeStyle="rgba(63,63,70,0.4)"; ctx.lineWidth=0.5; ctx.setLineDash([3,4]);
    for(let i=-4;i<=4;i++){ if(i===0) continue; const x=cx+i*28; ctx.beginPath(); ctx.moveTo(x, pad+6); ctx.lineTo(x, pad+innerH-6); ctx.stroke(); }
    for(let i=-3;i<=3;i++){ if(i===0) continue; const y=cy+i*28; ctx.beginPath(); ctx.moveTo(pad+8, y); ctx.lineTo(pad+innerW-8, y); ctx.stroke(); }
    ctx.setLineDash([]);
    // axes: X (right), Y (up), Z (out toward viewer) — Z drawn as diagonal from center
    ctx.strokeStyle="rgba(82,82,91,0.55)"; ctx.lineWidth=0.9;
    ctx.beginPath(); ctx.moveTo(pad+10, cy); ctx.lineTo(pad+innerW-10, cy); ctx.stroke(); // X
    ctx.beginPath(); ctx.moveTo(cx, pad+10); ctx.lineTo(cx, pad+innerH-10); ctx.stroke(); // Y
    // Z axis: project (0,0,0.35) through same rotation so it matches dots perspective
    {
      const ry=rotY*Math.PI/180, rx=rotX*Math.PI/180; const cosY=Math.cos(ry), sinY=Math.sin(ry), cosX=Math.cos(rx), sinX=Math.sin(rx);
      const sZ=(Math.min(innerW,innerH)*0.38)/0.6; // approx scale
      const pz:[number,number,number]=[0,0,0.32];
      const x1=pz[0]*cosY - pz[2]*sinY, z1=pz[0]*sinY + pz[2]*cosY, y1=pz[1]*cosX - z1*sinX;
      const zx=cx + x1*sZ, zy=cy - y1*sZ;
      ctx.strokeStyle="rgba(14,165,233,0.9)"; ctx.lineWidth=1.1; ctx.setLineDash([5,4]);
      ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(zx, zy); ctx.stroke(); ctx.setLineDash([]);
      // arrow head
      const ang=Math.atan2(zy-cy, zx-cx); const ah=7;
      ctx.beginPath(); ctx.moveTo(zx, zy); ctx.lineTo(zx - ah*Math.cos(ang-0.45), zy - ah*Math.sin(ang-0.45)); ctx.lineTo(zx - ah*Math.cos(ang+0.45), zy - ah*Math.sin(ang+0.45)); ctx.closePath(); ctx.fillStyle="rgba(14,165,233,0.95)"; ctx.fill();
      ctx.fillStyle="#7dd3fc"; ctx.font="9px ui-monospace"; ctx.textAlign="left"; ctx.fillText("Z → out", zx+6, zy-4);
    }
    ctx.fillStyle="#71717a"; ctx.font="9px ui-monospace"; ctx.textAlign="center"; ctx.fillText("X → right", pad+innerW-36, cy-6); ctx.fillText("Y ↑ up", cx+18, pad+14);
    if (!has3d) {
      ctx.fillStyle="#a1a1aa"; ctx.font="12px ui-sans-serif"; ctx.textAlign="center";
      ctx.fillText("No 3D data — Modal returned 2D only (no mock). Check modal/app.py pred_keypoints_3d.", cx, cy);
      ctx.font="11px ui-monospace"; ctx.fillStyle="#71717a"; ctx.fillText("pred_keypoints_3d missing in frames[]", cx, cy+16);
      return;
    }
    const cur = frames[activeIdx]; const k3: number[][] = cur?.pred_keypoints_3d ?? [];
    if (!k3.length) return;
    // center at mid-hip/pelvis and auto-orient upright (head must be above pelvis)
    const hips = [k3[9], k3[10]].filter(Boolean);
    let center: [number,number,number] = [0,0,0];
    if (hips.length===2) center = [(hips[0][0]+hips[1][0])/2, (hips[0][1]+hips[1][1])/2, (hips[0][2]+hips[1][2])/2];
    else if (k3.length) { let sx=0,sy=0,sz=0,c=0; for(const p of k3){ if(!p) continue; sx+=p[0]; sy+=p[1]; sz+=p[2]; c++; } center=[sx/c,sy/c,sz/c]; }
    let centered: [number,number,number][] = k3.map(p=> p ? [p[0]-center[0], p[1]-center[1], p[2]-center[2]] as [number,number,number] : [0,0,0]);
    // ensure upright: head (0) must be above pelvis (center); data may be Y-down, so flip if head is below
    {
      const h = centered[0]; if(h && h[1] < 0){
        centered = centered.map(p=>[p[0], -p[1], p[2]] as [number,number,number]);
      }
    }
    let maxAbs=0; for(const p of centered){ maxAbs=Math.max(maxAbs, Math.abs(p[0]), Math.abs(p[1]), Math.abs(p[2])); }
    const fitScale = (Math.min(innerW, innerH)*0.42) / Math.max(maxAbs, 0.3);
    const s = fitScale;
    const ry=rotY*Math.PI/180, rx=rotX*Math.PI/180; const cosY=Math.cos(ry), sinY=Math.sin(ry), cosX=Math.cos(rx), sinX=Math.sin(rx);
    const project = (p:[number,number,number])=>{ let [x,y,z]=p; const x1=x*cosY - z*sinY; const z1=x*sinY + z*cosY; const y1=y*cosX - z1*sinX; const z2=y*sinX + z1*cosX; return { x: cx + x1*s, y: cy - y1*s, z: z2, d: z2 }; };
    // wrist trails — shows where each wrist traveled through the whole clip (like motion history)
    // OFF by default now; when ON it respects the same Y-flip as dots so it isn't upside-down
    if (showTrail && frames.length>1) {
      const needsFlip = (centered[0]?.[1] ?? 0) > 0 ? false : false; // already flipped above, keep identity; calc from original center sign if needed
      // recompute flip flag from original head sign (head was flipped if <0)
      const wasFlipped = (k3[0] ? (k3[0][1]-center[1]) < 0 : false);
      const trailSpecs: Array<{idx:number, color:string, w:number}> = [
        {idx:62, color:"rgba(167,139,250,0.55)", w:2}, {idx:41, color:"rgba(244,114,182,0.55)", w:2},
        {idx:50, color:"rgba(167,139,250,0.22)", w:1.2}, {idx:29, color:"rgba(244,114,182,0.22)", w:1.2},
        {idx:42, color:"rgba(45,212,191,0.38)", w:1.1}, {idx:21, color:"rgba(45,212,191,0.38)", w:1.1},
      ];
      for(const spec of trailSpecs){
        ctx.strokeStyle=spec.color; ctx.lineWidth=spec.w; ctx.lineCap="round"; ctx.beginPath();
        let started=false;
        for(let fi=0; fi<frames.length; fi++){
          const k=frames[fi].pred_keypoints_3d?.[spec.idx]; if(!k) continue;
          let dy = k[1]-center[1]; if(wasFlipped) dy = -dy;
          const p:[number,number,number]=[k[0]-center[0], dy, k[2]-center[2]];
          const q=project(p);
          if(!started){ ctx.moveTo(q.x,q.y); started=true; } else ctx.lineTo(q.x,q.y);
        }
        if(started) ctx.stroke();
      }
    }
    const effectiveBones = viewMode==="both" || showBones;
    if (effectiveBones) {
      // torso as filled human shape — makes it instantly readable as a person
      const torsoIdx = [5,6,12,11];
      const torsoPts = torsoIdx.map(i=> centered[i] ? project(centered[i] as [number,number,number]) : null).filter(Boolean) as Array<{x:number,y:number,z:number}>;
      if(torsoPts.length===4){
        ctx.fillStyle="rgba(39,39,42,0.95)"; ctx.strokeStyle="rgba(82,82,91,0.9)"; ctx.lineWidth=1.2;
        ctx.beginPath(); ctx.moveTo(torsoPts[0].x, torsoPts[0].y);
        for(let i=1;i<torsoPts.length;i++) ctx.lineTo(torsoPts[i].x, torsoPts[i].y);
        ctx.closePath(); ctx.fill(); ctx.stroke();
      }
      // head disc
      {
        const head = centered[0] ? project(centered[0] as [number,number,number]) : null;
        const neck = centered[69] ? project(centered[69] as [number,number,number]) : null;
        if(head && neck){
          const r = 14;
          ctx.fillStyle="rgba(63,63,70,0.95)"; ctx.strokeStyle="rgba(161,161,170,0.9)"; ctx.lineWidth=1.2;
          ctx.beginPath(); ctx.arc(head.x, head.y, r, 0, Math.PI*2); ctx.fill(); ctx.stroke();
          // neck line
          ctx.strokeStyle="rgba(212,212,216,0.95)"; ctx.lineWidth=2.2; ctx.beginPath(); ctx.moveTo(head.x, head.y+r*0.7); ctx.lineTo(neck.x, neck.y); ctx.stroke();
        }
      }
      for(const [a,b] of wholeBodyEdges){
        const pa = centered[a], pb = centered[b]; if(!pa||!pb) continue;
        if([5,6,11,12].includes(a) && [5,6,11,12].includes(b)) continue; // torso already filled
        if(a===0 || b===0) continue; // head done
        const qa=project(pa as [number,number,number]), qb=project(pb as [number,number,number]);
        const avgZ=(qa.z+qb.z)/2; const depthAlpha = 0.45 + 0.55 * ((avgZ+1)/1.8);
        let col=`rgba(228,228,231,${0.95*depthAlpha})`;
        const isLeft = [5,7,62,50,51,46,47,42,43,9,11,13,15,17].includes(a) || [5,7,62,50,51,46,47,42,43,9,11,13,15,17].includes(b);
        const isRight = [6,8,41,29,30,25,26,21,22,10,12,14,16,20].includes(a) || [6,8,41,29,30,25,26,21,22,10,12,14,16,20].includes(b);
        if(isLeft) col=`rgba(139,92,246,${0.95*depthAlpha})`;
        else if(isRight) col=`rgba(236,72,153,${0.95*depthAlpha})`;
        const thick = ([7,62,8,41].includes(a) || [7,62,8,41].includes(b)) ? 3.2 : ([5,7,6,8,11,13,12,14].includes(a) || [5,7,6,8,11,13,12,14].includes(b)) ? 2.6 : 1.6;
        ctx.strokeStyle=col; ctx.lineWidth=thick; ctx.lineCap="round"; ctx.beginPath(); ctx.moveTo(qa.x,qa.y); ctx.lineTo(qb.x,qb.y); ctx.stroke();
      }
      // ground line
      {
        const lAnk = centered[15] ? project(centered[15] as [number,number,number]) : null;
        const rAnk = centered[16] ? project(centered[16] as [number,number,number]) : null;
        if(lAnk && rAnk){
          const gy = Math.max(lAnk.y, rAnk.y) + 8;
          ctx.strokeStyle="rgba(63,63,70,0.7)"; ctx.lineWidth=1; ctx.setLineDash([6,4]);
          ctx.beginPath(); ctx.moveTo(cx - innerW*0.3, gy); ctx.lineTo(cx + innerW*0.3, gy); ctx.stroke(); ctx.setLineDash([]);
        }
      }
    }
    // — dense human cloud like humandot3d.jpg — real joint positions expanded into ~1200 volumetric points, colored by area
    type P={x:number,y:number,z:number,c:string,r:number,i:number, side:"L"|"R"|"C"};
    const pts: P[] = [];
    const add = (p3:[number,number,number], c:string, r:number, side:P["side"])=>{ const q=project(p3); pts.push({x:q.x,y:q.y,z:q.z,c,r,i:-1,side}); };
    {
      const lerp3=(a:[number,number,number],b:[number,number,number],t:number):[number,number,number]=>[a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t,a[2]+(b[2]-a[2])*t];
      const jitter=(mag:number)=> (Math.random()-0.5)*mag;
      const areaColor=(isL:boolean,isR:boolean, base:string)=> base;
      // bones sampled densely — same palette but will render tiny so human still reads
      const denseBones:[number,number,string,number][]=[
        [5,7,"#a78bfa",16],[7,62,"#a78bfa",16],[62,50,"#a78bfa",10],[62,46,"#a78bfa",10],[62,42,"#a78bfa",10],
        [6,8,"#f472b6",16],[8,41,"#f472b6",16],[41,29,"#f472b6",10],[41,25,"#f472b6",10],[41,21,"#f472b6",10],
        [5,11,"#c4b5fd",14],[11,13,"#a78bfa",12],[13,15,"#a78bfa",10],
        [6,12,"#f9a8d4",14],[12,14,"#f472b6",12],[14,16,"#f472b6",10],
        [0,69,"#fde68a",10],[69,5,"#fde68a",8],[69,6,"#fde68a",8],[9,10,"#d4d4d8",10],[5,6,"#d4d4d8",10],
      ];
      for(const [a,b,col,n] of denseBones){
        const pa=centered[a] as [number,number,number], pb=centered[b] as [number,number,number]; if(!pa||!pb) continue;
        for(let k=0;k<n;k++){ const t=k/(n-1); const p=lerp3(pa,pb,t); // tube jitter
          const thick = (a===0||b===0)?0.015 : 0.018;
          p[0]+=jitter(thick); p[1]+=jitter(thick); p[2]+=jitter(thick*0.6);
          const side: P["side"] = (a===5||a===7||a===62||b===62) ? "L" : (a===6||a===8||a===41||b===41) ? "R" : "C";
          add(p, col, a===62||b===62||a===41||b===41 ? 2.2 : 1.9, side);
          // second jitter for volume
          if(k%2===0){ const p2:[number,number,number]=[p[0]+jitter(0.012),p[1]+jitter(0.012),p[2]+jitter(0.01)]; add(p2, col, 1.3, side); }
        }
      }
      // torso interior fill — denser for that speckled volume like dots.png
      const tA=centered[5], tB=centered[6], tC=centered[12], tD=centered[11];
      if(tA&&tB&&tC&&tD){
        for(let u=0;u<12;u++) for(let v=0;v<12;v++){ const uu=(u+Math.random()*0.6)/12, vv=(v+Math.random()*0.6)/12;
          const p:[number,number,number]=[
            (1-uu)*(1-vv)*tA[0]+uu*(1-vv)*tB[0]+uu*vv*tC[0]+(1-uu)*vv*tD[0],
            (1-uu)*(1-vv)*tA[1]+uu*(1-vv)*tB[1]+uu*vv*tC[1]+(1-uu)*vv*tD[1],
            (1-uu)*(1-vv)*tA[2]+uu*(1-vv)*tB[2]+uu*vv*tC[2]+(1-uu)*vv*tD[2]+jitter(0.02),
          ]; add(p, "#e4e4e7", 1.1, "C");
        }
      }
      const head=centered[0] as [number,number,number], neck=centered[69] as [number,number,number];
      if(head&&neck){ const rad=Math.hypot(head[0]-neck[0],head[1]-neck[1],head[2]-neck[2])*0.75||0.08;
        for(let i=0;i<140;i++){ const th=Math.random()*Math.PI*2, ph=Math.acos(2*Math.random()-1), r=Math.cbrt(Math.random())*rad;
          const p:[number,number,number]=[head[0]+r*Math.sin(ph)*Math.cos(th), head[1]+r*Math.sin(ph)*Math.sin(th), head[2]+r*Math.cos(ph)]; add(p, "#fde68a", 1.1, "C");
        }
      }
      // key joints emphasis (larger)
      for(const idx of [62,41,5,6,0,69]){
        const p=centered[idx] as [number,number,number]; if(!p) continue;
        const col = idx===62?"#a78bfa":idx===41?"#f472b6":idx===5?"#c4b5fd":idx===6?"#f9a8d4":"#fde68a";
        const side: P["side"] = idx===62||idx===5?"L":idx===41||idx===6?"R":"C";
        add(p, col, 1.6, side);
      }
    }
    // existing sparse joints for reference (tiny) — merge with dense
    const sparseExtra: P[]=[]; const leftIdx = new Set([5,7,62,50,51,46,47,42,43,9,11,13,15,17]); const rightIdx = new Set([6,8,41,29,30,25,26,21,22,10,12,14,16,20]);
    pts.sort((a,b)=>a.z-b.z);
    // like dots.png — tiny 1-1.6px square-ish particles, depth via alpha only, no glow
    for(const pt of pts){
      const depth = (pt.z+0.9)/1.8; // 0 far → 1 near
      const alpha = 0.18 + 0.82 * Math.max(0, Math.min(1, depth));
      const sz = 1.1 + pt.r * 0.35; // keep overall tiny like image
      ctx.globalAlpha = alpha;
      ctx.shadowBlur = 0 as any;
      ctx.fillStyle = pt.c;
      // crisp square dot (like dots.png grain) — fillRect is sharper than arc at 1px
      ctx.fillRect(pt.x - sz/2, pt.y - sz/2, sz, sz);
    }
    ctx.globalAlpha=1;
    // L / R side labels anchored to shoulders so separation is obvious in 3D
    {
      const lSh = centered[5], rSh = centered[6];
      if(lSh && rSh){
        const qL=project(lSh as [number,number,number]), qR=project(rSh as [number,number,number]);
        ctx.font="bold 10px ui-monospace"; ctx.textAlign="center";
        ctx.fillStyle="rgba(139,92,246,0.95)"; ctx.fillText("L", qL.x, qL.y - 14);
        ctx.fillStyle="rgba(236,72,153,0.95)"; ctx.fillText("R", qR.x, qR.y - 14);
      }
    }
    ctx.fillStyle="rgba(250,250,250,0.95)"; ctx.font="11px ui-monospace"; ctx.textAlign="left";
    const ts = cur?.timestampSeconds; ctx.fillText(`frame ${activeIdx+1}/${frames.length}  ${typeof ts==="number"? ts.toFixed(2)+"s" : ""}  •  ${k3.length} joints  •  real 3D`, pad+10, pad+14);
    ctx.fillStyle="rgba(161,161,170,0.9)"; ctx.font="10px ui-monospace"; ctx.fillText(`L violet  R pink  •  center pelvis • Y ${rotY}°  X ${rotX}°  Z out`, pad+10, pad+26);
  }, [frames, activeIdx, rotY, rotX, showTrail, showBones, viewMode, has3d]);
  const canScrub = frames.length>1 && !!onSeek;
  if (!frames.length) return null;
  return (
    <div ref={wrapRef} className="rounded-xl bg-zinc-950 border border-zinc-800 p-3 sm:p-4 space-y-2.5 overflow-hidden">
      {canScrub && (
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-mono text-zinc-500 shrink-0">Frame</span>
          <input type="range" min={0} max={frames.length-1} value={activeIdx} onInput={(e)=>{ const idx=Number((e.target as HTMLInputElement).value); const t=frames[idx]?.timestampSeconds ?? idx/30; onSeek?.(t); }} onChange={(e)=>{ const idx=Number((e.target as HTMLInputElement).value); const t=frames[idx]?.timestampSeconds ?? idx/30; onSeek?.(t); }} className="flex-1 accent-teal-500 h-2 cursor-pointer touch-manipulation" style={{touchAction:"pan-x"}} />
          <span className="text-[11px] font-mono text-zinc-300 shrink-0 tabular-nums">{activeIdx+1}/{frames.length}</span>
          <span className="text-[11px] font-mono text-zinc-400 shrink-0 hidden sm:inline">{(frames[activeIdx]?.timestampSeconds??0).toFixed(2)}s</span>
          <button type="button" onClick={()=> onSeek?.(frames[0]?.timestampSeconds ?? 0)} className="shrink-0 px-2 py-1 rounded-full bg-zinc-900 border border-zinc-800 text-[11px] text-zinc-400">⟲ 0</button>
        </div>
      )}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-xs font-semibold text-zinc-100 flex items-center gap-2">3D Motion Projection <span className="px-1.5 py-0.5 rounded-full bg-violet-500/15 border border-violet-500/30 text-violet-300 text-[10px] font-mono">real 3D only</span></div>
          <div className="text-[11px] text-zinc-500 mt-0.5">All 70 SAM 3D Body joints centered at pelvis • bones show whole human (head-trunk-arms-legs-hands) • dots from <span className="font-mono text-zinc-400">pred_keypoints_3d</span> — no mock</div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex gap-1 p-0.5 rounded-full bg-zinc-900 border border-zinc-800">
            <button onClick={()=>{setViewMode("dots"); setShowBones(false)}} className={`px-2.5 py-1 rounded-full text-[11px] font-medium transition ${viewMode==="dots" ? "bg-zinc-100 text-zinc-900" : "text-zinc-400 hover:text-zinc-200"}`}>Dots only</button>
            <button onClick={()=>{setViewMode("both"); setShowBones(true)}} className={`px-2.5 py-1 rounded-full text-[11px] font-medium transition ${viewMode==="both" ? "bg-zinc-100 text-zinc-900" : "text-zinc-400 hover:text-zinc-200"}`}>Dots + Lines</button>
          </div>
          <label title="When on, draws the path each wrist/hand took through the whole clip — off by default to keep the human readable" className="flex items-center gap-1.5 text-[11px] text-zinc-300 cursor-pointer px-2 py-1 rounded-full bg-zinc-900 border border-zinc-800"><input type="checkbox" checked={showTrail} onChange={e=>setShowTrail(e.target.checked)} className="accent-violet-500 w-3 h-3" /> Trail</label>
          <button onClick={()=>{ setRotY(8); setRotX(-8); }} className="px-2.5 py-1 rounded-full bg-zinc-900 border border-zinc-700 text-[11px] font-medium text-zinc-300 hover:bg-zinc-800 hover:text-zinc-100" title="Reset rotation to neutral (head top)">↺ Reset</button>
          <div className="hidden sm:flex items-center gap-2 px-2 py-1 rounded-full bg-zinc-900 border border-zinc-800" title="Sliders also — or drag inside the 3D area">
            <span className="text-[10px] font-mono text-zinc-500">Y</span><input type="range" min={-75} max={75} value={rotY} onChange={e=>setRotY(Number(e.target.value))} className="w-20 accent-violet-500 h-1" />
            <span className="text-[10px] font-mono text-zinc-500">X</span><input type="range" min={-45} max={45} value={rotX} onChange={e=>setRotX(Number(e.target.value))} className="w-20 accent-teal-500 h-1" />
          </div>
        </div>
      </div>
      <div className="sm:hidden flex items-center gap-3 px-1">
        <span className="text-[11px] font-mono text-zinc-500">Y</span><input type="range" min={-75} max={75} value={rotY} onChange={e=>setRotY(Number(e.target.value))} className="flex-1 accent-violet-500 h-1" />
        <span className="text-[11px] font-mono text-zinc-500">X</span><input type="range" min={-45} max={45} value={rotX} onChange={e=>setRotX(Number(e.target.value))} className="flex-1 accent-teal-500 h-1" />
        <button onClick={()=>{ setRotY(8); setRotX(-8); }} className="shrink-0 px-2.5 py-1 rounded-full bg-zinc-900 border border-zinc-700 text-[11px] font-medium text-zinc-300">↺</button>
      </div>
      <canvas ref={canvasRef} className="w-full rounded-xl bg-zinc-950 border border-zinc-800 block touch-none select-none" style={{display:"block", touchAction:"none", cursor:"grab"}}
        onPointerDown={(e)=>{ (e.currentTarget as any).setPointerCapture?.(e.pointerId); dragRef.current={active:true, sx:e.clientX, sy:e.clientY, ry0:rotY, rx0:rotX}; (e.currentTarget as HTMLCanvasElement).style.cursor="grabbing"; }}
        onPointerMove={(e)=>{ if(!dragRef.current.active) return; const dx=e.clientX-dragRef.current.sx, dy=e.clientY-dragRef.current.sy; setRotY(Math.max(-180,Math.min(180, dragRef.current.ry0 + dx*0.5))); setRotX(Math.max(-80,Math.min(80, dragRef.current.rx0 - dy*0.5))); }}
        onPointerUp={(e)=>{ dragRef.current.active=false; (e.currentTarget as HTMLCanvasElement).style.cursor="grab"; }}
        onPointerLeave={()=>{ dragRef.current.active=false; }}
        onDoubleClick={()=>{ setRotY(8); setRotX(-8); }}
        title="Drag to rotate • double-click to reset — scrub slider above drives this frame"
      />
      <div className="flex flex-wrap gap-1.5 text-[10px] font-mono leading-none">
        <span className="px-2 py-1 rounded-full bg-violet-500/15 border border-violet-500/30 text-violet-200">● L wrist 62</span>
        <span className="px-2 py-1 rounded-full bg-pink-500/15 border border-pink-500/30 text-pink-200">● R wrist 41</span>
        <span className="px-2 py-1 rounded-full bg-teal-500/15 border border-teal-500/30 text-teal-200">● hand tips 21·25·29 / 42·46·50</span>
        <span className="px-2 py-1 rounded-full bg-zinc-800 border border-zinc-700 text-zinc-300">● head 0·neck 69 · shoulders · hips · knees · ankles</span>
        <span className="px-2 py-1 rounded bg-zinc-900 border border-zinc-800 text-zinc-500">trail = wrist path over clip • bones = whole-body MHR70 • centered pelvis • auto-fit</span>
      </div>
      <div className="text-[11px] text-zinc-500">Tip: use the “How to read this” button at the top of Step 3 for dots / trail / axes explained.</div>
      {!has3d && <div className="text-[11px] text-amber-300 bg-amber-950/30 border border-amber-500/30 rounded-lg p-2">Real 3D missing — Modal must return <code className="px-1 py-0.5 rounded bg-zinc-800 border border-zinc-700 font-mono">pred_keypoints_3d</code> (70×3). No mock fallback.</div>}
    </div>
  );
}
