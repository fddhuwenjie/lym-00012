class Exporter {
    constructor(animationEngine, pathEditor) {
        this.animationEngine = animationEngine;
        this.pathEditor = pathEditor;
    }
    
    getEasingAttribute(easing) {
        const map = {
            'linear': '0 0 1 1',
            'ease': '.25 .1 .25 1',
            'ease-in': '.42 0 1 1',
            'ease-out': '0 0 .58 1',
            'ease-in-out': '.42 0 .58 1',
            'bounce': '.68 -.55 .265 1.55',
            'elastic': '.68 -.6 .32 1.6'
        };
        return map[easing] || map['linear'];
    }
    
    getRepeatCount(loop) {
        if (loop === 'repeat') return 'indefinite';
        if (loop === 'alternate') return 'indefinite';
        return '1';
    }
    
    getExpandedObjects() {
        return this.animationEngine.getExpandedObjects();
    }
    
    getSMILAnimation() {
        const { animationEngine, pathEditor } = this;
        const objects = this.getExpandedObjects();
        if (objects.length === 0) return '';
        
        let smil = '';
        
        for (const obj of objects) {
            const path = pathEditor.paths.find(p => p.id === obj.pathId);
            if (!path || path.points.length < 2) continue;
            
            const group = animationEngine.groups.find(g => g.id === obj.originalGroupId);
            const pathD = pathPointsToD(path.points, path.closed);
            const duration = obj.duration.toFixed(2);
            const size = obj.size;
            const easing = this.getEasingAttribute(obj.easing);
            
            const begin = obj.startTime > 0 ? `${obj.startTime.toFixed(2)}s` : '0s';
            
            let elementInner = '';
            
            switch (obj.type) {
                case 'circle':
                    elementInner = `<circle id="smil-${obj.id}" r="${size/2}" fill="${obj.color}" stroke="#fff" stroke-width="2">`;
                    break;
                case 'square':
                    elementInner = `<g id="smil-${obj.id}">
                        <rect x="${-size/2}" y="${-size/2}" width="${size}" height="${size}" fill="${obj.color}" stroke="#fff" stroke-width="2"/>`;
                    break;
                case 'triangle':
                    const h = size * 0.866;
                    elementInner = `<g id="smil-${obj.id}">
                        <polygon points="0,${-size/2} ${size/2},${h/2} ${-size/2},${h/2}" fill="${obj.color}" stroke="#fff" stroke-width="2"/>`;
                    break;
                case 'diamond':
                    elementInner = `<g id="smil-${obj.id}">
                        <polygon points="0,${-size/2} ${size/2},0 0,${size/2} ${-size/2},0" fill="${obj.color}" stroke="#fff" stroke-width="2"/>`;
                    break;
                case 'star':
                    const starPoints = [];
                    for (let i = 0; i < 10; i++) {
                        const angle = (i / 10) * Math.PI * 2 - Math.PI / 2;
                        const r = i % 2 === 0 ? size / 2 : size / 4;
                        starPoints.push(`${Math.cos(angle) * r},${Math.sin(angle) * r}`);
                    }
                    elementInner = `<g id="smil-${obj.id}">
                        <polygon points="${starPoints.join(' ')}" fill="${obj.color}" stroke="#fff" stroke-width="2"/>`;
                    break;
            }
            
            let rotateBegin = '';
            if (obj.type !== 'circle' && obj.orientToPath) {
                rotateBegin = `<animateMotion 
                    dur="${duration}s" 
                    begin="${begin}" 
                    repeatCount="${this.getRepeatCount(obj.loop)}" 
                    calcMode="spline" 
                    keySplines="${easing}" 
                    keyTimes="0;1" 
                    rotate="auto"
                    path="${pathD}"/>`;
            } else {
                rotateBegin = `<animateMotion 
                    dur="${duration}s" 
                    begin="${begin}" 
                    repeatCount="${this.getRepeatCount(obj.loop)}" 
                    calcMode="spline" 
                    keySplines="${easing}" 
                    keyTimes="0;1"
                    path="${pathD}"/>`;
            }
            
            if (obj.loop === 'alternate') {
                rotateBegin = rotateBegin.replace('repeatCount="indefinite"', 'repeatCount="indefinite" autoReverse="true"');
            }
            
            if (obj.type === 'circle') {
                smil += `  ${elementInner}
    ${rotateBegin}
  </circle>\n`;
            } else {
                smil += `  ${elementInner}
    ${rotateBegin}
  </g>\n`;
            }
        }
        
        return smil;
    }
    
    exportSMIL() {
        let svg = '<?xml version="1.0" encoding="UTF-8"?>\n';
        svg += '<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600" viewBox="0 0 800 600">\n';
        svg += '  <rect width="800" height="600" fill="#fafafa" stroke="#ddd" stroke-width="1"/>\n';
        
        for (const path of this.pathEditor.paths) {
            if (path.points.length >= 2) {
                svg += `  <path d="${pathPointsToD(path.points, path.closed)}" fill="none" stroke="${path.color}" stroke-width="2" stroke-dasharray="5,3" opacity="0.6"/>\n`;
            }
        }
        
        const smil = this.getSMILAnimation();
        if (smil) {
            svg += smil;
        }
        
        svg += '</svg>';
        
        this.downloadFile(svg, 'animation-smil.svg', 'image/svg+xml');
    }
    
    exportCSS() {
        const { animationEngine, pathEditor } = this;
        const objects = this.getExpandedObjects();
        
        let keyframes = '';
        let elements = '';
        let css = '';
        
        const totalDuration = animationEngine.totalDuration;
        
        for (let i = 0; i < objects.length; i++) {
            const obj = objects[i];
            const path = pathEditor.paths.find(p => p.id === obj.pathId);
            if (!path || path.points.length < 2) continue;
            
            const pathD = pathPointsToD(path.points, path.closed);
            const animName = `anim_${obj.id}`;
            const duration = obj.duration;
            const size = obj.size;
            
            const steps = 50;
            let kf = `@keyframes ${animName} {\n`;
            for (let s = 0; s <= steps; s++) {
                const t = s / steps;
                const easedT = (EasingFunctions[obj.easing] || EasingFunctions.linear)(t);
                const pos = getPointOnPath(path.points, easedT);
                let rotation = obj.orientToPath ? pos.angle : 0;
                if (obj.type === 'triangle' && obj.orientToPath) rotation -= 90;
                
                const percent = (t * 100).toFixed(1);
                kf += `  ${percent}% { transform: translate(${pos.x.toFixed(1)}px, ${pos.y.toFixed(1)}px) rotate(${rotation.toFixed(1)}deg); }\n`;
            }
            kf += '}\n\n';
            keyframes += kf;
            
            let delay = obj.startTime;
            let iterationCount = obj.loop === 'none' ? '1' : 'infinite';
            let direction = obj.loop === 'alternate' ? 'alternate' : 'normal';
            
            css += `#obj_${i} {\n`;
            css += `  position: absolute;\n`;
            css += `  left: 0; top: 0;\n`;
            css += `  animation: ${animName} ${duration.toFixed(2)}s ${delay.toFixed(2)}s ${iterationCount} ${direction} linear forwards;\n`;
            css += '}\n\n';
            
            let shape = '';
            switch (obj.type) {
                case 'circle':
                    shape = `<circle cx="${size/2}" cy="${size/2}" r="${size/2}" fill="${obj.color}" stroke="#fff" stroke-width="2"/>`;
                    break;
                case 'square':
                    shape = `<rect x="0" y="0" width="${size}" height="${size}" fill="${obj.color}" stroke="#fff" stroke-width="2"/>`;
                    break;
                case 'triangle':
                    const h = size * 0.866;
                    shape = `<polygon points="${size/2},0 ${size},${h} 0,${h}" fill="${obj.color}" stroke="#fff" stroke-width="2"/>`;
                    break;
                case 'diamond':
                    shape = `<polygon points="${size/2},0 ${size},${size/2} ${size/2},${size} 0,${size/2}" fill="${obj.color}" stroke="#fff" stroke-width="2"/>`;
                    break;
                case 'star':
                    const starPoints = [];
                    for (let j = 0; j < 10; j++) {
                        const angle = (j / 10) * Math.PI * 2 - Math.PI / 2;
                        const r = j % 2 === 0 ? size / 2 : size / 4;
                        starPoints.push(`${size/2 + Math.cos(angle) * r},${size/2 + Math.sin(angle) * r}`);
                    }
                    shape = `<polygon points="${starPoints.join(' ')}" fill="${obj.color}" stroke="#fff" stroke-width="2"/>`;
                    break;
            }
            
            elements += `    <svg id="obj_${i}" class="anim-obj" width="${size * 2}" height="${size * 2}" viewBox="0 0 ${size * 2} ${size * 2}">${shape}</svg>\n`;
        }
        
        let html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <title>CSS Path Animation</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { background: #f0f2f5; display: flex; justify-content: center; align-items: center; min-height: 100vh; }
        .stage {
            position: relative;
            width: 800px;
            height: 600px;
            background: #fff;
            border-radius: 8px;
            box-shadow: 0 4px 20px rgba(0,0,0,0.1);
            overflow: hidden;
        }
        .anim-obj {
            transform-origin: center center;
        }
${css}
${keyframes}
    </style>
</head>
<body>
    <div class="stage">
        <svg width="800" height="600" style="position:absolute;top:0;left:0;">
            <rect width="800" height="600" fill="#fafafa" stroke="#ddd" stroke-width="1"/>
${this.pathEditor.paths.filter(p => p.points.length >= 2).map(p => 
    `            <path d="${pathPointsToD(p.points, p.closed)}" fill="none" stroke="${p.color}" stroke-width="2" stroke-dasharray="5,3" opacity="0.5"/>`
).join('\n')}
        </svg>
${elements}
    </div>
</body>
</html>`;
        
        this.downloadFile(html, 'animation-css.html', 'text/html');
    }
    
    exportJS() {
        const { animationEngine, pathEditor } = this;
        
        const pathsData = pathEditor.paths.map(p => ({
            id: p.id,
            name: p.name,
            points: p.points,
            color: p.color,
            closed: p.closed
        }));
        
        const groupsData = animationEngine.groups.map(g => ({
            ...g,
            objectIds: [...g.objectIds]
        }));
        
        const objectsData = this.getExpandedObjects().map(o => ({
            ...o,
            originalGroupId: o.groupId
        }));
        
        const hasTrails = objectsData.some(o => o.trail);
        
        let html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <title>SVG Path Animation</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { 
            font-family: 'Segoe UI', sans-serif;
            background: #f0f2f5; 
            display: flex; 
            flex-direction: column;
            justify-content: center; 
            align-items: center; 
            min-height: 100vh;
            gap: 20px;
        }
        .controls {
            display: flex;
            gap: 10px;
        }
        .btn {
            padding: 10px 24px;
            border: none;
            border-radius: 6px;
            background: #667eea;
            color: white;
            font-size: 14px;
            cursor: pointer;
            transition: background 0.2s;
        }
        .btn:hover { background: #5a6fd6; }
        .btn.secondary { background: #95a5a6; }
        .btn.secondary:hover { background: #7f8c8d; }
        .stage {
            position: relative;
            width: 800px;
            height: 600px;
            background: #fff;
            border-radius: 8px;
            box-shadow: 0 4px 20px rgba(0,0,0,0.1);
        }
        .time-display {
            font-family: 'Courier New', monospace;
            font-size: 16px;
            color: #333;
            padding: 10px 20px;
            background: white;
            border-radius: 6px;
        }
        .animated-object { transition: filter 0.2s; }
        .animated-object:hover { filter: drop-shadow(0 0 8px rgba(0,0,0,0.3)); }
        .particle { pointer-events: none; }
    </style>
</head>
<body>
    <div class="controls">
        <button class="btn" id="btn-play">▶ 播放</button>
        <button class="btn secondary" id="btn-pause">⏸ 暂停</button>
        <button class="btn secondary" id="btn-reset">↺ 重置</button>
        <span class="time-display"><span id="current">0.00</span>s / <span id="total">${animationEngine.totalDuration.toFixed(2)}</span>s</span>
    </div>
    <div class="stage">
        <svg id="canvas" width="800" height="600" viewBox="0 0 800 600">
            <rect width="800" height="600" fill="#fafafa" stroke="#ddd" stroke-width="1"/>
            <g id="paths-layer"></g>
            <g id="particles-layer"></g>
            <g id="objects-layer"></g>
        </svg>
    </div>

    <script>
        const pathsData = ${JSON.stringify(pathsData, null, 2)};
        const groupsData = ${JSON.stringify(groupsData, null, 2)};
        const objectsData = ${JSON.stringify(objectsData, null, 2)};
        const MAX_PARTICLES = 500;
        const hasTrails = ${hasTrails};
        
        const EasingFunctions = ${JSON.stringify(Object.keys(EasingFunctions).reduce((acc, k) => {
            acc[k] = EasingFunctions[k].toString();
            return acc;
        }, {}), null, 2)};
        
        const FadeFunctions = ${JSON.stringify(Object.keys(FadeFunctions).reduce((acc, k) => {
            acc[k] = FadeFunctions[k].toString();
            return acc;
        }, {}), null, 2)};

        function pathPointsToD(points, closed = false) {
            if (!points || points.length === 0) return '';
            let d = 'M ' + points[0].x.toFixed(2) + ' ' + points[0].y.toFixed(2);
            for (let i = 1; i < points.length; i++) {
                const prev = points[i-1], curr = points[i];
                if (prev.type === 'bezier' && curr.type === 'bezier' && prev.cpOut && curr.cpIn) {
                    d += ' C ' + prev.cpOut.x.toFixed(2) + ' ' + prev.cpOut.y.toFixed(2) + ', ' +
                         curr.cpIn.x.toFixed(2) + ' ' + curr.cpIn.y.toFixed(2) + ', ' +
                         curr.x.toFixed(2) + ' ' + curr.y.toFixed(2);
                } else {
                    d += ' L ' + curr.x.toFixed(2) + ' ' + curr.y.toFixed(2);
                }
            }
            if (closed) d += ' Z';
            return d;
        }

        function getSegmentInfo(points) {
            const segments = [];
            let totalLength = 0;
            for (let i = 1; i < points.length; i++) {
                const prev = points[i - 1];
                const curr = points[i];
                let segPoints, segLengths = [], segTotalLength = 0;
                if (prev.type === 'bezier' && curr.type === 'bezier' && prev.cpOut && curr.cpIn) {
                    segPoints = getCubicBezierPoints(prev, curr);
                } else if (prev.type === 'bezier' && prev.cpOut) {
                    segPoints = getQuadraticBezierPoints(prev, curr);
                } else {
                    segPoints = [prev, curr];
                }
                for (let j = 1; j < segPoints.length; j++) {
                    const len = Math.hypot(segPoints[j].x - segPoints[j-1].x, segPoints[j].y - segPoints[j-1].y);
                    segLengths.push(len);
                    segTotalLength += len;
                }
                segments.push({ index: i - 1, points: segPoints, lengths: segLengths, totalLength: segTotalLength, startLength: totalLength });
                totalLength += segTotalLength;
            }
            return { segments, totalLength };
        }

        function getPointOnPath(points, t) {
            if (!points || points.length < 2) return { x: 0, y: 0, angle: 0 };
            const { segments, totalLength } = getSegmentInfo(points);
            const targetLength = Math.max(0, Math.min(1, t)) * totalLength;
            for (const seg of segments) {
                if (seg.startLength + seg.totalLength >= targetLength) {
                    const localTarget = targetLength - seg.startLength;
                    let accumulated = 0;
                    for (let j = 0; j < seg.lengths.length; j++) {
                        if (accumulated + seg.lengths[j] >= localTarget) {
                            const f = seg.lengths[j] > 0 ? (localTarget - accumulated) / seg.lengths[j] : 0;
                            const p1 = seg.points[j];
                            const p2 = seg.points[j + 1];
                            const x = p1.x + (p2.x - p1.x) * f;
                            const y = p1.y + (p2.y - p1.y) * f;
                            const angle = Math.atan2(p2.y - p1.y, p2.x - p1.x) * 180 / Math.PI;
                            return { x, y, angle };
                        }
                        accumulated += seg.lengths[j];
                    }
                    const lastPoint = seg.points[seg.points.length - 1];
                    const prevPoint = seg.points[seg.points.length - 2];
                    const angle = Math.atan2(lastPoint.y - prevPoint.y, lastPoint.x - prevPoint.x) * 180 / Math.PI;
                    return { x: lastPoint.x, y: lastPoint.y, angle };
                }
            }
            const last = points[points.length - 1];
            return { x: last.x, y: last.y, angle: 0 };
        }

        function getCubicBezierPoints(p0, p3) {
            const p1 = p0.cpOut, p2 = p3.cpIn, points = [];
            const steps = 20;
            for (let i = 0; i <= steps; i++) {
                const t = i / steps, mt = 1 - t;
                const x = mt*mt*mt*p0.x + 3*mt*mt*t*p1.x + 3*mt*t*t*p2.x + t*t*t*p3.x;
                const y = mt*mt*mt*p0.y + 3*mt*mt*t*p1.y + 3*mt*t*t*p2.y + t*t*t*p3.y;
                points.push({ x, y });
            }
            return points;
        }

        function getQuadraticBezierPoints(p0, p2) {
            const p1 = p0.cpOut, points = [];
            const steps = 15;
            for (let i = 0; i <= steps; i++) {
                const t = i / steps, mt = 1 - t;
                const x = mt*mt*p0.x + 2*mt*t*p1.x + t*t*p2.x;
                const y = mt*mt*p0.y + 2*mt*t*p1.y + t*t*p2.y;
                points.push({ x, y });
            }
            return points;
        }

        const pathsLayer = document.getElementById('paths-layer');
        const objectsLayer = document.getElementById('objects-layer');
        const particlesLayer = document.getElementById('particles-layer');
        const svgNS = 'http://www.w3.org/2000/svg';

        pathsData.forEach(path => {
            if (path.points.length >= 2) {
                const p = document.createElementNS(svgNS, 'path');
                p.setAttribute('d', pathPointsToD(path.points, path.closed));
                p.setAttribute('fill', 'none');
                p.setAttribute('stroke', path.color);
                p.setAttribute('stroke-width', '2');
                p.setAttribute('stroke-dasharray', '5,3');
                p.setAttribute('opacity', '0.5');
                pathsLayer.appendChild(p);
            }
        });

        let particles = [];
        let lastEmitTimes = {};
        
        function emitParticle(obj, pos, currentTime) {
            if (particles.length >= MAX_PARTICLES) particles.shift();
            if (!obj.trail) return;
            particles.push({
                x: pos.x, y: pos.y, color: obj.color, size: obj.trailSize,
                shape: obj.trailShape, birthTime: currentTime, lifetime: obj.trailLifetime,
                fadeCurve: obj.trailFade, objId: obj.id
            });
        }
        
        function updateParticles(currentTime) {
            particles = particles.filter(p => currentTime - p.birthTime < p.lifetime);
            if (particles.length > MAX_PARTICLES) particles = particles.slice(-MAX_PARTICLES);
        }
        
        function renderParticles(currentTime) {
            particlesLayer.innerHTML = '';
            for (const particle of particles) {
                const age = currentTime - particle.birthTime;
                const lifeRatio = age / particle.lifetime;
                const fadeFn = new Function('t', 'return (' + FadeFunctions[particle.fadeCurve] + ')(t)');
                const opacity = Math.max(0, Math.min(1, fadeFn(lifeRatio)));
                let element;
                if (particle.shape === 'square') {
                    element = document.createElementNS(svgNS, 'rect');
                    element.setAttribute('x', particle.x - particle.size / 2);
                    element.setAttribute('y', particle.y - particle.size / 2);
                    element.setAttribute('width', particle.size);
                    element.setAttribute('height', particle.size);
                } else {
                    element = document.createElementNS(svgNS, 'circle');
                    element.setAttribute('cx', particle.x);
                    element.setAttribute('cy', particle.y);
                    element.setAttribute('r', particle.size / 2);
                }
                element.setAttribute('fill', particle.color);
                element.setAttribute('opacity', opacity);
                element.setAttribute('class', 'particle');
                particlesLayer.appendChild(element);
            }
        }
        
        function emitParticlesForObject(obj, pos, deltaTime, currentTime) {
            if (!obj.trail || !pos.visible) return;
            const lastEmit = lastEmitTimes[obj.id] || 0;
            const emitInterval = 1 / obj.trailDensity;
            if (currentTime - lastEmit >= emitInterval) {
                emitParticle(obj, pos, currentTime);
                lastEmitTimes[obj.id] = currentTime;
            }
        }

        function render(time, deltaTime) {
            objectsLayer.innerHTML = '';
            for (const obj of objectsData) {
                const path = pathsData.find(p => p.id === obj.pathId);
                if (!path || path.points.length < 2) continue;

                const effDur = obj.duration;
                let localT = time - obj.startTime;
                if (localT < 0) continue;

                if (obj.loop === 'repeat') {
                    localT = localT % effDur;
                    if (localT < 0) localT += effDur;
                } else if (obj.loop === 'alternate') {
                    const cycle = effDur * 2;
                    const t = localT % cycle;
                    localT = t <= effDur ? t : cycle - t;
                } else if (localT > effDur) {
                    localT = effDur;
                }

                let t = localT / effDur;
                t = Math.max(0, Math.min(1, t));
                const easing = new Function('t', 'return (' + EasingFunctions[obj.easing] + ')(t)');
                const easedT = easing(t);
                const pos = getPointOnPath(path.points, easedT);
                pos.visible = true;
                
                if (hasTrails) {
                    emitParticlesForObject(obj, pos, deltaTime, time);
                }
                
                const g = document.createElementNS(svgNS, 'g');
                let rot = obj.orientToPath ? pos.angle : 0;
                if (obj.type === 'triangle' && obj.orientToPath) rot -= 90;
                g.setAttribute('transform', 'translate(' + pos.x + ',' + pos.y + ') rotate(' + rot + ')');
                g.setAttribute('class', 'animated-object');

                let el;
                const size = obj.size;
                switch (obj.type) {
                    case 'circle':
                        el = document.createElementNS(svgNS, 'circle');
                        el.setAttribute('r', size/2);
                        break;
                    case 'square':
                        el = document.createElementNS(svgNS, 'rect');
                        el.setAttribute('x', -size/2);
                        el.setAttribute('y', -size/2);
                        el.setAttribute('width', size);
                        el.setAttribute('height', size);
                        break;
                    case 'triangle':
                        el = document.createElementNS(svgNS, 'polygon');
                        const h = size * 0.866;
                        el.setAttribute('points', '0,' + (-size/2) + ' ' + size/2 + ',' + h/2 + ' ' + (-size/2) + ',' + h/2);
                        break;
                    case 'diamond':
                        el = document.createElementNS(svgNS, 'polygon');
                        el.setAttribute('points', '0,' + (-size/2) + ' ' + size/2 + ',0 0,' + size/2 + ' ' + (-size/2) + ',0');
                        break;
                    case 'star':
                        el = document.createElementNS(svgNS, 'polygon');
                        const sp = [];
                        for (let i = 0; i < 10; i++) {
                            const a = (i/10) * Math.PI * 2 - Math.PI/2;
                            const r = i%2 === 0 ? size/2 : size/4;
                            sp.push(Math.cos(a)*r + ',' + Math.sin(a)*r);
                        }
                        el.setAttribute('points', sp.join(' '));
                        break;
                }
                el.setAttribute('fill', obj.color);
                el.setAttribute('stroke', '#fff');
                el.setAttribute('stroke-width', '2');
                g.appendChild(el);
                objectsLayer.appendChild(g);
            }
            
            if (hasTrails) {
                updateParticles(time);
                renderParticles(time);
            }
        }

        let playing = false;
        let currentTime = 0;
        const totalDuration = ${animationEngine.totalDuration};
        let lastTime = 0;
        let rafId = null;

        function animate(now) {
            if (!playing) return;
            const delta = (now - lastTime) / 1000;
            lastTime = now;
            currentTime += delta;
            if (currentTime >= totalDuration) {
                const hasLoop = objectsData.some(o => o.loop !== 'none');
                currentTime = hasLoop ? 0 : totalDuration;
                if (!hasLoop) playing = false;
                if (hasLoop) {
                    particles = [];
                    lastEmitTimes = {};
                }
            }
            render(currentTime, delta);
            document.getElementById('current').textContent = currentTime.toFixed(2);
            if (playing) rafId = requestAnimationFrame(animate);
        }

        document.getElementById('btn-play').addEventListener('click', () => {
            if (!playing) {
                playing = true;
                lastTime = performance.now();
                rafId = requestAnimationFrame(animate);
            }
        });

        document.getElementById('btn-pause').addEventListener('click', () => {
            playing = false;
            if (rafId) cancelAnimationFrame(rafId);
        });

        document.getElementById('btn-reset').addEventListener('click', () => {
            playing = false;
            if (rafId) cancelAnimationFrame(rafId);
            currentTime = 0;
            particles = [];
            lastEmitTimes = {};
            render(0, 0);
            document.getElementById('current').textContent = '0.00';
        });

        render(0, 0);
    <\/script>
</body>
</html>`;
        
        this.downloadFile(html, 'animation-js.html', 'text/html');
    }
    
    downloadFile(content, filename, mimeType) {
        const blob = new Blob([content], { type: mimeType });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }
}
