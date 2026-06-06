class App {
    constructor() {
        this.svg = document.getElementById('main-canvas');
        this.pathsLayer = document.getElementById('paths-layer');
        this.handlesLayer = document.getElementById('handles-layer');
        this.objectsLayer = document.getElementById('objects-layer');
        this.particlesLayer = document.getElementById('particles-layer');
        
        this.pathEditor = new PathEditor(this.svg, this.pathsLayer, this.handlesLayer);
        this.animationEngine = new AnimationEngine(this.objectsLayer, this.pathEditor);
        this.timeline = new Timeline(document.querySelector('.timeline-container'), this.animationEngine, this.pathEditor);
        this.exporter = new Exporter(this.animationEngine, this.pathEditor);
        
        this.editingObjectId = null;
        this.selectedObjectId = null;
        this.editingGroupId = null;
        
        window.pathEditor = this.pathEditor;
        window.animationEngine = this.animationEngine;
        window.exporter = this.exporter;
        window.app = this;
        
        this.init();
    }
    
    init() {
        this.bindEvents();
        this.loadDefaultDemo();
        this.setupTabSwitching();
        this.updateSource();
    }
    
    loadDefaultDemo() {
        this.pathEditor.clearAll();
        
        this.pathEditor.loadPreset('heart');
        const heartPathId = this.pathEditor.currentPathId;
        
        const colors = ['#ff6b6b', '#4facfe', '#52c41a', '#ffa502', '#a55eea'];
        const objectIds = [];
        
        for (let i = 0; i < 5; i++) {
            const obj = this.animationEngine.createObject({
                name: `圆点 ${i + 1}`,
                type: 'circle',
                color: colors[i],
                size: 20,
                pathId: heartPathId,
                startTime: 0,
                duration: 5,
                speed: 1,
                easing: 'linear',
                loop: 'repeat',
                orientToPath: true,
                trail: true,
                trailShape: 'circle',
                trailDensity: 25,
                trailLifetime: 0.8,
                trailLength: 60,
                trailSize: 4,
                trailFade: 'ease-out'
            });
            objectIds.push(obj.id);
        }
        
        const demoGroup = this.animationEngine.createGroup({
            name: '心形长龙',
            objectIds: objectIds,
            duration: 5,
            phase: 0,
            spacingMode: 'arc',
            spacing: 5,
            reverse: false,
            mirrorH: false,
            mirrorV: false,
            trail: true,
            expanded: true
        });
        
        this.updateObjectsList();
        this.updatePathSelectors();
        this.updateGroupSelectors();
        this.timeline.update();
        this.animationEngine.render();
        this.updateSource();
        
        setTimeout(() => {
            this.animationEngine.play();
        }, 500);
    }
    
    bindEvents() {
        document.getElementById('btn-play').addEventListener('click', () => {
            this.animationEngine.play();
        });
        
        document.getElementById('btn-pause').addEventListener('click', () => {
            this.animationEngine.pause();
        });
        
        document.getElementById('btn-reset').addEventListener('click', () => {
            this.animationEngine.reset();
            this.timeline.updatePlayhead(0);
        });
        
        document.getElementById('btn-reverse-play').addEventListener('click', () => {
            this.animationEngine.startReversePlay();
        });
        
        document.getElementById('btn-create-group').addEventListener('click', () => {
            this.openGroupModal();
        });
        
        document.getElementById('tool-select').addEventListener('click', () => {
            this.setActiveTool('select', 'tool-select');
        });
        
        document.getElementById('tool-add').addEventListener('click', () => {
            this.setActiveTool('add', 'tool-add');
        });
        
        document.getElementById('tool-delete').addEventListener('click', () => {
            this.setActiveTool('delete', 'tool-delete');
        });
        
        document.getElementById('path-type').addEventListener('change', (e) => {
            this.pathEditor.setPathType(e.target.value);
        });
        
        document.getElementById('btn-load-preset').addEventListener('click', () => {
            const preset = document.getElementById('preset-paths').value;
            if (preset) {
                this.pathEditor.loadPreset(preset);
                this.updatePathSelectors();
                this.updateObjectsList();
                this.timeline.update();
                this.updateSource();
                document.getElementById('preset-paths').value = '';
            }
        });
        
        document.getElementById('btn-clear-path').addEventListener('click', () => {
            if (confirm('确定要清空当前路径吗？')) {
                this.pathEditor.clearCurrentPath();
                this.updateSource();
            }
        });
        
        document.getElementById('btn-add-object').addEventListener('click', () => {
            if (this.pathEditor.paths.filter(p => p.points.length >= 2).length === 0) {
                alert('请先创建至少一条路径！');
                return;
            }
            this.openObjectModal();
        });
        
        document.getElementById('modal-cancel').addEventListener('click', () => {
            this.closeObjectModal();
        });
        
        document.getElementById('modal-save').addEventListener('click', () => {
            this.saveObjectFromModal();
        });
        
        document.getElementById('obj-trail').addEventListener('change', (e) => {
            const trailOptions = document.getElementById('trail-options');
            if (e.target.checked) {
                trailOptions.classList.remove('hidden');
            } else {
                trailOptions.classList.add('hidden');
            }
        });
        
        document.getElementById('obj-size').addEventListener('input', (e) => {
            document.getElementById('obj-size-value').textContent = e.target.value;
        });
        
        document.getElementById('obj-speed').addEventListener('input', (e) => {
            document.getElementById('obj-speed-value').textContent = parseFloat(e.target.value).toFixed(1);
        });
        
        document.getElementById('obj-trail-density').addEventListener('input', (e) => {
            document.getElementById('obj-trail-density-value').textContent = e.target.value;
        });
        
        document.getElementById('obj-trail-lifetime').addEventListener('input', (e) => {
            document.getElementById('obj-trail-lifetime-value').textContent = parseFloat(e.target.value).toFixed(1);
        });
        
        document.getElementById('obj-trail-length').addEventListener('input', (e) => {
            document.getElementById('obj-trail-length-value').textContent = e.target.value;
        });
        
        document.getElementById('obj-trail-size').addEventListener('input', (e) => {
            document.getElementById('obj-trail-size-value').textContent = e.target.value;
        });
        
        document.getElementById('group-modal-cancel').addEventListener('click', () => {
            this.closeGroupModal();
        });
        
        document.getElementById('group-modal-save').addEventListener('click', () => {
            this.saveGroupFromModal();
        });
        
        document.getElementById('group-modal-delete').addEventListener('click', () => {
            if (this.editingGroupId && confirm('确定要删除这个组吗？组内对象不会被删除。')) {
                this.animationEngine.deleteGroup(this.editingGroupId);
                this.closeGroupModal();
                this.updateObjectsList();
                this.updateGroupSelectors();
                this.timeline.update();
                this.animationEngine.render();
                this.updateSource();
            }
        });
        
        document.getElementById('group-phase').addEventListener('input', (e) => {
            document.getElementById('group-phase-value').textContent = parseFloat(e.target.value).toFixed(2);
        });
        
        document.getElementById('show-anim-source').addEventListener('change', () => this.updateSource());
        document.getElementById('show-controls-source').addEventListener('change', () => this.updateSource());
        
        document.getElementById('btn-export-smil').addEventListener('click', () => {
            this.exporter.exportSMIL();
        });
        
        document.getElementById('btn-export-css').addEventListener('click', () => {
            this.exporter.exportCSS();
        });
        
        document.getElementById('btn-export-js').addEventListener('click', () => {
            this.exporter.exportJS();
        });
        
        this.animationEngine.onTimeUpdate = (time) => {
            this.timeline.updatePlayhead(time);
        };
        
        document.addEventListener('keydown', (e) => {
            if (e.code === 'Space' && !e.target.matches('input, textarea, select')) {
                e.preventDefault();
                if (this.animationEngine.playing) {
                    this.animationEngine.pause();
                } else {
                    this.animationEngine.play();
                }
            }
            if (e.code === 'KeyR' && !e.target.matches('input, textarea, select')) {
                this.animationEngine.reset();
                this.timeline.updatePlayhead(0);
            }
        });
        
        setInterval(() => this.updateSource(), 1000);
    }
    
    setActiveTool(tool, buttonId) {
        this.pathEditor.setTool(tool);
        document.querySelectorAll('.btn-tool').forEach(btn => btn.classList.remove('active'));
        document.getElementById(buttonId).classList.add('active');
    }
    
    setupTabSwitching() {
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const tab = btn.dataset.tab;
                document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
                document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
                btn.classList.add('active');
                document.getElementById('tab-' + tab).classList.add('active');
                
                if (tab === 'timeline') {
                    this.timeline.update();
                }
                if (tab === 'source') {
                    this.updateSource();
                }
            });
        });
    }
    
    updatePathSelectors() {
        const select = document.getElementById('obj-path');
        select.innerHTML = '';
        
        const validPaths = this.pathEditor.paths.filter(p => p.points.length >= 2);
        validPaths.forEach(path => {
            const option = document.createElement('option');
            option.value = path.id;
            option.textContent = path.name;
            select.appendChild(option);
        });
        
        if (validPaths.length > 0) {
            select.value = validPaths[0].id;
        }
    }
    
    updateGroupSelectors() {
        const select = document.getElementById('obj-group');
        select.innerHTML = '<option value="">-- 无组 --</option>';
        
        this.animationEngine.groups.forEach(group => {
            const option = document.createElement('option');
            option.value = group.id;
            option.textContent = group.name;
            select.appendChild(option);
        });
    }
    
    openObjectModal(objId = null) {
        this.editingObjectId = objId;
        const modal = document.getElementById('object-modal');
        modal.classList.remove('hidden');
        
        this.updatePathSelectors();
        this.updateGroupSelectors();
        
        const trailCheckbox = document.getElementById('obj-trail');
        const trailOptions = document.getElementById('trail-options');
        
        if (objId) {
            document.getElementById('modal-title').textContent = '编辑动画对象';
            const obj = this.animationEngine.objects.find(o => o.id === objId);
            if (obj) {
                document.getElementById('obj-name').value = obj.name;
                document.getElementById('obj-type').value = obj.type;
                document.getElementById('obj-color').value = obj.color;
                document.getElementById('obj-size').value = obj.size;
                document.getElementById('obj-size-value').textContent = obj.size;
                document.getElementById('obj-path').value = obj.pathId;
                document.getElementById('obj-start').value = obj.startTime;
                document.getElementById('obj-duration').value = obj.duration;
                document.getElementById('obj-speed').value = obj.speed;
                document.getElementById('obj-speed-value').textContent = obj.speed.toFixed(1);
                document.getElementById('obj-easing').value = obj.easing;
                document.getElementById('obj-loop').value = obj.loop;
                document.getElementById('obj-orient').checked = obj.orientToPath;
                document.getElementById('obj-group').value = obj.groupId || '';
                
                trailCheckbox.checked = obj.trail;
                if (obj.trail) {
                    trailOptions.classList.remove('hidden');
                } else {
                    trailOptions.classList.add('hidden');
                }
                
                document.getElementById('obj-trail-shape').value = obj.trailShape;
                document.getElementById('obj-trail-density').value = obj.trailDensity;
                document.getElementById('obj-trail-density-value').textContent = obj.trailDensity;
                document.getElementById('obj-trail-lifetime').value = obj.trailLifetime;
                document.getElementById('obj-trail-lifetime-value').textContent = parseFloat(obj.trailLifetime).toFixed(1);
                document.getElementById('obj-trail-length').value = obj.trailLength;
                document.getElementById('obj-trail-length-value').textContent = obj.trailLength;
                document.getElementById('obj-trail-size').value = obj.trailSize;
                document.getElementById('obj-trail-size-value').textContent = obj.trailSize;
                document.getElementById('obj-trail-fade').value = obj.trailFade;
            }
        } else {
            document.getElementById('modal-title').textContent = '添加动画对象';
            document.getElementById('obj-name').value = '对象 ' + (this.animationEngine.objects.length + 1);
            document.getElementById('obj-type').value = 'circle';
            document.getElementById('obj-color').value = '#ff6b6b';
            document.getElementById('obj-size').value = 20;
            document.getElementById('obj-size-value').textContent = '20';
            document.getElementById('obj-start').value = 0;
            document.getElementById('obj-duration').value = 3;
            document.getElementById('obj-speed').value = 1;
            document.getElementById('obj-speed-value').textContent = '1.0';
            document.getElementById('obj-easing').value = 'linear';
            document.getElementById('obj-loop').value = 'none';
            document.getElementById('obj-orient').checked = true;
            document.getElementById('obj-group').value = '';
            
            trailCheckbox.checked = false;
            trailOptions.classList.add('hidden');
            
            document.getElementById('obj-trail-shape').value = 'circle';
            document.getElementById('obj-trail-density').value = 20;
            document.getElementById('obj-trail-density-value').textContent = '20';
            document.getElementById('obj-trail-lifetime').value = 1;
            document.getElementById('obj-trail-lifetime-value').textContent = '1.0';
            document.getElementById('obj-trail-length').value = 50;
            document.getElementById('obj-trail-length-value').textContent = '50';
            document.getElementById('obj-trail-size').value = 3;
            document.getElementById('obj-trail-size-value').textContent = '3';
            document.getElementById('obj-trail-fade').value = 'linear';
        }
    }
    
    closeObjectModal() {
        document.getElementById('object-modal').classList.add('hidden');
        this.editingObjectId = null;
    }
    
    saveObjectFromModal() {
        const groupId = document.getElementById('obj-group').value || null;
        const trailEnabled = document.getElementById('obj-trail').checked;
        
        const data = {
            name: document.getElementById('obj-name').value || '未命名对象',
            type: document.getElementById('obj-type').value,
            color: document.getElementById('obj-color').value,
            size: parseInt(document.getElementById('obj-size').value),
            pathId: document.getElementById('obj-path').value,
            startTime: parseFloat(document.getElementById('obj-start').value) || 0,
            duration: parseFloat(document.getElementById('obj-duration').value) || 3,
            speed: parseFloat(document.getElementById('obj-speed').value) || 1,
            easing: document.getElementById('obj-easing').value,
            loop: document.getElementById('obj-loop').value,
            orientToPath: document.getElementById('obj-orient').checked,
            groupId: groupId,
            trail: trailEnabled,
            trailShape: document.getElementById('obj-trail-shape').value,
            trailDensity: parseInt(document.getElementById('obj-trail-density').value),
            trailLifetime: parseFloat(document.getElementById('obj-trail-lifetime').value),
            trailLength: parseInt(document.getElementById('obj-trail-length').value),
            trailSize: parseInt(document.getElementById('obj-trail-size').value),
            trailFade: document.getElementById('obj-trail-fade').value
        };
        
        if (this.editingObjectId) {
            this.animationEngine.updateObject(this.editingObjectId, data);
        } else {
            this.animationEngine.createObject(data);
        }
        
        this.closeObjectModal();
        this.updateObjectsList();
        this.updateGroupSelectors();
        this.timeline.update();
        this.animationEngine.render();
        this.updateSource();
    }
    
    openGroupModal(groupId = null) {
        this.editingGroupId = groupId;
        const modal = document.getElementById('group-modal');
        modal.classList.remove('hidden');
        
        const deleteBtn = document.getElementById('group-modal-delete');
        
        if (groupId) {
            document.getElementById('group-modal-title').textContent = '编辑组';
            deleteBtn.classList.remove('hidden');
            
            const group = this.animationEngine.groups.find(g => g.id === groupId);
            if (group) {
                document.getElementById('group-name').value = group.name;
                document.getElementById('group-duration').value = group.duration;
                document.getElementById('group-phase').value = group.phase;
                document.getElementById('group-phase-value').textContent = parseFloat(group.phase).toFixed(2);
                document.getElementById('group-spacing-mode').value = group.spacingMode;
                document.getElementById('group-spacing').value = group.spacing;
                document.getElementById('group-reverse').checked = group.reverse;
                document.getElementById('group-mirror-h').checked = group.mirrorH;
                document.getElementById('group-mirror-v').checked = group.mirrorV;
                document.getElementById('group-trail').checked = group.trail;
            }
        } else {
            document.getElementById('group-modal-title').textContent = '创建组';
            deleteBtn.classList.add('hidden');
            
            document.getElementById('group-name').value = '组 ' + (this.animationEngine.groups.length + 1);
            document.getElementById('group-duration').value = 5;
            document.getElementById('group-phase').value = 0;
            document.getElementById('group-phase-value').textContent = '0.00';
            document.getElementById('group-spacing-mode').value = 'arc';
            document.getElementById('group-spacing').value = 5;
            document.getElementById('group-reverse').checked = false;
            document.getElementById('group-mirror-h').checked = false;
            document.getElementById('group-mirror-v').checked = false;
            document.getElementById('group-trail').checked = false;
        }
        
        this.renderGroupObjectsCheckboxes(groupId);
    }
    
    renderGroupObjectsCheckboxes(groupId = null) {
        const container = document.getElementById('group-objects-checkboxes');
        container.innerHTML = '';
        
        const selectedIds = groupId 
            ? (this.animationEngine.groups.find(g => g.id === groupId)?.objectIds || [])
            : [];
        
        const ungroupedObjects = this.animationEngine.objects.filter(o => !o.groupId || o.groupId === groupId);
        
        if (ungroupedObjects.length === 0) {
            container.innerHTML = '<div style="color:#999;padding:10px;text-align:center;">暂无可用对象，请先创建动画对象</div>';
            return;
        }
        
        ungroupedObjects.forEach(obj => {
            const label = document.createElement('label');
            const isChecked = selectedIds.includes(obj.id);
            label.innerHTML = `
                <input type="checkbox" value="${obj.id}" ${isChecked ? 'checked' : ''}>
                <span class="object-color-dot" style="background:${obj.color};display:inline-block;width:10px;height:10px;border-radius:50%;margin:0 6px;"></span>
                ${obj.name}
            `;
            container.appendChild(label);
        });
    }
    
    closeGroupModal() {
        document.getElementById('group-modal').classList.add('hidden');
        this.editingGroupId = null;
    }
    
    saveGroupFromModal() {
        const checkboxes = document.querySelectorAll('#group-objects-checkboxes input[type="checkbox"]:checked');
        const objectIds = Array.from(checkboxes).map(cb => cb.value);
        
        const data = {
            name: document.getElementById('group-name').value || '未命名组',
            duration: parseFloat(document.getElementById('group-duration').value) || 5,
            phase: parseFloat(document.getElementById('group-phase').value) || 0,
            spacingMode: document.getElementById('group-spacing-mode').value,
            spacing: parseInt(document.getElementById('group-spacing').value) || 5,
            reverse: document.getElementById('group-reverse').checked,
            mirrorH: document.getElementById('group-mirror-h').checked,
            mirrorV: document.getElementById('group-mirror-v').checked,
            trail: document.getElementById('group-trail').checked,
            objectIds: objectIds
        };
        
        if (this.editingGroupId) {
            this.animationEngine.updateGroup(this.editingGroupId, data);
        } else {
            this.animationEngine.createGroup(data);
        }
        
        this.closeGroupModal();
        this.updateObjectsList();
        this.updateGroupSelectors();
        this.timeline.update();
        this.animationEngine.render();
        this.updateSource();
    }
    
    selectObject(objId) {
        this.selectedObjectId = objId;
        this.updateObjectsList();
        
        const obj = this.animationEngine.objects.find(o => o.id === objId);
        if (obj) {
            this.animationEngine.setTime(obj.startTime);
            this.timeline.updatePlayhead(obj.startTime);
        }
    }
    
    editGroup(groupId) {
        this.openGroupModal(groupId);
    }
    
    toggleGroupExpand(groupId) {
        const group = this.animationEngine.groups.find(g => g.id === groupId);
        if (group) {
            group.expanded = !group.expanded;
            this.updateObjectsList();
            this.timeline.update();
        }
    }
    
    updateObjectsList() {
        const container = document.getElementById('objects-list');
        container.innerHTML = '';
        
        if (this.animationEngine.objects.length === 0) {
            container.innerHTML = '<div style="text-align:center;color:#999;padding:30px;">暂无动画对象，点击"添加动画对象"按钮创建</div>';
            return;
        }
        
        const processedGroups = new Set();
        
        for (const obj of this.animationEngine.objects) {
            if (obj.groupId && !processedGroups.has(obj.groupId)) {
                const group = this.animationEngine.groups.find(g => g.id === obj.groupId);
                if (group) {
                    processedGroups.add(group.id);
                    this.renderGroupItem(container, group);
                }
            } else if (!obj.groupId) {
                this.renderObjectItem(container, obj);
            }
        }
    }
    
    renderGroupItem(container, group) {
        const item = document.createElement('div');
        item.className = 'object-item group-item';
        
        const header = document.createElement('div');
        header.className = 'group-header';
        header.innerHTML = `
            <div class="object-name">
                <span class="group-toggle" data-action="toggle-group" data-id="${group.id}">${group.expanded ? '▼' : '▶'}</span>
                <span class="object-color-dot" style="background: linear-gradient(135deg, #667eea, #764ba2)"></span>
                <span>${group.name}</span>
                <span class="group-badge">${group.objectIds.length}个对象</span>
            </div>
            <div class="object-actions">
                <button class="btn btn-small" data-action="edit-group" data-id="${group.id}">编辑组</button>
            </div>
        `;
        item.appendChild(header);
        
        const info = document.createElement('div');
        info.className = 'object-info';
        info.innerHTML = `
            <span>时长: ${group.duration.toFixed(1)}s</span>
            <span>相位: ${group.phase.toFixed(2)}</span>
            <span>间隔: ${group.spacingMode === 'arc' ? '等弧长' : '等时间'}</span>
            <span>${group.reverse ? '反向' : '正向'}</span>
            ${group.mirrorH ? '<span>水平翻转</span>' : ''}
            ${group.mirrorV ? '<span>垂直翻转</span>' : ''}
            ${group.trail ? '<span style="color:#52c41a;">粒子尾迹</span>' : ''}
        `;
        item.appendChild(info);
        
        if (group.expanded) {
            const children = document.createElement('div');
            children.className = 'group-children';
            
            group.objectIds.forEach((objId, index) => {
                const childObj = this.animationEngine.objects.find(o => o.id === objId);
                if (childObj) {
                    this.renderObjectItem(children, childObj, true, index);
                }
            });
            
            item.appendChild(children);
        }
        
        header.querySelectorAll('[data-action]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const action = btn.dataset.action;
                const id = btn.dataset.id;
                
                if (action === 'edit-group') {
                    this.editGroup(id);
                } else if (action === 'toggle-group') {
                    this.toggleGroupExpand(id);
                }
            });
        });
        
        container.appendChild(item);
    }
    
    renderObjectItem(container, obj, isChild = false, childIndex = 0) {
        const path = this.pathEditor.paths.find(p => p.id === obj.pathId);
        const pathName = path ? path.name : '未绑定';
        
        const item = document.createElement('div');
        item.className = 'object-item' + (this.selectedObjectId === obj.id ? ' selected' : '');
        
        const group = obj.groupId ? this.animationEngine.groups.find(g => g.id === obj.groupId) : null;
        const effectiveDuration = group ? group.duration : (obj.duration / obj.speed);
        
        item.innerHTML = `
            <div class="object-header">
                <div class="object-name">
                    ${isChild ? `<span style="display:inline-block;width:12px;"></span>` : ''}
                    <span class="object-color-dot" style="background:${obj.color}"></span>
                    <span>${isChild ? (childIndex + 1) + '. ' : ''}${obj.name}</span>
                    ${obj.trail || (group && group.trail) ? '<span style="color:#52c41a;font-size:10px;">✦尾迹</span>' : ''}
                </div>
                <div class="object-actions">
                    <button class="btn btn-small" data-action="edit" data-id="${obj.id}">编辑</button>
                    <button class="btn btn-small btn-danger" data-action="delete" data-id="${obj.id}">删除</button>
                </div>
            </div>
            <div class="object-info">
                <span>类型: ${this.getObjectTypeLabel(obj.type)}</span>
                <span>路径: ${pathName}</span>
                <span>开始: ${obj.startTime.toFixed(1)}s</span>
                <span>时长: ${effectiveDuration.toFixed(1)}s</span>
                <span>缓动: ${this.getEasingLabel(obj.easing)}</span>
                <span>循环: ${this.getLoopLabel(obj.loop)}</span>
            </div>
        `;
        
        item.querySelectorAll('[data-action]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const action = btn.dataset.action;
                const id = btn.dataset.id;
                
                if (action === 'edit') {
                    this.openObjectModal(id);
                } else if (action === 'delete') {
                    if (confirm('确定要删除这个动画对象吗？')) {
                        this.animationEngine.deleteObject(id);
                        if (this.selectedObjectId === id) this.selectedObjectId = null;
                        this.updateObjectsList();
                        this.updateGroupSelectors();
                        this.timeline.update();
                        this.animationEngine.render();
                        this.updateSource();
                    }
                }
            });
        });
        
        item.addEventListener('click', () => {
            this.selectObject(obj.id);
        });
        
        container.appendChild(item);
    }
    
    getObjectTypeLabel(type) {
        const labels = {
            circle: '圆形',
            square: '方形',
            triangle: '三角形',
            diamond: '菱形',
            star: '星形'
        };
        return labels[type] || type;
    }
    
    getEasingLabel(easing) {
        const labels = {
            linear: '线性',
            ease: '缓动',
            'ease-in': '缓入',
            'ease-out': '缓出',
            'ease-in-out': '缓入缓出',
            bounce: '弹跳',
            elastic: '弹性'
        };
        return labels[easing] || easing;
    }
    
    getLoopLabel(loop) {
        const labels = {
            none: '不循环',
            repeat: '重复',
            alternate: '往返'
        };
        return labels[loop] || loop;
    }
    
    updateSource() {
        const includeAnim = document.getElementById('show-anim-source').checked;
        const includeControls = document.getElementById('show-controls-source').checked;
        
        const source = this.pathEditor.getSVGSource(includeAnim, includeControls);
        document.getElementById('svg-source').value = source;
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new App();
});
