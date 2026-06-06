class Timeline {
    constructor(container, animationEngine, pathEditor) {
        this.container = container;
        this.scaleContainer = document.getElementById('timeline-scale');
        this.tracksContainer = document.getElementById('timeline-tracks');
        this.animationEngine = animationEngine;
        this.pathEditor = pathEditor;
        this.pixelsPerSecond = 100;
        this.draggingBlock = null;
        this.dragStartTime = 0;
        this.dragStartX = 0;
        
        this.init();
    }
    
    init() {
        this.renderScale();
        this.renderTracks();
        this.bindEvents();
    }
    
    renderScale() {
        const duration = this.animationEngine.totalDuration;
        this.scaleContainer.innerHTML = '';
        this.scaleContainer.style.width = (duration * this.pixelsPerSecond) + 'px';
        
        for (let t = 0; t <= duration; t += 0.5) {
            if (t % 1 === 0) {
                const label = document.createElement('div');
                label.style.position = 'absolute';
                label.style.left = (t * this.pixelsPerSecond) + 'px';
                label.style.top = '0';
                label.style.fontSize = '11px';
                label.style.color = '#666';
                label.style.transform = 'translateX(-50%)';
                label.textContent = t.toFixed(0) + 's';
                this.scaleContainer.appendChild(label);
            }
            
            const tick = document.createElement('div');
            tick.style.position = 'absolute';
            tick.style.left = (t * this.pixelsPerSecond) + 'px';
            tick.style.top = t % 1 === 0 ? '18px' : '22px';
            tick.style.width = '1px';
            tick.style.height = t % 1 === 0 ? '8px' : '4px';
            tick.style.background = '#ccc';
            this.scaleContainer.appendChild(tick);
        }
    }
    
    renderTracks() {
        this.tracksContainer.innerHTML = '';
        
        const processedGroups = new Set();
        
        for (const obj of this.animationEngine.objects) {
            if (obj.groupId && !processedGroups.has(obj.groupId)) {
                const group = this.animationEngine.groups.find(g => g.id === obj.groupId);
                if (group) {
                    processedGroups.add(group.id);
                    this.renderGroupTrack(group);
                }
            } else if (!obj.groupId) {
                this.renderObjectTrack(obj);
            }
        }
        
        const playhead = document.createElement('div');
        playhead.className = 'timeline-playhead';
        playhead.id = 'timeline-playhead';
        playhead.style.left = (this.animationEngine.currentTime * this.pixelsPerSecond) + 'px';
        this.tracksContainer.appendChild(playhead);
    }
    
    renderGroupTrack(group) {
        const track = document.createElement('div');
        track.className = 'timeline-track group-track';
        track.dataset.groupId = group.id;
        
        const label = document.createElement('div');
        label.className = 'timeline-track-label';
        label.innerHTML = `
            <span class="group-toggle" data-group-id="${group.id}">${group.expanded ? '▼' : '▶'}</span>
            <span class="object-color-dot" style="background: linear-gradient(135deg, #667eea, #764ba2)"></span>
            <span>${group.name} <span class="group-badge">${group.objectIds.length}个</span></span>
        `;
        track.appendChild(label);
        
        const content = document.createElement('div');
        content.className = 'timeline-track-content';
        content.style.width = (this.animationEngine.totalDuration * this.pixelsPerSecond) + 'px';
        
        const block = document.createElement('div');
        block.className = 'timeline-block';
        block.dataset.groupId = group.id;
        block.style.left = '0px';
        block.style.width = (group.duration * this.pixelsPerSecond) + 'px';
        block.style.background = 'linear-gradient(135deg, #667eea, #764ba2)';
        block.textContent = `${group.name} (${group.duration.toFixed(1)}s)`;
        
        content.appendChild(block);
        track.appendChild(content);
        this.tracksContainer.appendChild(track);
        
        if (group.expanded) {
            group.objectIds.forEach((objId, index) => {
                const obj = this.animationEngine.objects.find(o => o.id === objId);
                if (obj) {
                    this.renderObjectTrack(obj, true, index);
                }
            });
        }
        
        const toggleBtn = label.querySelector('.group-toggle');
        toggleBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            group.expanded = !group.expanded;
            this.update();
        });
    }
    
    renderObjectTrack(obj, isChild = false, childIndex = 0) {
        const track = document.createElement('div');
        track.className = 'timeline-track' + (isChild ? ' child-track' : '');
        if (isChild) {
            track.dataset.parentGroupId = obj.groupId;
        }
        
        const label = document.createElement('div');
        label.className = 'timeline-track-label';
        
        if (isChild) {
            label.innerHTML = `
                <span style="display:inline-block;width:12px;"></span>
                <span class="object-color-dot" style="background:${obj.color}"></span>
                <span>${childIndex + 1}. ${obj.name}</span>
            `;
        } else {
            label.innerHTML = `
                <span class="object-color-dot" style="background:${obj.color}"></span>
                <span>${obj.name}</span>
            `;
        }
        track.appendChild(label);
        
        const content = document.createElement('div');
        content.className = 'timeline-track-content';
        content.style.width = (this.animationEngine.totalDuration * this.pixelsPerSecond) + 'px';
        
        const group = obj.groupId ? this.animationEngine.groups.find(g => g.id === obj.groupId) : null;
        const duration = group ? group.duration : (obj.duration / obj.speed);
        const startTime = group ? 0 : obj.startTime;
        
        const block = document.createElement('div');
        block.className = 'timeline-block';
        block.dataset.objId = obj.id;
        block.style.left = (startTime * this.pixelsPerSecond) + 'px';
        block.style.width = (duration * this.pixelsPerSecond) + 'px';
        block.style.background = `linear-gradient(135deg, ${obj.color}99, ${obj.color})`;
        block.textContent = `${obj.name} (${duration.toFixed(1)}s)`;
        
        if (isChild) {
            block.style.opacity = '0.7';
        }
        
        content.appendChild(block);
        track.appendChild(content);
        this.tracksContainer.appendChild(track);
    }
    
    updatePlayhead(time) {
        const playhead = document.getElementById('timeline-playhead');
        if (playhead) {
            playhead.style.left = (time * this.pixelsPerSecond) + 'px';
        }
    }
    
    bindEvents() {
        this.tracksContainer.addEventListener('mousedown', (e) => {
            const block = e.target.closest('.timeline-block');
            if (block && block.dataset.objId) {
                const objId = block.dataset.objId;
                const obj = this.animationEngine.objects.find(o => o.id === objId);
                if (obj && !obj.groupId) {
                    this.draggingBlock = { obj, block };
                    this.dragStartTime = obj.startTime;
                    this.dragStartX = e.clientX;
                    block.classList.add('dragging');
                    e.preventDefault();
                    
                    if (window.app) {
                        window.app.selectObject(objId);
                    }
                }
            }
        });
        
        document.addEventListener('mousemove', (e) => {
            if (!this.draggingBlock) return;
            
            const dx = e.clientX - this.dragStartX;
            const dt = dx / this.pixelsPerSecond;
            let newStartTime = Math.max(0, this.dragStartTime + dt);
            
            const obj = this.draggingBlock.obj;
            const effectiveDuration = obj.duration / obj.speed;
            const maxStart = this.animationEngine.totalDuration - effectiveDuration;
            newStartTime = Math.min(newStartTime, maxStart);
            
            obj.startTime = Math.round(newStartTime * 10) / 10;
            this.draggingBlock.block.style.left = (obj.startTime * this.pixelsPerSecond) + 'px';
            
            if (window.app) {
                window.app.updateObjectsList();
            }
        });
        
        document.addEventListener('mouseup', () => {
            if (this.draggingBlock) {
                this.draggingBlock.block.classList.remove('dragging');
                this.draggingBlock = null;
                this.animationEngine.render();
            }
        });
        
        this.tracksContainer.addEventListener('click', (e) => {
            if (e.target.closest('.timeline-block')) return;
            if (e.target.closest('.group-toggle')) return;
            
            const rect = this.tracksContainer.getBoundingClientRect();
            const labelWidth = 100;
            const x = e.clientX - rect.left - labelWidth;
            if (x >= 0) {
                const time = x / this.pixelsPerSecond;
                this.animationEngine.setTime(Math.max(0, Math.min(this.animationEngine.totalDuration, time)));
                this.updatePlayhead(this.animationEngine.currentTime);
            }
        });
    }
    
    update() {
        this.renderScale();
        this.renderTracks();
        this.updatePlayhead(this.animationEngine.currentTime);
    }
}
