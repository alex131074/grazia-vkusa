/* 3D: шляпная коробка с розами, вокруг обвивается нить жемчуга. Чистый WebGL, без библиотек. */
(function () {
  var cv = document.getElementById('pb');
  var gl = cv && (cv.getContext('webgl', { alpha: true, antialias: true, premultipliedAlpha: true }) || cv.getContext('experimental-webgl'));
  if (!gl) { document.documentElement.classList.add('no-gl'); window.PB = { scroll: function () {}, live: function () {} }; return; }
  var reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  var PI = Math.PI;

  /* ---------- математика ---------- */
  function mul(a, b) { var o = new Float32Array(16); for (var c = 0; c < 4; c++) for (var r = 0; r < 4; r++) o[c * 4 + r] = a[r] * b[c * 4] + a[4 + r] * b[c * 4 + 1] + a[8 + r] * b[c * 4 + 2] + a[12 + r] * b[c * 4 + 3]; return o; }
  function ident() { return new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]); }
  function trans(x, y, z) { var m = ident(); m[12] = x; m[13] = y; m[14] = z; return m; }
  function scl(x, y, z) { var m = ident(); m[0] = x; m[5] = y; m[10] = z; return m; }
  function rotX(a) { var c = Math.cos(a), s = Math.sin(a), m = ident(); m[5] = c; m[6] = s; m[9] = -s; m[10] = c; return m; }
  function rotY(a) { var c = Math.cos(a), s = Math.sin(a), m = ident(); m[0] = c; m[2] = -s; m[8] = s; m[10] = c; return m; }
  function rotZ(a) { var c = Math.cos(a), s = Math.sin(a), m = ident(); m[0] = c; m[1] = s; m[4] = -s; m[5] = c; return m; }
  function persp(fov, asp, n, f) { var t = 1 / Math.tan(fov / 2), m = new Float32Array(16); m[0] = t / asp; m[5] = t; m[10] = (f + n) / (n - f); m[11] = -1; m[14] = 2 * f * n / (n - f); return m; }
  function norm(v) { var l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; }
  function cross(a, b) { return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]; }
  function dot(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }
  function lookAt(e, t) { var z = norm([e[0] - t[0], e[1] - t[1], e[2] - t[2]]), x = norm(cross([0, 1, 0], z)), y = cross(z, x); return new Float32Array([x[0], y[0], z[0], 0, x[1], y[1], z[1], 0, x[2], y[2], z[2], 0, -dot(x, e), -dot(y, e), -dot(z, e), 1]); }
  function basis(d) { var y = norm(d), up = Math.abs(y[2]) < .9 ? [0, 0, 1] : [1, 0, 0], x = norm(cross(up, y)), z = cross(x, y); return new Float32Array([x[0], x[1], x[2], 0, y[0], y[1], y[2], 0, z[0], z[1], z[2], 0, 0, 0, 0, 1]); }
  function chain() { var m = arguments[0]; for (var i = 1; i < arguments.length; i++) m = mul(m, arguments[i]); return m; }

  /* ---------- геометрия ---------- */
  function Geo() { this.d = []; }
  Geo.prototype.surf = function (F, nu, nv, M) { // F(u,v) -> [x,y,z,m], нормали по разностям
    M = M || ident(); var P = [], i, j, e = 1e-3;
    for (j = 0; j <= nv; j++) for (i = 0; i <= nu; i++) {
      var u = i / nu, v = j / nv, p = F(u, v), pu = F(Math.min(1, u + e), v), pu2 = F(Math.max(0, u - e), v), pv = F(u, Math.min(1, v + e)), pv2 = F(u, Math.max(0, v - e));
      var n = cross([pu[0] - pu2[0], pu[1] - pu2[1], pu[2] - pu2[2]], [pv[0] - pv2[0], pv[1] - pv2[1], pv[2] - pv2[2]]);
      if (!(n[0] || n[1] || n[2])) n = [0, 1, 0];
      P.push([p, norm(n)]);
    }
    var w = nu + 1;
    for (j = 0; j < nv; j++) for (i = 0; i < nu; i++) {
      var a = P[j * w + i], b = P[j * w + i + 1], c = P[(j + 1) * w + i + 1], d = P[(j + 1) * w + i];
      this.tri(a, b, c, M); this.tri(a, c, d, M);
    }
  };
  Geo.prototype.tri = function () {
    var M = arguments[3], self = this;
    for (var k = 0; k < 3; k++) {
      var q = arguments[k], p = q[0], n = q[1];
      self.d.push(M[0] * p[0] + M[4] * p[1] + M[8] * p[2] + M[12], M[1] * p[0] + M[5] * p[1] + M[9] * p[2] + M[13], M[2] * p[0] + M[6] * p[1] + M[10] * p[2] + M[14],
        M[0] * n[0] + M[4] * n[1] + M[8] * n[2], M[1] * n[0] + M[5] * n[1] + M[9] * n[2], M[2] * n[0] + M[6] * n[1] + M[10] * n[2], p[3]);
    }
  };
  Geo.prototype.upload = function () {
    var b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(this.d), gl.STATIC_DRAW);
    var n = this.d.length / 7; this.d = null; return { b: b, n: n };
  };

  /* лепесток: растёт вдоль y, края загибаются к центру цветка, кончик отгибается наружу */
  function petal(g, o) {
    var F = function (u, v) {
      var s = u * 2 - 1, w = o.w * Math.pow(Math.sin(PI * (.08 + .86 * v)), o.sh || .6);
      var x = s * w, y = o.l * v, z = -o.cup * s * s * w + o.curl * v * v * v * o.l;
      y -= o.tipDip ? o.tipDip * s * s * v * v : 0;
      return [x, y, z, o.m === undefined ? v : o.m];
    };
    g.surf(F, o.nu || 7, o.nv || 8, chain(rotY(o.a), trans(0, o.y || 0, o.r), rotX(o.t)));
  }
  function disc(g, r, h, m, M) { // приплюснутая полусфера: серединка, чашелистик
    g.surf(function (u, v) { var a = u * 2 * PI, b = v * PI / 2; return [Math.cos(a) * Math.cos(b) * r, Math.sin(b) * h, Math.sin(a) * Math.cos(b) * r, m]; }, 18, 5, M);
  }

  /* роза: тугой бутон внутри, раскрытые лепестки снаружи */
  var rose = new Geo(), GA = 2.39996;
  [[5, .14, .32, .5, .2, .25, .02], [5, .45, .42, .62, .3, .4, .06], [6, .8, .52, .72, .38, .5, .12], [6, 1.12, .6, .76, .44, .55, .22]].forEach(function (L, li) {
    for (var k = 0; k < L[0]; k++) petal(rose, { a: k / L[0] * 2 * PI + li * .7, t: L[1], w: L[2], l: L[3], r: L[4] * .35, cup: L[5], curl: L[6], y: -li * .05 });
  });
  disc(rose, .34, -.28, .1, ident());
  var roseB = rose.upload();

  /* кустовая роза: маленькая и раскрытая */
  var spray = new Geo();
  [[5, .5, .3, .4, .2, .35, .05], [6, 1.0, .36, .46, .3, .3, .15]].forEach(function (L, li) {
    for (var k = 0; k < L[0]; k++) petal(spray, { a: k / L[0] * 2 * PI + li * .6, t: L[1], w: L[2], l: L[3], r: L[4] * .3, cup: L[5], curl: L[6] });
  });
  disc(spray, .2, -.18, .1, ident());
  var sprayB = spray.upload();

  /* хризантема-ромашка: серединка и два ряда узких лепестков */
  var daisy = new Geo();
  [[18, 1.25, .1, .78, .02], [16, 1.5, .09, .7, .1]].forEach(function (L, li) {
    for (var k = 0; k < L[0]; k++) petal(daisy, { a: (k + li * .5) / L[0] * 2 * PI, t: L[1], w: L[2], l: L[3], r: .18, cup: .5, curl: L[4], sh: .45, nu: 3, nv: 6, y: .04 - li * .03 });
  });
  disc(daisy, .24, .14, 2, trans(0, .02, 0));
  var daisyB = daisy.upload();

  /* лист эвкалипта/зелени */
  var leaf = new Geo();
  petal(leaf, { a: 0, t: 0, w: .26, l: 1.25, r: 0, cup: .25, curl: .25, sh: .9, nv: 9 });
  var leafB = leaf.upload();

  /* обёртка: два слоя бумаги с волнистым краем, спереди ниже, чтобы цветы были видны */
  function wrapGeo(rot, lift, waves, m) {
    var g = new Geo();
    g.surf(function (u, v) {
      var a = u * 2 * PI, t = v;
      var front = Math.max(0, Math.cos(a - PI / 2 + rot));
      var top = .55 + lift - 1.0 * front * front + .16 * Math.sin(a * waves);
      var y = -3.3 + (top + 3.3) * t;
      var r = (.32 + Math.pow(t, 1.25) * .98) * (1 + .05 * Math.sin(a * waves + 1) * t);
      return [Math.cos(a) * r, y, Math.sin(a) * r, m + t * .9];
    }, 72, 14);
    return g.upload();
  }
  var wrapA = wrapGeo(0, 0, 5, 0), wrapB = wrapGeo(.5, .22, 4, 0);
  var ribbon = new Geo();
  ribbon.surf(function (u, v) { var a = u * 2 * PI, b = v * 2 * PI, R = .52, r = .07; return [Math.cos(a) * (R + Math.cos(b) * r), Math.sin(b) * r * 1.6, Math.sin(a) * (R + Math.cos(b) * r), 2]; }, 40, 8);
  [-1, 1].forEach(function (s) { // хвосты ленты
    ribbon.surf(function (u, v) { var x = s * (.1 + v * .5), y = -v * 1.2, z = .55 + Math.sin(v * 3) * .08; return [x + (u - .5) * .22, y, z + (u - .5) * .02 * s, 2]; }, 2, 8);
  });
  var ribbonB = ribbon.upload();
  var stem = new Geo();
  stem.surf(function (u, v) { var a = u * 2 * PI; return [Math.cos(a) * .05, -v * 1.1, Math.sin(a) * .05, .5]; }, 8, 1);
  var stemB = stem.upload();
  /* ---------- шейдер: цветы, бархат коробки, золото, жемчуг ---------- */
  var VS = 'attribute vec3 aP;attribute vec3 aN;attribute float aM;uniform mat4 uVP;uniform mat4 uW;varying vec3 vW;varying vec3 vN;varying float vM;' +
    'void main(){vec4 w=uW*vec4(aP,1.);vW=w.xyz;vN=mat3(uW[0].xyz,uW[1].xyz,uW[2].xyz)*aN;vM=aM;gl_Position=uVP*w;}';
  var FS = 'precision mediump float;varying vec3 vW;varying vec3 vN;varying float vM;uniform vec3 uC1;uniform vec3 uE;uniform float uFade;uniform float uK;' +
    'void main(){vec3 N=normalize(vN);vec3 V=normalize(uE-vW);if(dot(N,V)<0.)N=-N;' +
    'vec3 L1=normalize(vec3(-.5,.8,.7));vec3 L2=normalize(vec3(.85,.15,.45));vec3 H1=normalize(L1+V);' +
    'float d1=max(0.,dot(N,L1)*.6+.4);float d2=max(0.,dot(N,L2))*.3;float f=1.-max(dot(N,V),0.);vec3 c;' +
    'if(uK<.5){vec3 b=uC1*mix(.6,1.,smoothstep(0.,.9,vM));c=b*(.36+d1*.7+d2)+vec3(pow(max(dot(N,H1),0.),40.)*.15)+mix(vec3(1.,.97,.94),b,.4)*pow(f,2.4)*.16;}' +
    'else if(uK<1.5){vec3 b=vec3(.97,.94,.9);vec3 ir=mix(vec3(1.,.8,.86),vec3(.8,.9,1.),.5+.5*sin(f*7.+vW.y*3.));' +
    'c=b*(.42+d1*.6)+ir*pow(f,1.6)*.45+vec3(pow(max(dot(N,H1),0.),70.))*1.1+vec3(pow(max(dot(N,normalize(L2+V)),0.),30.))*.3;}' +
    'else if(uK<2.5){vec3 b=vec3(.86,.68,.36);float s=pow(max(dot(N,H1),0.),24.);c=b*(.3+d1*.55)+vec3(1.,.9,.65)*s*1.2+b*pow(f,1.5)*.5;}' +
    'else{vec3 b=uC1*mix(.82,1.,vM);c=b*(.42+d1*.55+d2)+mix(vec3(1.,.92,.9),b,.3)*pow(f,1.8)*.35;}' +
    'gl_FragColor=vec4(min(c,vec3(1.))*uFade,uFade);}';
  function sh(t, s) { var o = gl.createShader(t); gl.shaderSource(o, s); gl.compileShader(o); if (!gl.getShaderParameter(o, gl.COMPILE_STATUS)) console.error(gl.getShaderInfoLog(o)); return o; }
  var pg = gl.createProgram(); gl.attachShader(pg, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(pg, sh(gl.FRAGMENT_SHADER, FS)); gl.linkProgram(pg);
  var A = { p: gl.getAttribLocation(pg, 'aP'), n: gl.getAttribLocation(pg, 'aN'), m: gl.getAttribLocation(pg, 'aM') };
  var U = {}; ['uVP', 'uW', 'uC1', 'uE', 'uFade', 'uK'].forEach(function (n) { U[n] = gl.getUniformLocation(pg, n); });
  gl.useProgram(pg); gl.enable(gl.DEPTH_TEST); gl.clearColor(0, 0, 0, 0);
  [A.p, A.n, A.m].forEach(function (l) { gl.enableVertexAttribArray(l); });
  function draw(buf, W, c, k) {
    gl.bindBuffer(gl.ARRAY_BUFFER, buf.b);
    gl.vertexAttribPointer(A.p, 3, gl.FLOAT, false, 28, 0); gl.vertexAttribPointer(A.n, 3, gl.FLOAT, false, 28, 12); gl.vertexAttribPointer(A.m, 1, gl.FLOAT, false, 28, 24);
    gl.uniformMatrix4fv(U.uW, false, W); gl.uniform3fv(U.uC1, c || [1, 1, 1]); gl.uniform1f(U.uK, k || 0);
    gl.drawArrays(gl.TRIANGLES, 0, buf.n);
  }

  /* ---------- шляпная коробка, золотой кант, жемчужина ---------- */
  var box = new Geo();
  box.surf(function (u, v) { var a = u * 2 * PI; return [Math.cos(a) * 1.6, -1.65 + v * 1.5, Math.sin(a) * 1.6, v]; }, 64, 4);
  var boxB = box.upload();
  var rim = new Geo();
  [-.18, -1.6].forEach(function (y0) {
    rim.surf(function (u, v) { var a = u * 2 * PI, b = v * 2 * PI; return [Math.cos(a) * (1.61 + Math.cos(b) * .045), y0 + Math.sin(b) * .045, Math.sin(a) * (1.61 + Math.cos(b) * .045), 0]; }, 64, 6);
  });
  var rimB = rim.upload();
  var pearl = new Geo();
  pearl.surf(function (u, v) { var a = u * 2 * PI, b = (v - .5) * PI; return [Math.cos(a) * Math.cos(b), Math.sin(b), Math.sin(a) * Math.cos(b), 0]; }, 14, 10);
  var pearlB = pearl.upload();

  /* ---------- букет куполом над коробкой ---------- */
  var COL = { peach: [.99, .78, .66], blush: [.99, .82, .84], pink: [.95, .45, .62], cream: [.99, .95, .86], fuchsia: [.86, .2, .48], leaf: [.36, .52, .36] };
  var PAL = [[roseB, COL.peach, .62], [roseB, COL.blush, .62], [sprayB, COL.pink, .5], [roseB, COL.cream, .6], [roseB, COL.peach, .62], [sprayB, COL.fuchsia, .48], [roseB, COL.blush, .6]];
  var FL = [], NF = 30, CEN = [0, -.55, 0], RAD = 1.55;
  for (var i = 0; i < NF; i++) {
    var y = 1 - (i + .5) / NF * (1 - .2), r = Math.sqrt(1 - y * y), a = i * GA;
    var nrm = [Math.cos(a) * r, y, Math.sin(a) * r], p = PAL[i % PAL.length], j = 1 + ((i * 37) % 11 - 5) * .012;
    FL.push({ t: [CEN[0] + nrm[0] * RAD * j, CEN[1] + nrm[1] * RAD * j, CEN[2] + nrm[2] * RAD * j], d: nrm, b: p[0], c: p[1], s: p[2] * (1 + ((i * 53) % 7 - 3) * .03), k: i / NF, spin: i * 1.7 });
  }
  var LV = [];
  for (i = 0; i < 14; i++) { var la = i / 14 * 2 * PI + .2; LV.push({ t: [Math.cos(la) * 1.45, -.15, Math.sin(la) * 1.45], d: norm([Math.cos(la), .55, Math.sin(la)]) }); }

  /* ---------- нить жемчуга: спираль вокруг коробки и букета ---------- */
  function rOf(y) { return y < -.2 ? 1.72 : Math.max(.35, Math.sqrt(Math.max(0, 1.62 * 1.62 - (y - CEN[1]) * (y - CEN[1]))) + .16); }
  var NP = 118;
  function pearlPos(s, ph) { var y = -1.45 + s * 2.95, a = s * 2 * PI * 2.4 + ph, r = rOf(y); return [Math.cos(a) * r, y, Math.sin(a) * r]; }

  /* ---------- кадр ---------- */
  var W = 0, H = 0, live = true, last = 0, time = 0, mx = 0, my = 0, tmx = 0, tmy = 0, fade = 0, scr = 0, scrT = 0, intro = 0, ph = 0, boost = 0;
  function resize() {
    var rc = cv.getBoundingClientRect(), dpr = Math.min(devicePixelRatio || 1, 2);
    W = Math.max(1, Math.round(rc.width * dpr)); H = Math.max(1, Math.round(rc.height * dpr));
    if (cv.width !== W || cv.height !== H) { cv.width = W; cv.height = H; }
    gl.viewport(0, 0, W, H);
  }
  addEventListener('resize', function () { resize(); kick(); });
  if (matchMedia('(hover:hover)').matches) addEventListener('pointermove', function (e) { tmx = e.clientX / innerWidth - .5; tmy = e.clientY / innerHeight - .5; }, { passive: true });
  cv.addEventListener('click', function () { if (!reduce) boost = 1; });

  function ease(x) { x = Math.max(0, Math.min(1, x)); return 1 - Math.pow(1 - x, 3); }
  function step(dt) {
    var k = 1 - Math.exp(-dt * 5);
    fade += (1 - fade) * (1 - Math.exp(-dt * 3));
    mx += (tmx - mx) * k; my += (tmy - my) * k; scr += (scrT - scr) * k;
    intro = reduce ? 9 : intro + dt;
    boost *= Math.exp(-dt * 1.4);
    ph += dt * (.12 + boost * 4.5);
  }
  function render() {
    if (!W) resize();
    var asp = W / H, d = 10.8 * Math.max(1, .95 / asp);
    var tg = [0, -.2, 0], eye = [0, 2.4, d];
    var VP = mul(persp(.5, asp, 1, 80), lookAt(eye, tg));
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.uniformMatrix4fv(U.uVP, false, VP); gl.uniform3f(U.uE, eye[0], eye[1], eye[2]); gl.uniform1f(U.uFade, fade);
    var still = reduce ? 0 : 1;
    var G = chain(trans(0, scr * .4, 0), rotY(mx * .6 + still * time * .12 + scr * 1.2), rotX(my * .2 + scr * .25));
    draw(boxB, G, [.95, .82, .8], 3);
    draw(rimB, G, null, 2);
    LV.forEach(function (l, n) {
      var b = ease((intro - .3 - n * .03) / .7); if (b <= 0) return;
      draw(leafB, chain(G, trans(l.t[0], l.t[1], l.t[2]), basis(l.d), scl(.55 * b, .7 * b, .55 * b)), COL.leaf);
    });
    FL.forEach(function (f, n) {
      var t = ease((intro - .4 - f.k * 1.2) / .8); if (t <= 0) return;
      var bob = still * Math.sin(time * 1.4 + n) * .015 + boost * Math.sin(time * 9 + n) * .03, s = f.s * t;
      draw(f.b, chain(G, trans(f.t[0] + f.d[0] * bob, f.t[1] + f.d[1] * bob, f.t[2] + f.d[2] * bob), basis(f.d), rotY(f.spin), scl(s, s, s)), f.c);
    });
    var shown = reduce ? NP : Math.min(NP, Math.floor(Math.max(0, intro - 1.2) * 70));
    for (var q = 0; q < shown; q++) {
      var pp = pearlPos(q / (NP - 1), ph), ps = .085 * (q > shown - 6 ? (shown - q) / 6 : 1);
      draw(pearlB, chain(G, trans(pp[0], pp[1], pp[2]), scl(ps, ps, ps)), null, 1);
    }
  }
  function frame_(now) {
    var dt = Math.min(.05, (now - last) / 1000 || .016); last = now; time += dt;
    step(dt); render();
    if (live) requestAnimationFrame(frame_);
  }
  var pending = false;
  function kick() {
    if (!reduce || pending) return; pending = true;
    requestAnimationFrame(function () { pending = false; step(.05); render(); });
  }
  window.PB = {
    scroll: function (p) { scrT = Math.max(0, Math.min(1, p)); kick(); },
    live: function (v) { if (reduce || v === live) return; live = v; if (v) { last = performance.now(); requestAnimationFrame(frame_); } }
  };
  resize();
  if (reduce) { live = false; fade = 1; intro = 9; kick(); } else requestAnimationFrame(frame_);
})();
