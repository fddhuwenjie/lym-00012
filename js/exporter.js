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
    
    getSMILAnimation() {
        const { animationEngine, pathEditor } = this;
        if (animationEngine.objects.length === 0) return '';
        
        let smil = '';
        
        for (const obj of animationEngine.objects) {
            const path = pathEditor.paths.find(p => p.id === obj.pathId);
            if (!path || path.points.length < 2) continue;
            
            const pathD = pathPointsToD(path.points, path.closed);
            const duration = (obj.duration / obj.speed).toFixed(2);
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
        
        let keyframes = '';
        let elements = '';
        let css = '';
        
        const totalDuration = animationEngine.totalDuration;
        
        for (let i = 0; i < animationEngine.objects.length; i++) {
            const obj = animationEngine.objects[i];
            const path = pathEditor.paths.find(p => p.id === obj.pathId);
            if (!path || path.points.length < 2) continue;
            
            const pathD = pathPointsToD(path.points, path.closed);
            const animName = `anim_${obj.id}`;
            const duration = (obj.duration / obj.speed);
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
        
        const objectsData = animationEngine.objects.map(o => ({
            ...o
        }));
        
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
            <g id="objects-layer"></g>
        </svg>
    </div>

    <script>
        const pathsData = ${JSON.stringify(pathsData, null, 2)};
        const objectsData = ${JSON.stringify(objectsData, null, 2)};
        const EasingFunctions = ${JSON.stringify(Object.keys(EasingFunctions).reduce((acc, k) => {
            acc[k] = EasingFunctions[k].toString();
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

        function getPointOnPath(points, t) {
            if (!points || points.length < 2) return { x: 0, y: 0, angle: 0 };
            let length = 0;
            for (let i = 1; i < points.length; i++) {
                length += Math.hypot(points[i].x - points[i-1].x, points[i].y - points[i-1].y);
            }
            const target = t * length;
            let current = 0;
            for (let i = 1; i < points.length; i++) {
                const seg = Math.hypot(points[i].x - points[i-1].x, points[i].y - points[i-1].y);
                if (current + seg >= target) {
                    const lt = (target - current) / seg;
                    const x = points[i-1].x + (points[i].x - points[i-1].x) * lt;
                    const y = points[i-1].y + (points[i].y - points[i-1].y) * lt;
                    const angle = Math.atan2(points[i].y - points[i-1].y, points[i].x - points[i-1].x) * 180 / Math.PI;
                    return { x, y, angle };
                }
                current += seg;
            }
            return { x: points[points.length-1].x, y: points[points.length-1].y, angle: 0 };
        }

        const pathsLayer = document.getElementById('paths-layer');
        const objectsLayer = document.getElementById('objects-layer');
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

        function render(time) {
            objectsLayer.innerHTML = '';
            objectsData.forEach(obj => {
                const path = pathsData.find(p => p.id === obj.pathId);
                if (!path || path.points.length < 2) return;

                const effDur = obj.duration / obj.speed;
                let localT = time - obj.startTime;
                if (localT < 0) return;

                if (obj.loop === 'repeat') {
                    localT = localT % effDur;
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
            });
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
            }
            render(currentTime);
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
            render(0);
            document.getElementById('current').textContent = '0.00';
        });

        render(0);
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
