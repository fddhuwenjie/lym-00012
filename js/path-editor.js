class PathEditor {
    constructor(svg, pathsLayer, handlesLayer) {
        this.svg = svg;
        this.pathsLayer = pathsLayer;
        this.handlesLayer = handlesLayer;
        this.paths = [];
        this.currentPathId = null;
        this.selectedAnchor = null;
        this.selectedControl = null;
        this.dragging = null;
        this.tool = 'select';
        this.pathType = 'bezier';
        this.hoveredAnchor = null;
        
        this.init();
    }
    
    init() {
        this.createNewPath();
        this.drawGrid();
        this.bindEvents();
    }
    
    drawGrid() {
        const gridLayer = document.getElementById('grid-layer');
        gridLayer.innerHTML = '';
        
        for (let x = 0; x <= 800; x += 50) {
            const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
            line.setAttribute('x1', x);
            line.setAttribute('y1', 0);
            line.setAttribute('x2', x);
            line.setAttribute('y2', 600);
            line.setAttribute('class', 'grid-line');
            gridLayer.appendChild(line);
        }
        
        for (let y = 0; y <= 600; y += 50) {
            const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
            line.setAttribute('x1', 0);
            line.setAttribute('y1', y);
            line.setAttribute('x2', 800);
            line.setAttribute('y2', y);
            line.setAttribute('class', 'grid-line');
            gridLayer.appendChild(line);
        }
    }
    
    createNewPath(name = '路径 ' + (this.paths.length + 1)) {
        const path = {
            id: 'path_' + Date.now(),
            name: name,
            points: [],
            color: this.getRandomColor(),
            closed: false
        };
        this.paths.push(path);
        this.currentPathId = path.id;
        return path;
    }
    
    getRandomColor() {
        const colors = ['#667eea', '#f093fb', '#4facfe', '#43e97b', '#fa709a', '#fee140', '#30cfd0'];
        return colors[this.paths.length % colors.length];
    }
    
    getCurrentPath() {
        return this.paths.find(p => p.id === this.currentPathId);
    }
    
    setTool(tool) {
        this.tool = tool;
        this.svg.style.cursor = tool === 'add' ? 'crosshair' : tool === 'delete' ? 'not-allowed' : 'default';
    }
    
    setPathType(type) {
        this.pathType = type;
    }
    
    loadPreset(presetName) {
        const preset = PresetPaths[presetName];
        if (!preset) return;
        
        const points = preset.generate();
        const path = this.createNewPath(preset.name);
        path.points = points;
        this.currentPathId = path.id;
        this.render();
        
        document.getElementById('canvas-hint').classList.add('hidden');
    }
    
    clearCurrentPath() {
        const path = this.getCurrentPath();
        if (path) {
            path.points = [];
            this.render();
        }
    }
    
    clearAll() {
        this.paths = [];
        this.selectedAnchor = null;
        this.selectedControl = null;
        this.createNewPath();
        this.render();
    }
    
    bindEvents() {
        this.svg.addEventListener('mousedown', (e) => this.onMouseDown(e));
        this.svg.addEventListener('mousemove', (e) => this.onMouseMove(e));
        this.svg.addEventListener('mouseup', (e) => this.onMouseUp(e));
        this.svg.addEventListener('mouseleave', (e) => this.onMouseUp(e));
        
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Delete' && this.selectedAnchor !== null) {
                this.deleteAnchor(this.selectedAnchor.pathId, this.selectedAnchor.pointIndex);
            }
            if (e.key === 'Escape') {
                this.selectedAnchor = null;
                this.selectedControl = null;
                this.render();
            }
        });
    }
    
    getMousePos(e) {
        const rect = this.svg.getBoundingClientRect();
        return {
            x: e.clientX - rect.left,
            y: e.clientY - rect.top
        };
    }
    
    onMouseDown(e) {
        const pos = this.getMousePos(e);
        
        if (this.tool === 'add') {
            this.addAnchor(pos);
            return;
        }
        
        if (this.tool === 'delete') {
            const hit = this.hitTestAnchor(pos);
            if (hit) {
                this.deleteAnchor(hit.pathId, hit.pointIndex);
            }
            return;
        }
        
        const controlHit = this.hitTestControl(pos);
        if (controlHit) {
            this.dragging = { type: 'control', ...controlHit, startX: pos.x, startY: pos.y };
            this.selectedControl = controlHit;
            this.selectedAnchor = null;
            return;
        }
        
        const anchorHit = this.hitTestAnchor(pos);
        if (anchorHit) {
            this.dragging = { type: 'anchor', ...anchorHit, startX: pos.x, startY: pos.y };
            this.selectedAnchor = anchorHit;
            this.selectedControl = null;
            this.currentPathId = anchorHit.pathId;
            return;
        }
        
        this.selectedAnchor = null;
        this.selectedControl = null;
        this.render();
    }
    
    onMouseMove(e) {
        if (!this.dragging) return;
        
        const pos = this.getMousePos(e);
        const dx = pos.x - this.dragging.startX;
        const dy = pos.y - this.dragging.startY;
        
        const path = this.paths.find(p => p.id === this.dragging.pathId);
        if (!path) return;
        
        if (this.dragging.type === 'anchor') {
            const point = path.points[this.dragging.pointIndex];
            if (point) {
                if (point.cpIn) {
                    point.cpIn.x += dx;
                    point.cpIn.y += dy;
                }
                if (point.cpOut) {
                    point.cpOut.x += dx;
                    point.cpOut.y += dy;
                }
                point.x += dx;
                point.y += dy;
            }
        } else if (this.dragging.type === 'control') {
            const point = path.points[this.dragging.pointIndex];
            if (point) {
                const cp = this.dragging.cpType === 'in' ? point.cpIn : point.cpOut;
                if (cp) {
                    cp.x += dx;
                    cp.y += dy;
                }
            }
        }
        
        this.dragging.startX = pos.x;
        this.dragging.startY = pos.y;
        
        this.render();
        
        if (window.app && window.app.updateSource) {
            window.app.updateSource();
        }
    }
    
    onMouseUp(e) {
        this.dragging = null;
    }
    
    hitTestAnchor(pos) {
        const threshold = 10;
        
        for (const path of this.paths) {
            for (let i = 0; i < path.points.length; i++) {
                const p = path.points[i];
                const dist = Math.hypot(pos.x - p.x, pos.y - p.y);
                if (dist < threshold) {
                    return { pathId: path.id, pointIndex: i };
                }
            }
        }
        
        return null;
    }
    
    hitTestControl(pos) {
        const threshold = 8;
        
        for (const path of this.paths) {
            for (let i = 0; i < path.points.length; i++) {
                const p = path.points[i];
                
                if (p.cpIn) {
                    const dist = Math.hypot(pos.x - p.cpIn.x, pos.y - p.cpIn.y);
                    if (dist < threshold) {
                        return { pathId: path.id, pointIndex: i, cpType: 'in' };
                    }
                }
                
                if (p.cpOut) {
                    const dist = Math.hypot(pos.x - p.cpOut.x, pos.y - p.cpOut.y);
                    if (dist < threshold) {
                        return { pathId: path.id, pointIndex: i, cpType: 'out' };
                    }
                }
            }
        }
        
        return null;
    }
    
    addAnchor(pos) {
        const path = this.getCurrentPath();
        if (!path) return;
        
        document.getElementById('canvas-hint').classList.add('hidden');
        
        const lastPoint = path.points[path.points.length - 1];
        const cpOffset = 50;
        
        const newPoint = {
            x: pos.x,
            y: pos.y,
            type: this.pathType,
            cpIn: null,
            cpOut: null
        };
        
        if (path.points.length > 0) {
            const dx = pos.x - lastPoint.x;
            const dy = pos.y - lastPoint.y;
            const angle = Math.atan2(dy, dx);
            
            if (this.pathType === 'bezier') {
                newPoint.cpIn = {
                    x: pos.x - Math.cos(angle) * cpOffset,
                    y: pos.y - Math.sin(angle) * cpOffset
                };
                newPoint.cpOut = {
                    x: pos.x + Math.cos(angle) * cpOffset,
                    y: pos.y + Math.sin(angle) * cpOffset
                };
                
                if (!lastPoint.cpOut) {
                    lastPoint.cpOut = {
                        x: lastPoint.x + Math.cos(angle) * cpOffset,
                        y: lastPoint.y + Math.sin(angle) * cpOffset
                    };
                }
                lastPoint.type = 'bezier';
            }
        }
        
        path.points.push(newPoint);
        this.selectedAnchor = { pathId: path.id, pointIndex: path.points.length - 1 };
        this.render();
    }
    
    deleteAnchor(pathId, pointIndex) {
        const path = this.paths.find(p => p.id === pathId);
        if (!path || pointIndex < 0 || pointIndex >= path.points.length) return;
        
        path.points.splice(pointIndex, 1);
        this.selectedAnchor = null;
        this.render();
    }
    
    render() {
        this.pathsLayer.innerHTML = '';
        this.handlesLayer.innerHTML = '';
        
        for (const path of this.paths) {
            if (path.points.length >= 2) {
                const pathEl = document.createElementNS('http://www.w3.org/2000/svg', 'path');
                pathEl.setAttribute('d', pathPointsToD(path.points, path.closed));
                pathEl.setAttribute('class', 'path-visual');
                pathEl.setAttribute('stroke', path.color);
                pathEl.setAttribute('id', 'svg-' + path.id);
                pathEl.setAttribute('marker-end', 'url(#arrowhead)');
                this.pathsLayer.appendChild(pathEl);
            }
        }
        
        for (const path of this.paths) {
            for (let i = 0; i < path.points.length; i++) {
                const p = path.points[i];
                
                if (p.cpIn && i > 0) {
                    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
                    line.setAttribute('x1', p.x);
                    line.setAttribute('y1', p.y);
                    line.setAttribute('x2', p.cpIn.x);
                    line.setAttribute('y2', p.cpIn.y);
                    line.setAttribute('class', 'control-line');
                    this.handlesLayer.appendChild(line);
                    
                    const handle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
                    handle.setAttribute('cx', p.cpIn.x);
                    handle.setAttribute('cy', p.cpIn.y);
                    handle.setAttribute('r', 5);
                    handle.setAttribute('class', 'control-handle');
                    handle.setAttribute('fill', '#fff');
                    handle.setAttribute('stroke', '#667eea');
                    handle.setAttribute('stroke-width', 2);
                    handle.dataset.pathId = path.id;
                    handle.dataset.pointIndex = i;
                    handle.dataset.cpType = 'in';
                    this.handlesLayer.appendChild(handle);
                }
                
                if (p.cpOut && i < path.points.length - 1) {
                    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
                    line.setAttribute('x1', p.x);
                    line.setAttribute('y1', p.y);
                    line.setAttribute('x2', p.cpOut.x);
                    line.setAttribute('y2', p.cpOut.y);
                    line.setAttribute('class', 'control-line');
                    this.handlesLayer.appendChild(line);
                    
                    const handle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
                    handle.setAttribute('cx', p.cpOut.x);
                    handle.setAttribute('cy', p.cpOut.y);
                    handle.setAttribute('r', 5);
                    handle.setAttribute('class', 'control-handle');
                    handle.setAttribute('fill', '#fff');
                    handle.setAttribute('stroke', '#667eea');
                    handle.setAttribute('stroke-width', 2);
                    handle.dataset.pathId = path.id;
                    handle.dataset.pointIndex = i;
                    handle.dataset.cpType = 'out';
                    this.handlesLayer.appendChild(handle);
                }
                
                const anchor = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
                anchor.setAttribute('cx', p.x);
                anchor.setAttribute('cy', p.y);
                anchor.setAttribute('r', 6);
                anchor.setAttribute('class', 'anchor-point');
                anchor.setAttribute('fill', p.type === 'bezier' ? '#667eea' : '#52c41a');
                anchor.setAttribute('stroke', '#fff');
                anchor.setAttribute('stroke-width', 2);
                anchor.dataset.pathId = path.id;
                anchor.dataset.pointIndex = i;
                
                if (this.selectedAnchor && this.selectedAnchor.pathId === path.id && this.selectedAnchor.pointIndex === i) {
                    anchor.classList.add('selected');
                }
                
                this.handlesLayer.appendChild(anchor);
            }
        }
    }
    
    getSVGSource(includeAnimations = true, includeControls = false) {
        let svg = '<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600" viewBox="0 0 800 600">\n';
        svg += '  <rect width="800" height="600" fill="#fafafa" stroke="#ddd" stroke-width="1"/>\n';
        
        for (const path of this.paths) {
            if (path.points.length >= 2) {
                svg += `  <path d="${pathPointsToD(path.points, path.closed)}" fill="none" stroke="${path.color}" stroke-width="3" stroke-linecap="round"/>\n`;
            }
        }
        
        if (includeAnimations && window.animationEngine) {
            const smil = window.exporter.getSMILAnimation();
            if (smil) {
                svg += smil + '\n';
            }
        }
        
        svg += '</svg>';
        return svg;
    }
}
