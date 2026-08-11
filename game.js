// ============================================================
//  RUBIX - Cyberpunk 2D Rubik's Cube Solver
//  Vanilla HTML5/JavaScript, Arne16 colorscheme
// ============================================================
(function(){
"use strict";

var C=["#000000","#9D9D9D","#FFFFFF","#BE2633","#E06F8B","#493C2B","#A46422","#EB8931","#F7E26B","#2F484E","#44891A","#A3CE27","#1B2632","#005784","#31A2F2","#B2DCEF"];
var BLK=0,GRY=1,WHT=2,CRI=3,PNK=4,DRB=5,BRW=6,ORG=7,YLW=8,TEL=9,DGN=10,LIM=11,NVY=12,DBL=13,CYA=14,LCA=15;
function col(c){return C[c];}
var FC={U:WHT,D:YLW,F:CRI,B:ORG,L:CYA,R:LIM};
var FN={U:"UP",D:"DOWN",F:"FRONT",B:"BACK",L:"LEFT",R:"RIGHT"};
var FO=["U","D","F","B","L","R"];

var canvas=document.getElementById("game"),ctx=canvas.getContext("2d"),BASE=800,scale=1;
function resize(){var s=Math.min(window.innerWidth,window.innerHeight);scale=s/BASE;canvas.width=s;canvas.height=s;}
window.addEventListener("resize",resize);resize();

var TITLE=0,PLAYING=1,WON=2;
var gameState=TITLE,cube={},moves=0,startTime=0,elapsed=0,currentView=0;
var brokeTime=false,brokeMoves=false;

var VIEWS=[
{t:"U",c:"F",s:"R",d:"right"},{t:"U",c:"F",s:"L",d:"left"},
{t:"U",c:"B",s:"R",d:"right"},{t:"U",c:"B",s:"L",d:"left"},
{t:"D",c:"F",s:"R",d:"right"},{t:"D",c:"F",s:"L",d:"left"},
{t:"D",c:"B",s:"R",d:"right"},{t:"D",c:"B",s:"L",d:"left"}
];

var stars=[];
function genStars(){stars=[];for(var i=0;i<80;i++)stars.push({x:Math.random()*BASE,y:Math.random()*BASE,sz:Math.random()*2+.5,sp:Math.random()*.4+.1,br:Math.random()});}
genStars();

function makeCube(){var c={};for(var i=0;i<FO.length;i++){var f=FO[i];c[f]=[FC[f],FC[f],FC[f],FC[f],FC[f],FC[f],FC[f],FC[f],FC[f]];}return c;}

function isSolved(c){for(var i=0;i<FO.length;i++){var f=FO[i],t=FC[f];for(var j=0;j<9;j++)if(c[f][j]!==t)return false;}return true;}

function rotCW(a){var t=a[0];a[0]=a[6];a[6]=a[8];a[8]=a[2];a[2]=t;t=a[1];a[1]=a[3];a[3]=a[7];a[7]=a[5];a[5]=t;}

function rotateFace(face,cw){
  if(cw){rotCW(cube[face]);}else{rotCW(cube[face]);rotCW(cube[face]);rotCW(cube[face]);}
  var t;
  if(face==="U"){
    if(cw){t=[cube.F[0],cube.F[1],cube.F[2]];cube.F[0]=cube.L[0];cube.F[1]=cube.L[1];cube.F[2]=cube.L[2];cube.L[0]=cube.B[6];cube.L[1]=cube.B[7];cube.L[2]=cube.B[8];cube.B[6]=cube.R[0];cube.B[7]=cube.R[1];cube.B[8]=cube.R[2];cube.R[0]=t[0];cube.R[1]=t[1];cube.R[2]=t[2];}
    else{t=[cube.F[0],cube.F[1],cube.F[2]];cube.F[0]=cube.R[0];cube.F[1]=cube.R[1];cube.F[2]=cube.R[2];cube.R[0]=cube.B[6];cube.R[1]=cube.B[7];cube.R[2]=cube.B[8];cube.B[6]=cube.L[0];cube.B[7]=cube.L[1];cube.B[8]=cube.L[2];cube.L[0]=t[0];cube.L[1]=t[1];cube.L[2]=t[2];}
  }else if(face==="D"){
    if(cw){t=[cube.F[6],cube.F[7],cube.F[8]];cube.F[6]=cube.R[6];cube.F[7]=cube.R[7];cube.F[8]=cube.R[8];cube.R[6]=cube.B[2];cube.R[7]=cube.B[1];cube.R[8]=cube.B[0];cube.B[2]=cube.L[6];cube.B[1]=cube.L[7];cube.B[0]=cube.L[8];cube.L[6]=t[0];cube.L[7]=t[1];cube.L[8]=t[2];}
    else{t=[cube.F[6],cube.F[7],cube.F[8]];cube.F[6]=cube.L[6];cube.F[7]=cube.L[7];cube.F[8]=cube.L[8];cube.L[6]=cube.B[2];cube.L[7]=cube.B[1];cube.L[8]=cube.B[0];cube.B[2]=cube.R[6];cube.B[1]=cube.R[7];cube.B[0]=cube.R[8];cube.R[6]=t[0];cube.R[7]=t[1];cube.R[8]=t[2];}
  }else if(face==="F"){
    if(cw){t=[cube.U[6],cube.U[7],cube.U[8]];cube.U[6]=cube.L[8];cube.U[7]=cube.L[5];cube.U[8]=cube.L[2];cube.L[8]=cube.D[0];cube.L[5]=cube.D[1];cube.L[2]=cube.D[2];cube.D[0]=cube.R[6];cube.D[1]=cube.R[3];cube.D[2]=cube.R[0];cube.R[6]=t[0];cube.R[3]=t[1];cube.R[0]=t[2];}
    else{t=[cube.U[6],cube.U[7],cube.U[8]];cube.U[6]=cube.R[6];cube.U[7]=cube.R[3];cube.U[8]=cube.R[0];cube.R[6]=cube.D[2];cube.R[3]=cube.D[1];cube.R[0]=cube.D[0];cube.D[2]=cube.L[2];cube.D[1]=cube.L[5];cube.D[0]=cube.L[8];cube.L[2]=t[0];cube.L[5]=t[1];cube.L[8]=t[2];}
  }else if(face==="B"){
    if(cw){t=[cube.U[0],cube.U[1],cube.U[2]];cube.U[0]=cube.R[8];cube.U[1]=cube.R[5];cube.U[2]=cube.R[2];cube.R[8]=cube.D[8];cube.R[5]=cube.D[7];cube.R[2]=cube.D[6];cube.D[8]=cube.L[0];cube.D[7]=cube.L[3];cube.D[6]=cube.L[6];cube.L[0]=t[0];cube.L[3]=t[1];cube.L[6]=t[2];}
    else{t=[cube.U[0],cube.U[1],cube.U[2]];cube.U[0]=cube.L[0];cube.U[1]=cube.L[3];cube.U[2]=cube.L[6];cube.L[0]=cube.D[8];cube.L[3]=cube.D[7];cube.L[6]=cube.D[6];cube.D[8]=cube.R[2];cube.D[7]=cube.R[5];cube.D[6]=cube.R[8];cube.R[2]=t[0];cube.R[5]=t[1];cube.R[8]=t[2];}
  }else if(face==="L"){
    if(cw){t=[cube.U[0],cube.U[3],cube.U[6]];cube.U[0]=cube.B[8];cube.U[3]=cube.B[5];cube.U[6]=cube.B[2];cube.B[8]=cube.D[0];cube.B[5]=cube.D[3];cube.B[2]=cube.D[6];cube.D[0]=cube.F[0];cube.D[3]=cube.F[3];cube.D[6]=cube.F[6];cube.F[0]=t[0];cube.F[3]=t[1];cube.F[6]=t[2];}
    else{t=[cube.U[0],cube.U[3],cube.U[6]];cube.U[0]=cube.F[0];cube.U[3]=cube.F[3];cube.U[6]=cube.F[6];cube.F[0]=cube.D[0];cube.F[3]=cube.D[3];cube.F[6]=cube.D[6];cube.D[0]=cube.B[8];cube.D[3]=cube.B[5];cube.D[6]=cube.B[2];cube.B[8]=t[0];cube.B[5]=t[1];cube.B[2]=t[2];}
  }else if(face==="R"){
    if(cw){t=[cube.U[2],cube.U[5],cube.U[8]];cube.U[2]=cube.F[2];cube.U[5]=cube.F[5];cube.U[8]=cube.F[8];cube.F[2]=cube.D[2];cube.F[5]=cube.D[5];cube.F[8]=cube.D[8];cube.D[2]=cube.B[6];cube.D[5]=cube.B[3];cube.D[8]=cube.B[0];cube.B[6]=t[0];cube.B[3]=t[1];cube.B[0]=t[2];}
    else{t=[cube.U[2],cube.U[5],cube.U[8]];cube.U[2]=cube.B[6];cube.U[5]=cube.B[3];cube.U[8]=cube.B[0];cube.B[6]=cube.D[8];cube.B[3]=cube.D[5];cube.B[0]=cube.D[2];cube.D[8]=cube.F[8];cube.D[5]=cube.F[5];cube.D[2]=cube.F[2];cube.F[8]=t[0];cube.F[5]=t[1];cube.F[2]=t[2];}
  }
}

function scrambleCube(n){cube=makeCube();for(var i=0;i<n;i++){rotateFace(FO[Math.floor(Math.random()*6)],Math.random()>.5);}if(isSolved(cube))scrambleCube(n);}

// ---- Buttons ----
var buttons=[],focusedButton=0;

function buildButtons(){buttons=[];
buttons.push({id:"u",lb:"U",row:0,col:0,act:"rotate",face:"U",cw:true});
buttons.push({id:"d",lb:"D",row:0,col:1,act:"rotate",face:"D",cw:true});
buttons.push({id:"f",lb:"F",row:0,col:2,act:"rotate",face:"F",cw:true});
buttons.push({id:"b",lb:"B",row:0,col:3,act:"rotate",face:"B",cw:true});
buttons.push({id:"l",lb:"L",row:0,col:4,act:"rotate",face:"L",cw:true});
buttons.push({id:"r",lb:"R",row:0,col:5,act:"rotate",face:"R",cw:true});
buttons.push({id:"u2",lb:"U\u2032",row:1,col:0,act:"rotate",face:"U",cw:false});
buttons.push({id:"d2",lb:"D\u2032",row:1,col:1,act:"rotate",face:"D",cw:false});
buttons.push({id:"f2",lb:"F\u2032",row:1,col:2,act:"rotate",face:"F",cw:false});
buttons.push({id:"b2",lb:"B\u2032",row:1,col:3,act:"rotate",face:"B",cw:false});
buttons.push({id:"l2",lb:"L\u2032",row:1,col:4,act:"rotate",face:"L",cw:false});
buttons.push({id:"r2",lb:"R\u2032",row:1,col:5,act:"rotate",face:"R",cw:false});
buttons.push({id:"view",lb:"\u25C4 VIEW \u25BA",row:2,col:2,act:"view"});
}

var BTN_W=100,BTN_H=56,BTN_GAP=8;
function layoutButtons(){if(!buttons.length)return;
var row0Y=580,rowGap=68,totalW6=6*BTN_W+5*BTN_GAP,startX6=(BASE-totalW6)/2;
var startX1=(BASE-(BTN_W+80))/2;
for(var i=0;i<buttons.length;i++){var b=buttons[i];
if(b.row<=1){b.x=startX6+b.col*(BTN_W+BTN_GAP);b.y=row0Y+b.row*(BTN_H+rowGap-BTN_GAP);}
else{b.x=startX1+40;b.y=row0Y+2*(BTN_H+rowGap-BTN_GAP);}
b.w=BTN_W;b.h=BTN_H;}}

// ---- Input ----
function activateButton(idx){var b=buttons[idx];if(!b)return;
if(gameState===TITLE){startGame();return;}
if(gameState===WON){gameState=TITLE;return;}
if(b.act==="rotate"){moves++;rotateFace(b.face,b.cw);if(isSolved(cube)){gameState=WON;checkRecords();}}
else if(b.act==="view"){currentView=(currentView+1)%VIEWS.length;}}

function navigateButton(dir){var b=buttons[focusedButton];if(!b)return;
var best=-1,bestD=1/0;
for(var i=0;i<buttons.length;i++){var btn=buttons[i];
if(dir==="up"&&btn.row<b.row&&Math.abs(btn.col-b.col)<bestD){bestD=Math.abs(btn.col-b.col);best=i;}
if(dir==="down"&&btn.row>b.row&&Math.abs(btn.col-b.col)<bestD){bestD=Math.abs(btn.col-b.col);best=i;}
if(dir==="left"&&btn.col<b.col&&btn.row===b.row&&(b.col-btn.col)<bestD){bestD=b.col-btn.col;best=i;}
if(dir==="right"&&btn.col>b.col&&btn.row===b.row&&(btn.col-b.col)<bestD){bestD=btn.col-b.col;best=i;}
}if(best>=0)focusedButton=best;}

document.addEventListener("keydown",function(e){
if(gameState===TITLE){startGame();e.preventDefault();return;}
if(gameState===WON){gameState=TITLE;e.preventDefault();return;}
switch(e.key){
case"ArrowUp":navigateButton("up");e.preventDefault();break;
case"ArrowDown":navigateButton("down");e.preventDefault();break;
case"ArrowLeft":navigateButton("left");e.preventDefault();break;
case"ArrowRight":navigateButton("right");e.preventDefault();break;
case"Enter":case" ":activateButton(focusedButton);e.preventDefault();break;}
});

function getButtonAt(mx,my){for(var i=0;i<buttons.length;i++){var b=buttons[i];if(mx>=b.x&&mx<=b.x+b.w&&my>=b.y&&my<=b.y+b.h)return i;}return-1;}
function handlePointer(x,y){var mx=x/scale,my=y/scale;
if(gameState===TITLE){startGame();return;}
if(gameState===WON){gameState=TITLE;return;}
var idx=getButtonAt(mx,my);if(idx>=0){focusedButton=idx;activateButton(idx);}}
canvas.addEventListener("mousedown",function(e){handlePointer(e.clientX,e.clientY);});
canvas.addEventListener("touchstart",function(e){e.preventDefault();var t=e.touches[0];handlePointer(t.clientX,t.clientY);},{passive:false});

// ---- Game Flow ----
function startGame(){gameState=PLAYING;moves=0;startTime=Date.now();elapsed=0;currentView=0;focusedButton=0;buildButtons();layoutButtons();scrambleCube(20);}

// ---- Records ----
function getRecords(){try{var r=JSON.parse(localStorage.getItem("rubix_records"));if(r)return r;}catch(e){}return{bestTime:1/0,bestMoves:1/0};}
function checkRecords(){var rec=getRecords();
brokeTime=elapsed<rec.bestTime;brokeMoves=moves<rec.bestMoves;
if(brokeTime)rec.bestTime=elapsed;if(brokeMoves)rec.bestMoves=moves;
localStorage.setItem("rubix_records",JSON.stringify(rec));}

// ---- Rendering Helpers ----
function rr(x,y,w,h,r){ctx.beginPath();ctx.moveTo(x+r,y);ctx.lineTo(x+w-r,y);ctx.quadraticCurveTo(x+w,y,x+w,y+r);ctx.lineTo(x+w,y+h-r);ctx.quadraticCurveTo(x+w,y+h,x+w-r,y+h);ctx.lineTo(x+r,y+h);ctx.quadraticCurveTo(x,y+h,x,y+h-r);ctx.lineTo(x,y+r);ctx.quadraticCurveTo(x,y,x+r,y);ctx.closePath();}

function drawFace(cx,cy,sz,data){
var cs=sz/3,g=3;ctx.save();ctx.translate(cx,cy);
ctx.fillStyle=col(NVY);ctx.fillRect(-g,-g,sz+g*2,sz+g*2);
for(var r=0;r<3;r++){for(var c=0;c<3;c++){var i=r*3+c,px=c*cs,py=r*cs;
ctx.fillStyle=col(BLK);ctx.fillRect(px+g,py+g,cs-g*2,cs-g*2);
ctx.fillStyle=C[data[i]];ctx.fillRect(px+g+2,py+g+2,cs-g*2-4,cs-g*2-4);
ctx.fillStyle="rgba(255,255,255,0.15)";ctx.fillRect(px+g+2,py+g+2,cs-g*2-4,3);ctx.fillRect(px+g+2,py+g+2,3,cs-g*2-4);
ctx.fillStyle="rgba(0,0,0,0.3)";ctx.fillRect(px+g+2,py+cs-g-5,cs-g*2-4,3);ctx.fillRect(px+cs-g-5,py+g+2,3,cs-g*2-4);}}
ctx.strokeStyle=col(LCA);ctx.lineWidth=2;ctx.strokeRect(-1,-1,sz+2,sz+2);
ctx.restore();}

function drawStars(t){for(var i=0;i<stars.length;i++){var s=stars[i],fl=.5+.5*Math.sin(t*s.sp+s.br*100);
ctx.globalAlpha=fl*.7;ctx.fillStyle=s.br>.7?col(LCA):s.br>.4?col(CYA):col(DBL);
ctx.fillRect(s.x,s.y,s.sz,s.sz);}ctx.globalAlpha=1;}

function drawScanlines(){ctx.fillStyle="rgba(0,0,0,0.06)";for(var y=0;y<BASE;y+=4)ctx.fillRect(0,y,BASE,2);}

function fmtTime(ms){var m=Math.floor(ms/60000),s=Math.floor((ms%60000)/1000),ms2=Math.floor((ms%1000)/10);
return String(m).padStart(2,"0")+":"+String(s).padStart(2,"0")+"."+String(ms2).padStart(2,"0");}

function drawHUD(){
ctx.font="bold 22px monospace";ctx.textAlign="left";ctx.fillStyle=col(LCA);ctx.fillText("MOVES",30,35);
ctx.font="bold 32px monospace";ctx.fillStyle=col(YLW);ctx.fillText(String(moves),30,70);
ctx.font="bold 22px monospace";ctx.fillStyle=col(LCA);ctx.fillText("TIME",30,110);
ctx.font="bold 28px monospace";ctx.fillStyle=col(LIM);ctx.fillText(fmtTime(elapsed),30,142);
var rec=getRecords();ctx.font="14px monospace";ctx.fillStyle=col(GRY);ctx.textAlign="right";
if(rec.bestTime<1/0){var bt=Math.floor(rec.bestTime/60000)+":"+String(Math.floor((rec.bestTime%60000)/1000)).padStart(2,"0");
ctx.fillText("BEST TIME: "+bt+"s",BASE-30,35);}
if(rec.bestMoves<1/0)ctx.fillText("BEST MOVES: "+rec.bestMoves,BASE-30,55);
ctx.textAlign="center";ctx.font="bold 16px monospace";ctx.fillStyle=col(CYA);
var v=VIEWS[currentView];ctx.fillText("VIEW: "+v.t+"-"+v.c+"-"+v.s,BASE/2,170);}

function drawButtons(t){var pulse=.7+.3*Math.sin(t*3);
for(var i=0;i<buttons.length;i++){var b=buttons[i],isF=(i===focusedButton);
ctx.fillStyle=isF?col(DBL):col(NVY);rr(b.x,b.y,b.w,b.h,6);ctx.fill();
ctx.strokeStyle=isF?col(CYA):col(DBL);ctx.lineWidth=isF?3:1;rr(b.x,b.y,b.w,b.h,6);ctx.stroke();
if(isF){ctx.save();ctx.shadowColor=col(CYA);ctx.shadowBlur=12*pulse;ctx.strokeStyle=col(CYA);ctx.lineWidth=1;rr(b.x,b.y,b.w,b.h,6);ctx.stroke();ctx.restore();}
ctx.font="bold "+(b.row===2?16:20)+"px monospace";ctx.textAlign="center";ctx.textBaseline="middle";
ctx.fillStyle=isF?col(LCA):col(GRY);ctx.fillText(b.lb,b.x+b.w/2,b.y+b.h/2);ctx.textBaseline="alphabetic";}}

function drawTitleScreen(t){
ctx.fillStyle=col(BLK);ctx.fillRect(0,0,BASE,BASE);drawStars(t);drawScanlines();
ctx.strokeStyle=col(CYA);ctx.lineWidth=3;ctx.strokeRect(20,20,BASE-40,BASE-40);
ctx.strokeStyle=col(DBL);ctx.lineWidth=1;ctx.strokeRect(28,28,BASE-56,BASE-56);
var cl=40;ctx.strokeStyle=col(LCA);ctx.lineWidth=3;
ctx.beginPath();ctx.moveTo(20,20+cl);ctx.lineTo(20,20);ctx.lineTo(20+cl,20);ctx.stroke();
ctx.beginPath();ctx.moveTo(BASE-20-cl,20);ctx.lineTo(BASE-20,20);ctx.lineTo(BASE-20,20+cl);ctx.stroke();
ctx.beginPath();ctx.moveTo(20,BASE-20-cl);ctx.lineTo(20,BASE-20);ctx.lineTo(20+cl,BASE-20);ctx.stroke();
ctx.beginPath();ctx.moveTo(BASE-20-cl,BASE-20);ctx.lineTo(BASE-20,BASE-20);ctx.lineTo(BASE-20,BASE-20-cl);ctx.stroke();
var tp=.8+.2*Math.sin(t*2);
ctx.save();ctx.shadowColor=col(CYA);ctx.shadowBlur=30*tp;ctx.font="bold 120px monospace";ctx.textAlign="center";ctx.textBaseline="middle";
ctx.fillStyle=col(LCA);ctx.fillText("RUBIX",BASE/2,250);ctx.restore();
ctx.font="bold 20px monospace";ctx.fillStyle=col(CYA);ctx.fillText("CYBERPUNK SOLVER",BASE/2,320);
ctx.strokeStyle=col(DBL);ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(BASE/2-150,350);ctx.lineTo(BASE/2+150,350);ctx.stroke();
var mfs=60,pcx=BASE/2,pcy=430,pc=makeCube();
drawFace(pcx-mfs,pcy,mfs,pc["L"]);drawFace(pcx,pcy-mfs,mfs,pc["U"]);
drawFace(pcx,pcy,mfs,pc["F"]);drawFace(pcx+mfs,pcy,mfs,pc["R"]);
var pa=.5+.5*Math.sin(t*3);ctx.globalAlpha=pa;
ctx.font="bold 24px monospace";ctx.fillStyle=col(YLW);ctx.fillText("[ PRESS ANY KEY / TAP TO START ]",BASE/2,560);ctx.globalAlpha=1;
ctx.font="16px monospace";ctx.fillStyle=col(GRY);
ctx.fillText("ARROW KEYS: NAVIGATE  |  ENTER/SPACE: ACTIVATE",BASE/2,620);
ctx.fillText("CLICK/TAP BUTTONS DIRECTLY",BASE/2,645);
ctx.fillText("SOLVE THE CUBE IN FEWEST MOVES AND SHORTEST TIME",BASE/2,670);
ctx.font="14px monospace";ctx.fillStyle=col(GRY);
var ly=720;ctx.fillText("FACE COLORS:",BASE/2,ly);
var li=[["U:WHITE",WHT],["D:YELLOW",YLW],["F:RED",CRI],["B:ORANGE",ORG],["L:CYAN",CYA],["R:GREEN",LIM]];
var lx=BASE/2-200;
for(var i=0;i<li.length;i++){var lbl=li[i][0],clr=li[i][1],xx=lx+i*85;
ctx.fillStyle=C[clr];ctx.fillRect(xx,ly+18,14,14);ctx.fillStyle=col(GRY);ctx.fillText(lbl,xx+7,ly+30);}}

function drawVictoryScreen(t){
ctx.fillStyle=col(BLK);ctx.fillRect(0,0,BASE,BASE);drawStars(t);drawScanlines();
ctx.strokeStyle=col(LIM);ctx.lineWidth=3;ctx.strokeRect(20,20,BASE-40,BASE-40);
ctx.strokeStyle=col(DGN);ctx.lineWidth=1;ctx.strokeRect(28,28,BASE-56,BASE-56);
var cl=40;ctx.strokeStyle=col(LIM);ctx.lineWidth=3;
ctx.beginPath();ctx.moveTo(20,20+cl);ctx.lineTo(20,20);ctx.lineTo(20+cl,20);ctx.stroke();
ctx.beginPath();ctx.moveTo(BASE-20-cl,20);ctx.lineTo(BASE-20,20);ctx.lineTo(BASE-20,20+cl);ctx.stroke();
ctx.beginPath();ctx.moveTo(20,BASE-20-cl);ctx.lineTo(20,BASE-20);ctx.lineTo(20+cl,BASE-20);ctx.stroke();
ctx.beginPath();ctx.moveTo(BASE-20-cl,BASE-20);ctx.lineTo(BASE-20,BASE-20);ctx.lineTo(BASE-20,BASE-20-cl);ctx.stroke();
var pulse=.8+.2*Math.sin(t*2);
ctx.save();ctx.shadowColor=col(LIM);ctx.shadowBlur=25*pulse;ctx.font="bold 90px monospace";ctx.textAlign="center";ctx.textBaseline="middle";
ctx.fillStyle=col(LIM);ctx.fillText("SOLVED!",BASE/2,160);ctx.restore();
var bx=BASE/2-180,by=220,bw=360,bh=200;
ctx.fillStyle=col(NVY);rr(bx,by,bw,bh,10);ctx.fill();
ctx.strokeStyle=col(CYA);ctx.lineWidth=2;rr(bx,by,bw,bh,10);ctx.stroke();
ctx.font="bold 28px monospace";ctx.textAlign="center";
ctx.fillStyle=col(LCA);ctx.fillText("MOVES",BASE/2,by+45);
ctx.fillStyle=col(YLW);ctx.font="bold 48px monospace";ctx.fillText(String(moves),BASE/2,by+85);
ctx.font="bold 28px monospace";ctx.fillStyle=col(LCA);ctx.fillText("TIME",BASE/2,by+125);
ctx.fillStyle=col(LIM);ctx.font="bold 36px monospace";ctx.fillText(fmtTime(elapsed),BASE/2,by+160);
var ry=460;ctx.font="bold 22px monospace";ctx.textAlign="center";
if(brokeMoves){ctx.save();ctx.shadowColor=col(YLW);ctx.shadowBlur=15;ctx.fillStyle=col(YLW);
ctx.fillText("\u2605 NEW RECORD - FEWEST MOVES! \u2605",BASE/2,ry);ctx.restore();ry+=35;}
if(brokeTime){ctx.save();ctx.shadowColor=col(PNK);ctx.shadowBlur=15;ctx.fillStyle=col(PNK);
ctx.fillText("\u2605 NEW RECORD - FASTEST TIME! \u2605",BASE/2,ry);ctx.restore();ry+=35;}
var rec=getRecords();ctx.font="16px monospace";ctx.fillStyle=col(GRY);
if(rec.bestTime<1/0){var bt=Math.floor(rec.bestTime/60000)+":"+String(Math.floor((rec.bestTime%60000)/1000)).padStart(2,"0");
ctx.fillText("Best Time: "+bt+"s  |  Best Moves: "+rec.bestMoves,BASE/2,ry+30);}
var pa=.5+.5*Math.sin(t*3);ctx.globalAlpha=pa;ctx.font="bold 24px monospace";ctx.fillStyle=col(YLW);
ctx.fillText("[ PRESS ANY KEY / TAP TO PLAY AGAIN ]",BASE/2,680);ctx.globalAlpha=1;}

function drawGameScreen(t){
ctx.fillStyle=col(BLK);ctx.fillRect(0,0,BASE,BASE);drawStars(t);drawScanlines();
drawHUD();
ctx.strokeStyle=col(DBL);ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(20,165);ctx.lineTo(BASE-20,165);ctx.stroke();
ctx.font="bold 20px monospace";ctx.textAlign="center";ctx.fillStyle=col(CYA);ctx.fillText("R U B I X",BASE/2,155);
var view=VIEWS[currentView],fsz=120,fg=8,cx=BASE/2,cy=280;
drawFace(cx,cy,fsz,cube[view.c]);
drawFace(cx,cy-fsz-fg,fsz,cube[view.t]);
var sx=view.dir==="right"?cx+fsz+fg:cx-fsz-fg;
drawFace(sx,cy,fsz,cube[view.s]);
ctx.font="bold 14px monospace";ctx.textAlign="center";ctx.fillStyle=col(LCA);
ctx.fillText(FN[view.t],cx,cy-fsz-fg-10);
ctx.fillText(FN[view.c],cx,cy+fsz+20);
ctx.fillText(FN[view.s],view.dir==="right"?cx+fsz+fg+fsz/2:cx-fsz-fg+fsz/2,cy+fsz+20);
drawButtons(t);}

// ---- Main Loop ----
var lastTime=0;
function gameLoop(ts){var t=ts/1000;
if(gameState===PLAYING)elapsed=Date.now()-startTime;
ctx.clearRect(0,0,BASE,BASE);
switch(gameState){case TITLE:drawTitleScreen(t);break;case PLAYING:drawGameScreen(t);break;case WON:drawVictoryScreen(t);break;}
requestAnimationFrame(gameLoop);}

buildButtons();layoutButtons();requestAnimationFrame(gameLoop);
})();
