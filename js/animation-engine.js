const EasingFunctions = {
    linear: t => t,
    ease: t => t * (2 - t),
    'ease-in': t => t * t,
    'ease-out': t => t * (2 - t),
    'ease-in-out': t => t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t,
    bounce: t => {
        if (t < 1 / 2.75) return 7.5625 * t * t;
        if (t < 2 / 2.75) return 7.5625 * (t -= 1.5 / 2.75) * t + 0.75;
        if (t < 2.5 / 2.75) return 7.5625 * (t -= 2.25 / 2.75) * t + 0.9375;
        return 7.5625 * (t -= 2.625 / 2.75) * t + 0.984375;
    },
    elastic: t => {
        if (t === 0 || t === 1) return t;
        return Math.pow(2, -10 * t) * Math.sin((t - 0.1) * 5 * Math.PI) + 1;
    }
};

class AnimationEngine {
    constructor(objectsLayer, pathEditor) {
        this.objectsLayer = objectsLayer;
        this.pathEditor = pathEditor;
        this.objects = [];
        this.playing = false;
        this.currentTime = 0;
        this.totalDuration = 5;
        this.lastTime = 0;
        this.animationFrame = null;
        this.onTimeUpdate = null;
    }
    
    createObject(options = {}) {
        const obj = {
            id: 'obj_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
            name: options.name || '对象 ' + (this.objects.length + 1),
            type: options.type || 'circle',
            color: options.color || '#ff6b6b',
            size: options.size || 20,
            pathId: options.pathId || (this.pathEditor.paths[0] && this.pathEditor.paths[0].id),
            startTime: options.startTime !== undefined ? options.startTime : 0,
            duration: options.duration !== undefined ? options.duration : 3,
            speed: options.speed || 1,
            easing: options.easing || 'linear',
            loop: options.loop || 'none',
            orientToPath: options.orientToPath !== undefined ? options.orientToPath : true,
            visible: true
        };
        
        this.objects.push(obj);
        this.updateTotalDuration();
        return obj;
    }
    
    updateObject(objId, updates) {
        const obj = this.objects.find(o => o.id === objId);
        if (obj) {
            Object.assign(obj, updates);
            this.updateTotalDuration();
        }
    }
    
    deleteObject(objId) {
        const index = this.objects.findIndex(o => o.id === objId);
        if (index !== -1) {
            this.objects.splice(index, 1);
            this.updateTotalDuration();
        }
    }
    
    updateTotalDuration() {
        if (this.objects.length === 0) {
            this.totalDuration = 5;
        } else {
            const maxEnd = Math.max(...this.objects.map(o => {
                const end = o.startTime + o.duration / o.speed;
                if (o.loop === 'none') return end;
                return Math.max(end, this.totalDuration);
            }));
            this.totalDuration = Math.max(5, Math.ceil(maxEnd * 10) / 10);
        }
        
        const totalTimeEl = document.getElementById('total-time');
        if (totalTimeEl) {
            totalTimeEl.textContent = this.totalDuration.toFixed(2);
        }
    }
    
    getObjectPosition(obj, time) {
        const path = this.pathEditor.paths.find(p => p.id === obj.pathId);
        if (!path || path.points.length < 2) {
            return { x: 100, y: 100, angle: 0 };
        }
        
        const effectiveDuration = obj.duration / obj.speed;
        let localTime = time - obj.startTime;
        
        if (localTime < 0) {
            const firstPoint = path.points[0];
            return { x: firstPoint.x, y: firstPoint.y, angle: 0, visible: false };
        }
        
        if (obj.loop === 'repeat') {
            localTime = localTime % effectiveDuration;
        } else if (obj.loop === 'alternate') {
            const cycle = effectiveDuration * 2;
            const t = localTime % cycle;
            localTime = t <= effectiveDuration ? t : cycle - t;
        } else if (localTime > effectiveDuration) {
            const lastPoint = path.points[path.points.length - 1];
            return { x: lastPoint.x, y: lastPoint.y, angle: 0, visible: true };
        }
        
        let t = localTime / effectiveDuration;
        t = Math.max(0, Math.min(1, t));
        
        const easingFn = EasingFunctions[obj.easing] || EasingFunctions.linear;
        const easedT = easingFn(t);
        
        const pos = getPointOnPath(path.points, easedT);
        pos.visible = true;
        return pos;
    }
    
    play() {
        if (this.playing) return;
        this.playing = true;
        this.lastTime = performance.now();
        this.animate();
    }
    
    pause() {
        this.playing = false;
        if (this.animationFrame) {
            cancelAnimationFrame(this.animationFrame);
            this.animationFrame = null;
        }
    }
    
    reset() {
        this.pause();
        this.currentTime = 0;
        this.render();
        this.updateTimeDisplay();
    }
    
    setTime(time) {
        this.currentTime = Math.max(0, Math.min(this.totalDuration, time));
        this.render();
        this.updateTimeDisplay();
    }
    
    animate() {
        if (!this.playing) return;
        
        const now = performance.now();
        const delta = (now - this.lastTime) / 1000;
        this.lastTime = now;
        
        this.currentTime += delta;
        
        if (this.currentTime >= this.totalDuration) {
            const hasLooping = this.objects.some(o => o.loop !== 'none');
            if (hasLooping) {
                this.currentTime = 0;
            } else {
                this.currentTime = this.totalDuration;
                this.pause();
            }
        }
        
        this.render();
        this.updateTimeDisplay();
        
        if (this.onTimeUpdate) {
            this.onTimeUpdate(this.currentTime);
        }
        
        if (this.playing) {
            this.animationFrame = requestAnimationFrame(() => this.animate());
        }
    }
    
    updateTimeDisplay() {
        const currentTimeEl = document.getElementById('current-time');
        if (currentTimeEl) {
            currentTimeEl.textContent = this.currentTime.toFixed(2);
        }
    }
    
    render() {
        this.objectsLayer.innerHTML = '';
        
        for (const obj of this.objects) {
            if (!obj.visible) continue;
            
            const pos = this.getObjectPosition(obj, this.currentTime);
            if (!pos.visible) continue;
            
            const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
            g.setAttribute('id', 'svg-' + obj.id);
            g.setAttribute('class', 'animated-object');
            g.setAttribute('transform', `translate(${pos.x}, ${pos.y})`);
            
            let element;
            const size = obj.size;
            
            switch (obj.type) {
                case 'circle':
                    element = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
                    element.setAttribute('r', size / 2);
                    element.setAttribute('fill', obj.color);
                    break;
                    
                case 'square':
                    element = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
                    element.setAttribute('x', -size / 2);
                    element.setAttribute('y', -size / 2);
                    element.setAttribute('width', size);
                    element.setAttribute('height', size);
                    element.setAttribute('fill', obj.color);
                    break;
                    
                case 'triangle':
                    element = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
                    const h = size * 0.866;
                    element.setAttribute('points', `0,${-size/2} ${size/2},${h/2} ${-size/2},${h/2}`);
                    element.setAttribute('fill', obj.color);
                    if (obj.orientToPath) {
                        g.setAttribute('transform', `translate(${pos.x}, ${pos.y}) rotate(${pos.angle - 90})`);
                    }
                    break;
                    
                case 'diamond':
                    element = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
                    element.setAttribute('points', `0,${-size/2} ${size/2},0 0,${size/2} ${-size/2},0`);
                    element.setAttribute('fill', obj.color);
                    break;
                    
                case 'star':
                    element = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
                    const starPoints = [];
                    for (let i = 0; i < 10; i++) {
                        const angle = (i / 10) * Math.PI * 2 - Math.PI / 2;
                        const r = i % 2 === 0 ? size / 2 : size / 4;
                        starPoints.push(`${Math.cos(angle) * r},${Math.sin(angle) * r}`);
                    }
                    element.setAttribute('points', starPoints.join(' '));
                    element.setAttribute('fill', obj.color);
                    break;
            }
            
            if (obj.orientToPath && obj.type !== 'triangle') {
                g.setAttribute('transform', `translate(${pos.x}, ${pos.y}) rotate(${pos.angle})`);
            }
            
            element.setAttribute('stroke', '#fff');
            element.setAttribute('stroke-width', 2);
            
            g.appendChild(element);
            g.dataset.objId = obj.id;
            
            g.addEventListener('click', () => {
                if (window.app) {
                    window.app.selectObject(obj.id);
                }
            });
            
            this.objectsLayer.appendChild(g);
        }
    }
    
    getObjectSVGElement(obj, time = 0) {
        const pos = this.getObjectPosition(obj, time);
        const size = obj.size;
        
        let element;
        let rotation = obj.orientToPath ? pos.angle : 0;
        if (obj.type === 'triangle' && obj.orientToPath) rotation -= 90;
        
        switch (obj.type) {
            case 'circle':
                return `<circle cx="${pos.x}" cy="${pos.y}" r="${size/2}" fill="${obj.color}" stroke="#fff" stroke-width="2"/>`;
            case 'square':
                return `<g transform="translate(${pos.x},${pos.y}) rotate(${rotation})">
                    <rect x="${-size/2}" y="${-size/2}" width="${size}" height="${size}" fill="${obj.color}" stroke="#fff" stroke-width="2"/>
                </g>`;
            case 'triangle':
                const h = size * 0.866;
                return `<g transform="translate(${pos.x},${pos.y}) rotate(${rotation})">
                    <polygon points="0,${-size/2} ${size/2},${h/2} ${-size/2},${h/2}" fill="${obj.color}" stroke="#fff" stroke-width="2"/>
                </g>`;
            case 'diamond':
                return `<g transform="translate(${pos.x},${pos.y}) rotate(${rotation})">
                    <polygon points="0,${-size/2} ${size/2},0 0,${size/2} ${-size/2},0" fill="${obj.color}" stroke="#fff" stroke-width="2"/>
                </g>`;
            case 'star':
                const starPoints = [];
                for (let i = 0; i < 10; i++) {
                    const angle = (i / 10) * Math.PI * 2 - Math.PI / 2;
                    const r = i % 2 === 0 ? size / 2 : size / 4;
                    starPoints.push(`${Math.cos(angle) * r},${Math.sin(angle) * r}`);
                }
                return `<g transform="translate(${pos.x},${pos.y}) rotate(${rotation})">
                    <polygon points="${starPoints.join(' ')}" fill="${obj.color}" stroke="#fff" stroke-width="2"/>
                </g>`;
        }
        
        return '';
    }
}
