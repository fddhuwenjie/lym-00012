const EasingFunctions = {
    linear: t => t,
    ease: t => {
        const c1 = 1.70158;
        const c3 = c1 + 1;
        return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
    },
    'ease-in': t => t * t,
    'ease-out': t => 1 - (1 - t) * (1 - t),
    'ease-in-out': t => t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2,
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

const FadeFunctions = {
    linear: t => 1 - t,
    'ease-in': t => 1 - t * t,
    'ease-out': t => 1 - (1 - t) * (1 - t),
    'ease-in-out': t => t < 0.5 ? 1 - 2 * t * t : 1 - (1 - Math.pow(-2 * t + 2, 2) / 2)
};

const MAX_PARTICLES = 500;

class AnimationEngine {
    constructor(objectsLayer, pathEditor) {
        this.objectsLayer = objectsLayer;
        this.pathEditor = pathEditor;
        this.objects = [];
        this.groups = [];
        this.particles = [];
        this.particlesLayer = document.getElementById('particles-layer');
        this.playing = false;
        this.currentTime = 0;
        this.totalDuration = 5;
        this.lastTime = 0;
        this.animationFrame = null;
        this.onTimeUpdate = null;
        this.reversePlaying = false;
        this.reversePlayTarget = null;
        this.reversePlayStartTime = 0;
        this.reversePlayDuration = 2;
        this.lastEmitTimes = {};
    }
    
    createGroup(options = {}) {
        const group = {
            id: 'group_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
            name: options.name || '组 ' + (this.groups.length + 1),
            objectIds: options.objectIds || [],
            duration: options.duration !== undefined ? options.duration : 5,
            phase: options.phase !== undefined ? options.phase : 0,
            spacingMode: options.spacingMode || 'arc',
            spacing: options.spacing !== undefined ? options.spacing : 5,
            reverse: options.reverse || false,
            mirrorH: options.mirrorH || false,
            mirrorV: options.mirrorV || false,
            trail: options.trail || false,
            expanded: true
        };
        
        this.groups.push(group);
        this.updateGroupObjects(group);
        this.updateTotalDuration();
        return group;
    }
    
    updateGroup(groupId, updates) {
        const group = this.groups.find(g => g.id === groupId);
        if (group) {
            const oldObjectIds = [...group.objectIds];
            Object.assign(group, updates);
            
            if (updates.objectIds !== undefined) {
                oldObjectIds.forEach(objId => {
                    if (!updates.objectIds.includes(objId)) {
                        const obj = this.objects.find(o => o.id === objId);
                        if (obj) obj.groupId = null;
                    }
                });
            }
            
            this.updateGroupObjects(group);
            this.updateTotalDuration();
        }
    }
    
    deleteGroup(groupId) {
        const index = this.groups.findIndex(g => g.id === groupId);
        if (index !== -1) {
            const group = this.groups[index];
            group.objectIds.forEach(objId => {
                const obj = this.objects.find(o => o.id === objId);
                if (obj) obj.groupId = null;
            });
            this.groups.splice(index, 1);
            this.updateTotalDuration();
        }
    }
    
    updateGroupObjects(group) {
        group.objectIds.forEach(objId => {
            const obj = this.objects.find(o => o.id === objId);
            if (obj) {
                obj.groupId = group.id;
            }
        });
    }
    
    getGroupObjectPhase(group, obj, time) {
        const objIndex = group.objectIds.indexOf(obj.id);
        if (objIndex === -1) return 0;
        
        const numObjects = group.objectIds.length;
        const totalSpacing = group.spacing;
        
        if (group.spacingMode === 'time') {
            const interval = group.duration / totalSpacing;
            return (objIndex * interval) / group.duration;
        } else {
            return (objIndex / totalSpacing) % 1;
        }
    }
    
    getEffectiveObjectTime(obj, time) {
        const group = obj.groupId ? this.groups.find(g => g.id === obj.groupId) : null;
        
        if (!group) {
            return time;
        }
        
        const phase = this.getGroupObjectPhase(group, obj, time);
        let effectiveTime = time - obj.startTime + group.phase * group.duration;
        
        if (group.reverse || this.reversePlaying) {
            const cycleTime = group.duration;
            const t = ((effectiveTime % cycleTime) + cycleTime) % cycleTime;
            effectiveTime = time - obj.startTime + (1 - t / cycleTime) * cycleTime;
        }
        
        return effectiveTime;
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
            visible: true,
            groupId: options.groupId || null,
            trail: options.trail || false,
            trailShape: options.trailShape || 'circle',
            trailDensity: options.trailDensity !== undefined ? options.trailDensity : 20,
            trailLifetime: options.trailLifetime !== undefined ? options.trailLifetime : 1,
            trailLength: options.trailLength !== undefined ? options.trailLength : 50,
            trailSize: options.trailSize !== undefined ? options.trailSize : 3,
            trailFade: options.trailFade || 'linear'
        };
        
        this.objects.push(obj);
        this.lastEmitTimes[obj.id] = 0;
        this.updateTotalDuration();
        return obj;
    }
    
    updateObject(objId, updates) {
        const obj = this.objects.find(o => o.id === objId);
        if (obj) {
            const oldGroupId = obj.groupId;
            Object.assign(obj, updates);
            
            if (updates.groupId !== undefined && updates.groupId !== oldGroupId) {
                if (oldGroupId) {
                    const oldGroup = this.groups.find(g => g.id === oldGroupId);
                    if (oldGroup) {
                        oldGroup.objectIds = oldGroup.objectIds.filter(id => id !== objId);
                    }
                }
                if (updates.groupId) {
                    const newGroup = this.groups.find(g => g.id === updates.groupId);
                    if (newGroup && !newGroup.objectIds.includes(objId)) {
                        newGroup.objectIds.push(objId);
                    }
                }
            }
            
            this.updateTotalDuration();
        }
    }
    
    deleteObject(objId) {
        const index = this.objects.findIndex(o => o.id === objId);
        if (index !== -1) {
            const obj = this.objects[index];
            if (obj.groupId) {
                const group = this.groups.find(g => g.id === obj.groupId);
                if (group) {
                    group.objectIds = group.objectIds.filter(id => id !== objId);
                }
            }
            this.objects.splice(index, 1);
            delete this.lastEmitTimes[objId];
            this.updateTotalDuration();
        }
    }
    
    updateTotalDuration() {
        if (this.objects.length === 0 && this.groups.length === 0) {
            this.totalDuration = 5;
        } else {
            let maxEnd = 5;
            
            this.objects.forEach(obj => {
                const group = obj.groupId ? this.groups.find(g => g.id === obj.groupId) : null;
                const duration = group ? group.duration : (obj.duration / obj.speed);
                const end = obj.startTime + duration;
                if (obj.loop === 'none') {
                    maxEnd = Math.max(maxEnd, end);
                } else {
                    maxEnd = Math.max(maxEnd, end, this.totalDuration);
                }
            });
            
            this.groups.forEach(group => {
                maxEnd = Math.max(maxEnd, group.duration);
            });
            
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
        
        const group = obj.groupId ? this.groups.find(g => g.id === obj.groupId) : null;
        const effectiveTime = this.getEffectiveObjectTime(obj, time);
        
        const effectiveDuration = group ? group.duration : (obj.duration / obj.speed);
        let localTime = effectiveTime - obj.startTime;
        
        if (localTime < 0) {
            const firstPoint = path.points[0];
            return { x: firstPoint.x, y: firstPoint.y, angle: 0, visible: false };
        }
        
        const loopMode = group ? 'repeat' : obj.loop;
        
        if (loopMode === 'repeat') {
            localTime = localTime % effectiveDuration;
            if (localTime < 0) localTime += effectiveDuration;
        } else if (loopMode === 'alternate') {
            const cycle = effectiveDuration * 2;
            const t = localTime % cycle;
            localTime = t <= effectiveDuration ? t : cycle - t;
        } else if (localTime > effectiveDuration) {
            const lastPoint = path.points[path.points.length - 1];
            return { x: lastPoint.x, y: lastPoint.y, angle: 0, visible: true };
        }
        
        let t = localTime / effectiveDuration;
        t = Math.max(0, Math.min(1, t));
        
        if (group && group.reverse) {
            t = 1 - t;
        }
        
        const easingFn = EasingFunctions[obj.easing] || EasingFunctions.linear;
        const easedT = easingFn(t);
        
        const pos = getPointOnPath(path.points, easedT);
        pos.visible = true;
        
        if (group) {
            if (group.mirrorH) {
                pos.x = 800 - pos.x;
                pos.angle = 180 - pos.angle;
            }
            if (group.mirrorV) {
                pos.y = 600 - pos.y;
                pos.angle = -pos.angle;
            }
        }
        
        return pos;
    }
    
    emitParticle(obj, pos) {
        if (this.particles.length >= MAX_PARTICLES) {
            this.particles.shift();
        }
        
        const group = obj.groupId ? this.groups.find(g => g.id === obj.groupId) : null;
        const useTrail = group ? group.trail : obj.trail;
        
        if (!useTrail) return;
        
        const particle = {
            id: 'p_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
            x: pos.x,
            y: pos.y,
            color: obj.color,
            size: obj.trailSize,
            shape: obj.trailShape,
            birthTime: this.currentTime,
            lifetime: obj.trailLifetime,
            fadeCurve: obj.trailFade,
            objId: obj.id
        };
        
        this.particles.push(particle);
    }
    
    updateParticles() {
        const now = this.currentTime;
        this.particles = this.particles.filter(p => {
            const age = now - p.birthTime;
            return age < p.lifetime;
        });
        
        if (this.particles.length > MAX_PARTICLES) {
            this.particles = this.particles.slice(-MAX_PARTICLES);
        }
    }
    
    renderParticles() {
        if (!this.particlesLayer) return;
        
        this.particlesLayer.innerHTML = '';
        const svgNS = 'http://www.w3.org/2000/svg';
        
        for (const particle of this.particles) {
            const age = this.currentTime - particle.birthTime;
            const lifeRatio = age / particle.lifetime;
            const fadeFn = FadeFunctions[particle.fadeCurve] || FadeFunctions.linear;
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
            
            this.particlesLayer.appendChild(element);
        }
    }
    
    emitParticlesForObject(obj, pos, deltaTime) {
        const group = obj.groupId ? this.groups.find(g => g.id === obj.groupId) : null;
        const useTrail = group ? group.trail : obj.trail;
        
        if (!useTrail || !pos.visible) return;
        
        const lastEmit = this.lastEmitTimes[obj.id] || 0;
        const emitInterval = 1 / obj.trailDensity;
        
        if (this.currentTime - lastEmit >= emitInterval) {
            this.emitParticle(obj, pos);
            this.lastEmitTimes[obj.id] = this.currentTime;
        }
    }
    
    play() {
        if (this.playing) return;
        this.playing = true;
        this.reversePlaying = false;
        this.lastTime = performance.now();
        this.animate();
    }
    
    pause() {
        this.playing = false;
        this.reversePlaying = false;
        if (this.animationFrame) {
            cancelAnimationFrame(this.animationFrame);
            this.animationFrame = null;
        }
    }
    
    reset() {
        this.pause();
        this.currentTime = 0;
        this.particles = [];
        this.lastEmitTimes = {};
        this.render();
        this.updateTimeDisplay();
    }
    
    setTime(time) {
        this.currentTime = Math.max(0, Math.min(this.totalDuration, time));
        this.particles = [];
        this.lastEmitTimes = {};
        this.render();
        this.updateTimeDisplay();
    }
    
    startReversePlay(objId = null) {
        if (this.playing) {
            this.pause();
        }
        
        this.reversePlaying = true;
        this.reversePlayStartTime = this.currentTime;
        this.reversePlayDuration = 2;
        this.reversePlayTarget = 0;
        this.reversePlayObjId = objId;
        this.particles = [];
        this.lastEmitTimes = {};
        this.lastTime = performance.now();
        
        const btn = document.getElementById('btn-reverse-play');
        if (btn) btn.classList.add('reverse-playing');
        
        this.animate();
    }
    
    animate() {
        if (!this.playing && !this.reversePlaying) return;
        
        const now = performance.now();
        const delta = (now - this.lastTime) / 1000;
        this.lastTime = now;
        
        if (this.reversePlaying) {
            const progress = (this.currentTime - this.reversePlayTarget) / this.reversePlayDuration;
            this.currentTime -= delta;
            
            if (this.currentTime <= this.reversePlayTarget) {
                this.currentTime = this.reversePlayTarget;
                this.reversePlaying = false;
                const btn = document.getElementById('btn-reverse-play');
                if (btn) btn.classList.remove('reverse-playing');
            }
        } else {
            this.currentTime += delta;
            
            if (this.currentTime >= this.totalDuration) {
                const hasLooping = this.objects.some(o => {
                    const group = o.groupId ? this.groups.find(g => g.id === o.groupId) : null;
                    return group ? true : (o.loop !== 'none');
                });
                if (hasLooping) {
                    this.currentTime = 0;
                    this.particles = [];
                    this.lastEmitTimes = {};
                } else {
                    this.currentTime = this.totalDuration;
                    this.pause();
                }
            }
        }
        
        this.updateParticles();
        
        for (const obj of this.objects) {
            if (!obj.visible) continue;
            const pos = this.getObjectPosition(obj, this.currentTime);
            if (pos.visible) {
                this.emitParticlesForObject(obj, pos, delta);
            }
        }
        
        this.render();
        this.updateTimeDisplay();
        
        if (this.onTimeUpdate) {
            this.onTimeUpdate(this.currentTime);
        }
        
        if (this.playing || this.reversePlaying) {
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
        
        const renderObjects = [];
        
        for (const obj of this.objects) {
            if (!obj.visible) continue;
            
            const pos = this.getObjectPosition(obj, this.currentTime);
            if (!pos.visible) continue;
            
            renderObjects.push({ obj, pos });
        }
        
        for (const { obj, pos } of renderObjects) {
            const svgNS = 'http://www.w3.org/2000/svg';
            const g = document.createElementNS(svgNS, 'g');
            g.setAttribute('id', 'svg-' + obj.id);
            g.setAttribute('class', 'animated-object');
            g.setAttribute('transform', `translate(${pos.x}, ${pos.y})`);
            
            let element;
            const size = obj.size;
            
            switch (obj.type) {
                case 'circle':
                    element = document.createElementNS(svgNS, 'circle');
                    element.setAttribute('r', size / 2);
                    element.setAttribute('fill', obj.color);
                    break;
                    
                case 'square':
                    element = document.createElementNS(svgNS, 'rect');
                    element.setAttribute('x', -size / 2);
                    element.setAttribute('y', -size / 2);
                    element.setAttribute('width', size);
                    element.setAttribute('height', size);
                    element.setAttribute('fill', obj.color);
                    break;
                    
                case 'triangle':
                    element = document.createElementNS(svgNS, 'polygon');
                    const h = size * 0.866;
                    element.setAttribute('points', `0,${-size/2} ${size/2},${h/2} ${-size/2},${h/2}`);
                    element.setAttribute('fill', obj.color);
                    if (obj.orientToPath) {
                        g.setAttribute('transform', `translate(${pos.x}, ${pos.y}) rotate(${pos.angle - 90})`);
                    }
                    break;
                    
                case 'diamond':
                    element = document.createElementNS(svgNS, 'polygon');
                    element.setAttribute('points', `0,${-size/2} ${size/2},0 0,${size/2} ${-size/2},0`);
                    element.setAttribute('fill', obj.color);
                    break;
                    
                case 'star':
                    element = document.createElementNS(svgNS, 'polygon');
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
        
        this.renderParticles();
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
    
    getExpandedObjects() {
        const result = [];
        const processedGroups = new Set();
        
        for (const obj of this.objects) {
            if (obj.groupId && !processedGroups.has(obj.groupId)) {
                const group = this.groups.find(g => g.id === obj.groupId);
                if (group) {
                    processedGroups.add(group.id);
                    group.objectIds.forEach((objId, index) => {
                        const childObj = this.objects.find(o => o.id === objId);
                        if (childObj) {
                            const phase = this.getGroupObjectPhase(group, childObj, 0);
                            result.push({
                                ...childObj,
                                groupId: null,
                                startTime: childObj.startTime + phase * group.duration,
                                duration: group.duration,
                                speed: 1,
                                loop: 'repeat',
                                trail: group.trail || childObj.trail
                            });
                        }
                    });
                }
            } else if (!obj.groupId) {
                result.push({ ...obj });
            }
        }
        
        return result;
    }
}
